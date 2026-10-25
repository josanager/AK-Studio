"""Check GPU eligibility without building/downloading the separation model."""
import modal

app = modal.App("ak-studio-l4-eligibility")


@app.function(gpu="L4", cpu=.25, memory=256, timeout=30, retries=0,
              max_containers=1, min_containers=0, scaledown_window=2)
def probe():
    import subprocess
    return subprocess.check_output([
        "nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"
    ], text=True, timeout=10).strip()


@app.local_entrypoint()
def main(credits_verified: bool = False):
    if not credits_verified:
        raise RuntimeError("Verify applicable credits and a zero-charge limit first")
    print(probe.remote())
