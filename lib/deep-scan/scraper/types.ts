export interface ScrapedPage {
  url: string;
  title: string;
  html: string;
  text: string;
  screenshot?: string;
  screenshotMobile?: string;
  structure: PageStructure;
  techIndicators: TechIndicator[];
  externalRequests: ExternalRequest[];
  scrapedAt: string;
}

export interface PageStructure {
  headings: { level: number; text: string }[];
  navigation: { type: 'header' | 'footer' | 'sidebar'; links: string[] }[];
  sections: { tag: string; className?: string; id?: string }[];
  forms: { action?: string; method?: string; inputs: string[] }[];
  images: number;
  videos: number;
  iframes: { src: string }[];
}

export interface TechIndicator {
  name: string;
  category: 'cms' | 'framework' | 'library' | 'analytics' | 'hosting' | 'other';
  confidence: number;
  evidence: string;
}

export interface ExternalRequest {
  url: string;
  type: 'script' | 'api' | 'tracking' | 'cdn' | 'other';
  domain: string;
}

export interface ScrapeResult {
  success: boolean;
  pages: ScrapedPage[];
  sitemapFound: boolean;
  techStack: TechIndicator[];
  errors: string[];
  duration: number;
}

export interface ScrapeOptions {
  maxPages?: number;
  maxDepth?: number;
  includeScreenshots?: boolean;
  includeMobile?: boolean;
  timeout?: number;
}
