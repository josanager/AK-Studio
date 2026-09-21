declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    TEMP_BUCKET: R2Bucket;
    PROCESSING_QUEUE: Queue<ProcessingJobMessage>;
    SITE_URL?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_PRICE_PRO?: string;
    MASTER_ENCRYPTION_KEY?: string;
    PROCESSOR_WEBHOOK_SECRET?: string;
    GPU_PROCESSOR_URL?: string;
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
