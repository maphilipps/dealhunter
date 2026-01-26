export const PREQUAL_SECTION_QUERIES: Record<string, string> = {
  budget:
    'Budget, Kostenrahmen, Honorar, Vergütung, Laufzeit. Gibt es konkrete Beträge oder Budgetrahmen? Gibt es Angaben zur Laufzeit?',
  timing:
    'Zeitplan, Abgabefrist, Timeline, Vergabeverfahren, Shortlisting, Teilnahmeantrag, Portal, Termine, Meilensteine.',
  contracts:
    'Vertragstyp, EVB-IT, Rahmenvertrag, Vertragsmodell (Werkvertrag, Dienstvertrag, SLA), Vertragslaufzeit, Vertragsbedingungen.',
  deliverables:
    'Leistungsumfang, Scope, geforderte Leistungen, Unterlagen, Angebotsstruktur, Teilnahmeantrag, Angebotsphase, Pflichtunterlagen.',
  references:
    'Referenzen, Referenzprojekte, Anzahl, Branchenanforderungen, Technologieanforderungen, Nachweise.',
  'award-criteria':
    'Zuschlagskriterien, Bewertungskriterien, Gewichtung, Konzepte, Kriterien für Teilnahmeantrag und Angebot.',
};

export function getPreQualSectionQueryTemplate(sectionId: string): string | null {
  return PREQUAL_SECTION_QUERIES[sectionId] ?? null;
}
