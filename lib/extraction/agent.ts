import { extractedRequirementsSchema, type ExtractedRequirements } from './schema';

import { openai } from '@/lib/ai/config';
import { embedRawText } from '@/lib/rag/raw-embedding-service';
import { queryRawChunks, formatRAGContext } from '@/lib/rag/raw-retrieval-service';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

export interface ExtractionInput {
  rfpId?: string;
  rawText: string;
  inputType: 'pdf' | 'email' | 'freetext';
  metadata?: {
    from?: string;
    subject?: string;
    date?: string;
  };
}

export interface ExtractionOutput {
  requirements: ExtractedRequirements;
  success: boolean;
  error?: string;
}

/**
 * Field definition for RAG-based extraction
 * Each field has language-specific queries and a German extraction prompt
 */
interface FieldDefinition {
  name: string;
  displayName: string;
  queries: {
    de: string;
    en: string;
  };
  extractPrompt: string; // Always German - output language
  isArray?: boolean;
  isObject?: boolean;
}

type DocumentLanguage = 'de' | 'en';

/**
 * Detect the primary language of a document
 * Uses a small LLM call for accurate detection
 */
async function detectDocumentLanguage(rawText: string): Promise<DocumentLanguage> {
  // Take a sample from the beginning (first 1500 chars)
  const sample = rawText.substring(0, 1500);

  try {
    const completion = await openai.chat.completions.create({
      model: 'claude-haiku-4.5',
      messages: [
        {
          role: 'system',
          content:
            'Du bist ein Spracherkennungs-Experte. Antworte NUR mit "de" für Deutsch oder "en" für Englisch. Keine anderen Antworten.',
        },
        {
          role: 'user',
          content: `In welcher Sprache ist dieser Text hauptsächlich verfasst?\n\n${sample}`,
        },
      ],
      temperature: 0,
      max_tokens: 5,
    });

    const response = completion.choices[0]?.message?.content?.trim().toLowerCase() || 'en';
    return response === 'de' ? 'de' : 'en';
  } catch {
    // Default to English on error (most common for RFPs)
    return 'en';
  }
}

/**
 * Get the appropriate query for a field based on document language
 */
function getFieldQuery(field: FieldDefinition, language: DocumentLanguage): string {
  return field.queries[language];
}

/**
 * Define all fields to extract with language-specific RAG queries
 * Queries are in the document language, prompts are in German (output language)
 */
