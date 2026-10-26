# AK Studio on Cloudflare

## Production shape

- **Worker + static assets** serves the product UI and lightweight API endpoints.
- **D1 (`DB`)** stores accounts, authentication sessions, Patreon links/verification, usage and font collections. Audio is not stored in D1.
- **Queue (`PROCESSING_QUEUE`)** remains bound; vocal separation uses Modal's persistent background jobs.
- **R2 (`TEMP_BUCKET`)** holds temporary inputs and outputs. The bucket lifecycle deletes objects after one day.
- **Modal L4** performs lead/backing separation with the existing Mel-RoFormer checkpoint. It reads and writes single-file signed R2 transfers. See [deployment and rollback](processor/MODAL_DEPLOYMENT.md).
- **Cloudflare download containers** still fetch YouTube audio. The old CPU separator is retained, idle, for rollback; production selects `SEPARATOR_PROVIDER=modal`.
- **Browser** still handles editing, playback, waveforms and the existing video export. This migration does not claim zero local memory or cloud video rendering.
- **Patreon** grants Pro for qualifying active memberships; the verified owner exception remains. Historical Stripe compatibility endpoints/records remain but do not grant Pro. Existing Stripe subscriptions were not canceled by this migration.
- **Better Auth** handles Google/Patreon sign-in on `https://akstudiovocal.com`, with the app's own error screen.

## Deploy

Use Node 24 and the project's pinned Wrangler 4.92 for the web deployment.

```bash
npm ci
npm run build:cloudflare
npx wrangler d1 migrations apply ak-studio --remote --config wrangler.jsonc
node node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.cloudflare.json
```

Production secrets belong in Cloudflare, never in Git:

Preserve existing authentication, Patreon and processor secrets. Modal adds
`MODAL_SHARED_SECRET`, identical to the managed Modal secret
`ak-studio-cloudflare`. Public provider selection and URL are in
`wrangler.jsonc`. No bucket-wide credentials are sent to Modal. Dashboard
login sessions and the temporary local SDK token do not keep the deployed
service running; the deployment is independent of those sessions.

## CI/CD recommendation

The application can be deployed directly with Wrangler; GitHub is not technically required. A private GitHub repository connected to Cloudflare Workers Builds is recommended for production because pushes become reproducible deployments with history, preview checks, and rollback points.

Build command:

```bash
npm ci && npm run build:cloudflare
```

Deploy command:

```bash
npx wrangler deploy --config dist/server/wrangler.cloudflare.json
```

## GPU operation

Modal scales from zero to at most one L4, retaining a loaded model for up to
60 seconds after activity. Cold starts remain variable. Cancellation stops
the GPU invocation; retries are explicit and use isolated output generations.
The service rejects unauthenticated control requests and arbitrary source URLs.

As configured on 26 October 2026, Modal has a $30 usage cap and $0 net spend
limit. Processing is bounded by available free credits. Do not enable paid
overage, permanent GPU capacity or larger limits without the owner's request.
R2's one-day lifecycle applies to staged and final audio alike.
