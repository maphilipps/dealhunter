/**
 * Core wrapper for agent-browser CLI
 * Provides async functions for browser automation
 *
 * @see https://github.com/AIMONAgent/agent-browser
 */

import { execa, type Options as ExecaOptions } from 'execa';

import type {
  BrowserSession,
  SnapshotOptions,
  ScreenshotOptions,
  ViewportOptions,
  SnapshotResult,
  NetworkResult,
  PageContent,
} from './types';

// ========================================
// Configuration
// ========================================

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const CLI_COMMAND = 'agent-browser';

interface CommandOptions extends ExecaOptions {
  session?: string;
}

// ========================================
// Internal Helpers
// ========================================

/**
 * Build CLI args array from options
 */
function buildArgs(baseArgs: string[], options: BrowserSession = {}): string[] {
  const args = [...baseArgs];

  if (options.session) {
    args.unshift('--session', options.session);
  }

  if (options.headed) {
    args.push('--headed');
  }

  return args;
}

/**
 * Execute agent-browser CLI command
 */
async function runCommand(
  args: string[],
  options: CommandOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  const { session, timeout = DEFAULT_TIMEOUT, ...execaOpts } = options;

  const finalArgs = session ? ['--session', session, ...args] : args;

  try {
    const result = await execa(CLI_COMMAND, finalArgs, {
      timeout,
      reject: false,
      encoding: 'utf8',
      ...execaOpts,
    });

    const stdout = typeof result.stdout === 'string' ? result.stdout : '';
    const stderr = typeof result.stderr === 'string' ? result.stderr : '';

    if (result.exitCode !== 0 && stderr) {
      console.error(`[agent-browser] Command failed:`, stderr);
    }

    return { stdout, stderr };
  } catch (error) {
    console.error(`[agent-browser] Error executing command:`, error);
    throw error;
  }
}

/**
 * Execute command and parse JSON output
 */
async function runJsonCommand<T>(args: string[], options: CommandOptions = {}): Promise<T | null> {
  const { stdout } = await runCommand([...args, '--json'], options);

  if (!stdout.trim()) {
    return null;
  }

  try {
    return JSON.parse(stdout) as T;
  } catch (error) {
    console.error(`[agent-browser] Failed to parse JSON:`, stdout.slice(0, 200));
    return null;
  }
}

// ========================================
// Core Browser Actions
// ========================================

/**
 * Open a URL in the browser
 */
export async function openPage(url: string, options: BrowserSession = {}): Promise<boolean> {
  const args = buildArgs(['open', url], options);
  const { stderr } = await runCommand(args, { session: options.session });
  return !stderr.includes('error');
}

/**
 * Close the browser session
 */
export async function closeBrowser(options: BrowserSession = {}): Promise<void> {
  await runCommand(['close'], { session: options.session });
}

/**
 * Navigate back in history
 */
export async function goBack(options: BrowserSession = {}): Promise<void> {
  await runCommand(['back'], { session: options.session });
}

/**
 * Reload the current page
 */
export async function reload(options: BrowserSession = {}): Promise<void> {
  await runCommand(['reload'], { session: options.session });
}

// ========================================
// Content Retrieval
// ========================================

/**
 * Get the current page HTML
 */
export async function getHtml(options: BrowserSession = {}): Promise<string> {
  // agent-browser now requires a selector for 'get html'
  // Using 'html' selector to get the complete document HTML
  const { stdout } = await runCommand(['get', 'html', 'html'], { session: options.session });
  return stdout;
}

/**
 * Get page content (URL, title, HTML)
 */
export async function getPageContent(options: BrowserSession = {}): Promise<PageContent | null> {
  // Get HTML
  const html = await getHtml(options);

  // Get title via evaluate
  const titleResult = await evaluate('document.title', options);
  const title = typeof titleResult === 'string' ? titleResult : '';

  // Get URL via evaluate
  const urlResult = await evaluate('window.location.href', options);
  const url = typeof urlResult === 'string' ? urlResult : '';

  if (!html) {
    return null;
  }

  return { url, title, html };
}

/**
 * Take a screenshot
 */
export async function screenshot(options: ScreenshotOptions = {}): Promise<string | Buffer | null> {
  const args = ['screenshot'];

  if (options.fullPage) {
    args.push('--full-page');
  }

  if (options.filePath) {
    args.push('--output', options.filePath);
    await runCommand(args, { session: options.session });
    return options.filePath;
  }

  // Return base64 encoded image
  const { stdout } = await runCommand([...args, '--base64'], { session: options.session });
  return stdout || null;
}

