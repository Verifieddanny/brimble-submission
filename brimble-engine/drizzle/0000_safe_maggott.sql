CREATE TABLE `deployment` (
	`id` text PRIMARY KEY NOT NULL,
	`git_url` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`image_tag` text(255),
	`live_url` text(255),
	`port` integer,
	`container_id` text(255),
	`logs` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
