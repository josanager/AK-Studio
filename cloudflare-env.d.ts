declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    TEMP_BUCKET: R2Bucket;
    PROCESSING_QUEUE: Queue<ProcessingJobMessage>;
    SITE_URL?: string;
    COMPLIMENTARY_PRO_EMAIL?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_PRICE_PRO?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    PATREON_CLIENT_ID?: string;
    PATREON_CLIENT_SECRET?: string;
    PATREON_WEBHOOK_SECRET?: string;
    MASTER_ENCRYPTION_KEY?: string;
    PROCESSOR_WEBHOOK_SECRET?: string;
    GPU_PROCESSOR_URL?: string;
    SEPARATOR_PROCESSOR_URL?: string;
    SEPARATOR_WEBHOOK_SECRET?: string;
    MODAL_SEPARATOR_URL?: string;
    MODAL_SHARED_SECRET?: string;
    SEPARATOR_PROVIDER?: string;
    COBALT_API_URL?: string;
    COBALT_API_KEY?: string;
    BETTER_AUTH_URL: string;
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
  }

  interface ProcessingJobMessage {
    jobId: string;
    userId: string;
    sourceUrl: string;
    createdAt: number;
  }
}
