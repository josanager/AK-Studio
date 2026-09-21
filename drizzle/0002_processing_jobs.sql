CREATE TABLE `processing_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `source_url` text NOT NULL,
  `status` text NOT NULL DEFAULT 'queued',
  `progress` integer NOT NULL DEFAULT 0,
  `error_code` text,
  `result_manifest_key` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `processing_jobs_user_created_idx` ON `processing_jobs` (`user_id`, `created_at`);
CREATE INDEX `processing_jobs_expires_idx` ON `processing_jobs` (`expires_at`);
