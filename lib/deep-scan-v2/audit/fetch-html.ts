/**
 * HTML fetcher for audit modules with SSRF protection and size limits.
 */
import { validateUrlForFetch } from '@/lib/utils/url-validation';

const USER_AGENT = 'Dealhunter-DeepScanV2/1.0 (Website Audit Bot)';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_SIZE = 2 * 1024 * 1024; // 2MB limit

export interface FetchedPage {
  html: string;
  headers: Record<string, string>;
  statusCode: number;
}

export async function fetchHtml(url: string): Promise<FetchedPage> {
  validateUrlForFetch(url);

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  let html = await response.text();

  if (html.length > MAX_HTML_SIZE) {
    console.warn(
      `[fetchHtml] HTML truncated from ${html.length} to ${MAX_HTML_SIZE} bytes for ${url}`
    );
    html = html.slice(0, MAX_HTML_SIZE);
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return { html, headers, statusCode: response.status };
}
