/**
 * Calc-Sheet Generator Agent
 *
 * Generiert strukturierte Kalkulationsdaten für den adesso Calculator 2.01.
 * Wenn keine RAG-Daten vorhanden sind, generiert der Agent alle Daten selbstständig
 * basierend auf Quick Scan, Website-Analyse und verfügbaren Audit-Daten.
 *
 * Output-Struktur folgt dem adesso Calculator Template:
 * - Start: Projektinfos (Name, Kunde, CMS)
 * - Features: Feature-Liste mit Komplexität und Stunden
 * - Tasks: Projekt-Aufgaben nach Phasen
 * - Roles: Team-Rollen mit FTE
 * - Risks: Risiko-Register mit Mitigation
 *
 * @see adesso Calculator 2.01 - Default Template CMS 1.xlsm
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { dealEmbeddings, pitches } from '@/lib/db/schema';
import type { ChunkCategory } from '@/lib/db/schema';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Helpers to generate unique IDs for schema defaults
const generateFeatureId = () => `feat_${Math.random().toString(36).substring(2, 9)}`;
const generateTaskId = () => `task_${Math.random().toString(36).substring(2, 9)}`;
const generateRoleId = () => `role_${Math.random().toString(36).substring(2, 9)}`;
const generateRiskId = () => `risk_${Math.random().toString(36).substring(2, 9)}`;

export const CalcSheetFeatureSchema = z.object({
  id: z
    .string()
    .optional()
    .default('')
    .transform(v => v || generateFeatureId()),
  name: z.string().optional().default('Unbekanntes Feature'),
  description: z.string().optional().default(''),
  type: z
    .enum(['content_type', 'paragraph', 'view', 'module', 'integration', 'custom'])
    .default('custom'),
  complexity: z.enum(['H', 'M', 'L']).default('M'),
  hours: z.number().optional().default(8),
});

export const CalcSheetTaskSchema = z.object({
  id: z
    .string()
    .optional()
    .default('')
    .transform(v => v || generateTaskId()),
  phase: z.string().optional().default('Development'),
  description: z.string().optional().default(''),
  role: z.string().optional().default('Developer'),
  hours: z.number().optional().default(4),
});

export const CalcSheetRoleSchema = z.object({
  id: z
    .string()
    .optional()
    .default('')
    .transform(v => v || generateRoleId()),
  title: z.string().optional().default('Unbekannte Rolle'),
  level: z.enum(['Junior', 'Senior', 'Lead', 'Expert']).default('Senior'),
  responsibilities: z.array(z.string()).default([]),
  fte: z.number().default(1),
});

export const CalcSheetRiskSchema = z.object({
  id: z
    .string()
    .optional()
    .default('')
    .transform(v => v || generateRiskId()),
  name: z.string().optional().default('Unbekanntes Risiko'),
  description: z.string().optional().default(''),
  likelihood: z.enum(['low', 'medium', 'high']).default('medium'),
  impact: z.enum(['low', 'medium', 'high']).default('medium'),
  mitigation: z.string().optional().default('Zu definieren'),
});

export const CalcSheetStartSchema = z.object({
  projectName: z.string().default('Untitled Project'),
  client: z.string().default('Unknown Client'),
  partner: z.string().optional(),
  date: z.string().default(new Date().toISOString().split('T')[0]),
  cms: z.string().default('Unknown CMS'),
});

export const CalcSheetSummarySchema = z.object({
  totalFeatures: z.number().default(0),
  totalHours: z.number().default(0),
  totalFTE: z.number().default(0),
  estimatedBudget: z.number().optional(),
  estimatedDuration: z.string().optional(),
});

export const CalcSheetSchema = z.object({
  start: CalcSheetStartSchema.optional().default({
    projectName: 'Untitled Project',
    client: 'Unknown Client',
    date: new Date().toISOString().split('T')[0],
    cms: 'Unknown CMS',
  }),
  features: z.array(CalcSheetFeatureSchema).default([]),
  tasks: z.array(CalcSheetTaskSchema).default([]),
  roles: z.array(CalcSheetRoleSchema).default([]),
  risks: z.array(CalcSheetRiskSchema).default([]),
  summary: CalcSheetSummarySchema.optional().default({
    totalFeatures: 0,
    totalHours: 0,
    totalFTE: 0,
  }),
});

export type CalcSheetFeature = z.infer<typeof CalcSheetFeatureSchema>;
export type CalcSheetTask = z.infer<typeof CalcSheetTaskSchema>;
export type CalcSheetRole = z.infer<typeof CalcSheetRoleSchema>;
export type CalcSheetRisk = z.infer<typeof CalcSheetRiskSchema>;
export type CalcSheetStart = z.infer<typeof CalcSheetStartSchema>;
export type CalcSheetSummary = z.infer<typeof CalcSheetSummarySchema>;
export type CalcSheet = z.infer<typeof CalcSheetSchema>;

export interface CalcSheetGeneratorInput {
  leadId: string;
  forceRegenerate?: boolean;
}

export interface CalcSheetGeneratorResult {
  success: boolean;
  calcSheet: CalcSheet | null;
  source: 'rag' | 'ai_generated' | 'hybrid';
  confidence: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate Calc-Sheet data for a lead
 *
 * Flow:
 * 1. Check RAG for existing calc-sheet data
 * 2. If found, synthesize and return
 * 3. If not found, gather context from Quick Scan + Website Analysis
 * 4. Generate calc-sheet using AI
 * 5. Store in RAG with chunkCategory: 'estimate'
 *
 * @param input - Lead ID and options
 * @returns CalcSheetGeneratorResult with structured data
 */
