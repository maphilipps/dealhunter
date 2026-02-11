import { z } from 'zod';

import {
  calculateBudgetIndicator,
  type BudgetIndicatorResult,
} from '@/lib/qualification-scan/workflow/steps/budget-indicator';

type MinimalBudgetIndicatorInput = {
  contentVolume: { estimatedPageCount: number; actualPageCount?: number };
  features: {
    ecommerce: boolean;
    userAccounts: boolean;
    search: boolean;
    multiLanguage: boolean;
    blog: boolean;
    forms: boolean;
    api: boolean;
    mobileApp: boolean;
    customFeatures: string[];
  };
  techStack: { cms?: string };
  migrationComplexity?: { recommendation: 'easy' | 'moderate' | 'complex' | 'very_complex' };
};

const ParseContentVolumeSchema = z.object({
  estimatedPageCount: z.number().int().positive(),
  actualPageCount: z.number().int().positive().optional(),
});

const ParseFeaturesSchema = z
  .object({
    ecommerce: z.boolean().optional(),
    userAccounts: z.boolean().optional(),
    search: z.boolean().optional(),
    multiLanguage: z.boolean().optional(),
    blog: z.boolean().optional(),
    forms: z.boolean().optional(),
    api: z.boolean().optional(),
    mobileApp: z.boolean().optional(),
    customFeatures: z.array(z.string()).optional(),
  })
  .transform(value => ({
    ecommerce: value.ecommerce ?? false,
    userAccounts: value.userAccounts ?? false,
    search: value.search ?? false,
    multiLanguage: value.multiLanguage ?? false,
    blog: value.blog ?? false,
    forms: value.forms ?? false,
    api: value.api ?? false,
    mobileApp: value.mobileApp ?? false,
    customFeatures: value.customFeatures ?? [],
  }));

const ParseTechStackSchema = z.object({
  cms: z.string().optional(),
});

const ParseMigrationSchema = z.object({
  recommendation: z.enum(['easy', 'moderate', 'complex', 'very_complex']),
});

export function buildIndicativeBudgetEstimateFromScanPayload(payload: {
  contentVolume?: unknown;
  features?: unknown;
  techStack?: unknown;
  migrationComplexity?: unknown;
}): BudgetIndicatorResult | null {
  const contentVolume = ParseContentVolumeSchema.safeParse(payload.contentVolume);
  if (!contentVolume.success) return null;

  const features = ParseFeaturesSchema.safeParse(payload.features);
  const techStack = ParseTechStackSchema.safeParse(payload.techStack);
  const migration = ParseMigrationSchema.safeParse(payload.migrationComplexity);

  const input: MinimalBudgetIndicatorInput = {
    contentVolume: contentVolume.data,
    features: features.success
      ? features.data
      : {
          ecommerce: false,
          userAccounts: false,
          search: false,
          multiLanguage: false,
          blog: false,
          forms: false,
          api: false,
          mobileApp: false,
          customFeatures: [],
        },
    techStack: techStack.success ? techStack.data : {},
    migrationComplexity: migration.success ? migration.data : undefined,
  };

  return calculateBudgetIndicator(input as Parameters<typeof calculateBudgetIndicator>[0]);
}
