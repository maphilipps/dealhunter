ALTER TABLE `bid_opportunities` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `deep_migration_analyses` ADD `user_id` text NOT NULL REFERENCES users(id);