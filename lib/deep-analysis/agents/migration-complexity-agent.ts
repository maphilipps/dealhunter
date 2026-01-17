/**
 * Migration Complexity Scorer Agent
 * Assesses CMS export capabilities and data quality
 * Expected duration: 4-6 minutes
 */

import { MigrationComplexitySchema, type MigrationComplexity } from '../schemas';
import { checkExportCapabilities, assessDataQuality } from '../utils/cms-detector';

export async function scoreMigrationComplexity(
  websiteUrl: string,
  sourceCMS: string,
  sampleUrls: string[],
  contentTypeCount: number,
  onProgress?: (message: string) => void
): Promise<MigrationComplexity> {
  onProgress?.('Detecting source CMS export capabilities...');

  // Step 1: Check export capabilities
  const exportCapabilities = await checkExportCapabilities(websiteUrl, sourceCMS);

  onProgress?.('Assessing data quality...');

  // Step 2: Assess data quality
  const dataQuality = await assessDataQuality(websiteUrl, sampleUrls);

  onProgress?.('Calculating complexity score...');

  // Step 3: Calculate complexity factors
  const sourceCMSType = (sourceCMS.toLowerCase().includes('wordpress')
    ? 'wordpress'
    : sourceCMS.toLowerCase().includes('drupal')
    ? 'drupal'
    : sourceCMS.toLowerCase().includes('typo3')
    ? 'typo3'
    : 'custom') as 'wordpress' | 'drupal' | 'typo3' | 'custom';

  const factors = {
    sourceCMSType,
    hasStandardExport: exportCapabilities.xmlExport || exportCapabilities.restAPI,
    apiAvailable: exportCapabilities.restAPI,
    contentTypeCount,
    customPlugins: 0, // TODO: Detect from CMS (requires authenticated access)
    thirdPartyIntegrations: 0, // TODO: Detect from CMS (requires authenticated access)
  };

  // Step 4: Calculate complexity score (0-100)
  let score = 20; // Base complexity

  // Source CMS impact
  if (factors.sourceCMSType === 'custom') {
    score += 30; // Custom CMS is significantly more complex
  } else if (factors.sourceCMSType === 'typo3') {
    score += 15; // TYPO3 is moderately complex
  } else if (factors.sourceCMSType === 'drupal') {
    score += 5; // Drupal to Drupal is simpler
  }
  // WordPress gets 0 (baseline)

  // Export capabilities impact
  if (!factors.hasStandardExport) {
    score += 20; // No standard export is a major blocker
  }
  if (!factors.apiAvailable) {
    score += 10; // No API makes automation harder
  }

  // Content complexity impact
  if (contentTypeCount > 20) {
    score += 10; // Many content types add complexity
  } else if (contentTypeCount > 10) {
    score += 5;
  }

  // Data quality impact
  if (dataQuality.brokenLinks > 50) {
    score += 5;
  } else if (dataQuality.brokenLinks > 20) {
    score += 3;
  }

  if (dataQuality.duplicateContent) {
    score += 5;
  }

  if (dataQuality.inconsistentStructure) {
    score += 5;
  }

  // Cap at 100
  score = Math.min(score, 100);

  onProgress?.(`Complexity score calculated: ${score}/100`);

  // Step 5: Validate and return
  return MigrationComplexitySchema.parse({
    score,
    factors,
    exportCapabilities,
    dataQuality,
  });
}
