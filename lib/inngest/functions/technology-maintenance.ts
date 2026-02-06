import { eq, isNotNull, and, sql } from 'drizzle-orm';

import { inngest } from '../client';

import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';

const BATCH_SIZE = 15;
const QUERY_LIMIT = 500;

/**
 * Weekly Technology EOL Check
 *
 * Runs every Monday at 6:00 AM UTC.
 * Checks all technologies with a name against the endoflife.date API
 * and logs warnings for products nearing or past end-of-life.
 */
export const technologyMaintenanceFunction = inngest.createFunction(
  {
    id: 'technology-eol-check',
    name: 'Technology EOL Maintenance',
  },
  { cron: '0 6 * * 1' }, // Every Monday at 06:00 UTC
  async ({ step }) => {
    const techs = await step.run('load-technologies', async () => {
      return db
        .select({
          id: technologies.id,
          name: technologies.name,
          category: technologies.category,
          websiteUrl: technologies.websiteUrl,
        })
        .from(technologies)
        .where(isNotNull(technologies.name))
        .limit(QUERY_LIMIT);
    });

    if (techs.length === 0) {
      return { checked: 0, warnings: [] };
    }

    const warnings: Array<{
      technologyId: string;
      name: string;
      eolStatus: string;
    }> = [];

    // Process technologies in batches to avoid hammering the API
    for (let i = 0; i < techs.length; i += BATCH_SIZE) {
      const batch = techs.slice(i, i + BATCH_SIZE);

      const batchWarnings = await step.run(`check-eol-batch-${i}`, async () => {
        const results = await Promise.allSettled(
          batch.map(async tech => {
            const productSlug = tech.name!.toLowerCase().replace(/\s+/g, '-');

            const response = await fetch(`https://endoflife.date/api/${productSlug}.json`, {
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(10_000),
            });

            if (!response.ok) return null;

            const versions = (await response.json()) as Array<{
              cycle: string;
              eol: string | boolean;
              latest: string;
            }>;

            const latest = versions[0];
            if (!latest) return null;

            const isEol =
              latest.eol === true ||
              (typeof latest.eol === 'string' && new Date(latest.eol) < new Date());

            if (!isEol) return null;

            // Single conditional UPDATE: only prepend warning if not already present
            await db
              .update(technologies)
              .set({
                description: sql`CASE
                  WHEN ${technologies.description} LIKE '%[EOL WARNING]%' THEN ${technologies.description}
                  ELSE '[EOL WARNING] Latest version ' || ${latest.cycle} || ' has reached end-of-life. ' || COALESCE(${technologies.description}, '')
                END`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(technologies.id, tech.id),
                  sql`${technologies.description} NOT LIKE '%[EOL WARNING]%' OR ${technologies.description} IS NULL`
                )
              );

            return {
              technologyId: tech.id,
              name: tech.name!,
              eolStatus: `Latest cycle ${latest.cycle} is EOL (eol: ${String(latest.eol)})`,
            };
          })
        );

        return results
          .filter(
            (
              r
            ): r is PromiseFulfilledResult<{
              technologyId: string;
              name: string;
              eolStatus: string;
            } | null> => r.status === 'fulfilled'
          )
          .map(r => r.value)
          .filter((v): v is NonNullable<typeof v> => v != null);
      });

      warnings.push(...batchWarnings);
    }

    return {
      checked: techs.length,
      warnings,
      timestamp: new Date().toISOString(),
    };
  }
);
