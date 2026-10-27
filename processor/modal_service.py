"""AK Studio: authenticated job control + serial, scale-to-zero GPU worker.

Audio never lives in a Modal Volume. Read/write capabilities point to R2 via
Cloudflare and expire after one hour. Dicts contain only job status, not audio.
"""
import contextlib
import hmac
import os
import re
import tempfile
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

import modal
from processor.modal_benchmark import image as model_image, MODEL, PARAMS

app = modal.App("ak-studio-separator-gpu")
jobs = modal.Dict.from_name("ak-studio-gpu-jobs-v1", create_if_missing=True)
controls = modal.Dict.from_name("ak-studio-gpu-controls-v1", create_if_missing=True)
progress_events = modal.Dict.from_name("ak-studio-gpu-progress-v1", create_if_missing=True)
uuid = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def checked_url(value):
    if not isinstance(value, str) or len(value) > 3000:
        raise ValueError("Invalid transfer URL")
    url = urlsplit(value)
    if (url.scheme != "https" or url.hostname not in {"akstudiovocal.com", "www.akstudiovocal.com"}
            or url.port not in (None, 443) or url.username or url.password
            or url.path != "/api/audio/stems/transfer" or not url.query.startswith("token=") or url.fragment):
        raise ValueError("Invalid transfer URL")
    return value


def control_key(job_id, generation):
    return job_id + ":" + generation


def cancelled(job_id, generation):
    record = jobs.get(job_id, {})
    return record.get("generation") != generation or controls.get(control_key(job_id, generation), {}).get("cancelled", False)


def update(job_id, generation, **values):
    if cancelled(job_id, generation):
        return False
    record = jobs.get(job_id, {})
    jobs[job_id] = {**record, **values, "updatedAt": time.time()}
    return True


class Progress:
    def __init__(self, job_id, generation):
        self.job_id, self.generation = job_id, generation
        self.latest = None
        self.stop = threading.Event()

    def __enter__(self):
        def report():
            last = None
            while not self.stop.wait(1.5):
                value = self.latest
                if value is not None and value != last:
                    try:
                        # Never block CUDA inference on remote status storage.
                        # Separate key: a late update cannot overwrite ready/cancelled.
                        progress_events[control_key(self.job_id, self.generation)] = {"progress": value}
                        last = value
                    except Exception:
                        pass
        self.thread = threading.Thread(target=report, daemon=True)
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.stop.set()
        self.thread.join(timeout=2)

    def write(self, text):
        match = re.search(r"(\d{1,3})%\|", text)
        if match:
            self.latest = 20 + round(min(100, int(match.group(1))) * .65)
        return len(text)

    def flush(self):
        pass


@app.cls(image=model_image.add_local_python_source("processor"), gpu=["L4", "A10", "T4"], cpu=4,
         memory=12288, timeout=900, max_containers=1, min_containers=0,
         scaledown_window=60, retries=0)