/**
 * Get accessibility tree snapshot
 */
export async function getSnapshot(options: SnapshotOptions = {}): Promise<SnapshotResult | null> {
  const args = ['snapshot'];

  if (options.interactive) {
    args.push('-i');
  }

  if (options.compact) {
    args.push('--compact');
  }

  return runJsonCommand<SnapshotResult>(args, { session: options.session });
}

// ========================================
// Interaction
// ========================================

/**
 * Click on an element by ref (e.g., "@e5")
 */
export async function click(ref: string, options: BrowserSession = {}): Promise<boolean> {
  const target = ref.startsWith('@') ? ref : `@${ref}`;
  const { stderr } = await runCommand(['click', target], { session: options.session });
  return !stderr.includes('error');
}

/**
 * Type text into the focused element
 */
export async function type(text: string, options: BrowserSession = {}): Promise<boolean> {
  const { stderr } = await runCommand(['type', text], { session: options.session });
  return !stderr.includes('error');
}

/**
 * Fill an input field
 */
export async function fill(
  ref: string,
  value: string,
  options: BrowserSession = {}
): Promise<boolean> {
  const target = ref.startsWith('@') ? ref : `@${ref}`;
  const { stderr } = await runCommand(['fill', target, value], { session: options.session });
  return !stderr.includes('error');
}

/**
 * Scroll the page
 */
export async function scroll(
  direction: 'up' | 'down' | 'left' | 'right',
  amount?: number,
  options: BrowserSession = {}
): Promise<void> {
  const args = ['scroll', direction];
  if (amount) {
    args.push(String(amount));
  }
  await runCommand(args, { session: options.session });
}

// ========================================
// JavaScript Evaluation
// ========================================

/**
 * Evaluate JavaScript in the browser context
 */
export async function evaluate<T = unknown>(
  script: string,
  options: BrowserSession = {}
): Promise<T | null> {
  // Wrap script in a function if it's a simple expression
  const wrappedScript = script.includes('return') ? script : `return ${script}`;

  return runJsonCommand<T>(['eval', `(function() { ${wrappedScript} })()`], {
    session: options.session,
  });
}

/**
 * Evaluate a function with serialized return
 */
export async function evaluateFunction<T = unknown>(
  fn: string,
  options: BrowserSession = {}
): Promise<T | null> {
  return runJsonCommand<T>(['eval', `(${fn})()`], { session: options.session });
}

// ========================================
// Viewport & Settings
// ========================================

/**
 * Set viewport size
 */
export async function setViewport(options: ViewportOptions): Promise<void> {
  await runCommand(['set', 'viewport', String(options.width), String(options.height)], {
    session: options.session,
  });
}

// ========================================
// Network
// ========================================

/**
 * Get network requests
 */
export async function getNetworkRequests(options: BrowserSession = {}): Promise<NetworkResult> {
  const result = await runJsonCommand<NetworkResult>(['network', 'requests'], {
    session: options.session,
  });
  return result || { requests: [] };
}

// ========================================
// Session Management
// ========================================

/**
 * Create a new session with optional name
 */
export function createSession(name?: string): BrowserSession {
  return {
    session: name || `session_${Date.now()}`,
  };
}

/**
 * Wait for a specified time (in milliseconds)
 */
export async function wait(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// High-Level Helpers
// ========================================

/**
 * Open URL, wait for load, and return HTML
 */
export async function fetchPage(
  url: string,
  options: BrowserSession = {}
): Promise<{
  html: string;
  url: string;
  title: string;
} | null> {
  const opened = await openPage(url, options);
  if (!opened) {
    return null;
  }

  // Wait for page to stabilize
  await wait(2000);

  const content = await getPageContent(options);
  return content;
}

/**
 * Open URL, dismiss cookie banner, and get clean HTML
 */
export async function fetchCleanPage(
  url: string,
  options: BrowserSession = {}
): Promise<{
  html: string;
  url: string;
  title: string;
} | null> {
  const opened = await openPage(url, options);
  if (!opened) {
    return null;
  }

  // Wait for page to stabilize
  await wait(2000);

  // Cookie banner dismissal will be handled by the cookie-banner module
  // Import dynamically to avoid circular dependency
  const { dismissCookieBanner } = await import('./cookie-banner');
  await dismissCookieBanner(options);

  const content = await getPageContent(options);
  return content;
}
