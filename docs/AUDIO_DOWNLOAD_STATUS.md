# Audio download reliability — 2026-09-26

The observed production failure is Cloudflare error 1016: the configured processor origin is unavailable. The main Worker is online, but the dedicated `ak-studio-audio-processor` Worker is not deployed. A stopped temporary tunnel cannot be repaired by client retries.

Implemented:
- Bounded retries for network errors and HTTP 408/429/500/502/503/504, with exponential delay and request deadlines.
- Restart interrupted or truncated audio transfers; reject empty files, HTML/JSON error responses, and files exceeding 96 MiB. Progress does not regress within a transfer retry.
- Prefer highest source bitrate rather than lower-bitrate AAC. Cobalt MP3 requests use 320 kbps (this does not improve source quality).
- Processor download requests reuse a completed manifest for the same job/source. Concurrent duplicate requests are serialized. Failed jobs can resume yt-dlp partial downloads.
- Clear English unavailable-server error. Existing failed-download quota rollback remains in place.

Verification: `node scripts/test-download-http.mjs`, `npx tsc --noEmit`, Python compilation, production build.

Still required: provision a permanent processor runtime, deploy `processor/server.py`, configure `GPU_PROCESSOR_URL` and the matching authentication secret, then verify a real authenticated download through the editor. Local Docker is absent and the current Wrangler OAuth token cannot access Workers Builds (403), so remote container provisioning remains outstanding. These code changes do not restore the unavailable origin and do not guarantee uninterrupted downloads.
