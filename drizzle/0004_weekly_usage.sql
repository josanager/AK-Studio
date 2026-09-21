CREATE TABLE `weekly_usage` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `week_key` text NOT NULL,
  `status` text NOT NULL DEFAULT 'processing',
  `created_at` integer NOT NULL,
  `completed_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `idx_weekly_usage_user_week` ON `weekly_usage` (`user_id`, `week_key`);
CREATE INDEX `idx_weekly_usage_created_at` ON `weekly_usage` (`created_at`);
