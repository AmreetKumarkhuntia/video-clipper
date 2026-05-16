CREATE TABLE IF NOT EXISTS `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`handle` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`chunk` text NOT NULL,
	`analysis` text,
	`score` real,
	`start` real NOT NULL,
	`end` real NOT NULL,
	`rank` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`channel_title` text DEFAULT '' NOT NULL,
	`published_at` text DEFAULT '' NOT NULL,
	`duration_sec` real DEFAULT 0 NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`transcript_lines` text,
	`transcript_fetched_at` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
