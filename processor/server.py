import base64
import json
import os
import shutil
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "m.youtube.com"}

class Handler(BaseHTTPRequestHandler):
    server_version = "AKAudioProcessor/1.0"

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200); self.end_headers(); self.wfile.write(b"ok")
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/download":
            return self.send_error(404)
        try:
            length = min(int(self.headers.get("content-length", "0")), 8192)
            payload = json.loads(self.rfile.read(length))
            url = str(payload.get("url", ""))
            if urlparse(url).hostname not in ALLOWED_HOSTS:
                return self.respond_error(400, "Only public YouTube and YouTube Music links are supported.")
            with tempfile.TemporaryDirectory(prefix="ak-audio-") as directory:
                output = os.path.join(directory, "source.%(ext)s")
                command = ["yt-dlp", "--no-playlist", "--retries", "5", "--fragment-retries", "5",
                    "--extractor-retries", "3", "--socket-timeout", "25",
                    "--retry-sleep", "http:linear=1:3", "--retry-sleep", "fragment:exp=1:8",
                    "--js-runtimes", "deno", "-f", "bestaudio/best", "-x", "--audio-format", "flac",
                    "--audio-quality", "0", "--embed-metadata", "--write-info-json", "-o", output, url]
                result = subprocess.run(command, capture_output=True, text=True, timeout=900)
                if result.returncode:
                    message = next((line for line in reversed(result.stderr.splitlines()) if line.strip()), "The song could not be downloaded.")
                    return self.respond_error(422, message[:420])
                audio_path = os.path.join(directory, "source.flac")
                info_path = os.path.join(directory, "source.info.json")
                if not os.path.isfile(audio_path):
                    return self.respond_error(502, "The processor did not produce an audio file.")
                info = {}
                if os.path.isfile(info_path):
                    with open(info_path, "r", encoding="utf-8") as source:
                        raw = json.load(source)
                    info = {"title": raw.get("track") or raw.get("title"), "artist": raw.get("artist") or raw.get("uploader"), "album": raw.get("album"), "duration": raw.get("duration")}
                metadata = base64.urlsafe_b64encode(json.dumps(info, ensure_ascii=True).encode()).decode()
                size = os.path.getsize(audio_path)
                self.send_response(200)
                self.send_header("content-type", "audio/flac")
                self.send_header("content-length", str(size))
                self.send_header("x-ak-metadata", metadata)
                self.end_headers()
                with open(audio_path, "rb") as audio:
                    shutil.copyfileobj(audio, self.wfile, length=1024 * 1024)
        except subprocess.TimeoutExpired:
            self.respond_error(504, "The audio download timed out.")
        except Exception as error:
            self.respond_error(500, str(error)[:420])

    def respond_error(self, status, message):
        body = message.encode("utf-8", "replace")
        self.send_response(status); self.send_header("content-type", "text/plain; charset=utf-8")
        self.send_header("content-length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(json.dumps({"message": fmt % args}), flush=True)

ThreadingHTTPServer(("0.0.0.0", int(os.getenv("PORT", "8080"))), Handler).serve_forever()
