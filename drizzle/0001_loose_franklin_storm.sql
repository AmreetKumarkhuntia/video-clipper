CREATE TABLE `segmentations` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`rank` integer NOT NULL,
	`start_sec` real NOT NULL,
	`end_sec` real NOT NULL,
	`score` real NOT NULL,
	`reason` text NOT NULL,
	`source` text NOT NULL,
	`audio_event` text,
	`options_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
