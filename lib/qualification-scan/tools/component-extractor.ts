/**
 * Component Extractor - Extract UI components from HTML pages
 * Analyzes DOM patterns to identify navigation, content blocks, forms, media, and interactive elements
 */

import type { PageData } from './multi-page-analyzer';

export interface NavigationComponent {
  type:
    | 'mega_menu'
    | 'sticky_header'
    | 'mobile_menu'
    | 'sidebar'
    | 'breadcrumbs'
    | 'pagination'
    | 'standard';
  features: string[];
  itemCount?: number;
  maxDepth?: number;
}

export interface ContentBlockComponent {
  type:
    | 'hero'
    | 'cards'
    | 'teaser'
    | 'accordion'
    | 'tabs'
    | 'slider'
    | 'testimonials'
    | 'timeline'
    | 'grid'
    | 'list'
    | 'cta'
    | 'pricing'
    | 'faq'
    | 'team'
    | 'stats'
    | 'features';
  count: number;
  examples: string[];
  hasImages?: boolean;
  hasLinks?: boolean;
}

export interface FormComponent {
  type:
    | 'contact'
    | 'newsletter'
    | 'search'
    | 'login'
    | 'registration'
    | 'checkout'
    | 'filter'
    | 'generic';
  fields: number;
  hasValidation?: boolean;
  hasFileUpload?: boolean;
  hasCaptcha?: boolean;
}

export interface MediaComponent {
  type:
    | 'image_gallery'
    | 'video_embed'
    | 'video_player'
    | 'audio_player'
    | 'carousel'
    | 'lightbox'
    | 'background_video';
  count: number;
  providers?: string[];
}

export interface ExtractedComponents {
  navigation: NavigationComponent[];
  contentBlocks: ContentBlockComponent[];
  forms: FormComponent[];
  mediaElements: MediaComponent[];
  interactiveElements: string[];
  summary: {
    totalComponents: number;
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    uniquePatterns: number;
    estimatedComponentTypes: number;
  };
}

/**
 * Navigation detection patterns
 */
const NAVIGATION_PATTERNS = {
  mega_menu: [
    /mega-?menu/i,
    /nav.*dropdown.*dropdown/i,
    /class="[^"]*mega[^"]*"/i,
    /<nav[^>]*>[\s\S]*?<ul[^>]*>[\s\S]*?<li[^>]*>[\s\S]*?<ul[^>]*>/i,
  ],
  sticky_header: [
    /sticky/i,
    /fixed.*header/i,
    /position:\s*fixed/i,
    /header.*scrolled/i,
    /navbar-fixed/i,
  ],
  mobile_menu: [
    /mobile-?menu/i,
    /hamburger/i,
    /burger-?menu/i,
    /nav-?toggle/i,
    /menu-?toggle/i,
    /offcanvas/i,
    /drawer/i,
  ],
  sidebar: [/sidebar/i, /side-?nav/i, /aside.*nav/i],
  breadcrumbs: [/breadcrumb/i, /aria-label="breadcrumb"/i, /itemtype=".*BreadcrumbList"/i],
  pagination: [/pagination/i, /page-?numbers/i, /nav.*prev.*next/i],
};

/**
 * Content block detection patterns
 */
const CONTENT_BLOCK_PATTERNS = {
  hero: [/hero/i, /banner/i, /jumbotron/i, /stage/i, /masthead/i, /intro-?section/i],
  cards: [/card/i, /tile/i, /box/i, /panel/i, /<article[^>]*class/i],
  teaser: [/teaser/i, /preview/i, /excerpt/i, /snippet/i],
  accordion: [/accordion/i, /collaps/i, /expand/i, /data-toggle="collapse"/i, /aria-expanded/i],
  tabs: [
    /tab-?content/i,
    /tab-?pane/i,
    /role="tablist"/i,
    /role="tabpanel"/i,
    /data-toggle="tab"/i,
  ],
  slider: [/slider/i, /carousel/i, /swiper/i, /slick/i, /owl-?carousel/i, /splide/i, /glide/i],
  testimonials: [/testimonial/i, /review/i, /quote/i, /feedback/i, /kundenstimme/i],
  timeline: [/timeline/i, /history/i, /milestones/i, /chronolog/i],
  grid: [/grid/i, /masonry/i, /columns/i],
  cta: [/cta/i, /call-?to-?action/i, /action-?button/i],
  pricing: [/pricing/i, /price-?table/i, /tariff/i, /plans?-?table/i],
  faq: [/faq/i, /questions/i, /help-?center/i, /support/i],
  team: [/team/i, /staff/i, /members?/i, /mitarbeiter/i, /employees/i],
  stats: [/stats?/i, /counter/i, /numbers?/i, /facts?/i, /figures?/i, /kennzahlen/i],
  features: [/features?/i, /benefits?/i, /services?/i, /leistungen/i, /vorteile/i],
};

