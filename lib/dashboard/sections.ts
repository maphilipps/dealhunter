/**
 * Canonical dashboard section configuration.
 * Single source of truth for section IDs, titles, groups, and RAG queries.
 */

export interface DashboardSectionConfig {
  id: string;
  title: string;
  group: 'overview' | 'bid';
  ragQuery: string;
}

export const DASHBOARD_SECTIONS: DashboardSectionConfig[] = [
  {
    id: 'facts',
    title: 'Key Facts',
    group: 'overview',
    ragQuery: 'Projektübersicht Kunde Branche Scope wichtigste Fakten',
  },
  {
    id: 'budget',
    title: 'Budget',
    group: 'bid',
    ragQuery: 'Budget Preis Kosten Finanzierung Vergütung Angebotspreis Wert',
  },
  {
    id: 'timing',
    title: 'Zeitplan / Verfahren',
    group: 'bid',
    ragQuery: 'Zeitplan Termine Fristen Meilensteine Deadlines Vergabeverfahren',
  },
  {
    id: 'contracts',
    title: 'Verträge',
    group: 'bid',
    ragQuery: 'Vertrag Bedingungen AGB Haftung Gewährleistung Vertragsstrafe',
  },
  {
    id: 'deliverables',
    title: 'Leistungsumfang',
    group: 'bid',
    ragQuery: 'Leistungen Anforderungen Deliverables Umfang Aufgaben',
  },
  {
    id: 'references',
    title: 'Referenzen',
    group: 'bid',
    ragQuery: 'Referenzen Nachweise Erfahrung Qualifikation Projekte',
  },
  {
    id: 'award-criteria',
    title: 'Zuschlagskriterien',
    group: 'bid',
    ragQuery: 'Zuschlagskriterien Bewertung Wertung Punkte Kriterien',
  },
  {
    id: 'offer-structure',
    title: 'Angebotsstruktur',
    group: 'bid',
    ragQuery: 'Angebotsstruktur Gliederung Format Unterlagen Abgabe',
  },
  {
    id: 'risks',
    title: 'Risiken',
    group: 'bid',
    ragQuery: 'Risiko Haftung Vertragsstrafe Poenale Verzug Komplexitaet Abhaengigkeiten',
  },
];

/** Lookup map: sectionId → config */
export const SECTION_BY_ID = new Map(DASHBOARD_SECTIONS.map(s => [s.id, s]));

/** Section IDs grouped by category */
export const OVERVIEW_SECTION_IDS = DASHBOARD_SECTIONS.filter(s => s.group === 'overview').map(
  s => s.id
);
export const BID_SECTION_IDS = DASHBOARD_SECTIONS.filter(s => s.group === 'bid').map(s => s.id);
