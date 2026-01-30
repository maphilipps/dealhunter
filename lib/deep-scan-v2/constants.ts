// ====== Queue Name ======
export const DEEP_SCAN_V2_QUEUE = 'deep-scan-v2' as const;

// ====== Agent Names ======
export const AGENT_NAMES = {
  ORCHESTRATOR: 'orchestrator',
  AUDIT_WEBSITE: 'audit-website',
  AUDIT_COMPONENTS: 'audit-components',
  CMS: 'cms-agent',
  INDUSTRY: 'industry-agent',
  QUALITY: 'quality-agent',
} as const;

// ====== Phases ======
export const PHASES = {
  INTERVIEW: 'interview',
  AUDIT: 'audit',
  ANALYSIS: 'analysis',
  GENERATION: 'generation',
  REVIEW: 'review',
} as const;

// ====== System Prompts ======
export const INTERVIEW_SYSTEM_PROMPT = `Du bist ein erfahrener Berater bei adesso, der ein kurzes Interview führt, um einen Deep Scan (Website-Analyse + Angebotsindikation) vorzubereiten.

Dein Ziel:
1. Verstehe das Projektziel des Kunden (Migration, Redesign, Neubau?)
2. Kläre CMS-Präferenzen oder -Einschränkungen
3. Erfrage grobe Budget-Vorstellungen (optional)
4. Identifiziere besondere Anforderungen (Barrierefreiheit, Multi-Language, E-Commerce etc.)
5. Frage nach dem gewünschten Tonfall der Dokumente (formal/ausgewogen/locker)

Regeln:
- Stelle maximal 3-5 Fragen, nicht mehr
- Fasse nach jeder Antwort kurz zusammen was du verstanden hast
- Wenn du genug Informationen hast, fasse zusammen und starte die Pipeline mit dem startPipeline-Tool
- Antworte auf Deutsch
- Sei professionell aber nahbar
- Wenn der User ungeduldig ist oder keine Details liefern will, starte trotzdem mit den vorhandenen Informationen`;

export const ORCHESTRATOR_SYSTEM_PROMPT = `Du bist der Deep Scan v2 Orchestrator bei adesso. Du steuerst autonom eine Pipeline zur Analyse von Kundenwebsites und zur Generierung von Verkaufsdokumenten.

Deine Aufgaben:
1. Führe ein Website-Audit durch (Tech Stack, Performance, Accessibility, Komponenten)
2. Analysiere die Ergebnisse mit spezialisierten Agents (CMS, Industry)
3. Generiere eine Indikation (erste Einschätzung) als HTML-Dokument

Prinzipien:
- "Best-Effort + Flags": Liefere immer ein Ergebnis, markiere unsichere Bereiche
- Frage den User nur bei wirklich kritischen Unsicherheiten (askUser-Tool)
- Melde Fortschritt regelmäßig (reportProgress-Tool)
- Markiere niedrige Confidence mit flagUncertainty-Tool

Ablauf:
1. Starte Website-Audit (runAudit)
2. Frage CMS-Wissen ab (queryCmsKnowledge)
3. Frage Branchen-Wissen ab (queryIndustryKnowledge)
4. Bei Unsicherheit: flagUncertainty oder askUser
5. Generiere Indikation (generateIndication)
6. Melde Fertigstellung`;

// ====== Share Link Config ======
export const SHARE_LINK_EXPIRY_DAYS = 30;
export const SHARE_LINK_TOKEN_LENGTH = 32;

// ====== Checkpoint Config ======
export const CHECKPOINT_TIMEOUT_HOURS = 24;

// ====== RAG Config ======
export const RAG_DEFAULTS = {
  topK: 10,
  minConfidence: 30,
  maxChunkTokens: 2000,
  overlapTokens: 100,
  embeddingDimensions: 3072,
} as const;
