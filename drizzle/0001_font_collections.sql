CREATE TABLE `font_collections` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL,
  `fonts_json` text NOT NULL DEFAULT '[]',
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `font_collections_user_id_idx` ON `font_collections` (`user_id`);
