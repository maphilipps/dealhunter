// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP STEPS - QuickScan 2.0 Workflow
// Steps that run at the beginning of the workflow with no dependencies
// ═══════════════════════════════════════════════════════════════════════════════


import { db } from '../../../db';
import { businessUnits as businessUnitsTable } from '../../../db/schema';
import { fetchWebsiteData } from '../../tools/website-fetch';
import { wrapTool, wrapToolWithProgress } from '../tool-wrapper';
import type { WebsiteData, BusinessUnit, BootstrapInput } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS UNITS SINGLETON CACHE
// ═══════════════════════════════════════════════════════════════════════════════

let cachedBusinessUnits: BusinessUnit[] | null = null;

export async function loadBusinessUnitsFromDB(): Promise<BusinessUnit[]> {
  if (!cachedBusinessUnits) {
    try {
      const units = await db.select().from(businessUnitsTable);
      cachedBusinessUnits = units.map(unit => ({
        name: unit.name,
        keywords:
          typeof unit.keywords === 'string'
            ? (JSON.parse(unit.keywords) as string[])
            : (unit.keywords as string[]) || [],
      }));
      // Business units loaded successfully
    } catch (error) {
      console.error('[Bootstrap] Error loading business units from DB:', error);
      cachedBusinessUnits = [];
    }
  }
  return cachedBusinessUnits;
}

export function clearBusinessUnitsCache(): void {
  cachedBusinessUnits = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD BUSINESS UNITS STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const loadBusinessUnitsStep = wrapTool<void, BusinessUnit[]>(
  {
    name: 'loadBusinessUnits',
    displayName: 'Business Units',
    phase: 'bootstrap',
    dependencies: [],
    optional: false,
    timeout: 10000,
  },
  async (_input, _ctx) => {
    return loadBusinessUnitsFromDB();
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH WEBSITE STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchWebsiteStep = wrapToolWithProgress<BootstrapInput, WebsiteData>(
  {
    name: 'fetchWebsite',
    displayName: 'Website Crawler',
    phase: 'bootstrap',
    dependencies: [],
    optional: false,
    timeout: 30000,
  },
  async (input, ctx, onProgress) => {
    const fullUrl = ctx.fullUrl || input.url;

    onProgress('Lade Website-Inhalt...');
    const result = await fetchWebsiteData(fullUrl);

    const htmlSize = Math.round(result.html.length / 1024);
    onProgress(`Website geladen: ${htmlSize} KB HTML`);

    return result;
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ALL BOOTSTRAP STEPS
// ═══════════════════════════════════════════════════════════════════════════════

export const bootstrapSteps = [loadBusinessUnitsStep, fetchWebsiteStep];
