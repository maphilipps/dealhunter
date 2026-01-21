import { searchAndContents, getContents } from '@/lib/search/web-search';
import { generateStructuredOutput } from '@/lib/ai/config';
import { z } from 'zod';
import type { DecisionMakersResearch, DecisionMaker } from '../schema';

// Valid source types for DecisionMaker
type DecisionMakerSource =
  | 'impressum'
  | 'linkedin'
  | 'xing'
  | 'website'
  | 'web_search'
  | 'derived'
  | 'team_page';

/**
 * Decision Maker Research Tool - SMART VERSION
 * Uses web search to find decision makers instead of manually iterating URLs
 *
 * Strategy:
 * 1. Web search for team/management/leadership pages
 * 2. Web search for specific roles (CEO, CTO, etc.)
 * 3. LinkedIn search as fallback
 * 4. Extract from found pages with AI
 * 5. Iterate until enough contacts are found
 */

// Schema for AI-extracted person data
const extractedPersonSchema = z.object({
  name: z.string(),
  role: z.string(),
  email: z.string().optional(),
  linkedInUrl: z.string().optional(),
  xingUrl: z.string().optional(),
  phone: z.string().optional(),
});

// Search strategies - ordered by effectiveness
const SEARCH_STRATEGIES = [
  // Strategy 1: Direct team/management page search
  (company: string) => `"${company}" Team Management Geschäftsführung site:`,
  (company: string) => `"${company}" Über uns Team Führung`,
  (company: string) => `"${company}" Impressum Geschäftsführer`,

  // Strategy 2: Role-specific searches
  (company: string) => `"${company}" Geschäftsführer CEO`,
  (company: string) => `"${company}" IT-Leiter CTO "Head of IT"`,
  (company: string) => `"${company}" Marketingleiter CMO "Head of Marketing"`,
  (company: string) => `"${company}" "Digital" Director Head`,

  // Strategy 3: LinkedIn searches
  (company: string) => `"${company}" Geschäftsführer site:linkedin.com/in`,
  (company: string) => `"${company}" CEO CTO site:linkedin.com/in`,

  // Strategy 4: Xing searches (DACH region)
  (company: string) => `"${company}" Geschäftsführer site:xing.com`,

  // Strategy 5: Press/News searches
  (company: string) => `"${company}" CEO ernennt neuer Geschäftsführer`,
  (company: string) => `"${company}" Management Vorstand Pressemitteilung`,
];