const EXTRACTION_FIELDS: FieldDefinition[] = [
  {
    name: 'customerName',
    displayName: 'Kundenname',
    queries: {
      de: 'Kunde Auftraggeber Firma Unternehmen Organisation Name Antragsteller',
      en: 'client customer company organization name contracting party issuer',
    },
    extractPrompt:
      'Extrahiere den Namen des Kunden/Auftraggebers. Antworte NUR mit dem Namen, nichts anderes.',
  },
  {
    name: 'projectName',
    displayName: 'Projektname',
    queries: {
      de: 'Projekt Name Titel Bezeichnung Vorhaben Ausschreibung',
      en: 'RFP project title name scope platform website app mobile',
    },
    extractPrompt:
      'Extrahiere den Projektnamen oder -titel aus dem RFP-Dokument. Antworte NUR mit dem Namen, nichts anderes.',
  },
  {
    name: 'projectDescription',
    displayName: 'Projektbeschreibung',
    queries: {
      de: 'Projekt Beschreibung Ziel Anforderung Umfang Hintergrund',
      en: 'scope objective overview executive summary introduction background purpose',
    },
    extractPrompt: 'Fasse das Projekt in 2-3 Sätzen zusammen. Was soll erreicht werden?',
  },
  {
    name: 'industry',
    displayName: 'Branche',
    queries: {
      de: 'Branche Industrie Sektor Bereich Markt Geschäftsfeld',
      en: 'industry sector market business domain sports finance healthcare retail',
    },
    extractPrompt:
      'Extrahiere die Branche des Kunden (z.B. Sport, Finanzen, Gesundheit). Antworte NUR mit der Branche.',
  },
  {
    name: 'technologies',
    displayName: 'Technologien',
    queries: {
      de: 'Technologie Framework CMS System Plattform Software Tool',
      en: 'technology stack platform software tools API integration SSO CMS framework',
    },
    extractPrompt:
      'Liste alle genannten Technologien, Frameworks und Systeme auf. Format: kommagetrennte Liste.',
    isArray: true,
  },
  {
    name: 'budgetRange',
    displayName: 'Budget',
    queries: {
      de: 'Budget Kosten EUR Euro Betrag Wert Preis Aufwand Volumen',
      en: 'budget cost price EUR USD amount value financial estimate pricing investment',
    },
    extractPrompt: `Extrahiere das Budget. Antworte im JSON Format:
{"min": <zahl oder null>, "max": <zahl oder null>, "currency": "EUR", "confidence": <0-100>, "rawText": "<original text>"}
Falls kein Budget genannt: {"min": null, "max": null, "currency": "EUR", "confidence": 0, "rawText": "nicht genannt"}`,
    isObject: true,
  },
  {
    name: 'submissionDeadline',
    displayName: 'Abgabefrist',
    queries: {
      de: 'Deadline Abgabe Frist Termin Einreichung bis spätestens',
      en: 'submission deadline due date response timeline RFP deadline closing date',
    },
    extractPrompt:
      'Extrahiere das Abgabedatum. Antworte NUR im Format YYYY-MM-DD oder "nicht genannt".',
  },
  {
    name: 'timeline',
    displayName: 'Projektlaufzeit',
    queries: {
      de: 'Zeitplan Laufzeit Dauer Monate Start Ende Projektplan',
      en: 'timeline schedule duration months project milestones phases delivery go-live',
    },
    extractPrompt:
      'Beschreibe den Zeitplan/die Laufzeit kurz. Z.B. "6 Monate ab Q2 2024" oder "nicht genannt".',
  },
  {
    name: 'contacts',
    displayName: 'Kontakte',
    queries: {
      de: 'Kontakt Ansprechpartner Person Email Telefon Name',
      en: 'contact person email phone name point of contact stakeholder procurement',
    },
    extractPrompt: `Liste alle Kontaktpersonen auf. Antworte im JSON Array Format:
[{"name": "...", "role": "...", "email": "...", "phone": "...", "category": "decision_maker|influencer|coordinator|unknown", "confidence": 50}]
Falls keine Kontakte: []`,
    isArray: true,
  },
  {
    name: 'cmsConstraints',
    displayName: 'CMS-Vorgaben',
    queries: {
      de: 'CMS Content Management Drupal WordPress Typo3 System',
      en: 'CMS content management Drupal WordPress headless backend platform architecture',
    },
    extractPrompt: `Extrahiere CMS-Anforderungen. Antworte im JSON Format:
{"required": ["..."], "preferred": ["..."], "excluded": ["..."], "flexibility": "rigid|preferred|flexible|unknown", "confidence": <0-100>, "rawText": "..."}
Falls kein CMS genannt: {"required": [], "preferred": [], "excluded": [], "flexibility": "unknown", "confidence": 0, "rawText": "nicht genannt"}`,
    isObject: true,
  },
  {
    name: 'requiredDeliverables',
    displayName: 'Einzureichende Unterlagen',
    queries: {
      de: 'Unterlagen Dokumente einreichen Angebot Konzept Referenzen Nachweise',
      en: 'deliverables submission requirements proposal response format documents vendor must provide',
    },
    extractPrompt: `Extrahiere alle Unterlagen/Dokumente, die der Bieter einreichen muss (z.B. Proposal, Technical Response, Pricing, References, etc.).
Suche nach: "submission requirements", "deliverables", "vendor must provide", "response should include", "proposal format".
Antworte im JSON Array Format:
[{"name": "Technical Proposal", "description": "Beschreibung", "deadline": "YYYY-MM-DD oder null", "mandatory": true, "confidence": 80}]
Falls keine spezifischen Unterlagen genannt werden, antworte mit: []`,
    isArray: true,
  },
  {
    name: 'keyRequirements',
    displayName: 'Kernanforderungen',
    queries: {
      de: 'Anforderung muss soll Pflicht Kriterium Bedingung funktional',
      en: 'requirements must shall mandatory functional non-functional scope features criteria',
    },
    extractPrompt:
      'Liste die wichtigsten Anforderungen auf. Format: kommagetrennte Liste der Kernanforderungen.',
    isArray: true,
  },
  {
    name: 'websiteUrls',
    displayName: 'Website-URLs',
    queries: {
      de: 'Website URL www Domain Webseite Homepage Link Adresse',
      en: 'website URL www http domain link web address homepage portal site',
    },
    extractPrompt: `Extrahiere alle Website-URLs. Antworte im JSON Array Format:
[{"url": "https://...", "type": "primary|product|regional|related", "description": "...", "extractedFromDocument": true}]
Falls keine URLs: []`,
    isArray: true,
  },
];

