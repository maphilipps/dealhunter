import { z } from 'zod';

/**
 * Schema for tech stack detection results
 */
export const techStackSchema = z.object({
  // CMS Detection
  cms: z.string().optional().describe('Detected CMS (WordPress, Drupal, Typo3, Joomla, Custom, etc.)'),
  cmsVersion: z.string().optional().describe('CMS version if detectable'),
  cmsConfidence: z.number().min(0).max(100).describe('Confidence in CMS detection (0-100)'),

  // Framework Detection
  framework: z.string().optional().describe('Frontend framework (React, Vue, Angular, jQuery, Vanilla JS, etc.)'),
  frameworkVersion: z.string().optional().describe('Framework version if detectable'),

  // Backend Detection
  backend: z.array(z.string()).describe('Backend technologies detected (PHP, Node.js, Java, .NET, Python, etc.)'),

  // Hosting & Infrastructure
  hosting: z.string().optional().describe('Hosting provider (AWS, Azure, GCP, on-premise, Unknown)'),
  cdn: z.string().optional().describe('CDN provider if detected (Cloudflare, Akamai, etc.)'),
  server: z.string().optional().describe('Web server (Apache, Nginx, IIS, etc.)'),

  // Additional Technologies
  libraries: z.array(z.string()).describe('JavaScript libraries and tools detected'),
  analytics: z.array(z.string()).describe('Analytics tools (Google Analytics, Matomo, etc.)'),
  marketing: z.array(z.string()).describe('Marketing tools (HubSpot, Mailchimp, etc.)'),

  // Overall Assessment
  overallConfidence: z.number().min(0).max(100).describe('Overall confidence in tech stack detection'),
});

export type TechStack = z.infer<typeof techStackSchema>;

/**
 * Schema for content volume analysis
 */
export const contentVolumeSchema = z.object({
  estimatedPageCount: z.number().describe('Estimated total number of pages'),
  contentTypes: z.array(z.object({
    type: z.string().describe('Content type (Blog, Product, Service, etc.)'),
    count: z.number().describe('Estimated count of this content type'),
  })),
  mediaAssets: z.object({
    images: z.number().describe('Estimated number of images'),
    videos: z.number().describe('Estimated number of videos'),
    documents: z.number().describe('Estimated number of downloadable documents'),
  }),
  languages: z.array(z.string()).describe('Detected languages'),
  complexity: z.enum(['low', 'medium', 'high']).describe('Overall content complexity'),
});

export type ContentVolume = z.infer<typeof contentVolumeSchema>;

/**
 * Schema for feature detection
 */
export const featuresSchema = z.object({
  ecommerce: z.boolean().describe('Has e-commerce functionality'),
  userAccounts: z.boolean().describe('Has user account system'),
  search: z.boolean().describe('Has search functionality'),
  multiLanguage: z.boolean().describe('Multi-language support'),
  blog: z.boolean().describe('Has blog/news section'),
  forms: z.boolean().describe('Has contact forms or other forms'),
  api: z.boolean().describe('Has API endpoints detected'),
  mobileApp: z.boolean().describe('Has mobile app integration'),
  customFeatures: z.array(z.string()).describe('Other notable features detected'),
});

export type Features = z.infer<typeof featuresSchema>;

/**
 * Schema for business line recommendation
 */
export const blRecommendationSchema = z.object({
  primaryBusinessLine: z.string().describe('Primary recommended business line'),
  confidence: z.number().min(0).max(100).describe('Confidence in recommendation (0-100)'),
  reasoning: z.string().describe('Explanation for the recommendation'),
  alternativeBusinessLines: z.array(z.object({
    name: z.string(),
    confidence: z.number().min(0).max(100),
    reason: z.string(),
  })).describe('Alternative business line recommendations'),
  requiredSkills: z.array(z.string()).describe('Key skills needed for this project'),
});

export type BLRecommendation = z.infer<typeof blRecommendationSchema>;
