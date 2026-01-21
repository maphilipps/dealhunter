import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeContentArchitecture,
  type AnalyzeContentArchitectureInput,
} from '@/lib/agents/content-architecture-agent';

// Mock generateObject
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

// Mock AI provider
vi.mock('@/lib/ai/providers', () => ({
  openai: vi.fn(() => 'mock-model'),
}));

describe('Content Architecture Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeContentArchitecture', () => {
    it('should return error when crawl data is missing', async () => {
      const input: AnalyzeContentArchitectureInput = {
        websiteUrl: 'https://example.com',
        crawlData: {
          crawledAt: new Date().toISOString(),
        },
      };

      const result = await analyzeContentArchitecture(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing or incomplete crawl data');
      expect(result.pageCount).toBe(0);
      expect(result.pageCountConfidence).toBe('low');
    });

    it('should return error when sample pages array is empty', async () => {
      const input: AnalyzeContentArchitectureInput = {
        websiteUrl: 'https://example.com',
        crawlData: {
          samplePages: [],
          crawledAt: new Date().toISOString(),
        },
      };

      const result = await analyzeContentArchitecture(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing or incomplete crawl data');
    });

    it('should analyze content architecture with valid crawl data', async () => {
      const { generateObject } = await import('ai');

      // Mock AI response
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          pageCountEstimate: 150,
          pageCountConfidence: 'medium' as const,
          contentTypes: [
            {
              name: 'News Article',
              pattern: '/news/',
              estimatedCount: 50,
              characteristics: ['Has publish date', 'Has author'],
            },
            {
              name: 'Product Page',
              pattern: '/products/',
              estimatedCount: 30,
              characteristics: ['Has price', 'Has images'],
            },
          ],
          navigationDepth: 3,
          navigationBreadth: 5,
          mainNavItems: ['Home', 'Products', 'About', 'Contact'],
          imageCount: 500,
          videoCount: 10,
          documentCount: 20,
        },
      } as never);

      const input: AnalyzeContentArchitectureInput = {
        websiteUrl: 'https://example.com',
        crawlData: {
          homepage: {
            url: 'https://example.com',
            title: 'Example Website',
            description: 'An example website',
          },
          samplePages: [
            'https://example.com/news/article-1',
            'https://example.com/news/article-2',
            'https://example.com/products/product-1',
            'https://example.com/about',
          ],
          crawledAt: new Date().toISOString(),
        },
      };

      const result = await analyzeContentArchitecture(input);

      expect(result.success).toBe(true);
      expect(result.pageCount).toBe(150);
      expect(result.pageCountConfidence).toBe('medium');
      expect(result.contentTypes).toHaveLength(2);
      expect(result.contentTypes[0].name).toBe('News Article');
      expect(result.navigationStructure.depth).toBe(3);
      expect(result.navigationStructure.breadth).toBe(5);
      expect(result.navigationStructure.mainNavItems).toEqual([
        'Home',
        'Products',
        'About',
        'Contact',
      ]);
      expect(result.contentVolume.images).toBe(500);
      expect(result.contentVolume.videos).toBe(10);
      expect(result.contentVolume.documents).toBe(20);
      expect(result.contentVolume.totalAssets).toBe(530);
      expect(result.siteTree).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should generate site tree with homepage', async () => {
      const { generateObject } = await import('ai');

      vi.mocked(generateObject).mockResolvedValue({
        object: {
          pageCountEstimate: 50,
          pageCountConfidence: 'high' as const,
          contentTypes: [],
          navigationDepth: 2,
          navigationBreadth: 4,
          mainNavItems: ['Home', 'About'],
          imageCount: 100,
          videoCount: 0,
          documentCount: 5,
        },
      } as never);

      const input: AnalyzeContentArchitectureInput = {
        websiteUrl: 'https://example.com',
        crawlData: {
          homepage: {
            url: 'https://example.com',
            title: 'Home Page',
            description: 'Homepage',
          },
          samplePages: ['https://example.com/about', 'https://example.com/contact'],
          crawledAt: new Date().toISOString(),
        },
      };

      const result = await analyzeContentArchitecture(input);

      expect(result.success).toBe(true);
      expect(result.siteTree).toBeDefined();
      expect(result.siteTree.length).toBeGreaterThan(0);
      expect(result.siteTree[0].title).toBe('Home Page');
      expect(result.siteTree[0].level).toBe(0);
      expect(result.siteTree[0].children).toBeDefined();
    });

    it('should handle AI errors gracefully', async () => {
      const { generateObject } = await import('ai');

      vi.mocked(generateObject).mockRejectedValue(new Error('AI service unavailable'));

      const input: AnalyzeContentArchitectureInput = {
        websiteUrl: 'https://example.com',
        crawlData: {
          homepage: {
            url: 'https://example.com',
            title: 'Example',
            description: 'Test',
          },
          samplePages: ['https://example.com/page1'],
          crawledAt: new Date().toISOString(),
        },
      };

      const result = await analyzeContentArchitecture(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI service unavailable');
      expect(result.pageCount).toBe(0);
      expect(result.contentTypes).toEqual([]);
    });

    it('should handle different confidence levels correctly', async () => {
      const { generateObject } = await import('ai');

      for (const confidence of ['low', 'medium', 'high'] as const) {
        vi.mocked(generateObject).mockResolvedValue({
          object: {
            pageCountEstimate: 100,
            pageCountConfidence: confidence,
            contentTypes: [],
            navigationDepth: 2,
            navigationBreadth: 3,
            mainNavItems: [],
            imageCount: 50,
            videoCount: 0,
            documentCount: 0,
          },
        } as never);

        const input: AnalyzeContentArchitectureInput = {
          websiteUrl: 'https://example.com',
          crawlData: {
            samplePages: ['https://example.com/test'],
            crawledAt: new Date().toISOString(),
          },
        };

        const result = await analyzeContentArchitecture(input);

        expect(result.success).toBe(true);
        expect(result.pageCountConfidence).toBe(confidence);
      }
    });

    it('should include analyzed timestamp', async () => {
      const { generateObject } = await import('ai');

      vi.mocked(generateObject).mockResolvedValue({
        object: {
          pageCountEstimate: 100,
          pageCountConfidence: 'medium' as const,
          contentTypes: [],
          navigationDepth: 2,
          navigationBreadth: 3,
          mainNavItems: [],
          imageCount: 50,
          videoCount: 0,
          documentCount: 0,
        },
      } as never);

      const input: AnalyzeContentArchitectureInput = {
        websiteUrl: 'https://example.com',
        crawlData: {
          samplePages: ['https://example.com/test'],
          crawledAt: new Date().toISOString(),
        },
      };

      const beforeTime = new Date().toISOString();
      const result = await analyzeContentArchitecture(input);
      const afterTime = new Date().toISOString();

      expect(result.analyzedAt).toBeDefined();
      expect(result.analyzedAt >= beforeTime).toBe(true);
      expect(result.analyzedAt <= afterTime).toBe(true);
    });
  });
});
