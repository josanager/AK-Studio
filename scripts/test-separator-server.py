"""Stdlib-only HTTP orchestration test; never runs real audio inference."""
import importlib.util
import json
import threading
import time
import urllib.request
import uuid
from pathlib import Path

spec = importlib.util.spec_from_file_location("separator_server", Path(__file__).resolve().parents[1] / "processor/server.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
calls = []


def fake_job(self, payload, download_only):
    calls.append(payload["jobId"])
    time.sleep(0.1)
    return {"files": {"lead": "lead", "backing": "backing"}}


module.Handler.perform_job = fake_job
server = module.ThreadingHTTPServer(("127.0.0.1", 0), module.Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_port}"
job = str(uuid.uuid4())


def start(job_id):
    request = urllib.request.Request(base + "/process", data=json.dumps({"jobId": job_id, "audioUrl": "https://stored.example/audio"}).encode(),
                                     headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request) as response:
        return response.status, json.load(response)


try:
    assert start(job)[0] == 202
    assert start(job)[0] == 202
    try:
        start(str(uuid.uuid4()))
        raise AssertionError("Concurrent inference should be rejected")
    except urllib.error.HTTPError as error:
        assert error.code == 429
    time.sleep(0.2)
    with urllib.request.urlopen(base + "/job/" + job) as response:
        result = json.load(response)
    assert result["status"] == "ready" and len(calls) == 1
    print("PASS: immediate 202, duplicate start runs once, concurrency limit, ready polling. No inference executed.")
finally:
    server.shutdown()
