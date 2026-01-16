CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`strengths` text,
	`weaknesses` text,
	`technology_focus` text,
	`industry_focus` text,
	`price_level` text DEFAULT 'medium' NOT NULL,
	`recent_encounters` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