/**
 * Form detection patterns
 */
const FORM_PATTERNS = {
  contact: [/contact/i, /kontakt/i, /anfrage/i, /inquiry/i, /message/i, /nachricht/i],
  newsletter: [/newsletter/i, /subscribe/i, /mailing/i, /email.*signup/i],
  search: [/search/i, /suche/i, /type="search"/i, /role="search"/i],
  login: [/login/i, /signin/i, /anmeld/i, /password.*username/i],
  registration: [/regist/i, /signup/i, /create.*account/i],
  checkout: [/checkout/i, /payment/i, /billing/i, /shipping/i, /order/i],
  filter: [/filter/i, /sort/i, /refine/i, /facet/i],
};

/**
 * Media detection patterns
 */
const MEDIA_PATTERNS = {
  image_gallery: [/gallery/i, /lightbox/i, /fancybox/i, /photoswipe/i, /magnific/i],
  video_embed: [/youtube/i, /vimeo/i, /wistia/i, /iframe.*video/i, /embed.*video/i],
  video_player: [/<video/i, /video-?player/i, /plyr/i, /video\.js/i],
  audio_player: [/<audio/i, /audio-?player/i, /podcast/i],
  carousel: [/carousel/i, /slider.*image/i, /image.*slider/i],
  background_video: [/background.*video/i, /video.*background/i, /hero.*video/i],
};

/**
 * Interactive element detection patterns
 */
const INTERACTIVE_PATTERNS = [
  { name: 'Modal/Popup', patterns: [/modal/i, /popup/i, /dialog/i, /overlay/i] },
  { name: 'Tooltip', patterns: [/tooltip/i, /popover/i, /hint/i] },
  { name: 'Dropdown', patterns: [/dropdown/i, /select/i, /combobox/i] },
  { name: 'Date Picker', patterns: [/datepicker/i, /calendar/i, /flatpickr/i, /pikaday/i] },
  { name: 'Autocomplete', patterns: [/autocomplete/i, /typeahead/i, /autosuggest/i] },
  { name: 'File Upload', patterns: [/file.*upload/i, /dropzone/i, /drag.*drop/i] },
  { name: 'Map', patterns: [/google.*map/i, /mapbox/i, /leaflet/i, /openstreetmap/i] },
  { name: 'Chat Widget', patterns: [/chat/i, /messenger/i, /intercom/i, /zendesk/i, /freshdesk/i] },
  { name: 'Cookie Banner', patterns: [/cookie/i, /consent/i, /gdpr/i, /privacy.*banner/i] },
  { name: 'Social Share', patterns: [/share/i, /social/i, /facebook/i, /twitter/i, /linkedin/i] },
  { name: 'Print Button', patterns: [/print/i, /drucken/i] },
  { name: 'Back to Top', patterns: [/back.*top/i, /scroll.*top/i, /totop/i] },
  { name: 'Progress Bar', patterns: [/progress/i, /loading/i, /spinner/i] },
  { name: 'Rating/Stars', patterns: [/rating/i, /stars?/i, /review/i, /bewertung/i] },
  { name: 'Countdown', patterns: [/countdown/i, /timer/i] },
];

/**
 * Count pattern matches in HTML
 */
function countMatches(html: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const matches = html.match(new RegExp(pattern, 'gi'));
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Check if pattern exists in HTML
 */
function hasPattern(html: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(html));
}

/**
 * Extract examples (class names or IDs) for a pattern
 */
