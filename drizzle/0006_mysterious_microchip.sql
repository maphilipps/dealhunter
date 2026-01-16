CREATE TABLE `technologies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`business_line_id` text NOT NULL,
	`baseline_hours` integer NOT NULL,
	`baseline_name` text NOT NULL,
	`baseline_entity_counts` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`business_line_id`) REFERENCES `business_lines`(`id`) ON UPDATE no action ON DELETE no action
);
