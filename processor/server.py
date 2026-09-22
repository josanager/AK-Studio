import json
import os
import re
import shutil
import subprocess
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "m.youtube.com"}
MODEL = os.getenv("SEPARATOR_MODEL", "model_bs_roformer_ep_317_sdr_12.9755.ckpt")
JOBS_ROOT = Path(os.getenv("JOBS_ROOT", "/tmp/ak-studio-jobs"))
TTL_SECONDS = 24 * 60 * 60


def cleanup_jobs():
    JOBS_ROOT.mkdir(parents=True, exist_ok=True)
    cutoff = time.time() - TTL_SECONDS
    for path in JOBS_ROOT.iterdir():
        try:
            if path.is_dir() and path.stat().st_mtime < cutoff:
                shutil.rmtree(path, ignore_errors=True)
        except OSError:
            pass


def run(command, timeout, binary=False):
    result = subprocess.run(command, capture_output=True, text=not binary, timeout=timeout)
    if result.returncode:
        stderr = result.stderr.decode("utf-8", "replace") if binary else result.stderr
        message = next((line for line in reversed(stderr.splitlines()) if line.strip()), "Processing failed.")
        raise RuntimeError(message[:500])
    return result


def detect_bpm(audio_path):
    try:
        import librosa
        samples, sample_rate = librosa.load(str(audio_path), sr=22050, mono=True, duration=600)
        tempo, _ = librosa.beat.beat_track(y=samples, sr=sample_rate)
        return round(float(tempo[0] if hasattr(tempo, "__len__") else tempo), 1)
    except Exception:
        return None


def find_stems(directory):
    files = list(Path(directory).glob("*.flac"))
    vocals = next((p for p in files if "vocal" in p.name.lower() and "instrument" not in p.name.lower()), None)
    instrumental = next((p for p in files if "instrument" in p.name.lower() or "no_vocal" in p.name.lower()), None)
    if not vocals or not instrumental:
        raise RuntimeError("The open-source separator did not produce both karaoke stems.")
    return vocals, instrumental


