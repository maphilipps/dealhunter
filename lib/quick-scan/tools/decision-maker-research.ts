import { searchDuckDuckGo, fetchUrlContents } from '@/lib/search/duckduckgo-search';
import { generateStructuredOutput } from '@/lib/ai/config';
import { z } from 'zod';
import type { DecisionMakersResearch, DecisionMaker } from '../schema';

/**
 * Decision Maker Research Tool
 * Researches decision makers via LinkedIn, web search, and email pattern derivation
 */

// Schema for AI-extracted person data
const extractedPersonSchema = z.object({
  name: z.string(),
  role: z.string(),
  linkedInUrl: z.string().url().optional(),
  source: z.enum(['LinkedIn', 'Xing', 'WebSearch', 'Impressum']),
});

// Common role patterns to search for
const DECISION_MAKER_ROLES = [
  { de: 'Geschäftsführer', en: 'CEO', priority: 1 },
  { de: 'IT-Leiter', en: 'CTO', priority: 2 },
  { de: 'IT-Verantwortlicher', en: 'Head of IT', priority: 2 },
  { de: 'Marketingleiter', en: 'CMO', priority: 3 },
  { de: 'Digital-Verantwortlicher', en: 'Head of Digital', priority: 3 },
  { de: 'Leiter Web', en: 'Web Director', priority: 3 },
  { de: 'Vorstand', en: 'Board Member', priority: 1 },
];

