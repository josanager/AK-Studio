# Vocal separation — 2026-09-26

## Architecture

- Independent Cloudflare Worker `ak-studio-separator`, configured by `processor/wrangler.separator.jsonc`.
- Image `processor/Dockerfile.separator`: Python 3.12, CPU PyTorch, audio-separator 0.47.0, FFmpeg, audioread, and native compiler dependencies.
- Karaoke-specific model: `mel_band_roformer_karaoke_aufr33_viperx_sdr_10.1956.ckpt`. The model's `Vocals` output maps to `lead.flac`, its residual `Instrumental` output to `backing.flac`. This is not the generic all-vocals BS-RoFormer model.
- One `standard-4` container at most (4 vCPU, 12 GiB RAM), sleeping after two idle minutes. This is CPU inference, not a GPU deployment. Usage charges are additional to the Workers plan and depend on runtime.
- GitHub Workers Builds: repository `josanager/AK-Studio`, root `/processor`, deploy command `npx wrangler deploy --config wrangler.separator.jsonc`. Preview builds disabled. Existing saved build token reused.
- Production separator deployment verified: version `f831c33d-5b7a-45c1-b745-2c69ba90f952`, container application `a03b1a03-8c65-44bb-8452-5865182a057b`.
- Main Worker secrets: `SEPARATOR_PROCESSOR_URL`, `SEPARATOR_WEBHOOK_SECRET`; separator secret: `PROCESSOR_WEBHOOK_SECRET`. Secret values are never checked into Git.
- The download-only Worker and its URL/secret are independent and unchanged.

## Request flow

1. Authenticate the user and verify ownership of the existing R2 original.
2. Return already-stored lead/backing files without new inference when both exist.
3. Feed a short-lived signed original-audio URL to the separator. Use the audio UUID as an idempotent job ID.
4. `/process` returns HTTP 202 immediately; a background thread runs separation. The main Worker polls authenticated `/job/:id` every ten seconds and sends blank NDJSON keepalives to the editor.
5. Reject simultaneous inference instead of overcommitting the container. Do not automatically repeat failed inference against YouTube.
6. Validate the two output files, stream them into the existing temporary R2 bucket, and return authenticated lead/backing URLs to the editor. Existing 24-hour R2 retention applies.

Cold provisioning failures use bounded, idempotent retries. Mutable `backing`/`lead` playback caches revalidate with R2 ETags instead of reusing the initial full-mix backing. The audio route supports authenticated conditional 304 responses. Originals remain reusable without revalidation because they are immutable. This fixes preview/export retaining the full mix after successful separation.

Keep the editor tab open while inference is running. This initial implementation does not guarantee recovery after browser cancellation, container restart, or deployment during inference; durable queue processing is a separate hardening step.

## Verification

- TypeScript typecheck and Python compilation passed.
- Local HTTP test with mocked inference passed: immediate 202, repeated start runs once, polling reaches ready. No real inference was executed by this test.
- Existing download retry regression tests passed.
- `node scripts/test-separator-service.mjs`: async polling, two-file storage, transient provisioning recovery, busy error, and invalid output paths passed with mocked inference.
- `python3 scripts/test-separator-server.py`: immediate 202, duplicate suppression, concurrency limit, and ready status passed with mocked inference.
- `node scripts/test-audio-cache.mjs`: stale full-mix cache replacement, ETag/304 reuse, and original cache reuse passed.
- Production song: Pentatonix — Get Happy / Happy Days Are Here Again (`Om-nOVJhfqA`). The first request failed during Cloudflare provisioning before inference. The same stored audio was then processed successfully: the browser measured 829 seconds (~13m49s) for the successful separation request.
- Both actual model outputs are available in R2 and loaded in the editor. Backing: 12,414,673 bytes; lead: 12,651,259 bytes; both 135.26771 seconds. Original: 27,927,912 bytes. SHA-256 comparison confirmed that preview backing matches the real R2 backing and differs from the original; lead differs from both.
- Verified `readyState: 4`, advancing playback, independent mute controls, and restored separated tracks after reload. Left playback paused with backing enabled and lead muted. No second song was processed.
- Main Worker deployed with cache correction: version `3861718f-5202-4863-bfb2-5f352cf52b1d` (later GitHub builds may produce a newer version with the same code).

The CPU path is functional but this measured latency is not suitable for fast, high-throughput interactive separation. GPU inference and a durable queue are still needed before claiming high-scale, low-latency processing. The UI currently stays at 5% during inference; that number denotes the processing phase and does not measure internal model progress.

Model output is probabilistic: some lead bleed or lost backing vocals can remain. Do not claim perfect separation, GPU performance, or a universally best model.