def download_audio_url(audio_url, dest: Path):
    parsed = urlparse(audio_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise RuntimeError("Invalid audio URL for stem separation.")
    req = urllib.request.Request(audio_url, headers={"user-agent": "AKAudioProcessor/2.0"})
    with urllib.request.urlopen(req, timeout=180) as response:
        content_type = (response.headers.get("content-type") or "").lower()
        suffix = ".flac"
        if "mpeg" in content_type or "mp3" in content_type:
            suffix = ".mp3"
        elif "mp4" in content_type or "m4a" in content_type or "aac" in content_type:
            suffix = ".m4a"
        elif "webm" in content_type:
            suffix = ".webm"
        elif "ogg" in content_type or "opus" in content_type:
            suffix = ".ogg"
        raw = dest.with_suffix(suffix)
        with raw.open("wb") as out:
            shutil.copyfileobj(response, out, length=1024 * 1024)
    if raw.suffix.lower() == ".flac":
        return raw
    flac = dest.with_suffix(".flac")
    run(["ffmpeg", "-y", "-i", str(raw), "-vn", "-c:a", "flac", str(flac)], 600)
    raw.unlink(missing_ok=True)
    return flac


class Handler(BaseHTTPRequestHandler):
    server_version = "AKAudioProcessor/2.0"

    def do_GET(self):
        if self.path == "/health":
            return self.respond_json(200, {"ok": True, "model": MODEL})
        match = re.fullmatch(r"/file/([0-9a-f-]{36})/(original|backing|lead)", self.path)
        if not match:
            return self.send_error(404)
        path = JOBS_ROOT / match.group(1) / f"{match.group(2)}.flac"
        if not path.is_file():
            return self.send_error(404)
        self.send_response(200)
        self.send_header("content-type", "audio/flac")
        self.send_header("content-length", str(path.stat().st_size))
        self.send_header("cache-control", "private, max-age=300")
        self.end_headers()
        with path.open("rb") as audio:
            shutil.copyfileobj(audio, self.wfile, length=1024 * 1024)

    def do_POST(self):
        if self.path not in ("/process", "/download"):
            return self.send_error(404)
        download_only = self.path == "/download"
        try:
            cleanup_jobs()
            length = min(int(self.headers.get("content-length", "0")), 16384)
            payload = json.loads(self.rfile.read(length))
            url = str(payload.get("url", "") or "")
            audio_url = str(payload.get("audioUrl", "") or "")
            job_id = str(payload.get("jobId", ""))
            if not re.fullmatch(r"[0-9a-f-]{36}", job_id):
                return self.respond_error(400, "Invalid processing job.")

            has_youtube = bool(url) and urlparse(url).hostname in ALLOWED_HOSTS
            has_audio = bool(audio_url) and urlparse(audio_url).scheme in ("http", "https")
            if not has_youtube and not has_audio:
                return self.respond_error(400, "Only public YouTube links or a stored audio URL are supported.")
            if download_only and not has_youtube:
                return self.respond_error(400, "Only public YouTube and YouTube Music links are supported.")

            job_dir = JOBS_ROOT / job_id
            job_dir.mkdir(parents=True, exist_ok=False)
            source = job_dir / "source.flac"
            info = {}

            if has_audio and not download_only:
                source = download_audio_url(audio_url, job_dir / "source")
            else:
                run(["yt-dlp", "--no-playlist", "--retries", "5", "--fragment-retries", "5", "--extractor-retries", "3", "--socket-timeout", "25", "--retry-sleep", "http:linear=1:3", "--retry-sleep", "fragment:exp=1:8", "--js-runtimes", "deno", "-f", "bestaudio/best", "-x", "--audio-format", "flac", "--audio-quality", "0", "--embed-metadata", "--write-info-json", "-o", str(job_dir / "source.%(ext)s"), url], 900)
                source = job_dir / "source.flac"
                info_path = job_dir / "source.info.json"
                if info_path.is_file():
                    raw = json.loads(info_path.read_text(encoding="utf-8"))
                    info = {
                        "title": raw.get("track") or raw.get("title"),
                        "artist": raw.get("artist") or raw.get("uploader"),
                        "duration": raw.get("duration"),
                    }

            if not source.is_file():
                raise RuntimeError("The downloader did not produce an audio file.")
            if download_only:
                shutil.move(source, job_dir / "original.flac")
                files = {"original": f"/file/{job_id}/original"}
                return self.respond_json(200, {**info, "bpm": None, "model": "full-mix", "files": files})

            # Check separator binary exists — download-only images fail clearly here.
            if not shutil.which("audio-separator"):
                raise RuntimeError("Stem separation needs the GPU processor. Full mix still plays.")

            separated = job_dir / "separated"
            separated.mkdir()
            run(["audio-separator", str(source), "--model_filename", MODEL, "--output_format", "FLAC", "--output_dir", str(separated), "--model_file_dir", "/models"], 3600)
            lead, backing = find_stems(separated)
            shutil.move(source, job_dir / "original.flac")
            shutil.move(lead, job_dir / "lead.flac")
            shutil.move(backing, job_dir / "backing.flac")
            files = {stem: f"/file/{job_id}/{stem}" for stem in ("original", "backing", "lead")}
            self.respond_json(200, {**info, "bpm": detect_bpm(job_dir / "original.flac"), "model": "BS-RoFormer", "files": files})
        except subprocess.TimeoutExpired:
            self.respond_error(504, "Audio preparation timed out. Try a shorter song.")
        except FileExistsError:
            self.respond_error(409, "This processing job already exists.")
        except Exception as error:
            self.respond_error(500, str(error)[:500])

    def respond_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def respond_error(self, status, message):
        body = message.encode("utf-8", "replace")
        self.send_response(status)
        self.send_header("content-type", "text/plain; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(json.dumps({"message": fmt % args}), flush=True)


cleanup_jobs()
ThreadingHTTPServer(("0.0.0.0", int(os.getenv("PORT", "8080"))), Handler).serve_forever()
