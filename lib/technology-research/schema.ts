import { z } from 'zod';

export const technologyResearchResultSchema = z.object({
  // Basis-Informationen
  logoUrl: z.string().url().optional().describe('URL zum offiziellen Logo der Technologie'),
  websiteUrl: z.string().url().optional().describe('Offizielle Website der Technologie'),
  description: z.string().optional().describe('Kurze Beschreibung der Technologie (2-3 Sätze)'),
  category: z
    .enum(['CMS', 'Framework', 'Library', 'Language', 'Database', 'Tool', 'Platform', 'Other'])
    .optional()
    .describe('Kategorie der Technologie'),

  // Technische Details
  license: z.string().optional().describe('Lizenztyp (z.B. MIT, GPL, Proprietary, Apache 2.0)'),
  latestVersion: z.string().optional().describe('Aktuelle stabile Version'),
  githubUrl: z.string().url().optional().describe('GitHub Repository URL'),
  githubStars: z.number().int().nonnegative().optional().describe('Anzahl GitHub Stars'),
  lastRelease: z.string().optional().describe('Datum des letzten Releases (YYYY-MM-DD)'),
  communitySize: z.enum(['small', 'medium', 'large']).optional().describe('Größe der Community'),

  // Bewertung
  pros: z.array(z.string()).optional().describe('Vorteile der Technologie (3-5 Punkte)'),
  cons: z.array(z.string()).optional().describe('Nachteile der Technologie (3-5 Punkte)'),

  // Marketing
  usps: z
    .array(z.string())
    .optional()
    .describe('Unique Selling Points für Verkaufsgespräche (3-5 Punkte)'),
  targetAudiences: z.array(z.string()).optional().describe('Zielgruppen für diese Technologie'),
  useCases: z.array(z.string()).optional().describe('Typische Anwendungsfälle'),

  // adesso-spezifisch
  adessoExpertise: z
    .string()
    .optional()
    .describe('Beschreibung der adesso-Expertise mit dieser Technologie'),
});

export type TechnologyResearchResult = z.infer<typeof technologyResearchResultSchema>;

export const technologyInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  websiteUrl: z.string().optional(),
  // Existing data for incremental update
  existingData: z
    .object({
      logoUrl: z.string().nullable().optional(),
      websiteUrl: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      license: z.string().nullable().optional(),
      latestVersion: z.string().nullable().optional(),
      githubUrl: z.string().nullable().optional(),
      githubStars: z.number().nullable().optional(),
      lastRelease: z.string().nullable().optional(),
      communitySize: z.string().nullable().optional(),
      pros: z.string().nullable().optional(),
      cons: z.string().nullable().optional(),
      usps: z.string().nullable().optional(),
      targetAudiences: z.string().nullable().optional(),
      useCases: z.string().nullable().optional(),
      adessoExpertise: z.string().nullable().optional(),
      lastResearchedAt: z.date().nullable().optional(),
    })
    .optional(),
});

export type TechnologyInfo = z.infer<typeof technologyInfoSchema>;
