-- Add license cost fields to technologies table
ALTER TABLE "technologies" ADD COLUMN "annual_license_cost" integer NOT NULL DEFAULT 0;
ALTER TABLE "technologies" ADD COLUMN "requires_enterprise" boolean NOT NULL DEFAULT false;

-- Seed license cost data for existing CMS technologies
UPDATE "technologies" SET "annual_license_cost" = 0, "requires_enterprise" = false WHERE "name" = 'Drupal';
UPDATE "technologies" SET "annual_license_cost" = 0, "requires_enterprise" = false WHERE "name" = 'Sulu';
UPDATE "technologies" SET "annual_license_cost" = 15000, "requires_enterprise" = false WHERE "name" = 'Ibexa';
UPDATE "technologies" SET "annual_license_cost" = 30000, "requires_enterprise" = true WHERE "name" = 'Magnolia';
UPDATE "technologies" SET "annual_license_cost" = 50000, "requires_enterprise" = true WHERE "name" = 'FirstSpirit';