/**
 * Extract a single field using RAG query + focused LLM call
 * Uses language-specific query for better retrieval
 */
async function extractSingleField(
  rfpId: string,
  field: FieldDefinition,
  language: DocumentLanguage,
  emit: EventEmitter
): Promise<unknown> {
  // Emit progress: searching
  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: 'Extraktion',
      message: `Suche ${field.displayName} in Unterlagen...`,
    },
  });

  // Get language-specific query
  const query = getFieldQuery(field, language);

  // Query RAG for relevant chunks
  const chunks = await queryRawChunks({
    rfpId,
    question: query,
    maxResults: 5,
  });

  if (chunks.length === 0) {
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: `${field.displayName}: Keine relevanten Passagen gefunden`,
      },
    });

    // Return appropriate default
    if (field.isArray) return [];
    if (field.isObject) return null;
    return null;
  }

  // Format chunks as context
  const context = formatRAGContext(chunks);

  // Small focused LLM call
  const completion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      {
        role: 'system',
        content: `Du bist ein Experte für die Analyse von Ausschreibungsunterlagen.
Extrahiere präzise die gewünschte Information aus dem gegebenen Kontext.
Antworte kurz und direkt - keine Erklärungen, nur die extrahierte Information.
Wenn die Information nicht im Kontext enthalten ist, antworte mit "nicht gefunden" oder einem leeren Array/Objekt je nach Anfrage.`,
      },
      {
        role: 'user',
        content: `KONTEXT AUS DEN UNTERLAGEN:
${context}

AUFGABE: ${field.extractPrompt}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 500,
  });

  const responseText = completion.choices[0]?.message?.content?.trim() || '';

  // Parse response based on field type
  let extractedValue: unknown;

  if (field.isArray) {
    // Try to parse as JSON array
    try {
      if (responseText.startsWith('[')) {
        extractedValue = JSON.parse(responseText);
      } else {
        // Parse comma-separated list
        extractedValue = responseText
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s && s !== 'nicht gefunden' && s !== 'nicht genannt');
      }
    } catch {
      extractedValue = [];
    }
  } else if (field.isObject) {
    // Try to parse as JSON object
    try {
      if (responseText.startsWith('{')) {
        extractedValue = JSON.parse(responseText);
      } else {
        extractedValue = null;
      }
    } catch {
      extractedValue = null;
    }
  } else {
    // String value
    extractedValue =
      responseText === 'nicht gefunden' || responseText === 'nicht genannt' ? null : responseText;
  }

  // Emit progress: found
  const displayValue = formatDisplayValue(extractedValue, field);
  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: 'Extraktion',
      message: `${field.displayName}: ${displayValue}`,
    },
  });

  return extractedValue;
}

/**
 * Format extracted value for display in progress messages
 */
function formatDisplayValue(value: unknown, field: FieldDefinition): string {
  if (value === null || value === undefined) {
    return 'Nicht gefunden';
  }

  if (field.isArray && Array.isArray(value)) {
    if (value.length === 0) return 'Keine gefunden';
    if (typeof value[0] === 'string') {
      return value.length <= 3 ? value.join(', ') : `${value.length} Einträge gefunden`;
    }
    return `${value.length} Einträge gefunden`;
  }

  if (field.isObject && typeof value === 'object') {
    // Special handling for budget
    if (field.name === 'budgetRange') {
      const budget = value as { min?: number; max?: number; currency?: string };
      if (budget.min || budget.max) {
        const min = budget.min ? `${(budget.min / 1000).toFixed(0)}k` : '?';
        const max = budget.max ? `${(budget.max / 1000).toFixed(0)}k` : '?';
        return `${min} - ${max} ${budget.currency || 'EUR'}`;
      }
      return 'Nicht genannt';
    }
    return 'Gefunden';
  }

  // String - truncate if too long
  const str = String(value);
  return str.length > 50 ? str.substring(0, 47) + '...' : str;
}

/**
 * Get empty requirements structure for error cases
 */
function getEmptyRequirements(): ExtractedRequirements {
  return {
    customerName: '',
    projectDescription: '',
    technologies: [],
    keyRequirements: [],
    confidenceScore: 0,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * AI Agent for extracting structured requirements using Field-by-Field RAG
 *
 * New approach:
 * 1. Embed document into chunks (one-time)
 * 2. For each field: Query RAG → Get relevant chunks → Small LLM call → Extract value
 * 3. Combine all fields into ExtractedRequirements
 *
 * Benefits:
 * - More focused extraction per field
 * - Better visibility into what's being extracted
 * - Easier to debug and improve individual fields
 */
export async function runExtractionWithStreaming(
  input: ExtractionInput,
  emit: EventEmitter
): Promise<ExtractionOutput> {
  try {
    // Step 1: Verify we have an rfpId for RAG
    if (!input.rfpId) {
      emit({
        type: AgentEventType.ERROR,
        data: {
          message: 'Keine RFP-ID für RAG-Extraktion vorhanden',
          code: 'MISSING_RFP_ID',
        },
      });
      return {
        requirements: getEmptyRequirements(),
        success: false,
        error: 'Missing rfpId for RAG extraction',
      };
    }

    // Step 2: Create embeddings
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: `Analysiere ${input.inputType === 'pdf' ? 'PDF-Dokument' : input.inputType === 'email' ? 'E-Mail' : 'Freitext'}...`,
      },
    });

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: 'Erstelle Dokument-Embeddings für semantische Suche...',
      },
    });

    const embedResult = await embedRawText(input.rfpId, input.rawText);

    if (!embedResult.success) {
      emit({
        type: AgentEventType.ERROR,
        data: {
          message: `Embedding fehlgeschlagen: ${embedResult.error}`,
          code: 'EMBEDDING_ERROR',
        },
      });
      return {
        requirements: getEmptyRequirements(),
        success: false,
        error: embedResult.error,
      };
    }

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: `${embedResult.stats.totalChunks} Dokument-Chunks erstellt. Erkenne Dokumentsprache...`,
      },
    });

    // Step 3: Detect document language
    const documentLanguage = await detectDocumentLanguage(input.rawText);
    const languageDisplay = documentLanguage === 'de' ? 'Deutsch' : 'Englisch';

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: `Sprache erkannt: ${languageDisplay}. Starte Feld-für-Feld Extraktion...`,
      },
    });

    // Step 4: Extract each field using RAG with language-specific queries
    const extractedData: Record<string, unknown> = {};

    for (const field of EXTRACTION_FIELDS) {
      try {
        const value = await extractSingleField(input.rfpId, field, documentLanguage, emit);
        if (value !== null && value !== undefined) {
          extractedData[field.name] = value;
        }
      } catch (fieldError) {
        console.warn(`[EXTRACT] Field ${field.name} extraction failed:`, fieldError);
        // Continue with other fields
      }
    }

    // Step 5: Ensure required fields have defaults
    if (!extractedData.customerName) extractedData.customerName = 'Unbekannt';
    if (!extractedData.projectDescription)
      extractedData.projectDescription = 'Keine Beschreibung extrahiert';
    if (!Array.isArray(extractedData.technologies)) extractedData.technologies = [];
    if (!Array.isArray(extractedData.keyRequirements)) extractedData.keyRequirements = [];

    // Normalize contacts array
    const validCategories = ['decision_maker', 'influencer', 'coordinator', 'unknown'];
    if (Array.isArray(extractedData.contacts)) {
      extractedData.contacts = (extractedData.contacts as Record<string, unknown>[]).map(
        contact => ({
          ...contact,
          name: contact.name || 'Unbekannt',
          role: contact.role || 'Unbekannt',
          category: validCategories.includes(contact.category as string)
            ? contact.category
            : 'unknown',
          confidence: typeof contact.confidence === 'number' ? contact.confidence : 50,
        })
      );
    }

    // Normalize requiredDeliverables array
    if (Array.isArray(extractedData.requiredDeliverables)) {
      extractedData.requiredDeliverables = (
        extractedData.requiredDeliverables as Record<string, unknown>[]
      ).map(d => ({
        ...d,
        name: d.name || 'Unbekannt',
        mandatory: d.mandatory !== false,
        confidence: typeof d.confidence === 'number' ? d.confidence : 50,
      }));
    }

    // Step 6: Validate with Zod schema
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: 'Validiere extrahierte Daten...',
      },
    });

    const validated = extractedRequirementsSchema.parse(extractedData);

    const requirements: ExtractedRequirements = {
      ...validated,
      extractedAt: new Date().toISOString(),
    };

    // Step 7: Report completion
    const foundItems: string[] = [];
    if (requirements.customerName && requirements.customerName !== 'Unbekannt')
      foundItems.push('Kunde');
    if (requirements.projectName) foundItems.push('Projektname');
    if (requirements.technologies.length > 0)
      foundItems.push(`${requirements.technologies.length} Technologien`);
    if (requirements.keyRequirements.length > 0)
      foundItems.push(`${requirements.keyRequirements.length} Anforderungen`);
    if (requirements.budgetRange) foundItems.push('Budget');
    if (requirements.cmsConstraints) foundItems.push('CMS-Vorgaben');
    if (requirements.contacts && requirements.contacts.length > 0) {
      foundItems.push(`${requirements.contacts.length} Kontakte`);
    }
    if (requirements.submissionDeadline) foundItems.push('Abgabefrist');

    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: 'Extraktion',
        message: `Extraktion abgeschlossen! Gefunden: ${foundItems.join(', ') || 'keine Daten'}`,
      },
    });

    return {
      requirements,
      success: true,
    };
  } catch (error) {
    console.error('Extraction error:', error);
    emit({
      type: AgentEventType.ERROR,
      data: {
        message: error instanceof Error ? error.message : 'Unbekannter Fehler',
        code: 'EXTRACTION_ERROR',
      },
    });
    return {
      requirements: getEmptyRequirements(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error',
    };
  }
}

/**
 * Legacy function for backward compatibility (non-streaming)
 * Delegates to the streaming version with a no-op emitter
 */
export async function extractRequirements(input: ExtractionInput): Promise<ExtractionOutput> {
  const noOpEmit: EventEmitter = () => {};
  return runExtractionWithStreaming(input, noOpEmit);
}
