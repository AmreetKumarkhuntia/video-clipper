PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`title` text NOT NULL,
	`duration_sec` real NOT NULL,
	`options_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
DROP TABLE `analyses`;
--> statement-breakpoint
ALTER TABLE `__new_analyses` RENAME TO `analyses`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
