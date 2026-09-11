CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`rank` integer NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `role_id` text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
INSERT INTO `roles` (`id`, `rank`, `permissions`, `created_at`) VALUES
  ('customer', 0, '[]', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('admin', 100, '["settings:write"]', CAST(strftime('%s','now') AS INTEGER) * 1000);
