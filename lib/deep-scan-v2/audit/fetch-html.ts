/**
 * Simple HTML fetcher for audit modules.
 * Reuses SSRF protection patterns from deep-analysis/utils/crawler.ts.
 */

const USER_AGENT = 'Dealhunter-DeepScanV2/1.0 (Website Audit Bot)';
const FETCH_TIMEOUT_MS = 15_000;

export async function fetchHtml(url: string): Promise<{
  html: string;
  headers: Record<string, string>;
  statusCode: number;
}> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return { html, headers, statusCode: response.status };
}
