import json
import os
import queue
import re
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path


class JobCancelled(Exception):
    pass


class WarmSeparator:
    def __init__(self, model):
        self.model = model
        self.process = None
        self.messages = None
        self.loaded = False
        self.worker_path = Path(__file__).with_name("inference_worker.py")

    def stop(self):
        process, self.process = self.process, None
        self.loaded = False
        if process:
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait(timeout=10)
            for pipe in (process.stdin, process.stdout):
                if pipe:
                    pipe.close()

    def start(self):
        self.stop()
        environment = {**os.environ, "PYTHONUNBUFFERED": "1", "OMP_DYNAMIC": "FALSE",
                       "SEPARATOR_MODEL": self.model}
        for name in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
            environment[name] = "4"
        process = subprocess.Popen([sys.executable, "-u", str(self.worker_path)],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   start_new_session=True, env=environment, bufsize=0)
        messages = queue.Queue()
        def collect():
            pending = b""
            try:
                while True:
                    chunk = os.read(process.stdout.fileno(), 4096)
                    if not chunk:
                        break
                    lines = re.split(b"[\r\n]", pending + chunk)
                    pending = lines.pop()
                    for line in lines:
                        if line:
                            messages.put(line.decode("utf-8", "replace"))
                if pending:
                    messages.put(pending.decode("utf-8", "replace"))
            except (OSError, ValueError):
                pass
            finally:
                messages.put(None)
        threading.Thread(target=collect, daemon=True).start()
        self.process, self.messages = process, messages

    def run(self, source, output_dir, cancelled, on_progress, timeout=1800):
        if cancelled.is_set():
            raise JobCancelled("Separation cancelled.")
        if self.process is None or self.process.poll() is not None:
            self.start()
        self.process.stdin.write((json.dumps({"source": str(source), "output": str(output_dir)}) + "\n").encode())
        self.process.stdin.flush()
        deadline, recent = time.monotonic() + timeout, []
        try:
            while True:
                if cancelled.is_set():
                    raise JobCancelled("Separation cancelled.")
                if time.monotonic() > deadline:
                    raise RuntimeError("Vocal separation timed out. Please retry.")
                try:
                    line = self.messages.get(timeout=.2)
                except queue.Empty:
                    continue
                if line is None:
                    raise RuntimeError(recent[-1] if recent else "The separator stopped. Please retry.")
                recent.append(line)
                del recent[:-20]
                if line.startswith("AK_RESULT:"):
                    result = json.loads(line[len("AK_RESULT:"):])
                    if not result.get("ok"):
                        raise RuntimeError(result.get("error") or "Vocal separation failed.")
                    self.loaded = True
                    return
                match = re.search(r"(?:^|\s)(\d{1,3})%\|", line)
                if match:
                    on_progress(20 + round(min(100, int(match.group(1))) * .65), "Separating lead vocal…")
        except BaseException:
            self.stop()
            raise
