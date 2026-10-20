"""Exercise actual child processes without downloading a model."""
import importlib.util
import json
import tempfile
import threading
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location("warm_separator", Path(__file__).resolve().parents[1] / "processor/warm_separator.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
    engine = Path(directory) / "engine.py"
    engine.write_text('import sys,json,time\nfor line in sys.stdin:\n x=json.loads(line)\n if x["source"]=="wait": time.sleep(30)\n print(" 50%|test",flush=True)\n print("AK_RESULT:"+json.dumps({"ok":True}),flush=True)\n')
    worker = module.WarmSeparator("same-checkpoint.ckpt")
    worker.worker_path = engine
    updates = []
    try:
        worker.run("sample", directory, threading.Event(), lambda n,m: updates.append(n), timeout=3)
        first = worker.process.pid
        worker.run("sample-two", directory, threading.Event(), lambda n,m: None, timeout=3)
        assert worker.process.pid == first and worker.loaded
        assert updates and updates[0] > 20
        cancelled = threading.Event()
        timer = threading.Timer(.15, cancelled.set)
        timer.start()
        try:
            worker.run("wait", directory, cancelled, lambda n,m: None, timeout=3)
            raise AssertionError("Cancellation must stop inference")
        except module.JobCancelled:
            pass
        assert worker.process is None
        worker.run("sample-three", directory, threading.Event(), lambda n,m: None, timeout=3)
        assert worker.process.pid != first
        print("PASS: model process reused across jobs; cancellation terminates it; next request recovers.")
    finally:
        worker.stop()
