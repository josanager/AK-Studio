"""HTTP/job state tests; no GPU, network, credentials or paid inference."""
import importlib.util
import os
import sys
import time
import uuid
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from modal.exception import TimeoutError as ModalTimeout
from processor import modal_service as service

service.jobs, service.controls, service.progress_events = {}, {}, {}
spawned, cancelled = [], []


class Call:
    object_id = "test-call"
    def get(self, timeout=0):
        raise ModalTimeout("Still running")
    def cancel(self, terminate_containers=False):
        cancelled.append(terminate_containers)


def spawn(*args):
    spawned.append(args)
    return Call()


service.SeparatorGPU = lambda: SimpleNamespace(separate=SimpleNamespace(spawn=spawn))
service.modal.FunctionCall = SimpleNamespace(from_id=lambda _: Call())
os.environ["MODAL_SHARED_SECRET"] = "test-only"
client = TestClient(service.api.local())
headers = {"authorization": "Bearer test-only"}
assert client.get("/health").status_code == 401
assert client.get("/health", headers=headers).json()["gpu"] == ["L4", "A10", "T4"]
job, gen = str(uuid.uuid4()), str(uuid.uuid4())
url = "https://akstudiovocal.com/api/audio/stems/transfer?token=test"
body = {"jobId": job, "generation": gen, "audioUrl": url, "uploads": {"lead": url, "backing": url}}
bad = {**body, "audioUrl": "http://127.0.0.1/private"}
assert client.post("/process", json=bad, headers=headers).status_code == 400
assert client.post("/process", json=body, headers=headers).status_code == 202
assert client.post("/process", json=body, headers=headers).status_code == 202
assert len(spawned) == 1, "Reconnect must not duplicate inference"
assert client.get(f"/job/{job}", headers=headers).json()["status"] == "queued"
assert client.post(f"/job/{job}/cancel", headers=headers).json()["status"] == "cancelled"
assert cancelled == [True], "Cancellation must terminate GPU work"
assert not service.update(job, gen, status="ready"), "Cancelled work cannot publish ready"
assert client.get(f"/job/{job}", headers=headers).json()["status"] == "cancelled"
new_gen = str(uuid.uuid4())
assert client.post("/process", json={**body, "generation": new_gen}, headers=headers).status_code == 202
assert len(spawned) == 2
assert not service.update(job, gen, status="ready"), "Stale worker cannot overwrite retry"
assert service.update(job, new_gen, status="ready", manifest={"generation": new_gen, "duration": 10})
service.progress_events[service.control_key(job, new_gen)] = {"progress": 50}
assert client.get(f"/job/{job}", headers=headers).json()["manifest"]["generation"] == new_gen
assert client.get(f"/job/{job}", headers=headers).json()["status"] == "ready", "Late progress cannot overwrite completion"
failed_job = str(uuid.uuid4())
assert client.post("/process", json={**body, "jobId": failed_job}, headers=headers).status_code == 202
class FailedCall(Call):
    def get(self, timeout=0):
        raise RuntimeError("GPU startup failed")
service.modal.FunctionCall = SimpleNamespace(from_id=lambda _: FailedCall())
assert client.get(f"/job/{failed_job}", headers=headers).json()["status"] == "error"
assert service.jobs[failed_job]["status"] == "error", "Failed startup cannot occupy the queue forever"
service.modal.FunctionCall = SimpleNamespace(from_id=lambda _: Call())
for _ in range(8):
    jid = str(uuid.uuid4())
    service.jobs[jid] = {"status": "queued", "generation": gen, "createdAt": time.time()}
assert client.post("/process", json={**body, "jobId": str(uuid.uuid4())}, headers=headers).status_code == 429
print("PASS: authenticated API, SSRF rejection, pending polling, dedup, cancellation, retry isolation and bounded queue. No inference.")
