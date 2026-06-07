CREATE TABLE `qa_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`citations` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `qa_messages_video_id_idx` ON `qa_messages` (`video_id`);