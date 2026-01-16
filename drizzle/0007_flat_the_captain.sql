CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`business_line_id` text NOT NULL,
	`skills` text NOT NULL,
	`roles` text NOT NULL,
	`availability_status` text DEFAULT 'available' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`business_line_id`) REFERENCES `business_lines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);