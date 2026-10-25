"""Isolated, ephemeral L4 benchmark. Never deployed or connected to production.

Run only after checking Modal credits and setting the workspace spend limit to $0.
No local inference, private audio, persistent volumes, secrets, or public endpoints.
"""
import hashlib
import json
import math
import statistics
import struct
import tempfile
import time
import wave
from pathlib import Path

import modal

MODEL = "mel_band_roformer_karaoke_aufr33_viperx_sdr_10.1956.ckpt"
PARAMS = {"segment_size": 256, "override_model_segment_size": False,
          "batch_size": 1, "overlap": 2, "pitch_shift": 0}
app = modal.App("ak-studio-l4-benchmark")
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "libsndfile1", "build-essential")
    .pip_install("torch==2.8.0", "torchaudio==2.8.0", "torchvision==0.23.0",
                 index_url="https://download.pytorch.org/whl/cu128")
    .pip_install("audio-separator[cpu]==0.47.0", "librosa", "audioread")
    .run_commands("mkdir -p /models", "audio-separator --model_filename " + MODEL
                  + " --model_file_dir /models --download_model_only")
)


def make_fixture(path, seconds):
    """Deterministic stereo music-like signal, made remotely; no copyrighted input."""
    sample_rate = 44100
    with wave.open(str(path), "wb") as output:
        output.setparams((2, 2, sample_rate, 0, "NONE", "not compressed"))
        for second in range(seconds):
            chunk = bytearray()
            for frame in range(sample_rate):
                t = second + frame / sample_rate
                beat = math.exp(-30 * (t % .5))
                melody = math.sin(2 * math.pi * (330 + 15 * math.sin(t)) * t)
                left = .12 * melody + .08 * math.sin(2 * math.pi * 110 * t) + .1 * beat * math.sin(2 * math.pi * 65 * t)
                right = .12 * melody + .08 * math.sin(2 * math.pi * 165 * t) + .1 * beat * math.sin(2 * math.pi * 65 * t)
                chunk.extend(struct.pack("<hh", int(left * 32767), int(right * 32767)))
            output.writeframes(chunk)


@app.function(image=image, gpu="L4", cpu=4, memory=12288, timeout=900,
              max_containers=1, min_containers=0, scaledown_window=2, retries=0)
def benchmark(seconds: int = 30):
    import torch
    import soundfile as sf
    from audio_separator.separator import Separator

    if seconds not in (15, 30, 60):
        raise ValueError("Allowed durations: 15, 30 or 60 seconds")
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA unavailable: refusing a misleading CPU fallback")
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    torch.backends.cuda.matmul.allow_tf32 = False
    torch.backends.cudnn.allow_tf32 = False
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        source = root / "synthetic.wav"
        make_fixture(source, seconds)
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        started = time.perf_counter()
        separator = Separator(model_file_dir="/models", output_dir=str(root),
                              output_format="FLAC", use_autocast=False,
                              mdxc_params=PARAMS)
        separator.load_model(model_filename=MODEL)
        if separator.torch_device.type != "cuda":
            raise RuntimeError("Separator did not select CUDA")
        torch.cuda.synchronize()
        model_load = time.perf_counter() - started
        checkpoint = Path("/models") / MODEL
        with checkpoint.open("rb") as handle:
            checkpoint_hash = hashlib.file_digest(handle, "sha256").hexdigest()
        runs = []
        for iteration in range(3):
            out = root / str(iteration)
            out.mkdir()
            separator.output_dir = str(out)
            separator.model_instance.output_dir = str(out)
            torch.cuda.reset_peak_memory_stats()
            torch.cuda.synchronize()
            started = time.perf_counter()
            names = separator.separate(str(source), custom_output_names={
                "Vocals": "lead", "Instrumental": "backing",
                "Lead Vocals": "lead", "Backing Vocals": "backing"})
            torch.cuda.synchronize()
            elapsed = time.perf_counter() - started
            if len(names) != 2:
                raise RuntimeError("Expected two separated tracks")
            for name in names:
                output = Path(name) if Path(name).is_absolute() else out / name
                info = sf.info(output)
                if abs(info.duration - seconds) > .1 or info.channels != 2:
                    raise RuntimeError("Invalid separated track")
            runs.append({"seconds": round(elapsed, 3),
                         "peak_vram_gib": round(torch.cuda.max_memory_allocated() / 2**30, 3)})
        return {"model": MODEL, "checkpoint_sha256": checkpoint_hash,
                "audio_separator": "0.47.0", "torch": str(torch.__version__),
                "gpu": torch.cuda.get_device_name(), "precision": "FP32",
                "params": PARAMS, "fixture": "synthetic; not a song or a quality evaluation",
                "fixture_sha256": source_hash, "audio_seconds": seconds,
                "model_load_seconds": round(model_load, 3), "runs": runs,
                "warm_median_seconds": round(statistics.median(r["seconds"] for r in runs[1:]), 3)}


