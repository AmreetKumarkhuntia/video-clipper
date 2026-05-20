CREATE TABLE `publish_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_id` text NOT NULL,
	`video_id` text NOT NULL,
	`title` text NOT NULL,
	`items_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publish_drafts_analysis_id_unique` ON `publish_drafts` (`analysis_id`);
--> statement-breakpoint
CREATE TABLE `upload_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_id` text NOT NULL,
	`video_id` text NOT NULL,
	`clip_artifact_id` text NOT NULL,
	`title` text NOT NULL,
	`privacy_status` text NOT NULL,
	`status` text NOT NULL,
	`youtube_video_id` text,
	`youtube_url` text,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