// Common email patterns
const EMAIL_PATTERNS = [
  (first: string, last: string, domain: string) => `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
  (first: string, last: string, domain: string) => `${first.toLowerCase()[0]}.${last.toLowerCase()}@${domain}`,
  (first: string, last: string, domain: string) => `${first.toLowerCase()}@${domain}`,
  (first: string, last: string, domain: string) => `${last.toLowerCase()}@${domain}`,
  (first: string, last: string, domain: string) => `${first.toLowerCase()[0]}${last.toLowerCase()}@${domain}`,
];

// Team page paths to search
const TEAM_PAGE_PATHS = [
  '/team',
  '/ueber-uns',
  '/about-us',
  '/about',
  '/unternehmen',
  '/company',
  '/wir',
  '/mitarbeiter',
  '/management',
  '/fuehrung',
  '/leadership',
];

/**
 * Sleep utility with jitter for rate limiting
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff and jitter
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  operationName: string = 'operation'
): Promise<T | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      if (isLastAttempt) {
        console.error(`[Decision Makers] ${operationName} failed after ${maxRetries} attempts:`, error);
        return null;
      }
      // Exponential backoff with jitter: 1s, 2s, 4s + random 0-500ms
      const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 10000);
      console.log(`[Decision Makers] ${operationName} failed, retrying in ${Math.round(backoffMs)}ms...`);
      await sleep(backoffMs);
    }
  }
  return null;
}

/**
 * Search for decision makers on LinkedIn via DuckDuckGo
 */
async function searchLinkedIn(
  companyName: string,
  role: { de: string; en: string }
): Promise<Array<{ name: string; linkedInUrl?: string; role: string }>> {
  const results: Array<{ name: string; linkedInUrl?: string; role: string }> = [];

  // Search in German
  const queryDe = `${companyName} ${role.de} site:linkedin.com/in`;
  const searchResultsDe = await searchDuckDuckGo(queryDe, 3);

  for (const result of searchResultsDe.results) {
    if (result.url.includes('linkedin.com/in/')) {
      // Extract name from title (usually "Name - Role - Company | LinkedIn")
      const nameParts = result.title.split(' - ');
      if (nameParts.length > 0) {
        const name = nameParts[0].replace('| LinkedIn', '').trim();
        if (name && !results.some(r => r.name === name)) {
          results.push({
            name,
            linkedInUrl: result.url,
            role: role.de,
          });
        }
      }
    }
  }

  // Search in English as fallback
  if (results.length === 0) {
    const queryEn = `${companyName} ${role.en} site:linkedin.com/in`;
    const searchResultsEn = await searchDuckDuckGo(queryEn, 3);

    for (const result of searchResultsEn.results) {
      if (result.url.includes('linkedin.com/in/')) {
        const nameParts = result.title.split(' - ');
        if (nameParts.length > 0) {
          const name = nameParts[0].replace('| LinkedIn', '').trim();
          if (name && !results.some(r => r.name === name)) {
            results.push({
              name,
              linkedInUrl: result.url,
              role: role.en,
            });
          }
        }
      }
    }
  }

  return results;
}

/**
 * Extract contacts from Impressum page
 */
async function extractImpressumContacts(
  websiteUrl: string
): Promise<{
  people: Array<{ name: string; role: string; email?: string }>;
  genericEmails: string[];
  phones: string[];
}> {
  const result = {
    people: [] as Array<{ name: string; role: string; email?: string }>,
    genericEmails: [] as string[],
    phones: [] as string[],
  };

  // Try common impressum paths
  const impressumPaths = [
    '/impressum',
    '/imprint',
    '/legal',
    '/kontakt',
    '/contact',
    '/about/impressum',
    '/ueber-uns/impressum',
  ];

  const baseUrl = new URL(websiteUrl);
  let impressumHtml = '';

  for (const path of impressumPaths) {
    try {
      const response = await fetchUrlContents(`${baseUrl.origin}${path}`);
      if (response.content && response.content.length > 500) {
        impressumHtml = response.content;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!impressumHtml) {
    return result;
  }

  // Extract emails
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = impressumHtml.match(emailPattern) || [];

  for (const email of emails) {
    const normalizedEmail = email.toLowerCase();
    // Check if it's a generic email
    if (
      normalizedEmail.startsWith('info@') ||
      normalizedEmail.startsWith('kontakt@') ||
      normalizedEmail.startsWith('mail@') ||
      normalizedEmail.startsWith('office@') ||
      normalizedEmail.startsWith('service@') ||
      normalizedEmail.startsWith('support@')
    ) {
      if (!result.genericEmails.includes(normalizedEmail)) {
        result.genericEmails.push(normalizedEmail);
      }
    }
  }

  // Extract phone numbers
  const phonePattern = /\+?[0-9]{1,4}[\s.-]?[0-9]{2,4}[\s.-]?[0-9]{3,8}/g;
  const phones = impressumHtml.match(phonePattern) || [];
  result.phones = [...new Set(phones.filter(p => p.length >= 8))].slice(0, 3);

  // Use AI to extract named people with roles
  try {
    const extractionResult = await generateStructuredOutput<z.ZodObject<{
      people: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        role: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
      }>>;
    }>>({
      schema: z.object({
        people: z.array(z.object({
          name: z.string(),
          role: z.string(),
          email: z.string().optional(),
        })),
      }),
      system: `Du bist ein Experte für die Extraktion von Kontaktinformationen aus Impressum-Texten.
Extrahiere alle genannten Personen mit Namen, Rolle und E-Mail (wenn vorhanden).
Gib nur echte Personen zurück, keine generischen Kontakte.`,
      prompt: `Extrahiere Personen aus diesem Impressum-Text:

${impressumHtml.slice(0, 5000)}

Gib zurück: { "people": [{ "name": "...", "role": "...", "email": "..." }] }`,
    });

    result.people = extractionResult.people;
  } catch (error) {
    console.error('AI extraction failed:', error);
  }

  return result;
}

/**
 * Search for decision makers on team pages
 */
async function extractFromTeamPages(
  websiteUrl: string
): Promise<Array<{ name: string; role: string; source: 'TeamPage' }>> {
  const results: Array<{ name: string; role: string; source: 'TeamPage' }> = [];
  const baseUrl = new URL(websiteUrl);

  console.log('[Decision Makers] Searching team pages...');

  for (const path of TEAM_PAGE_PATHS) {
    const teamPageUrl = `${baseUrl.origin}${path}`;

    const pageResult = await withRetry(
      async () => {
        const response = await fetchUrlContents(teamPageUrl);
        if (!response.content || response.content.length < 500) {
          throw new Error('Page too short or not found');
        }
        return response.content;
      },
      2,
      `fetch team page ${path}`
    );

    if (!pageResult) continue;

    console.log(`[Decision Makers] Found team page at ${path}`);

    // Use AI to extract people from the page
    try {
      const extractionResult = await generateStructuredOutput<z.ZodObject<{
        people: z.ZodArray<z.ZodObject<{
          name: z.ZodString;
          role: z.ZodString;
        }>>;
      }>>({
        schema: z.object({
          people: z.array(z.object({
            name: z.string(),
            role: z.string(),
          })),
        }),
        system: `Du bist ein Experte für die Extraktion von Team-Informationen aus Webseiten.
Extrahiere alle Personen mit Führungsrollen (Geschäftsführer, Leiter, Manager, Director, Head of, etc.).
Ignoriere normale Mitarbeiter ohne Führungsposition.`,
        prompt: `Extrahiere Entscheidungsträger aus dieser Team-Seite:

${pageResult.slice(0, 8000)}

Gib zurück: { "people": [{ "name": "...", "role": "..." }] }
Nur Führungspersonen, maximal 5 Personen.`,
      });

      for (const person of extractionResult.people) {
        if (!results.some(r => r.name.toLowerCase() === person.name.toLowerCase())) {
          results.push({
            name: person.name,
            role: person.role,
            source: 'TeamPage',
          });
        }
      }

      // If we found results, no need to check more pages
      if (results.length > 0) break;
    } catch (error) {
      console.error(`[Decision Makers] AI extraction failed for ${path}:`, error);
    }
  }

  console.log(`[Decision Makers] Found ${results.length} people on team pages`);
  return results;
}

/**
 * Derive email address from name and domain
 */
function deriveEmails(name: string, domain: string): Array<{ email: string; confidence: number }> {
  const nameParts = name.trim().split(/\s+/);
  if (nameParts.length < 2) {
    return [];
  }

  // Handle German titles
  const firstName = nameParts.find(p => !['Dr.', 'Prof.', 'Dipl.', 'Ing.', 'MBA'].includes(p)) || nameParts[0];
  const lastName = nameParts[nameParts.length - 1];

  // Clean up domain
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

  const derivedEmails = EMAIL_PATTERNS.map((pattern, index) => ({
    email: pattern(firstName, lastName, cleanDomain),
    confidence: 100 - (index * 15), // First pattern is most likely
  }));

  return derivedEmails.slice(0, 3); // Return top 3 patterns
}

/**
 * Main research function
 */
export async function searchDecisionMakers(
  companyName: string,
  websiteUrl: string
): Promise<DecisionMakersResearch> {
  const decisionMakers: DecisionMaker[] = [];
  let linkedInFound = 0;
  let emailsConfirmed = 0;
  let emailsDerived = 0;

  const domain = new URL(websiteUrl).hostname.replace(/^www\./, '');

  console.log(`[Decision Makers] Starting research for "${companyName}"...`);

  // 1. Search LinkedIn for key roles (with retry)
  for (const role of DECISION_MAKER_ROLES.slice(0, 4)) { // Limit to top 4 roles
    const linkedInResults = await withRetry(
      () => searchLinkedIn(companyName, role),
      3,
      `LinkedIn search for ${role.de}`
    );

    if (!linkedInResults || linkedInResults.length === 0) continue;

    for (const result of linkedInResults.slice(0, 1)) { // Take first result per role
      linkedInFound++;

      // Derive email
      const derivedEmails = deriveEmails(result.name, domain);
      const bestEmail = derivedEmails[0];

      const decisionMaker: DecisionMaker = {
        name: result.name,
        role: result.role,
        linkedInUrl: result.linkedInUrl,
        email: bestEmail?.email,
        emailConfidence: bestEmail ? 'derived' : undefined,
        source: 'linkedin',
      };

      if (bestEmail) {
        emailsDerived++;
      }

      // Avoid duplicates
      if (!decisionMakers.some(dm => dm.name === decisionMaker.name)) {
        decisionMakers.push(decisionMaker);
      }
    }
  }

  console.log(`[Decision Makers] LinkedIn search found ${linkedInFound} contacts`);

  // 2. Search Team Pages (if LinkedIn didn't find enough)
  if (decisionMakers.length < 3) {
    const teamPageResults = await extractFromTeamPages(websiteUrl);

    for (const person of teamPageResults) {
      // Check if already found
      const existing = decisionMakers.find(dm =>
        dm.name.toLowerCase() === person.name.toLowerCase()
      );

      if (!existing) {
        const derivedEmails = deriveEmails(person.name, domain);
        const bestEmail = derivedEmails[0];

        decisionMakers.push({
          name: person.name,
          role: person.role,
          email: bestEmail?.email,
          emailConfidence: bestEmail ? 'derived' : undefined,
          source: 'team_page',
        });

        if (bestEmail) {
          emailsDerived++;
        }
      }
    }
  }

  // 3. Extract from Impressum (with retry)
  const impressumData = await withRetry(
    () => extractImpressumContacts(websiteUrl),
    2,
    'Impressum extraction'
  );

  try {
    if (!impressumData) {
      throw new Error('Impressum extraction failed');
    }

    for (const person of impressumData.people) {
      // Check if already found via LinkedIn
      const existing = decisionMakers.find(dm =>
        dm.name.toLowerCase() === person.name.toLowerCase()
      );

      if (existing) {
        // Update with confirmed email
        if (person.email && !existing.email) {
          existing.email = person.email;
          existing.emailConfidence = 'confirmed';
          emailsConfirmed++;
          emailsDerived--; // Remove from derived count
        }
      } else {
        // Add new person from Impressum
        const decisionMaker: DecisionMaker = {
          name: person.name,
          role: person.role,
          email: person.email,
          emailConfidence: person.email ? 'confirmed' : undefined,
          source: 'impressum',
        };

        if (person.email) {
          emailsConfirmed++;
        }

        decisionMakers.push(decisionMaker);
      }
    }

    // Build generic contacts
    const genericContacts: DecisionMakersResearch['genericContacts'] = {};

    for (const email of impressumData.genericEmails) {
      if (email.startsWith('info@') || email.startsWith('kontakt@')) {
        genericContacts.mainEmail = email;
      } else if (email.includes('vertrieb') || email.includes('sales')) {
        genericContacts.salesEmail = email;
      } else if (email.includes('it@') || email.includes('tech')) {
        genericContacts.techEmail = email;
      } else if (email.includes('marketing')) {
        genericContacts.marketingEmail = email;
      }
    }

    if (impressumData.phones.length > 0) {
      genericContacts.phone = impressumData.phones[0];
    }

    // Calculate confidence score
    const confidence = Math.min(100, Math.round(
      (linkedInFound * 20) +
      (emailsConfirmed * 25) +
      (emailsDerived * 10) +
      (Object.keys(genericContacts).length * 5)
    ));

    // Determine sources used
    const sources: string[] = [];
    if (linkedInFound > 0) sources.push('LinkedIn');
    if (emailsConfirmed > 0) sources.push('Impressum');
    if (emailsDerived > 0) sources.push('Email Pattern Derivation');

    return {
      decisionMakers,
      genericContacts: Object.keys(genericContacts).length > 0 ? genericContacts : undefined,
      researchQuality: {
        linkedInFound,
        emailsConfirmed,
        emailsDerived,
        confidence,
        sources,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Impressum extraction failed:', error);

    const sources: string[] = [];
    if (linkedInFound > 0) sources.push('LinkedIn');
    if (emailsDerived > 0) sources.push('Email Pattern Derivation');

    return {
      decisionMakers,
      researchQuality: {
        linkedInFound,
        emailsConfirmed,
        emailsDerived,
        confidence: Math.min(100, linkedInFound * 20 + emailsDerived * 10),
        sources,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

/**
 * Quick contact search (impressum only, no LinkedIn)
 */
export async function quickContactSearch(websiteUrl: string): Promise<{
  mainEmail?: string;
  phone?: string;
  contactPage?: string;
}> {
  try {
    const impressumData = await extractImpressumContacts(websiteUrl);

    return {
      mainEmail: impressumData.genericEmails[0],
      phone: impressumData.phones[0],
      contactPage: impressumData.genericEmails.length > 0 ? `${new URL(websiteUrl).origin}/kontakt` : undefined,
    };
  } catch {
    return {};
  }
}
