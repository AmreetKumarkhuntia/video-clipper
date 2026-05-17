CREATE TABLE `clips` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`analysis_id` text,
	`segmentation_id` text,
	`segment_rank` integer NOT NULL,
	`filename` text NOT NULL,
	`path` text NOT NULL,
	`edited_path` text,
	`edits_json` text,
	`current_edits_hash` text,
	`last_rendered_hash` text,
	`start_sec` real NOT NULL,
	`end_sec` real NOT NULL,
	`duration_sec` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