class SeparatorGPU:
    @modal.enter()
    def load(self):
        import torch
        from audio_separator.separator import Separator
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA GPU unavailable")
        torch.set_num_threads(4)
        torch.set_num_interop_threads(1)
        torch.backends.cuda.matmul.allow_tf32 = False
        torch.backends.cudnn.allow_tf32 = False
        self.separator = Separator(model_file_dir="/models", output_dir="/tmp/ak-stems",
                                   output_format="FLAC", use_autocast=False, mdxc_params=PARAMS)
        self.separator.load_model(model_filename=MODEL)
        if self.separator.torch_device.type != "cuda":
            raise RuntimeError("Refusing CPU fallback")

    @modal.method()
    def separate(self, job_id, generation, audio_url, uploads):
        import requests
        import soundfile as sf
        try:
            if not update(job_id, generation, status="processing", progress=12, message="Loading stored audio from Cloudflare…"):
                return
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source = root / "original.wav"
                download_started = time.perf_counter()
                with requests.get(checked_url(audio_url), headers={"User-Agent": "AK-Studio-Processor/1.0"}, stream=True, timeout=(15, 60), allow_redirects=False) as response:
                    response.raise_for_status()
                    extension = {"audio/flac": ".flac", "audio/ogg": ".ogg", "audio/mpeg": ".mp3",
                                 "audio/mp4": ".m4a", "video/mp4": ".m4a", "audio/webm": ".webm"}.get(response.headers.get("content-type", "").split(";")[0], ".wav")
                    source = root / ("original" + extension)
                    total = 0
                    with source.open("wb") as output:
                        for chunk in response.iter_content(1024 * 1024):
                            total += len(chunk)
                            if total > 250 * 1024 * 1024:
                                raise ValueError("Audio too large")
                            output.write(chunk)
                download_seconds = time.perf_counter() - download_started
                # Cancellation terminates the native call; validate generation again
                # before compute, without two synchronous Dict RPCs per MiB downloaded.
                if cancelled(job_id, generation):
                    return
                # ffprobe handles AAC/MP4 originals as well as FLAC/OGG.
                import json
                import subprocess
                probe = json.loads(subprocess.check_output([
                    "ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "json", str(source)], timeout=30))
                duration = float(probe["format"]["duration"])
                if not 0 < duration <= 1200:
                    raise ValueError("Invalid audio duration")
                self.separator.output_dir = str(root)
                self.separator.model_instance.output_dir = str(root)
                update(job_id, generation, status="processing", progress=20, message="Separating lead vocal on the cloud GPU…")
                with Progress(job_id, generation) as progress:
                    with contextlib.redirect_stderr(progress):
                        separation_started = time.perf_counter()
                        names = self.separator.separate(str(source), custom_output_names={
                            "Vocals": "lead", "Instrumental": "backing",
                            "Lead Vocals": "lead", "Backing Vocals": "backing"})
                        separation_seconds = time.perf_counter() - separation_started
                paths = {Path(name).stem: Path(name) if Path(name).is_absolute() else root / name for name in names}
                if set(paths) != {"lead", "backing"}:
                    raise RuntimeError("Incomplete stems")
                pair_info = [sf.info(paths[stem]) for stem in ("lead", "backing")]
                if (pair_info[0].frames != pair_info[1].frames
                        or pair_info[0].samplerate != pair_info[1].samplerate):
                    raise RuntimeError("Separated tracks do not share a sample timeline")
                for stem, path in paths.items():
                    info = sf.info(path)
                    if abs(info.duration - duration) > 1 or info.frames <= 0 or path.stat().st_size > 95 * 1024 * 1024:
                        raise RuntimeError("Invalid output")
                    if not update(job_id, generation, status="processing", progress=90, message="Saving separated tracks to Cloudflare…"):
                        return
                    for attempt in range(3):
                        if cancelled(job_id, generation):
                            return
                        try:
                            with path.open("rb") as audio:
                                response = requests.put(checked_url(uploads[stem]), data=audio,
                                                        headers={"content-type": "audio/flac", "User-Agent": "AK-Studio-Processor/1.0"},
                                                        timeout=(15, 120), allow_redirects=False)
                                response.raise_for_status()
                            break
                        except requests.RequestException:
                            if attempt == 2:
                                raise
                            time.sleep(2)
                update(job_id, generation, status="ready", progress=100,
                       manifest={"generation": generation, "duration": duration,
                                 "separationSeconds": round(separation_seconds, 3),
                                 "downloadSeconds": round(download_seconds, 3)}, message="Separated tracks are ready")
        except Exception as error:
            # Never print signed transfer URLs, user data or raw request errors.
            print("Separation failed:", type(error).__name__, flush=True)
            update(job_id, generation, status="error", message="Vocal separation failed. Please retry.")


api_image = modal.Image.debian_slim(python_version="3.12").pip_install("fastapi==0.115.6").add_local_python_source("processor")


@app.function(image=api_image, secrets=[modal.Secret.from_name("ak-studio-cloudflare")],
              cpu=.25, memory=256, max_containers=1, min_containers=0,
              scaledown_window=300, timeout=120)
@modal.asgi_app()
def api():
    from fastapi import FastAPI, Request, HTTPException
    from fastapi.responses import JSONResponse
    from modal.exception import TimeoutError as ModalTimeout

    web = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @web.middleware("http")
    async def authentication(request: Request, call_next):
        expected = "Bearer " + os.environ["MODAL_SHARED_SECRET"]
        if not hmac.compare_digest(request.headers.get("authorization", ""), expected):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        return await call_next(request)

    def status(job_id):
        record = jobs.get(job_id)
        if not record or time.time() - record.get("createdAt", 0) > 86400:
            raise HTTPException(404, "Job expired")
        control = controls.get(control_key(job_id, record["generation"]), {})
        if control.get("cancelled"):
            return {**record, "status": "cancelled", "message": "Separation cancelled."}
        if record["status"] in {"queued", "processing"} and control.get("callId"):
            try:
                modal.FunctionCall.from_id(control["callId"]).get(timeout=0)
                if record["status"] != "ready":
                    record = jobs.get(job_id, record)
                    if record["status"] in {"queued", "processing"}:
                        record = {**record, "status": "error", "message": "Vocal separation stopped. Please retry."}
            except (TimeoutError, ModalTimeout):
                pass
            except Exception:
                record = {**record, "status": "error", "message": "The cloud GPU could not finish. Please retry."}
            if record["status"] == "error":
                current = jobs.get(job_id, {})
                if current.get("generation") == record["generation"] and current.get("status") in {"queued", "processing"}:
                    jobs[job_id] = {**record, "updatedAt": time.time()}
        if record["status"] == "processing" and record.get("progress", 0) <= 85:
            progress = progress_events.get(control_key(job_id, record["generation"]), {})
            if progress.get("progress", 0) > record.get("progress", 0):
                record = {**record, **progress, "message": "Separating lead vocal on the cloud GPU…"}
        return record

    @web.get("/health")
    def health():
        return {"service": "ak-studio-modal", "gpu": ["L4", "A10", "T4"], "model": MODEL, "protocol": 1}

    @web.post("/process")
    def start(body: dict):
        job_id, generation = body.get("jobId", ""), body.get("generation", "")
        if not isinstance(job_id, str) or not uuid.fullmatch(job_id) or not isinstance(generation, str) or not uuid.fullmatch(generation):
            raise HTTPException(400, "Invalid job")
        existing = jobs.get(job_id)
        if existing and time.time() - existing.get("createdAt", 0) < 86400:
            existing = status(job_id)
            if existing["status"] not in {"error", "cancelled"}:
                return JSONResponse(existing, status_code=202)
        try:
            audio_url = checked_url(body["audioUrl"])
            uploads = {stem: checked_url(body["uploads"][stem]) for stem in ("lead", "backing")}
        except (KeyError, TypeError, ValueError):
            raise HTTPException(400, "Invalid transfers")
        active = sum(1 for jid, item in jobs.items() if item.get("status") in {"queued", "processing"}
                     and time.time() - item.get("createdAt", 0) < 1200
                     and not controls.get(control_key(jid, item["generation"]), {}).get("cancelled"))
        if active >= 8:
            raise HTTPException(429, "The separator queue is full")
        record = {"status": "queued", "generation": generation, "progress": 5,
                  "message": "Waiting for the cloud GPU… You can keep editing or cancel.", "createdAt": time.time()}
        jobs[job_id] = record
        ck = control_key(job_id, generation)
        controls[ck] = {"cancelled": False}
        try:
            call = SeparatorGPU().separate.spawn(job_id, generation, audio_url, uploads)
            controls[ck] = {"cancelled": False, "callId": call.object_id}
        except Exception:
            jobs[job_id] = {**record, "status": "error"}
            raise HTTPException(503, "The cloud GPU could not start")
        return JSONResponse(record, status_code=202)

    @web.get("/job/{job_id}")
    def get_job(job_id: str):
        return status(job_id)

    @web.post("/job/{job_id}/cancel")
    def cancel(job_id: str):
        record = jobs.get(job_id)
        if not record:
            return {"status": "cancelled"}
        if record["status"] == "ready":
            return {"status": "ready"}
        ck = control_key(job_id, record["generation"])
        control = controls.get(ck, {})
        controls[ck] = {**control, "cancelled": True}
        if control.get("callId"):
            modal.FunctionCall.from_id(control["callId"]).cancel(terminate_containers=True)
        jobs[job_id] = {**record, "status": "cancelled", "message": "Separation cancelled."}
        return {"status": "cancelled"}

    return web
