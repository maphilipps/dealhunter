CREATE TABLE "configs" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"category" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "configs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "configs" ADD CONSTRAINT "configs_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "configs_key_idx" ON "configs" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "configs_category_idx" ON "configs" USING btree ("category");
