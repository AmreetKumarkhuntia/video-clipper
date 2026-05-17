CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`plan_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
