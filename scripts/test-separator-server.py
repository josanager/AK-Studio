"""HTTP regression: one inference at a time, cancellation and retries."""
import importlib.util
import json
import sys
import threading
import time
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "processor"))
spec = importlib.util.spec_from_file_location("separator_server", Path(__file__).resolve().parents[1] / "processor/server.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
calls, running, maximum = [], 0, 0


def fake_job(self, payload, download_only):
    global running, maximum
    job_id = payload["jobId"]
    running += 1
    maximum = max(maximum, running)
    calls.append(job_id)
    try:
        deadline = time.monotonic() + (5 if payload.get("wait") else .2)
        while time.monotonic() < deadline:
            if module.JOB_CANCEL[job_id].is_set():
                raise module.JobCancelled()
            time.sleep(.01)
        if payload.get("fail") and calls.count(job_id) == 1:
            raise RuntimeError("Transient test failure")
        return {"files": {"lead": "lead", "backing": "backing"}}
    finally:
        running -= 1


module.Handler.perform_job = fake_job
server = module.ThreadingHTTPServer(("127.0.0.1", 0), module.Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_port}"


def post(path, body=None):
    req = urllib.request.Request(base + path, data=json.dumps(body or {}).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as response:
        return response.status, json.load(response)


def start(job_id, **extra):
    return post("/process", {"jobId": job_id, "audioUrl": "https://stored.example/audio", **extra})


def status(job_id):
    with urllib.request.urlopen(base + "/job/" + job_id) as response:
        return json.load(response)["status"]


def wait(job_id, expected):
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        if status(job_id) == expected:
            return
        time.sleep(.02)
    raise AssertionError(f"{job_id} did not reach {expected}")


try:
    first, second = str(uuid.uuid4()), str(uuid.uuid4())
    assert start(first)[0] == 202
    assert start(first)[0] == 202
    assert start(second)[0] == 202
    post(f"/job/{second}/cancel")
    wait(first, "ready")
    assert calls.count(first) == 1 and second not in calls
    assert status(second) == "cancelled"
    failed = str(uuid.uuid4())
    start(failed, fail=True)
    wait(failed, "error")
    start(failed, fail=True)
    wait(failed, "ready")
    assert calls.count(failed) == 2
    active = str(uuid.uuid4())
    start(active, wait=True)
    wait(active, "processing")
    post(f"/job/{active}/cancel")
    wait(active, "cancelled")
    after = str(uuid.uuid4())
    start(after)
    wait(after, "ready")
    assert maximum == 1
    print("PASS: idempotent starts, serial queue, queued/active cancellation, failed-job retry and next-job recovery.")
finally:
    server.shutdown()
