DROP INDEX IF EXISTS `idx_projects_user_name`;
ALTER TABLE `projects` ADD COLUMN `expires_at` integer;
CREATE INDEX IF NOT EXISTS `projects_user_updated_idx` ON `projects` (`user_id`, `updated_at`);
CREATE INDEX IF NOT EXISTS `projects_expires_idx` ON `projects` (`expires_at`);
