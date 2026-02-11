import { generateText } from 'ai';
import { z } from 'zod';

import type { DecisionMakersResearch, DecisionMaker } from '../schema';

import { modelNames, AI_TIMEOUTS } from '@/lib/ai/config';
import { getProviderForSlot } from '@/lib/ai/providers';
import { searchAndContents, getContents } from '@/lib/search/web-search';

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
 * Decision Maker Research Tool - AI-AGENT VERSION
 * Uses an AI agent with tools to intelligently find decision makers
 *
 * Strategy:
 * - Agent uses web_search, fetch_page, submit_contacts tools
 * - Agent decides search strategy and domain-relevance autonomously
 * - Handles domain redirects and finds contacts even with changing domains
 */

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
 * Main research function - AI-AGENT VERSION
 * Uses AI agent with tools to intelligently find decision makers
 */
export async function searchDecisionMakers(
  companyName: string,
  websiteUrl: string,
  options: { minContacts?: number } = {}
): Promise<DecisionMakersResearch> {
  const { minContacts = 3 } = options;

  const domain = extractDomain(websiteUrl);
  const foundPeople = new Map<
    string,
    {
      name: string;
      role: string;
      email?: string;
      linkedInUrl?: string;
      xingUrl?: string;
      phone?: string;
      source: DecisionMakerSource;
    }
  >();

  console.log(
    `[Decision Makers] Starting AI-Agent research for "${companyName}" (domain: ${domain})`
  );
  console.log(`[Decision Makers] Target: ${minContacts} contacts`);

  // Define AI-SDK Tools for the agent
  const web_search = {
    description:
      'Search the web for information. Returns search results with URLs, titles, and snippets.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      numResults: z.number().optional().describe('Number of results (default: 5, max: 10)'),
    }),
    execute: async ({ query, numResults = 5 }: { query: string; numResults?: number }) => {
      console.log(`[Agent] web_search: "${query.slice(0, 60)}..."`);
      try {
        const results = await searchAndContents(query, { numResults: Math.min(numResults, 10) });
        return {
          success: true,
          results: results.results?.map(r => ({
            url: r.url,
            title: r.title,
            snippet: r.text?.slice(0, 300),
          })),
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  };

  const fetch_page = {
    description:
      'Fetch the full text content of a web page. Use this to extract contact information from team pages, impressum, etc.',
    inputSchema: z.object({
      url: z.string().describe('The URL to fetch'),
    }),
    execute: async ({ url }: { url: string }) => {
      console.log(`[Agent] fetch_page: ${url.slice(0, 60)}...`);
      try {
        const content = await getContents(url, { text: true });
        return {
          success: true,
          url,
          text: content.text?.slice(0, 15000) || '',
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  };

  const submit_contacts = {
    description:
      'Submit found decision makers. Call this when you have found enough contacts (at least the minimum required) or when you have exhausted search options. This ends the research loop.',
    inputSchema: z.object({
      contacts: z.array(
        z.object({
          name: z.string().describe('Full name of the person'),
          role: z.string().describe('Job title/role'),
          email: z.string().optional().describe('Email address if found'),
          linkedInUrl: z.string().optional().describe('LinkedIn profile URL if found'),
          xingUrl: z.string().optional().describe('Xing profile URL if found'),
          phone: z.string().optional().describe('Phone number if found'),
          source: z
            .enum(['impressum', 'linkedin', 'xing', 'website', 'web_search', 'team_page'])
            .describe('Where this contact was found'),
        })
      ),
      notes: z.string().optional().describe('Any notes about the research process'),
    }),
    execute: async ({
      contacts,
      notes,
    }: {
      contacts: Array<{
        name: string;
        role: string;
        email?: string;
        linkedInUrl?: string;
        xingUrl?: string;
        phone?: string;
        source: DecisionMakerSource;
      }>;
      notes?: string;
    }) => {
      console.log(`[Agent] submit_contacts: ${contacts.length} contacts`);
      if (notes) console.log(`[Agent] Notes: ${notes}`);

      // Store found people (deduplicate by name)
      for (const contact of contacts) {
        const key = contact.name.toLowerCase();
        if (!foundPeople.has(key)) {
          foundPeople.set(key, contact);
        }
      }

      return {
        success: true,
        message: `Submitted ${contacts.length} contacts. Total unique: ${foundPeople.size}`,
      };
    },
  };

  // Agent system prompt
  const systemPrompt = `Du bist ein spezialisierter AI-Agent für Decision-Maker-Research.

ZIEL: Finde mindestens ${minContacts} Entscheidungsträger und Führungspersonen für das Unternehmen "${companyName}".

VERFÜGBARE TOOLS:
- web_search: Suche im Web nach Kontakten (LinkedIn, Xing, Team-Seiten, Impressum)
- fetch_page: Lade Seiteninhalt zum Extrahieren von Kontakten
- submit_contacts: Reiche gefundene Kontakte ein (beendet die Recherche)

SUCHSTRATEGIE:
1. Suche zuerst nach Team-Seiten, Impressum, Führungsteam ("${companyName}" Team Geschäftsführung)
2. Suche nach spezifischen Rollen (CEO, CTO, IT-Leiter, Marketingleiter)
3. Nutze LinkedIn/Xing-Suchen (site:linkedin.com/in "${companyName}" Geschäftsführer)
4. Extrahiere Kontakte aus gefundenen Seiten mit fetch_page
5. WICHTIG: Auch bei Domain-Redirects weitersuchen (z.B. Firmenname ≠ Domain)

QUALITÄTSKRITERIEN:
- NUR Führungspersonen (Geschäftsführer, CEO, CTO, Director, Head of, Leiter, Manager, Vorstand)
- Echte E-Mails bevorzugt (nicht info@, kontakt@)
- LinkedIn/Xing-Profile erhöhen Qualität
- Mindestens ${minContacts} Kontakte sammeln

DOMAIN-HANDLING:
- Firmen-Domain: ${domain}
- Falls Suchergebnisse auf andere Domains zeigen (Redirects, Umbenennungen): Trotzdem verwenden!
- Prüfe Relevanz über Firmennamen, nicht nur Domain

Wenn du genügend Kontakte hast, rufe submit_contacts auf.`;

  const userPrompt = `Finde jetzt Decision-Makers für "${companyName}" (Website: ${websiteUrl}, Domain: ${domain}).

Starte mit einer breiten Suche nach Team-Seiten oder Führungskräften. Nutze die Tools intelligent und eigenständig.`;

  try {
    await generateText({
      model: (await getProviderForSlot('research'))(modelNames.research),
      system: systemPrompt,
      prompt: userPrompt,
      tools: { web_search, fetch_page, submit_contacts },
      abortSignal: AbortSignal.timeout(AI_TIMEOUTS.AGENT_COMPLEX),
    });

    console.log(`[Decision Makers] Agent completed with ${foundPeople.size} unique contacts`);

    // Convert to DecisionMaker array
    const decisionMakers: DecisionMaker[] = [];
    let linkedInFound = 0;
    let xingFound = 0;
    let emailsConfirmed = 0;
    let emailsDerived = 0;
    const sourcesUsed = new Set<string>();

    for (const person of foundPeople.values()) {
      sourcesUsed.add(person.source);
      if (person.source === 'linkedin') linkedInFound++;
      if (person.source === 'xing') xingFound++;

      let email = person.email;
      let emailConfidence: 'confirmed' | 'likely' | 'derived' | 'unknown' = 'unknown';

      if (email) {
        emailConfidence = 'confirmed';
        emailsConfirmed++;
      } else {
        // Derive email if not found
        const derivedEmails = deriveEmails(person.name, domain);
        if (derivedEmails.length > 0) {
          email = derivedEmails[0].email;
          emailConfidence = 'derived';
          emailsDerived++;
        }
      }

      decisionMakers.push({
        name: person.name,
        role: person.role,
        email,
        emailConfidence,
        linkedInUrl: person.linkedInUrl,
        xingUrl: person.xingUrl,
        phone: person.phone,
        source: person.source,
      });
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
    console.log(`  - Xing found: ${xingFound}`);
    console.log(`  - Emails confirmed: ${emailsConfirmed}`);
    console.log(`  - Emails derived: ${emailsDerived}`);
    console.log(`  - Confidence: ${confidence}%`);

    return {
      decisionMakers,
      researchQuality: {
        linkedInFound,
        xingFound,
        emailsConfirmed,
        emailsDerived,
        confidence,
        sources: Array.from(sourcesUsed),
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[Decision Makers] Agent failed:', error);

    // Return empty result on failure
    return {
      decisionMakers: [],
      researchQuality: {
        linkedInFound: 0,
        xingFound: 0,
        emailsConfirmed: 0,
        emailsDerived: 0,
        confidence: 0,
        sources: [],
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

/**
 * Name-only decision maker research (no website/domain required).
 *
 * Strategy:
 * - Only use LinkedIn/Xing search queries and parse snippets for public profile URLs.
 * - Do not attempt email derivation (no domain context).
 */
export async function searchDecisionMakersNameOnly(
  companyName: string,
  options: { maxSearches?: number } = {}
): Promise<DecisionMakersResearch> {
  const { maxSearches = 4 } = options;

  const decisionMakers: DecisionMaker[] = [];
  const existingNames = new Set<string>();
  let linkedInFound = 0;
  let searchesExecuted = 0;

  const sourcesUsed = new Set<string>();

  // Focus on public profile URL discovery only (lowest risk, highest signal).
  const queries = [
    `"${companyName}" Geschäftsführer site:linkedin.com/in`,
    `"${companyName}" CEO CTO site:linkedin.com/in`,
    `"${companyName}" Managing Director site:linkedin.com/in`,
    `"${companyName}" Geschäftsführer site:xing.com`,
  ];

  for (const query of queries) {
    if (searchesExecuted >= maxSearches) break;
    searchesExecuted++;

    const isLinkedInSearch = query.includes('site:linkedin.com');
    const isXingSearch = query.includes('site:xing.com');

    try {
      const searchResults = await searchAndContents(query, {
        numResults: 5,
      });

      if (!searchResults.results || searchResults.results.length === 0) continue;

      if (isLinkedInSearch) {
        const people = parseLinkedInResults(searchResults.results);
        for (const person of people) {
          const key = person.name.toLowerCase();
          if (existingNames.has(key)) continue;
          existingNames.add(key);
          linkedInFound++;
          sourcesUsed.add('linkedin');
          decisionMakers.push({
            name: person.name,
            role: person.role,
            linkedInUrl: person.linkedInUrl,
            source: 'linkedin',
            emailConfidence: 'unknown',
          });
        }
      } else if (isXingSearch) {
        // Minimal Xing support: store URLs if they look like profiles.
        for (const r of searchResults.results) {
          if (!r.url.includes('xing.com')) continue;
          sourcesUsed.add('xing');
          const title = r.title || '';
          const name = title.split(' - ')[0]?.trim();
          if (!name || name.length < 3) continue;
          const key = name.toLowerCase();
          if (existingNames.has(key)) continue;
          existingNames.add(key);
          decisionMakers.push({
            name,
            role: 'Unknown',
            xingUrl: r.url,
            source: 'xing',
            emailConfidence: 'unknown',
          });
        }
      }
    } catch (error) {
      console.error(
        `[Decision Makers] Name-only search failed for "${query.slice(0, 40)}..."`,
        error
      );
    }

    await sleep(750);
  }

  const confidence = Math.min(100, Math.round(decisionMakers.length * 15 + linkedInFound * 10));

  return {
    decisionMakers,
    researchQuality: {
      linkedInFound,
      xingFound: Array.from(sourcesUsed).includes('xing') ? 1 : 0,
      emailsConfirmed: 0,
      emailsDerived: 0,
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
