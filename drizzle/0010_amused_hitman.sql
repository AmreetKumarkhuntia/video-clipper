CREATE TABLE `auth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_identities_customer_id_idx` ON `auth_identities` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_identities_provider_account_uq` ON `auth_identities` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`name` text,
	`avatar_url` text,
	`channel_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`video_id` text NOT NULL,
	`saved_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `library_videos_customer_saved_idx` ON `library_videos` (`customer_id`,`saved_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `library_videos_customer_video_uq` ON `library_videos` (`customer_id`,`video_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_customer_id_idx` ON `sessions` (`customer_id`);--> statement-breakpoint
CREATE TABLE `youtube_auth` (
	`customer_id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expiry_date` integer,
	`scope` text,
	`channel_id` text,
	`connected_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `videos` ADD `thumbnail_url` text;