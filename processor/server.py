import json
import os
import queue
import re
import shutil
import signal
import subprocess
import time
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from warm_separator import WarmSeparator, JobCancelled

ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "m.youtube.com"}
MODEL = os.getenv("SEPARATOR_MODEL", "model_bs_roformer_ep_317_sdr_12.9755.ckpt")
JOBS_ROOT = Path(os.getenv("JOBS_ROOT", "/tmp/ak-studio-jobs"))
TTL_SECONDS = 24 * 60 * 60
JOB_LOCKS = [threading.Lock() for _ in range(64)]
ACTIVE_JOBS = {}
ACTIVE_LOCK = threading.Lock()
JOB_CANCEL = {}
SEPARATION_QUEUE = queue.Queue(maxsize=8)
QUEUE_THREAD = None
WARM_SEPARATOR = WarmSeparator(MODEL)


def ensure_queue_worker():
    global QUEUE_THREAD
    if QUEUE_THREAD is None or not QUEUE_THREAD.is_alive():
        def consume():
            while True:
                task = SEPARATION_QUEUE.get()
                try:
                    task()
                finally:
                    SEPARATION_QUEUE.task_done()
        QUEUE_THREAD = threading.Thread(target=consume, daemon=True)
        QUEUE_THREAD.start()


def update_job_progress(job_id, value, message):
    with ACTIVE_LOCK:
        job = ACTIVE_JOBS.get(job_id)
        if job and job.get("status") == "processing":
            job.update(progress=max(job.get("progress", 5), min(88, value)),
                       message=message, updatedAt=time.time())


def run_separation(command, timeout, job_id):
    """Stream real audio-separator progress from both stdout and stderr."""
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               start_new_session=True, bufsize=0)
    output = []

    def read_output():
        pending = b""
        while True:
            chunk = os.read(process.stdout.fileno(), 4096)
            if not chunk:
                break
            pending += chunk
            lines = re.split(b"[\r\n]", pending)
            pending = lines.pop()
            for line in lines:
                text = line.decode("utf-8", "replace")
                output.append(text)
                del output[:-30]
                match = re.search(rb"(?:^|\s)(\d{1,3})%\|", line)
                if match:
                    percent = min(100, int(match.group(1)))
                    update_job_progress(job_id, 20 + round(percent * 0.65),
                                        "Separating lead vocal…")

    reader = threading.Thread(target=read_output, daemon=True)
    reader.start()
    deadline = time.monotonic() + timeout
    try:
        while process.poll() is None:
            if time.monotonic() > deadline:
                raise RuntimeError("Vocal separation timed out. Try a shorter song.")
            time.sleep(0.2)
        reader.join(timeout=2)
        if process.returncode:
            message = next((line for line in reversed(output) if line.strip()),
                           "Vocal separation failed.")
            raise RuntimeError(message[:500])
    finally:
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=10)
        process.stdout.close()




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


