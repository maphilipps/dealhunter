/**
 * Event types for qualification processing streaming.
 *
 * These events are published by the BullMQ worker via Redis pub/sub
 * and consumed by the SSE endpoint → client EventSource.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export enum QualificationEventType {
  // Phase lifecycle
  PHASE_START = 'phase_start',
  PHASE_COMPLETE = 'phase_complete',
  PHASE_ERROR = 'phase_error',

  // Agent activity
  AGENT_PROGRESS = 'agent_progress',
  AGENT_COMPLETE = 'agent_complete',

  // Tool transparency
  TOOL_CALL = 'tool_call',
  TOOL_RESULT = 'tool_result',

  // Section orchestration
  SECTION_START = 'section_start',
  SECTION_COMPLETE = 'section_complete',
  SECTION_QUALITY = 'section_quality',

  // Extracted findings
  FINDING = 'finding',

  // Terminal
  COMPLETE = 'complete',
  ERROR = 'error',
}

export type QualificationPhaseId =
  | 'pdf_extraction'
  | 'requirements_extraction'
  | 'qualification_scan'
  | 'section_orchestration'
  | 'completion';

export interface QualificationPhaseDefinition {
  id: QualificationPhaseId;
  label: string;
  description: string;
}

export const QUALIFICATION_PHASES: QualificationPhaseDefinition[] = [
  {
    id: 'pdf_extraction',
    label: 'Dokumente extrahieren',
    description: 'Text aus PDFs und Dokumenten wird extrahiert und aufbereitet',
  },
  {
    id: 'requirements_extraction',
    label: 'Anforderungen analysieren',
    description: 'KI extrahiert Projektanforderungen, Technologien und Kundendaten',
  },
  {
    id: 'qualification_scan',
    label: 'Website & Scan',
    description: 'Website-Analyse, Tech-Stack-Erkennung und Business-Line-Zuordnung',
  },
  {
    id: 'section_orchestration',
    label: 'Detailseiten erstellen',
    description: 'Parallele Generierung der Analyse-Sektionen durch spezialisierte Agenten',
  },
  {
    id: 'completion',
    label: 'Abschluss',
    description: 'Ergebnisse werden zusammengeführt und gespeichert',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

export interface QualificationProcessingEvent {
  type: QualificationEventType;
  timestamp: number;
  phase?: QualificationPhaseId;
  progress?: number;
  data?: QualificationEventData;
}

export type FindingType =
  | 'customer'
  | 'budget'
  | 'timeline'
  | 'tech_stack'
  | 'contact'
  | 'decision'
  | 'requirement'
  | 'scope'
  | 'contract'
  | 'deadline'
  | 'industry'
  | 'location'
  | 'reference'
  | 'deliverable'
  | 'criterion'
  | 'service'
  | 'goal'
  | 'business_line'
  | 'cms'
  | 'question'
  | 'strength'
  | 'weakness'
  | 'condition';

export interface FindingData {
  type: FindingType;
  label: string;
  value: string;
  confidence?: number;
}

export interface QualificationEventData {
  message?: string;
  agent?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  reasoning?: string;
  confidence?: number;
  sectionId?: string;
  sectionLabel?: string;
  completedSections?: number;
  totalSections?: number;
  error?: string;
  finding?: FindingData;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

export function isPhaseEvent(
  event: QualificationProcessingEvent
): event is QualificationProcessingEvent & { phase: QualificationPhaseId } {
  return (
    event.type === QualificationEventType.PHASE_START ||
    event.type === QualificationEventType.PHASE_COMPLETE ||
    event.type === QualificationEventType.PHASE_ERROR
  );
}

export function isAgentEvent(event: QualificationProcessingEvent): boolean {
  return (
    event.type === QualificationEventType.AGENT_PROGRESS ||
    event.type === QualificationEventType.AGENT_COMPLETE
  );
}

export function isToolEvent(event: QualificationProcessingEvent): boolean {
  return (
    event.type === QualificationEventType.TOOL_CALL ||
    event.type === QualificationEventType.TOOL_RESULT
  );
}

export function isSectionEvent(event: QualificationProcessingEvent): boolean {
  return (
    event.type === QualificationEventType.SECTION_START ||
    event.type === QualificationEventType.SECTION_COMPLETE ||
    event.type === QualificationEventType.SECTION_QUALITY
  );
}

export function isFindingEvent(event: QualificationProcessingEvent): boolean {
  return event.type === QualificationEventType.FINDING;
}

export function isTerminalEvent(event: QualificationProcessingEvent): boolean {
  return (
    event.type === QualificationEventType.COMPLETE || event.type === QualificationEventType.ERROR
  );
}

export function isVisibleEvent(event: QualificationProcessingEvent): boolean {
  return (
    isAgentEvent(event) || isToolEvent(event) || isSectionEvent(event) || isFindingEvent(event)
  );
}
