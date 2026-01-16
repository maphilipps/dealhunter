CREATE TABLE `business_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`leader_name` text NOT NULL,
	`leader_email` text NOT NULL,
	`keywords` text NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
