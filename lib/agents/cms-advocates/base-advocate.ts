/**
 * Base CMS Advocate Agent
 *
 * Abstract base class for CMS-specific advocates.
 * Each advocate "pitches" their CMS based on project requirements.
 */

import { eq } from 'drizzle-orm';

import {
  type CMSAdvocateInput,
  type CMSAdvocateOutput,
  CMSAdvocateOutputSchema,
  type CMSKnowledge,
} from './types';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// CMS KNOWLEDGE LOADER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load CMS knowledge from technologies table
 */
export async function loadCMSKnowledge(cmsName: string): Promise<CMSKnowledge | null> {
  const tech = await db.select().from(technologies).where(eq(technologies.name, cmsName)).limit(1);

  if (!tech.length) {
    // Try case-insensitive search
    const allTechs = await db.select().from(technologies);
    const match = allTechs.find(t => t.name.toLowerCase() === cmsName.toLowerCase());
    if (!match) return null;

    return parseTechnologyToKnowledge(match);
  }

  return parseTechnologyToKnowledge(tech[0]);
}

function parseTechnologyToKnowledge(tech: typeof technologies.$inferSelect): CMSKnowledge {
  // Safe JSON parse helper with type assertion
  const parseJsonArray = (json: string | null): string[] | undefined =>
    json ? (JSON.parse(json) as string[]) : undefined;

  const parseJsonRecord = <T>(json: string | null): T | undefined =>
    json ? (JSON.parse(json) as T) : undefined;

  return {
    id: tech.id,
    name: tech.name,
    description: tech.description ?? undefined,
    category: tech.category ?? undefined,
    license: tech.license ?? undefined,
    latestVersion: tech.latestVersion ?? undefined,
    githubStars: tech.githubStars ?? undefined,
    communitySize: (tech.communitySize as 'small' | 'medium' | 'large') ?? undefined,
    pros: parseJsonArray(tech.pros),
    cons: parseJsonArray(tech.cons),
    usps: parseJsonArray(tech.usps),
    targetAudiences: parseJsonArray(tech.targetAudiences),
    useCases: parseJsonArray(tech.useCases),
    features: parseJsonRecord<Record<string, { supported: boolean; score: number; notes: string }>>(
      tech.features
    ),
    adessoExpertise: tech.adessoExpertise ?? undefined,
    adessoReferenceCount: tech.adessoReferenceCount ?? undefined,
    baselineHours: tech.baselineHours ?? undefined,
    baselineEntityCounts: parseJsonRecord<Record<string, number>>(tech.baselineEntityCounts),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVOCATE PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the advocate prompt for a specific CMS
 */
function buildAdvocatePrompt(
  cmsName: string,
  knowledge: CMSKnowledge | null,
  input: CMSAdvocateInput,
  additionalContext?: string
): string {
  const knowledgeSection = knowledge
    ? `
## Dein Hintergrundwissen über ${cmsName}

${knowledge.description ? `**Beschreibung:** ${knowledge.description}` : ''}
${knowledge.license ? `**Lizenz:** ${knowledge.license}` : ''}
${knowledge.latestVersion ? `**Aktuelle Version:** ${knowledge.latestVersion}` : ''}
${knowledge.githubStars ? `**GitHub Stars:** ${knowledge.githubStars.toLocaleString()}` : ''}
${knowledge.communitySize ? `**Community-Größe:** ${knowledge.communitySize}` : ''}

${knowledge.pros?.length ? `**Vorteile:**\n${knowledge.pros.map(p => `- ${p}`).join('\n')}` : ''}

${knowledge.cons?.length ? `**Nachteile (für Counter-Arguments gegen andere):**\n${knowledge.cons.map(c => `- ${c}`).join('\n')}` : ''}

${knowledge.usps?.length ? `**Unique Selling Points:**\n${knowledge.usps.map(u => `- ${u}`).join('\n')}` : ''}

${knowledge.targetAudiences?.length ? `**Zielgruppen:**\n${knowledge.targetAudiences.map(t => `- ${t}`).join('\n')}` : ''}

${knowledge.useCases?.length ? `**Typische Use Cases:**\n${knowledge.useCases.map(u => `- ${u}`).join('\n')}` : ''}

${knowledge.adessoExpertise ? `**adesso Expertise:** ${knowledge.adessoExpertise}` : ''}
${knowledge.adessoReferenceCount ? `**adesso Referenzen:** ${knowledge.adessoReferenceCount} Projekte` : ''}
${knowledge.baselineHours ? `**Baseline Stunden:** ${knowledge.baselineHours}h für Standard-Projekt` : ''}
`
    : `
## Hinweis
Keine detaillierten Daten für ${cmsName} in der Datenbank. Nutze dein allgemeines Wissen.
`;

  const requirementsSection = input.requirements
    .map(
      r =>
        `- **${r.requirement}** (${r.category}, ${r.priority})${r.source === 'detected' ? ' [erkannt]' : ''}`
    )
    .join('\n');

  return `Du bist ein erfahrener ${cmsName} Consultant und Solution Architect bei adesso SE, einem führenden deutschen IT-Beratungsunternehmen.

## Deine Aufgabe
Überzeuge den Kunden, warum **${cmsName}** die beste Wahl für sein Projekt ist.
Argumentiere faktenbasiert, nutze dein Hintergrundwissen, und sei ein enthusiastischer aber sachlicher Advocate.

${knowledgeSection}

${additionalContext ? `## CMS-spezifischer Kontext\n${additionalContext}` : ''}

## Projekt-Anforderungen
${requirementsSection}

## Kunden-Profil
- **Branche:** ${input.customerProfile.industry}
- **Unternehmensgröße:** ${input.customerProfile.companySize}
- **Tech-Reife:** ${input.customerProfile.techMaturity}
- **Budget:** ${input.customerProfile.budget}
${input.customerProfile.country ? `- **Land:** ${input.customerProfile.country}` : ''}

## Konkurrierende CMS
${input.competingCMS.join(', ')}

## Deine Aufgabe

### 1. Fit-Score (0-100)
Bewerte ehrlich, wie gut ${cmsName} zu den Anforderungen passt.
- 90-100: Perfekte Passung
- 70-89: Gute Passung mit kleinen Einschränkungen
- 50-69: Machbar, aber nicht ideal
- <50: Nicht empfohlen

### 2. Verkaufsargumente (3-8 Stück)
Nutze deine USPs, Pros, und Use Cases um zu argumentieren.
Kategorien: feature, cost, expertise, community, scalability, security, ux
Stärke: strong (unwiderlegbar), medium (solide), weak (nur Bonus)

### 3. Counter-Arguments (gegen die Konkurrenz)
Wo ist ${cmsName} besser als ${input.competingCMS.join(', ')}?
Nutze bekannte Schwächen der anderen CMS (aber bleib sachlich).

### 4. Feature-Mapping
Mappe jede Anforderung auf ${cmsName} Features.
Nenne konkrete Module/Plugins wenn möglich.

### 5. Aufwands-Schätzung
${knowledge?.baselineHours ? `Baseline: ${knowledge.baselineHours} Stunden` : 'Schätze basierend auf Projektgröße'}
Passe an basierend auf:
- Kundenanforderungen (mehr Features = höherer Faktor)
- Tech-Reife (niedrig = höherer Faktor)
- Komplexität der Integration

### 6. Risiken (max 5)
Was könnte schiefgehen? Wie mitigieren?
Sei ehrlich - das macht dich glaubwürdiger.

### 7. adesso-Vorteil (1-4 Punkte)
Warum ist adesso der richtige Partner für ${cmsName}?
- Expertise-Level
- Referenzprojekte
- Certified Developers
- Support-Strukturen

### 8. Pitch Summary
2-3 Sätze als Elevator Pitch. Warum ${cmsName}? Warum jetzt? Warum mit adesso?
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ADVOCATE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run a CMS advocate agent for a specific CMS
 */
export async function runCMSAdvocate(
  cmsName: string,
  input: CMSAdvocateInput,
  additionalContext?: string
): Promise<CMSAdvocateOutput> {
  // 1. Load CMS knowledge from database
  const knowledge = await loadCMSKnowledge(cmsName);

  if (!knowledge) {
    console.warn(`[CMS Advocate] No database entry for ${cmsName}, using general knowledge`);
  }

  // 2. Build prompt
  const prompt = buildAdvocatePrompt(cmsName, knowledge, input, additionalContext);

  // 3. Generate structured output
  const result = await generateStructuredOutput({
    model: 'quality',
    schema: CMSAdvocateOutputSchema,
    system: `Du bist ein ${cmsName} Advocate bei adesso SE. Deine Aufgabe ist es, das CMS professionell zu "verkaufen", dabei aber ehrlich und faktenbasiert zu bleiben.`,
    prompt,
    temperature: 0.7,
  });

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CMS-SPECIFIC CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CMS-specific context that gets added to the prompt
 */
export const CMS_SPECIFIC_CONTEXT: Record<string, string> = {
  drupal: `
## Drupal-spezifisches Wissen

### Core Features (nativ)
- Content Types & Fields System
- Views (Listen, Übersichten)
- Taxonomy (Kategorisierung)
- Media Library
- User Roles & Permissions
- Workflows (Content Moderation)
- Layout Builder
- Multilingual (Content Translation)
- JSON:API / REST

### Wichtige Contrib-Module
- Paragraphs (Flexible Content)
- Webform (Formulare)
- Search API + Solr (Suche)
- Commerce (E-Commerce)
- Metatag (SEO)
- Pathauto (URL-Aliase)
- Simple Sitemap
- Google Analytics
- Editoria11y (Barrierefreiheit)

### adesso Drupal Expertise
- Drupal Enterprise Partner
- 50+ Drupal-Entwickler
- Certified Acquia Developers
- Eigene Drupal Baseline (Best Practices)
`,

  magnolia: `
## Magnolia-spezifisches Wissen

### Core Features
- Content Apps Architecture
- Visual SPA Editor
- Personalization Engine
- Digital Asset Management
- Multi-Site Management
- Headless/Hybrid Delivery
- REST API
- GraphQL API

### Stärken
- Enterprise-Grade Java-Architektur
- Hervorragender Visual Editor
- Native Personalisierung
- Starke Integration mit Java-Ökosystem

### adesso Magnolia Expertise
- Magnolia Partner
- Java Enterprise Fokus
- Integration mit SAP, Hybris
`,

  ibexa: `
## Ibexa-spezifisches Wissen (ehemals eZ Platform)

### Core Features
- Symfony-basiert
- Content Repository
- Page Builder
- Site Factory (Multi-Site)
- Product Information Management
- Personalization
- REST API
- GraphQL

### Stärken
- Modernes PHP/Symfony Stack
- Starke API-First Architektur
- B2B E-Commerce Features
- Content as a Service (CaaS)

### adesso Ibexa Expertise
- Symfony Expertise
- PHP Enterprise Projekte
`,

  firstspirit: `
## FirstSpirit-spezifisches Wissen

### Core Features
- Content as a Service (CaaS)
- Headless Architecture
- Omnichannel Delivery
- Personalization
- Multi-Site Management
- AI-powered Content
- Integration Hub

### Stärken
- Pures Headless CMS
- Starke Omnichannel-Fähigkeiten
- Deutsche Entwicklung (e-Spirit/Crownpeak)
- Enterprise Support

### adesso FirstSpirit Expertise
- FirstSpirit Partner
- Omnichannel Expertise
- Enterprise Implementations
`,

  sulu: `
## Sulu-spezifisches Wissen

### Core Features
- Symfony-basiert
- Content Management
- Media Management
- Multi-Portal
- SEO Tools
- Form Builder
- Headless Ready

### Stärken
- Modernes Symfony Stack
- Open Source
- Gute Developer Experience
- Flexibel und erweiterbar
- Deutsche Community

### adesso Sulu Expertise
- Symfony Expertise
- PHP Best Practices
- Open Source Fokus
`,
};