export async function generateCalcSheet(
  input: CalcSheetGeneratorInput
): Promise<CalcSheetGeneratorResult> {
  const { leadId, forceRegenerate = false } = input;

  try {
    // 1. Check for existing calc-sheet data in RAG
    if (!forceRegenerate) {
      const existingData = await getExistingCalcSheetData(leadId);
      if (existingData) {
        return {
          success: true,
          calcSheet: existingData,
          source: 'rag',
          confidence: 85,
        };
      }
    }

    // 2. Gather context from Quick Scan and other sources
    const context = await gatherContext(leadId);

    if (!context.hasData) {
      return {
        success: false,
        calcSheet: null,
        source: 'ai_generated',
        confidence: 0,
        error: 'Keine Daten verfügbar. Bitte erst einen Quick Scan oder Deep Scan durchführen.',
      };
    }

    // 3. Generate calc-sheet using AI
    const calcSheet = await generateCalcSheetFromContext(context);

    // 4. Store in RAG
    await storeCalcSheetInRAG(leadId, calcSheet);

    return {
      success: true,
      calcSheet,
      source: 'ai_generated',
      confidence: context.confidence,
    };
  } catch (error) {
    console.error('[Calc-Sheet Generator] Error:', error);
    return {
      success: false,
      calcSheet: null,
      source: 'ai_generated',
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

interface ContextData {
  hasData: boolean;
  confidence: number;
  customerName: string;
  websiteUrl: string;
  cms: string;
  techStack: string[];
  pageCount: number;
  contentTypes: string[];
  components: string[];
  integrations: string[];
  migrationComplexity: string;
  existingFeatures: string[];
}

/**
 * Check for existing calc-sheet data in RAG
 */
async function getExistingCalcSheetData(leadId: string): Promise<CalcSheet | null> {
  try {
    const chunks = await db.select().from(dealEmbeddings).where(eq(dealEmbeddings.pitchId, leadId));

    // Look for calc-sheet specific chunks
    const calcSheetChunks = chunks.filter(
      chunk =>
        chunk.agentName === 'calc_sheet_generator' ||
        chunk.chunkType === 'calc_sheet' ||
        chunk.chunkType === 'estimation_result'
    );

    if (calcSheetChunks.length === 0) {
      return null;
    }

    // Try to parse the most recent calc-sheet
    for (const chunk of calcSheetChunks) {
      try {
        const metadata = chunk.metadata
          ? (JSON.parse(chunk.metadata) as Record<string, unknown>)
          : {};

        if (metadata.calcSheet) {
          return CalcSheetSchema.parse(metadata.calcSheet);
        }
      } catch {
        // Continue to next chunk
      }
    }

    return null;
  } catch (error) {
    console.error('[Calc-Sheet Generator] Error checking existing data:', error);
    return null;
  }
}

/**
 * Gather context from Quick Scan and other RAG sources
 */
async function gatherContext(leadId: string): Promise<ContextData> {
  const context: ContextData = {
    hasData: false,
    confidence: 0,
    customerName: '',
    websiteUrl: '',
    cms: '',
    techStack: [],
    pageCount: 0,
    contentTypes: [],
    components: [],
    integrations: [],
    migrationComplexity: 'medium',
    existingFeatures: [],
  };

  try {
    // Get lead data
    const lead = await db.query.pitches.findFirst({
      where: eq(pitches.id, leadId),
      with: {
        quickScan: true,
      },
    });

    if (!lead) {
      return context;
    }

    context.customerName = lead.customerName;
    context.websiteUrl = lead.websiteUrl || '';
    context.hasData = true;

    // Get Quick Scan data
    if (lead.quickScan) {
      const qs = lead.quickScan;
      context.cms = qs.cms || '';
      context.pageCount = qs.pageCount || 0;

      if (qs.techStack) {
        try {
          const techStack = JSON.parse(qs.techStack);
          context.techStack = Array.isArray(techStack) ? techStack : techStack.technologies || [];
        } catch {
          // Ignore parse errors
        }
      }

      if (qs.contentTypes) {
        try {
          const ct = JSON.parse(qs.contentTypes);
          context.contentTypes = Array.isArray(ct) ? ct : [];
        } catch {
          // Ignore parse errors
        }
      }

      if (qs.migrationComplexity) {
        try {
          const mc = JSON.parse(qs.migrationComplexity);
          context.migrationComplexity = mc.level || mc.complexity || 'medium';
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Get RAG embeddings for additional context
    const chunks = await db.select().from(dealEmbeddings).where(eq(dealEmbeddings.pitchId, leadId));

    // Extract components from component_library agent
    const componentChunks = chunks.filter(c => c.agentName === 'component_library');
    for (const chunk of componentChunks) {
      try {
        const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {};
        if (metadata.components) {
          context.components = metadata.components
            .map((c: { name?: string }) => c.name)
            .filter(Boolean);
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Extract content architecture
    const contentChunks = chunks.filter(c => c.agentName === 'content_architecture');
    for (const chunk of contentChunks) {
      try {
        const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {};
        if (metadata.contentTypes) {
          context.contentTypes = [
            ...context.contentTypes,
            ...metadata.contentTypes.map((ct: { name?: string }) => ct.name).filter(Boolean),
          ];
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Calculate confidence based on available data
    let confidence = 30; // Base confidence
    if (context.cms && context.cms.trim() !== '') confidence += 15;
    if (context.pageCount > 0) confidence += 10;
    if (context.techStack.length > 0) confidence += 10;
    if (context.contentTypes.length > 0) confidence += 15;
    if (context.components.length > 0) confidence += 10;
    if (chunks.length > 5) confidence += 10;

    context.confidence = Math.min(100, confidence);

    return context;
  } catch (error) {
    console.error('[Calc-Sheet Generator] Error gathering context:', error);
    return context;
  }
}

/**
 * Sanitize calc-sheet by replacing "Unbekannt" placeholders with derived names
 */
function sanitizeCalcSheet(calcSheet: CalcSheet): CalcSheet {
  return {
    ...calcSheet,
    features: calcSheet.features.map(f => ({
      ...f,
      name: sanitizeName(f.name, f.description, 'Feature'),
    })),
    roles: calcSheet.roles.map(r => ({
      ...r,
      title: sanitizeName(r.title, r.responsibilities.join(', '), 'Rolle'),
    })),
    risks: calcSheet.risks.map(r => ({
      ...r,
      name: sanitizeName(r.name, r.description || r.mitigation, 'Risiko'),
    })),
  };
}

/**
 * Sanitize a single name by deriving from fallback source if needed
 */
function sanitizeName(name: string, fallbackSource: string, prefix: string): string {
  const forbidden = ['Unbekanntes Feature', 'Unbekannte Rolle', 'Unbekanntes Risiko', ''];

  if (forbidden.includes(name) || !name?.trim()) {
    // Derive name from fallback source (first 5 words)
    const derived = fallbackSource?.trim().split(/\s+/).slice(0, 5).join(' ');
    return derived || `${prefix}-${Date.now().toString(36)}`;
  }

  return name;
}

/**
 * Generate calc-sheet using AI from gathered context
 */
async function generateCalcSheetFromContext(context: ContextData): Promise<CalcSheet> {
  const systemPrompt = `Du bist ein erfahrener Projektplaner bei adesso SE, spezialisiert auf CMS-Migrationsprojekte.
Du erstellst strukturierte Projektkalkulationen im Format des adesso Calculator 2.01.

WICHTIG:
- Alle Schätzungen basieren auf adesso-typischen Projektgrößen und Erfahrungswerten
- Features werden nach Komplexität kategorisiert: H (High/16-32h), M (Medium/8-16h), L (Low/2-8h)
- Stunden sind realistische Schätzungen inklusive Testing und Documentation
- Risiken werden mit konkreten Mitigationsstrategien versehen

PHASEN im adesso-Projektmodell:
1. Discovery & Konzeption
2. Setup & Infrastruktur
3. Content Architecture
4. Frontend Development
5. Backend Development
6. Integrations
7. Migration & Import
8. Testing & QA
9. Go-Live & Training

ROLLEN:
- Project Manager
- Technical Architect
- Senior Developer
- Developer
- UX/UI Designer
- QA Engineer`;

  const userPrompt = `Erstelle eine vollständige Projektkalkulation für folgendes Projekt:

PROJEKTDATEN:
- Kunde: ${context.customerName}
- Website: ${context.websiteUrl}
- Aktuelles CMS: ${context.cms}
- Seitenanzahl: ${context.pageCount}
- Tech-Stack: ${context.techStack.join(', ') || 'Nicht ermittelt'}
- Erkannte Content Types: ${context.contentTypes.join(', ') || 'Nicht ermittelt'}
- Erkannte Komponenten: ${context.components.join(', ') || 'Nicht ermittelt'}
- Migrations-Komplexität: ${context.migrationComplexity}

Generiere eine vollständige Kalkulation mit:
1. START: Projektinfos
2. FEATURES: Mindestens 10-15 Features basierend auf den erkannten Content Types und Komponenten
3. TASKS: Mindestens 15-20 Aufgaben verteilt auf alle Projektphasen
4. ROLES: Mindestens 4-6 Rollen mit FTE-Zuordnung
5. RISKS: Mindestens 5 Risiken mit Mitigationsstrategien
6. SUMMARY: Gesamtsummen

Für jeden Feature:
- Leite aus Content Types → Content Type Features ab
- Leite aus Komponenten → Paragraph Features ab
- Füge Standard-Features hinzu (Navigation, Search, Forms, etc.)

KRITISCHE NAMENSGEBUNG:
- Jedes Feature MUSS einen konkreten, beschreibenden Namen haben (z.B. "News-Artikel Content Type", "Video-Paragraph-Komponente")
- Jede Rolle MUSS einen konkreten Jobtitel haben (z.B. "Senior Drupal Developer", "UX Designer")
- Jedes Risiko MUSS einen konkreten Namen haben (z.B. "Datenmigration aus Legacy-System", "Browser-Kompatibilität")
- VERBOTEN: "Unbekanntes Feature", "Unbekannte Rolle", "Unbekanntes Risiko", generische Platzhalter
- Bei fehlendem Kontext: Namen aus Beschreibung/Mitigation ableiten oder sinnvolle Standardnamen verwenden

Antworte im JSON-Format.`;

  const calcSheet = await generateStructuredOutput({
    model: 'quality',
    schema: CalcSheetSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
    maxTokens: 8000,
  });

  // Ensure summary is calculated correctly
  calcSheet.summary = {
    totalFeatures: calcSheet.features.length,
    totalHours:
      calcSheet.features.reduce((sum, f) => sum + f.hours, 0) +
      calcSheet.tasks.reduce((sum, t) => sum + t.hours, 0),
    totalFTE: calcSheet.roles.reduce((sum, r) => sum + r.fte, 0),
    estimatedBudget: undefined,
    estimatedDuration: undefined,
  };

  // Calculate estimated duration (rough: total hours / (total FTE * 160 hours/month))
  const monthlyCapacity = calcSheet.summary.totalFTE * 160;
  if (monthlyCapacity > 0) {
    const months = Math.ceil(calcSheet.summary.totalHours / monthlyCapacity);
    calcSheet.summary.estimatedDuration = `${months} Monate`;
  }

  // Sanitize calc-sheet to remove any "Unbekannt" placeholders
  return sanitizeCalcSheet(calcSheet);
}

/**
 * Store calc-sheet in RAG with proper categorization
 */
async function storeCalcSheetInRAG(leadId: string, calcSheet: CalcSheet): Promise<void> {
  try {
    // Build searchable content
    const featureList = calcSheet.features
      .map(f => `- ${f.name} (${f.type}, ${f.complexity}, ${f.hours}h): ${f.description}`)
      .join('\n');

    const taskList = calcSheet.tasks
      .map(t => `- ${t.phase}: ${t.description} (${t.role}, ${t.hours}h)`)
      .join('\n');

    const roleList = calcSheet.roles
      .map(r => `- ${r.title} (${r.level}, ${r.fte} FTE): ${r.responsibilities.join(', ')}`)
      .join('\n');

    const riskList = calcSheet.risks
      .map(
        r =>
          `- ${r.name} (${r.likelihood}/${r.impact}): ${r.description} | Mitigation: ${r.mitigation}`
      )
      .join('\n');

    const chunkText = `Projektkalkulation für ${calcSheet.start.client}

PROJEKTÜBERSICHT:
- Projekt: ${calcSheet.start.projectName}
- Kunde: ${calcSheet.start.client}
- CMS: ${calcSheet.start.cms}
- Datum: ${calcSheet.start.date}

ZUSAMMENFASSUNG:
- Gesamt-Features: ${calcSheet.summary.totalFeatures}
- Gesamt-Stunden: ${calcSheet.summary.totalHours}h
- Gesamt-FTE: ${calcSheet.summary.totalFTE}
${calcSheet.summary.estimatedDuration ? `- Geschätzte Dauer: ${calcSheet.summary.estimatedDuration}` : ''}

FEATURES:
${featureList}

AUFGABEN:
${taskList}

ROLLEN:
${roleList}

RISIKEN:
${riskList}`;

    // Generate embedding
    const chunks = [
      {
        chunkIndex: 0,
        content: chunkText,
        tokenCount: Math.ceil(chunkText.length / 4),
        metadata: {
          startPosition: 0,
          endPosition: chunkText.length,
          type: 'section' as const,
        },
      },
    ];

    const chunksWithEmbeddings = await generateRawChunkEmbeddings(chunks);

    if (chunksWithEmbeddings && chunksWithEmbeddings.length > 0) {
      await db.insert(dealEmbeddings).values({
        pitchId: leadId,
        agentName: 'calc_sheet_generator',
        chunkType: 'calc_sheet',
        chunkIndex: 0,
        content: chunkText,
        embedding: chunksWithEmbeddings[0].embedding,
        chunkCategory: 'estimate' as ChunkCategory,
        confidence: 70,
        requiresValidation: true,
        metadata: JSON.stringify({
          calcSheet,
          generatedAt: new Date().toISOString(),
          version: '1.0',
        }),
      });
    }
  } catch (error) {
    console.error('[Calc-Sheet Generator] Failed to store in RAG:', error);
    // Don't throw - generation still succeeded
  }
}

/**
 * Get only calc-sheet features for a lead
 */
export async function getCalcSheetFeatures(leadId: string): Promise<CalcSheetFeature[]> {
  const result = await generateCalcSheet({ leadId });
  return result.calcSheet?.features || [];
}

/**
 * Get only calc-sheet tasks for a lead
 */
export async function getCalcSheetTasks(leadId: string): Promise<CalcSheetTask[]> {
  const result = await generateCalcSheet({ leadId });
  return result.calcSheet?.tasks || [];
}

/**
 * Get only calc-sheet roles for a lead
 */
export async function getCalcSheetRoles(leadId: string): Promise<CalcSheetRole[]> {
  const result = await generateCalcSheet({ leadId });
  return result.calcSheet?.roles || [];
}

/**
 * Get only calc-sheet risks for a lead
 */
export async function getCalcSheetRisks(leadId: string): Promise<CalcSheetRisk[]> {
  const result = await generateCalcSheet({ leadId });
  return result.calcSheet?.risks || [];
}
