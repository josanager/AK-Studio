# Audio download reliability — 2026-09-26

The observed production failure is Cloudflare error 1016: the configured processor origin is unavailable. The main Worker is online, but the dedicated `ak-studio-audio-processor` Worker is not deployed. A stopped temporary tunnel cannot be repaired by client retries.

Implemented:
- Bounded retries for network errors and HTTP 408/429/500/502/503/504, with exponential delay and request deadlines.
- Restart interrupted or truncated audio transfers; reject empty files, HTML/JSON error responses, and files exceeding 96 MiB. Progress does not regress within a transfer retry.
- Prefer highest source bitrate rather than lower-bitrate AAC. Cobalt MP3 requests use 320 kbps (this does not improve source quality).
- Processor download requests reuse a completed manifest for the same job/source. Concurrent duplicate requests are serialized. Failed jobs can resume yt-dlp partial downloads.
- Clear English unavailable-server error. Existing failed-download quota rollback remains in place.

Verification: `node scripts/test-download-http.mjs`, `npx tsc --noEmit`, Python compilation, production build.

## Permanent deployment completed

Cloudflare Workers Paid is active. The dedicated Worker `ak-studio-audio-processor` is deployed at `https://ak-studio-audio-processor.josanager.workers.dev`, backed by Cloudflare Containers. Workers Builds uses the existing GitHub connection, repository `josanager/AK-Studio`, root `/processor`, and deploy command `npx wrangler deploy`. Existing build-token access worked; no new API token was created. The image is built remotely, so local Docker is unnecessary.

`Dockerfile.download` installs yt-dlp, ffmpeg, and Deno only. Maximum instances: 3, basic instance size, idle sleep: 2 minutes. This image does NOT install the optional vocal separator. The original Dockerfile remains available for a separately provisioned separation runtime; do not claim that separation works on this download-only deployment.

Matching `PROCESSOR_WEBHOOK_SECRET` values were configured in both Workers, and `GPU_PROCESSOR_URL` now points to the permanent processor. Secrets are stored in Cloudflare, never in Git. Main Worker includes `global_fetch_strictly_public` to permit calls to the processor Worker; without it Cloudflare returned error 1042.

Import calls `/download` directly (separation remains an explicit, separate action). NDJSON sends blank keepalive lines every 15 seconds during preparation; callbacks tolerate stream cancellation, though this does not guarantee a job survives a browser disconnect.

Verified through the authenticated production editor: YouTube Music video `Om-nOVJhfqA` (Get Happy / Happy Days Are Here Again) reached `Ready · full-mix · LRCLIB`; waveform and Play became available. Playback confirmed `paused: false`, `readyState: 4`, duration 135.267688 seconds, and advancing playback time. Processor `/health` also returned HTTP 200. No local processor or temporary tunnel is involved. YouTube availability, external restrictions, and transient infrastructure failures still mean downloads cannot be guaranteed for every link.