@app.local_entrypoint()
def main(credits_verified: bool = False, seconds: int = 30,
         output: str = "outputs/modal-benchmark.json"):
    if not credits_verified:
        raise RuntimeError("First verify credits, GPU eligibility and $0 spend limit in Modal; then pass --credits-verified")
    if seconds not in (15, 30, 60):
        raise ValueError("Allowed durations: 15, 30 or 60 seconds")
    started = time.perf_counter()
    result = benchmark.remote(seconds)
    result["remote_call_seconds_including_startup"] = round(time.perf_counter() - started, 3)
    result["note"] = "Image build excluded. No speedup claim without the same-input CPU baseline."
    target = Path(output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


@app.function(image=image, gpu="L4", cpu=4, memory=12288, timeout=900,
              max_containers=1, min_containers=0, scaledown_window=2, retries=0)
def music_benchmark(single_run: bool = False):
    remote_started = time.perf_counter()
    import librosa
    import numpy as np
    import soundfile as sf
    import torch
    from audio_separator.separator import Separator

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA unavailable; refusing CPU fallback")
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    torch.backends.cuda.matmul.allow_tf32 = False
    torch.backends.cudnn.allow_tf32 = False
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        started = time.perf_counter()
        # Public CC-BY 3.0 musical recording, downloaded only by the cloud worker.
        original = Path(librosa.ex("fishin", hq=True))
        audio, rate = sf.read(original, dtype="float32", always_2d=True)
        source_seconds = len(audio) / rate
        if audio.shape[1] != 2 or not 60 < source_seconds < 600:
            raise RuntimeError("Unexpected reference recording format/duration")
        download_decode_seconds = time.perf_counter() - started
        source_hash = hashlib.sha256(original.read_bytes()).hexdigest()
        started = time.perf_counter()
        separator = Separator(model_file_dir="/models", output_dir=str(root),
                              output_format="FLAC", use_autocast=False,
                              mdxc_params=PARAMS)
        separator.load_model(model_filename=MODEL)
        if separator.torch_device.type != "cuda":
            raise RuntimeError("Separator did not select CUDA")
        torch.cuda.synchronize()
        model_load = time.perf_counter() - started
        runs = []
        cases = (("full_first", source_seconds),) if single_run else (
            ("full_first", source_seconds), ("full_warm", source_seconds),
            ("excerpt_30", 30), ("excerpt_60", 60))
        for label, seconds in cases:
            out = root / label
            out.mkdir()
            source = root / (label + ".wav")
            sf.write(source, audio[:round(seconds * rate)], rate, subtype="PCM_16")
            separator.output_dir = str(out)
            separator.model_instance.output_dir = str(out)
            torch.cuda.reset_peak_memory_stats()
            torch.cuda.synchronize()
            started = time.perf_counter()
            names = separator.separate(str(source), custom_output_names={
                "Vocals": "lead", "Instrumental": "backing",
                "Lead Vocals": "lead", "Backing Vocals": "backing"})
            torch.cuda.synchronize()
            elapsed = time.perf_counter() - started
            if len(names) != 2:
                raise RuntimeError("Expected two stems")
            stems = []
            for name in names:
                path = Path(name) if Path(name).is_absolute() else out / name
                data, output_rate = sf.read(path, dtype="float32", always_2d=True)
                duration = len(data) / output_rate
                rms = float(np.sqrt(np.mean(np.square(data, dtype=np.float64))))
                if data.shape[1] != 2 or abs(duration - seconds) > .1 or not np.isfinite(data).all() or rms < 1e-7:
                    raise RuntimeError("Invalid, silent or non-finite stem")
                stems.append({"name": path.name, "seconds": round(duration, 3),
                              "bytes": path.stat().st_size, "rms": round(rms, 6)})
            measurement = {"case": label, "audio_seconds": round(seconds, 3),
                           "separation_seconds": round(elapsed, 3), "stems": stems,
                           "peak_vram_gib": round(torch.cuda.max_memory_allocated() / 2**30, 3)}
            if label == "full_first":
                measurement["remote_execution_to_first_song_ready_seconds"] = round(time.perf_counter() - remote_started, 3)
            print("AK_MUSIC_MEASUREMENT " + json.dumps(measurement), flush=True)
            runs.append(measurement)
        with (Path("/models") / MODEL).open("rb") as handle:
            checkpoint_hash = hashlib.file_digest(handle, "sha256").hexdigest()
        return {"track": "Let's Go Fishin' — Karissa Hobbs", "license": "CC-BY 3.0",
                "source": "librosa example fishin, high quality stereo",
                "source_license_url": "https://raw.githubusercontent.com/librosa/data/main/audio/Karissa_Hobbs_-_Lets_Go_Fishin.txt",
                "source_sha256": source_hash, "source_sample_rate": rate,
                "model": MODEL, "checkpoint_sha256": checkpoint_hash,
                "audio_separator": "0.47.0", "torch": str(torch.__version__),
                "gpu": torch.cuda.get_device_name(), "precision": "FP32", "params": PARAMS,
                "download_decode_seconds": round(download_decode_seconds, 3),
                "model_load_seconds": round(model_load, 3), "runs": runs,
                "remote_execution_all_runs_seconds": round(time.perf_counter() - remote_started, 3)}


@app.local_entrypoint()
def music(credits_verified: bool = False):
    if not credits_verified:
        raise RuntimeError("Verify credits and spend limit $0 before execution")
    started = time.perf_counter()
    result = music_benchmark.remote()
    result["client_wall_all_runs_seconds"] = round(time.perf_counter() - started, 3)
    result["scope"] = "No R2 transfer, YouTube download, app queue or client playback; not a subjective audio quality evaluation"
    target = Path("outputs/modal-music-benchmark.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


@app.function(image=image, gpu="L4", cpu=4, memory=12288, timeout=900,
              max_containers=1, min_containers=0, scaledown_window=2, retries=0)
def music_single_job():
    # Separate function pool: first invocation cannot reuse the previous model.
    return music_benchmark.local(single_run=True)


@app.local_entrypoint()
def coldmusic(credits_verified: bool = False,
              output: str = "outputs/modal-music-cold.json"):
    if not credits_verified:
        raise RuntimeError("Verify credits and spend limit $0 before execution")
    started = time.perf_counter()
    result = music_single_job.remote()
    result["client_wall_single_song_seconds"] = round(time.perf_counter() - started, 3)
    result["scope"] = "One song, new container; includes startup, example download, decode, model loading, FLAC creation and validation. Excludes R2, YouTube and production queue."
    target = Path(output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
