import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize text by stripping ALL HTML tags and keeping only text content.
 * Use this for user input, AI-generated content, or any untrusted data.
 *
 * @param text - The text to sanitize
 * @returns Sanitized text with all HTML removed
 *
 * @example
 * sanitizeText('<script>alert(1)</script>Hello') // Returns: 'Hello'
 * sanitizeText('&#60;script&#62;alert(1)&#60;/script&#62;') // Returns: 'alert(1)'
 */
export function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content
  });
}

/**
 * Sanitize HTML while allowing specific tags.
 * Use with caution - prefer sanitizeText() when possible.
 *
 * @param html - The HTML to sanitize
 * @param allowedTags - Array of allowed HTML tags (default: [])
 * @returns Sanitized HTML with only allowed tags
 *
 * @example
 * sanitizeHtml('<b>Hello</b><script>alert(1)</script>', ['b']) // Returns: '<b>Hello</b>'
 */
export function sanitizeHtml(html: string, allowedTags: string[] = []): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: [],
  });
}

/**
 * Validate and sanitize a URL.
 * Only allows http/https protocols and removes any malicious content.
 *
 * @param url - The URL to validate and sanitize
 * @returns The sanitized URL
 * @throws Error if URL is invalid or uses disallowed protocol
 *
 * @example
 * sanitizeUrl('https://example.com') // Returns: 'https://example.com'
 * sanitizeUrl('javascript:alert(1)') // Throws error
 */
export function sanitizeUrl(url: string): string {
  // Only allow http/https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('URL must use http or https protocol');
  }

  // Sanitize and check if URL is still valid
  const sanitized = DOMPurify.sanitize(url, { ALLOWED_TAGS: [] });

  try {
    new URL(sanitized);
    return sanitized;
  } catch {
    throw new Error('Invalid URL after sanitization');
  }
}