function extractExamples(html: string, patterns: RegExp[], maxExamples: number = 3): string[] {
  const examples: string[] = [];

  for (const pattern of patterns) {
    const contextPattern = new RegExp(
      `class="[^"]*${pattern.source}[^"]*"|id="[^"]*${pattern.source}[^"]*"`,
      'gi'
    );
    const matches = html.match(contextPattern);

    if (matches) {
      for (const match of matches) {
        const cleaned = match.replace(/class="|id="|"/g, '').trim();
        if (cleaned && !examples.includes(cleaned) && examples.length < maxExamples) {
          examples.push(cleaned);
        }
      }
    }
  }

  return examples;
}

/**
 * Analyze form fields
 */
function analyzeForm(html: string, formPatterns: RegExp[]): FormComponent | null {
  // Find form context
  let formHtml = html;

  for (const pattern of formPatterns) {
    const formMatch = html.match(new RegExp(`<form[^>]*${pattern.source}[^>]*>.*?</form>`, 'is'));
    if (formMatch) {
      formHtml = formMatch[0];
      break;
    }
  }

  // Count form fields
  const inputCount = (formHtml.match(/<input[^>]*>/gi) || []).length;
  const textareaCount = (formHtml.match(/<textarea[^>]*>/gi) || []).length;
  const selectCount = (formHtml.match(/<select[^>]*>/gi) || []).length;

  const totalFields = inputCount + textareaCount + selectCount;

  if (totalFields === 0) return null;

  return {
    type: 'generic',
    fields: totalFields,
    hasValidation: /required|pattern=|data-validation/i.test(formHtml),
    hasFileUpload: /type="file"/i.test(formHtml),
    hasCaptcha: /captcha|recaptcha|hcaptcha/i.test(formHtml),
  };
}

/**
 * Extract components from a single page
 */
export function extractComponentsFromPage(page: PageData): ExtractedComponents {
  const html = page.html || '';

  const navigation: NavigationComponent[] = [];
  const contentBlocks: ContentBlockComponent[] = [];
  const forms: FormComponent[] = [];
  const mediaElements: MediaComponent[] = [];
  const interactiveElements: string[] = [];

  // Detect navigation components
  for (const [type, patterns] of Object.entries(NAVIGATION_PATTERNS)) {
    if (hasPattern(html, patterns)) {
      const features: string[] = [];

      // Detect additional features
      if (/search/i.test(html)) features.push('search');
      if (/logo/i.test(html)) features.push('logo');
      if (/lang|language/i.test(html)) features.push('language_switcher');
      if (/cart|warenkorb/i.test(html)) features.push('cart');

      navigation.push({
        type: type as NavigationComponent['type'],
        features,
      });
    }
  }

  // If no special navigation found, add standard
  if (navigation.length === 0 && /<nav/i.test(html)) {
    navigation.push({
      type: 'standard',
      features: [],
    });
  }

  // Detect content blocks
  for (const [type, patterns] of Object.entries(CONTENT_BLOCK_PATTERNS)) {
    const count = countMatches(html, patterns);
    if (count > 0) {
      const examples = extractExamples(html, patterns);
      contentBlocks.push({
        type: type as ContentBlockComponent['type'],
        count: Math.min(count, 50), // Cap at reasonable number
        examples,
        hasImages: /<img/i.test(html),
        hasLinks: /<a[^>]*href/i.test(html),
      });
    }
  }

  // Detect forms
  for (const [type, patterns] of Object.entries(FORM_PATTERNS)) {
    if (hasPattern(html, patterns)) {
      const formData = analyzeForm(html, patterns);
      if (formData) {
        forms.push({
          ...formData,
          type: type as FormComponent['type'],
        });
      }
    }
  }

  // Detect media elements
  for (const [type, patterns] of Object.entries(MEDIA_PATTERNS)) {
    const count = countMatches(html, patterns);
    if (count > 0) {
      const providers: string[] = [];

      // Detect video providers
      if (/youtube/i.test(html)) providers.push('YouTube');
      if (/vimeo/i.test(html)) providers.push('Vimeo');
      if (/wistia/i.test(html)) providers.push('Wistia');

      mediaElements.push({
        type: type as MediaComponent['type'],
        count: Math.min(count, 50),
        providers: providers.length > 0 ? providers : undefined,
      });
    }
  }

  // Detect interactive elements
  for (const { name, patterns } of INTERACTIVE_PATTERNS) {
    if (hasPattern(html, patterns)) {
      interactiveElements.push(name);
    }
  }

  // Calculate summary
  const totalComponents =
    navigation.length +
    contentBlocks.length +
    forms.length +
    mediaElements.length +
    interactiveElements.length;

  const uniquePatterns = new Set([
    ...navigation.map(n => n.type),
    ...contentBlocks.map(c => c.type),
    ...forms.map(f => f.type),
    ...mediaElements.map(m => m.type),
    ...interactiveElements,
  ]).size;

  let complexity: ExtractedComponents['summary']['complexity'] = 'simple';
  if (totalComponents > 20 || uniquePatterns > 15) {
    complexity = 'very_complex';
  } else if (totalComponents > 12 || uniquePatterns > 10) {
    complexity = 'complex';
  } else if (totalComponents > 5 || uniquePatterns > 5) {
    complexity = 'moderate';
  }

  return {
    navigation,
    contentBlocks,
    forms,
    mediaElements,
    interactiveElements,
    summary: {
      totalComponents,
      complexity,
      uniquePatterns,
      estimatedComponentTypes: Math.ceil(uniquePatterns * 1.5), // Estimate for CMS
    },
  };
}

/**
 * Merge component results from multiple pages
 */
export function mergeComponentResults(results: ExtractedComponents[]): ExtractedComponents {
  const navigationMap = new Map<string, NavigationComponent>();
  const contentBlockMap = new Map<string, ContentBlockComponent>();
  const formMap = new Map<string, FormComponent>();
  const mediaMap = new Map<string, MediaComponent>();
  const interactiveSet = new Set<string>();

  for (const result of results) {
    // Merge navigation
    for (const nav of result.navigation) {
      const existing = navigationMap.get(nav.type);
      if (existing) {
        existing.features = [...new Set([...existing.features, ...nav.features])];
      } else {
        navigationMap.set(nav.type, { ...nav });
      }
    }

    // Merge content blocks
    for (const block of result.contentBlocks) {
      const existing = contentBlockMap.get(block.type);
      if (existing) {
        existing.count += block.count;
        existing.examples = [...new Set([...existing.examples, ...block.examples])].slice(0, 5);
      } else {
        contentBlockMap.set(block.type, { ...block });
      }
    }

    // Merge forms
    for (const form of result.forms) {
      const existing = formMap.get(form.type);
      if (existing) {
        existing.fields = Math.max(existing.fields, form.fields);
        existing.hasValidation = existing.hasValidation || form.hasValidation;
        existing.hasFileUpload = existing.hasFileUpload || form.hasFileUpload;
        existing.hasCaptcha = existing.hasCaptcha || form.hasCaptcha;
      } else {
        formMap.set(form.type, { ...form });
      }
    }

    // Merge media
    for (const media of result.mediaElements) {
      const existing = mediaMap.get(media.type);
      if (existing) {
        existing.count += media.count;
        if (media.providers) {
          existing.providers = [...new Set([...(existing.providers || []), ...media.providers])];
        }
      } else {
        mediaMap.set(media.type, { ...media });
      }
    }

    // Merge interactive elements
    for (const interactive of result.interactiveElements) {
      interactiveSet.add(interactive);
    }
  }

  const navigation = Array.from(navigationMap.values());
  const contentBlocks = Array.from(contentBlockMap.values()).sort((a, b) => b.count - a.count);
  const forms = Array.from(formMap.values());
  const mediaElements = Array.from(mediaMap.values());
  const interactiveElements = Array.from(interactiveSet);

  const totalComponents =
    navigation.length +
    contentBlocks.length +
    forms.length +
    mediaElements.length +
    interactiveElements.length;

  const uniquePatterns = new Set([
    ...navigation.map(n => n.type),
    ...contentBlocks.map(c => c.type),
    ...forms.map(f => f.type),
    ...mediaElements.map(m => m.type),
    ...interactiveElements,
  ]).size;

  let complexity: ExtractedComponents['summary']['complexity'] = 'simple';
  if (totalComponents > 25 || uniquePatterns > 18) {
    complexity = 'very_complex';
  } else if (totalComponents > 15 || uniquePatterns > 12) {
    complexity = 'complex';
  } else if (totalComponents > 8 || uniquePatterns > 6) {
    complexity = 'moderate';
  }

  return {
    navigation,
    contentBlocks,
    forms,
    mediaElements,
    interactiveElements,
    summary: {
      totalComponents,
      complexity,
      uniquePatterns,
      estimatedComponentTypes: Math.ceil(uniquePatterns * 1.3),
    },
  };
}

/**
 * Extract components from multiple pages
 */
export function extractComponents(pages: PageData[]): ExtractedComponents {
  const validPages = pages.filter(p => p.html && !p.error);

  if (validPages.length === 0) {
    return {
      navigation: [],
      contentBlocks: [],
      forms: [],
      mediaElements: [],
      interactiveElements: [],
      summary: {
        totalComponents: 0,
        complexity: 'simple',
        uniquePatterns: 0,
        estimatedComponentTypes: 0,
      },
    };
  }

  const pageResults = validPages.map(page => extractComponentsFromPage(page));
  return mergeComponentResults(pageResults);
}
