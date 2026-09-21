# AK Studio on Cloudflare

## Production shape

- **Worker + static assets** serves the product UI and lightweight API endpoints.
- **D1 (`DB`)** stores users, subscriptions, encrypted provider credentials, font collections, and short-lived job metadata. It does not store sessions, audio, or video.
- **Queue (`PROCESSING_QUEUE`)** decouples the web request from long-running media work.
- **R2 (`TEMP_BUCKET`)** holds temporary inputs and outputs. The bucket lifecycle deletes objects after one day.
- **External GPU processor** performs download, source separation, transcription/alignment, BPM detection, and rendering. Workers orchestrate this workload; they do not run the ML models.
- **Stripe** handles subscriptions. Stripe webhook processing and entitlement enforcement must be connected before billing is considered production-ready.
- **Consumer authentication provider** must replace the OpenAI Sites request headers before the public Cloudflare deployment.

## Deploy

Use Node 22 or newer.

```bash
npm ci
npm run build:cloudflare
npx wrangler d1 migrations apply ak-studio --remote --config wrangler.jsonc
npx wrangler deploy --config dist/server/wrangler.cloudflare.json
```

Production secrets belong in Cloudflare, never in Git:

```bash
npx wrangler secret put MASTER_ENCRYPTION_KEY --config dist/server/wrangler.cloudflare.json
npx wrangler secret put STRIPE_SECRET_KEY --config dist/server/wrangler.cloudflare.json
npx wrangler secret put PROCESSOR_WEBHOOK_SECRET --config dist/server/wrangler.cloudflare.json
```

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

## Remaining production gates

1. Replace `app/chatgpt-auth.ts` with the selected public authentication provider.
2. Add Stripe product/price, secrets, webhook verification, and entitlement checks.
3. Select and connect a GPU processing provider. The UI must not claim that stems or rendered audio are ready until this exists.
4. Add a custom domain after the intended hostname is provided.
5. Add rate limiting, job quotas, error tracking, and spend alerts before opening registration.