def run_download(command, timeout, on_progress=None):
    """Run yt-dlp with newline progress and keep its long request observable."""
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        start_new_session=True,
    )
    lines = queue.Queue()

    def collect_output():
        try:
            for line in process.stdout:
                lines.put(line)
        finally:
            lines.put(None)

    reader = threading.Thread(target=collect_output, daemon=True)
    reader.start()
    output = []
    last_percent = -1
    deadline = time.monotonic() + timeout
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise subprocess.TimeoutExpired(command, timeout)
            try:
                line = lines.get(timeout=min(1, remaining))
            except queue.Empty:
                if process.poll() is not None:
                    break
                continue
            if line is None:
                break

            output.append(line.rstrip())
            del output[:-40]
            match = re.search(r"AK_PROGRESS:\s*([0-9]+(?:\.[0-9]+)?)%", line)
            if not match:
                match = re.search(r"\[download\]\s+([0-9]+(?:\.[0-9]+)?)%", line)
            if match and on_progress:
                percent = max(0, min(100, round(float(match.group(1)))))
                if percent != last_percent:
                    last_percent = percent
                    on_progress(percent)

        return_code = process.wait(timeout=max(1, deadline - time.monotonic()))
        if return_code:
            message = next((line for line in reversed(output) if line.strip()), "Audio download failed.")
            raise RuntimeError(message[:500])
    except BaseException:
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
        raise
    finally:
        if process.stdout:
            process.stdout.close()


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
    vocals = next((p for p in files if p.stem == "lead"), None)
    instrumental = next((p for p in files if p.stem == "backing"), None)
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
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path == "/health":
            with ACTIVE_LOCK:
                active = sum(job.get("status") in ("processing", "queued", "cancelling") for job in ACTIVE_JOBS.values())
            return self.respond_json(200, {"ok": True, "model": MODEL, "activeJobs": active,
                                           "modelLoaded": WARM_SEPARATOR.loaded, "serviceVersion": "repair-20261020"})
        job = re.fullmatch(r"/job/([0-9a-f-]{36})", self.path)
        if job:
            with ACTIVE_LOCK:
                status = ACTIVE_JOBS.get(job.group(1))
            return self.respond_json(200 if status else 404, status or {"status": "missing"})
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
        cancel = re.fullmatch(r"/job/([0-9a-f-]{36})/cancel", self.path)
        if cancel:
            job_id = cancel.group(1)
            with ACTIVE_LOCK:
                event = JOB_CANCEL.get(job_id)
                job = ACTIVE_JOBS.get(job_id)
                if event and job and job.get("status") in ("queued", "processing", "cancelling"):
                    event.set()
                    job["status"] = "cancelled" if job["status"] == "queued" else "cancelling"
                    job["message"] = "Cancelling separation…"
            return self.respond_json(200, {"status": "cancelled"})
        if self.path not in ("/process", "/download"):
            return self.send_error(404)
        download_only = self.path == "/download"
        length = min(int(self.headers.get("content-length", "0")), 16384)
        try:
            payload = json.loads(self.rfile.read(length))
        except (ValueError, TypeError):
            return self.respond_error(400, "Invalid request.")
        job_id = str(payload.get("jobId", ""))
        if not re.fullmatch(r"[0-9a-f-]{36}", job_id):
            return self.respond_error(400, "Invalid processing job.")
        if not download_only:
            with ACTIVE_LOCK:
                existing = ACTIVE_JOBS.get(job_id)
                if existing and existing.get("status") in ("processing", "queued", "ready", "cancelling"):
                    return self.respond_json(202, {"status": existing["status"], "jobId": job_id})
                if SEPARATION_QUEUE.full():
                    return self.respond_error(429, "The separation queue is full. Try again shortly.")
                cancelled = threading.Event()
                JOB_CANCEL[job_id] = cancelled
                ACTIVE_JOBS[job_id] = {"status": "queued", "startedAt": time.time(), "progress": 5, "message": "Waiting for the vocal separator…"}
            def work():
                with ACTIVE_LOCK:
                    if JOB_CANCEL.get(job_id) is not cancelled or cancelled.is_set():
                        return
                    ACTIVE_JOBS[job_id].update(status="processing", progress=8, message="Preparing stored audio…")
                try:
                    manifest = self.perform_job(payload, False)
                    if cancelled.is_set():
                        raise JobCancelled("Separation cancelled.")
                    result = {"status": "ready", "manifest": manifest}
                except JobCancelled:
                    result = {"status": "cancelled"}
                except Exception as error:
                    result = {"status": "error", "error": str(error)[:500]}
                with ACTIVE_LOCK:
                    if JOB_CANCEL.get(job_id) is cancelled:
                        ACTIVE_JOBS[job_id] = result
            try:
                SEPARATION_QUEUE.put_nowait(work)
            except queue.Full:
                with ACTIVE_LOCK:
                    ACTIVE_JOBS.pop(job_id, None)
                    JOB_CANCEL.pop(job_id, None)
                return self.respond_error(429, "The separation queue is full. Try again shortly.")
            with ACTIVE_LOCK:
                ensure_queue_worker()
            return self.respond_json(202, {"status": "queued", "jobId": job_id})
        with ACTIVE_LOCK:
            ACTIVE_JOBS[job_id] = {"status": "processing", "startedAt": time.time()}
        self.begin_ndjson()
        heartbeat_stop = threading.Event()
        def heartbeat():
            while not heartbeat_stop.wait(10):
                self.send_ndjson({"status": "working", "message": "Preparing audio source…"})
        threading.Thread(target=heartbeat, daemon=True).start()
        try:
            self.send_ndjson({"status": "progress", "progress": 0})
            manifest = self.perform_job(
                payload,
                True,
                lambda percent: self.send_ndjson({"status": "progress", "progress": percent}),
            )
            self.send_ndjson({"status": "ready", "manifest": manifest})
        except Exception as error:
            self.send_ndjson({"status": "error", "error": str(error)[:500]})
        finally:
            heartbeat_stop.set()
            self.finish_ndjson()
            with ACTIVE_LOCK:
                ACTIVE_JOBS.pop(job_id, None)

    def perform_job(self, payload, download_only, on_download_progress=None):
        job_lock = None
        try:
            cleanup_jobs()
            url = str(payload.get("url", "") or "")
            audio_url = str(payload.get("audioUrl", "") or "")
            job_id = str(payload.get("jobId", ""))
            if not re.fullmatch(r"[0-9a-f-]{36}", job_id):
                raise ValueError("Invalid processing job.")

            has_youtube = bool(url) and urlparse(url).hostname in ALLOWED_HOSTS
            has_audio = bool(audio_url) and urlparse(audio_url).scheme in ("http", "https")
            if not has_youtube and not has_audio:
                raise ValueError("Only public YouTube links or a stored audio URL are supported.")
            if download_only and not has_youtube:
                raise ValueError("Only public YouTube and YouTube Music links are supported.")

            job_dir = JOBS_ROOT / job_id
            job_lock = JOB_LOCKS[int(job_id.replace("-", ""), 16) % len(JOB_LOCKS)]
            job_lock.acquire()
            job_dir.mkdir(parents=True, exist_ok=True)
            manifest_path = job_dir / ("download.json" if download_only else "process.json")
            if manifest_path.is_file():
                cached = json.loads(manifest_path.read_text(encoding="utf-8"))
                if cached.get("source", "").split("&token=")[0] != (url or audio_url).split("&token=")[0]:
                    raise ValueError("This job belongs to another source.")
                return cached["manifest"]
            source = job_dir / "source.flac"
            info = {}

            if has_audio and not download_only:
                update_job_progress(job_id, 10, "Loading stored audio…")
                source = download_audio_url(audio_url, job_dir / "source")
            else:
                run_download([
                    "yt-dlp", "--no-playlist", "--retries", "5", "--fragment-retries", "5",
                    "--extractor-retries", "3", "--socket-timeout", "25",
                    "--retry-sleep", "http:linear=1:3", "--retry-sleep", "fragment:exp=1:8",
                    "--js-runtimes", "deno", "--newline", "--no-colors", "--progress", "--progress-delta", "1",
                    "--progress-template", "download:AK_PROGRESS:%(progress._percent_str)s",
                    "-f", "bestaudio/best", "-x", "--audio-format", "flac", "--audio-quality", "0",
                    "--embed-metadata", "--write-info-json", "-o", str(job_dir / "source.%(ext)s"), url,
                ], 900, on_download_progress)
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
                manifest = {**info, "bpm": None, "model": "full-mix", "files": files}
                manifest_path.write_text(json.dumps({"source": url, "manifest": manifest}), encoding="utf-8")
                return manifest

            # Check separator binary exists — download-only images fail clearly here.
            if not shutil.which("audio-separator"):
                raise RuntimeError("The vocal separation service is not installed. Full mix still plays.")

            separated = job_dir / "separated"
            separated.mkdir(exist_ok=True)
            update_job_progress(job_id, 20, "Loading vocal separation model…")
            WARM_SEPARATOR.run(source, separated, JOB_CANCEL[job_id],
                               lambda value, message: update_job_progress(job_id, value, message))
            update_job_progress(job_id, 88, "Preparing separated tracks…")
            lead, backing = find_stems(separated)
            shutil.move(source, job_dir / "original.flac")
            shutil.move(lead, job_dir / "lead.flac")
            shutil.move(backing, job_dir / "backing.flac")
            files = {stem: f"/file/{job_id}/{stem}" for stem in ("original", "backing", "lead")}
            # Tempo is already estimated in the editor. Re-running librosa here
            # adds an unrelated full-song analysis after inference has finished.
            manifest = {**info, "bpm": None, "model": "Mel-RoFormer Karaoke", "files": files}
            manifest_path.write_text(json.dumps({"source": url or audio_url, "manifest": manifest}), encoding="utf-8")
            return manifest
        except subprocess.TimeoutExpired:
            raise RuntimeError("Audio preparation timed out. Try a shorter song.")
        finally:
            if job_lock is not None and job_lock.locked():
                job_lock.release()

    def respond_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def begin_ndjson(self):
        self._ndjson_open = True
        self._ndjson_lock = threading.Lock()
        self.send_response(200)
        self.send_header("content-type", "application/x-ndjson; charset=utf-8")
        self.send_header("transfer-encoding", "chunked")
        self.send_header("cache-control", "no-store")
        self.end_headers()

    def send_ndjson(self, event):
        if not getattr(self, "_ndjson_open", False):
            return
        payload = json.dumps(event, separators=(",", ":")).encode("utf-8") + b"\n"
        try:
            with self._ndjson_lock:
                if not self._ndjson_open:
                    return
                self.wfile.write(f"{len(payload):X}\r\n".encode("ascii"))
                self.wfile.write(payload)
                self.wfile.write(b"\r\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            # Keep the backend download alive if the editor tab disconnects.
            self._ndjson_open = False

    def finish_ndjson(self):
        if not getattr(self, "_ndjson_open", False):
            return
        try:
            with self._ndjson_lock:
                self._ndjson_open = False
                self.wfile.write(b"0\r\n\r\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        self._ndjson_open = False

    def respond_error(self, status, message):
        body = message.encode("utf-8", "replace")
        self.send_response(status)
        self.send_header("content-type", "text/plain; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(json.dumps({"message": fmt % args}), flush=True)


if __name__ == "__main__":
    cleanup_jobs()
    ThreadingHTTPServer(("0.0.0.0", int(os.getenv("PORT", "8080"))), Handler).serve_forever()