// Common email patterns for derivation
const EMAIL_PATTERNS = [
  (first: string, last: string, domain: string) =>
    `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
  (first: string, last: string, domain: string) =>
    `${first.toLowerCase()[0]}.${last.toLowerCase()}@${domain}`,
  (first: string, last: string, domain: string) => `${first.toLowerCase()}@${domain}`,
  (first: string, last: string, domain: string) =>
    `${first.toLowerCase()[0]}${last.toLowerCase()}@${domain}`,
  (first: string, last: string, domain: string) => `${last.toLowerCase()}@${domain}`,
];

/**
 * Sleep utility for rate limiting
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }
}

/**
 * Derive email addresses from name and domain
 */
function deriveEmails(name: string, domain: string): Array<{ email: string; confidence: number }> {
  const nameParts = name.trim().split(/\s+/);
  if (nameParts.length < 2) return [];

  // Handle German titles
  const titlesToRemove = ['Dr.', 'Prof.', 'Dipl.', 'Ing.', 'MBA', 'M.Sc.', 'B.Sc.'];
  const cleanParts = nameParts.filter(p => !titlesToRemove.includes(p));

  if (cleanParts.length < 2) return [];

  const firstName = cleanParts[0];
  const lastName = cleanParts[cleanParts.length - 1];
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();

  return EMAIL_PATTERNS.map((pattern, index) => ({
    email: pattern(firstName, lastName, cleanDomain),
    confidence: 100 - index * 15,
  })).slice(0, 3);
}

/**
 * Extract people from a web page using AI
 */
async function extractPeopleFromPage(
  pageContent: string,
  pageUrl: string,
  companyName: string
): Promise<
  Array<{
    name: string;
    role: string;
    email?: string;
    linkedInUrl?: string;
    phone?: string;
    source: DecisionMakerSource;
  }>
> {
  try {
    const result = await generateStructuredOutput<
      z.ZodObject<{
        people: z.ZodArray<
          z.ZodObject<{
            name: z.ZodString;
            role: z.ZodString;
            email: z.ZodOptional<z.ZodString>;
            linkedInUrl: z.ZodOptional<z.ZodString>;
            phone: z.ZodOptional<z.ZodString>;
          }>
        >;
      }>
    >({
      schema: z.object({
        people: z.array(
          z.object({
            name: z.string().describe('Vollständiger Name der Person'),
            role: z.string().describe('Position/Rolle in der Firma'),
            email: z.string().optional().describe('E-Mail-Adresse wenn gefunden'),
            linkedInUrl: z.string().optional().describe('LinkedIn URL wenn gefunden'),
            phone: z.string().optional().describe('Telefonnummer wenn gefunden'),
          })
        ),
      }),
      system: `Du bist ein Experte für die Extraktion von Kontaktinformationen aus Webseiten.

AUFGABE: Extrahiere Entscheidungsträger und Führungspersonen von ${companyName}.

WICHTIG:
- Nur Personen mit Führungsrollen (Geschäftsführer, CEO, CTO, Leiter, Director, Head of, Manager, Vorstand)
- Ignoriere normale Mitarbeiter ohne Führungsposition
- Extrahiere echte E-Mails (nicht info@, kontakt@, etc.)
- Extrahiere LinkedIn URLs wenn vorhanden
- Maximal 5 relevante Personen`,
      prompt: `Extrahiere Entscheidungsträger von ${companyName} aus diesem Seiteninhalt:

URL: ${pageUrl}

INHALT:
${pageContent.slice(0, 10000)}

Gib ein JSON zurück mit allen gefundenen Führungspersonen.`,
    });

    const source: DecisionMakerSource = pageUrl.includes('linkedin.com')
      ? 'linkedin'
      : pageUrl.includes('xing.com')
        ? 'xing'
        : pageUrl.includes('impressum')
          ? 'impressum'
          : 'web_search';
    return result.people.map(p => ({
      ...p,
      source,
    }));
  } catch (error) {
    console.error(`[Decision Makers] AI extraction failed for ${pageUrl}:`, error);
    return [];
  }
}

/**
 * Parse LinkedIn search results to extract basic info
 */
function parseLinkedInResults(
  results: Array<{ url: string; title: string; text?: string }>
): Array<{ name: string; role: string; linkedInUrl: string }> {
  const people: Array<{ name: string; role: string; linkedInUrl: string }> = [];

  for (const result of results) {
    if (!result.url.includes('linkedin.com/in/')) continue;

    // LinkedIn titles are usually "Name - Role - Company | LinkedIn"
    const titleParts = result.title.split(' - ');
    if (titleParts.length >= 2) {
      const name = titleParts[0].replace('| LinkedIn', '').trim();
      const role = titleParts[1]?.replace('| LinkedIn', '').trim() || 'Unknown';

      if (name && name.length > 2 && !people.some(p => p.name === name)) {
        people.push({
          name,
          role,
          linkedInUrl: result.url,
        });
      }
    }
  }

  return people;
}

/**
 * Execute a single search strategy and extract people
 */
async function executeSearchStrategy(
  strategy: (company: string) => string,
  companyName: string,
  websiteDomain: string,
  existingNames: Set<string>
): Promise<
  Array<{
    name: string;
    role: string;
    email?: string;
    linkedInUrl?: string;
    phone?: string;
    source: DecisionMakerSource;
  }>
> {
  const query = strategy(companyName);
  const isLinkedInSearch = query.includes('site:linkedin.com');
  const isXingSearch = query.includes('site:xing.com');

  console.log(`[Decision Makers] Searching: "${query.slice(0, 60)}..."`);

  try {
    // Execute web search
    const searchResults = await searchAndContents(query, {
      numResults: isLinkedInSearch || isXingSearch ? 5 : 3,
      category: isLinkedInSearch ? 'people' : 'company',
    });

    if (!searchResults.results || searchResults.results.length === 0) {
      return [];
    }

    const foundPeople: Array<{
      name: string;
      role: string;
      email?: string;
      linkedInUrl?: string;
      phone?: string;
      source: DecisionMakerSource;
    }> = [];

    // For LinkedIn/Xing searches, parse results directly
    if (isLinkedInSearch) {
      const linkedInPeople = parseLinkedInResults(searchResults.results);
      for (const person of linkedInPeople) {
        if (!existingNames.has(person.name.toLowerCase())) {
          foundPeople.push({
            ...person,
            source: 'linkedin' as const,
          });
        }
      }
      return foundPeople;
    }

    // For other searches, fetch and extract from pages
    for (const result of searchResults.results.slice(0, 3)) {
      // Skip if it's a different company's website
      const resultDomain = extractDomain(result.url);
      const isSameDomain =
        resultDomain.includes(websiteDomain) || websiteDomain.includes(resultDomain);
      const isLinkedIn = result.url.includes('linkedin.com');
      const isXing = result.url.includes('xing.com');

      if (!isSameDomain && !isLinkedIn && !isXing) {
        console.log(`[Decision Makers] Skipping external domain: ${resultDomain}`);
        continue;
      }

      try {
        // Fetch page content
        const pageContent = await getContents(result.url, { text: true });
        if (!pageContent.text || pageContent.text.length < 300) continue;

        // Extract people using AI
        const people = await extractPeopleFromPage(pageContent.text, result.url, companyName);

        for (const person of people) {
          if (!existingNames.has(person.name.toLowerCase())) {
            foundPeople.push(person);
            existingNames.add(person.name.toLowerCase());
          }
        }

        // Rate limiting
        await sleep(500);
      } catch (error) {
        console.error(`[Decision Makers] Failed to fetch ${result.url}:`, error);
      }
    }

    return foundPeople;
  } catch (error) {
    console.error(`[Decision Makers] Search failed for "${query.slice(0, 40)}...":`, error);
    return [];
  }
}

/**
 * Main research function - SMART VERSION
 * Uses web search iteratively until enough contacts are found
 */
export async function searchDecisionMakers(
  companyName: string,
  websiteUrl: string,
  options: { minContacts?: number; maxSearches?: number } = {}
): Promise<DecisionMakersResearch> {
  const { minContacts = 3, maxSearches = 6 } = options;

  const decisionMakers: DecisionMaker[] = [];
  const existingNames = new Set<string>();
  const domain = extractDomain(websiteUrl);

  let linkedInFound = 0;
  let emailsConfirmed = 0;
  let emailsDerived = 0;
  let searchesExecuted = 0;
  const sourcesUsed = new Set<string>();

  console.log(`[Decision Makers] Starting SMART research for "${companyName}" (domain: ${domain})`);
  console.log(`[Decision Makers] Target: ${minContacts} contacts, max ${maxSearches} searches`);

  // Execute search strategies until we have enough contacts or exhausted strategies
  for (const strategy of SEARCH_STRATEGIES) {
    // Check if we have enough contacts
    if (decisionMakers.length >= minContacts) {
      console.log(`[Decision Makers] Found ${decisionMakers.length} contacts - stopping search`);
      break;
    }

    // Check if we've done enough searches
    if (searchesExecuted >= maxSearches) {
      console.log(`[Decision Makers] Reached max searches (${maxSearches}) - stopping`);
      break;
    }

    searchesExecuted++;

    const foundPeople = await executeSearchStrategy(strategy, companyName, domain, existingNames);

    for (const person of foundPeople) {
      // Track source
      sourcesUsed.add(person.source);
      if (person.source === 'linkedin') linkedInFound++;

      // Derive email if not found
      let email = person.email;
      let emailConfidence: 'confirmed' | 'likely' | 'derived' | undefined = undefined;

      if (email) {
        emailConfidence = 'confirmed';
        emailsConfirmed++;
      } else {
        const derivedEmails = deriveEmails(person.name, domain);
        if (derivedEmails.length > 0) {
          email = derivedEmails[0].email;
          emailConfidence = 'derived';
          emailsDerived++;
        }
      }

      // Add to results
      decisionMakers.push({
        name: person.name,
        role: person.role,
        email,
        emailConfidence,
        linkedInUrl: person.linkedInUrl,
        phone: person.phone,
        source: person.source,
      });

      existingNames.add(person.name.toLowerCase());
    }

    // Rate limiting between strategies
    await sleep(1000);
  }

  // Calculate confidence score
  const confidence = Math.min(
    100,
    Math.round(
      decisionMakers.length * 15 + linkedInFound * 10 + emailsConfirmed * 20 + emailsDerived * 5
    )
  );

  console.log(`[Decision Makers] Research complete:`);
  console.log(`  - Total contacts: ${decisionMakers.length}`);
  console.log(`  - LinkedIn found: ${linkedInFound}`);
  console.log(`  - Emails confirmed: ${emailsConfirmed}`);
  console.log(`  - Emails derived: ${emailsDerived}`);
  console.log(`  - Searches executed: ${searchesExecuted}`);
  console.log(`  - Confidence: ${confidence}%`);

  return {
    decisionMakers,
    researchQuality: {
      linkedInFound,
      emailsConfirmed,
      emailsDerived,
      confidence,
      sources: Array.from(sourcesUsed),
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Quick contact search - finds generic contact info fast
 */
export async function quickContactSearch(websiteUrl: string): Promise<{
  mainEmail?: string;
  phone?: string;
  contactPage?: string;
}> {
  const domain = extractDomain(websiteUrl);

  try {
    // Search for contact/impressum page
    const searchResults = await searchAndContents(`site:${domain} impressum kontakt`, {
      numResults: 3,
    });

    if (!searchResults.results || searchResults.results.length === 0) {
      return {};
    }

    // Fetch first result
    const contactUrl = searchResults.results[0].url;
    const pageContent = await getContents(contactUrl, { text: true });

    if (!pageContent.text) return { contactPage: contactUrl };

    // Extract emails and phones with regex
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phonePattern = /\+?[0-9]{1,4}[\s.-]?[0-9]{2,4}[\s.-]?[0-9]{3,8}/g;

    const emails = pageContent.text.match(emailPattern) || [];
    const phones = pageContent.text.match(phonePattern) || [];

    // Find generic contact email
    const mainEmail =
      emails.find(
        e =>
          e.toLowerCase().startsWith('info@') ||
          e.toLowerCase().startsWith('kontakt@') ||
          e.toLowerCase().startsWith('mail@') ||
          e.toLowerCase().startsWith('office@')
      ) || emails[0];

    return {
      mainEmail,
      phone: phones.find(p => p.length >= 10),
      contactPage: contactUrl,
    };
  } catch (error) {
    console.error('[Quick Contact] Search failed:', error);
    return {};
  }
}
