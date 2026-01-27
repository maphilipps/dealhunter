export const PREQUAL_SECTION_QUERIES: Record<string, string> = {
  budget:
    'Budget, Kostenrahmen, Honorar, Vergütung, Budgetobergrenze, Laufzeit. Gibt es konkrete Beträge oder Budgetrahmen? Wie lange ist die Laufzeit?',
  timing:
    'Zeitplan, Abgabefrist, Timeline, Vergabeverfahren, Shortlisting, Teilnahmeantrag, Portal, Termine, Meilensteine. Gibt es einen mehrstufigen Prozess (Teilnahmeantrag/Shortlist)?',
  contracts:
    'Vertragstyp, EVB-IT, Rahmenvertrag, Vertragsmodell (Werkvertrag, Dienstvertrag, Servicevertrag mit SLA), Vertragslaufzeit, Vertragsbedingungen.',
  deliverables:
    'Leistungsumfang, Scope, geforderte Leistungen, Unterlagen, Angebotsstruktur, Teilnahmeantrag, Angebotsphase, Pflichtunterlagen. Was muss das Angebotsteam erarbeiten?',
  references:
    'Referenzen, Referenzprojekte, Anzahl, Branchenanforderungen, Technologieanforderungen, Nachweise, verpflichtende Branchen.',
  'award-criteria':
    'Zuschlagskriterien, Bewertungskriterien, Gewichtung, Konzepte, Kriterien für Teilnahmeantrag und Angebot. Sind Kriterien an Konzepte gebunden?',
  legal:
    'Rechtliche Anforderungen, Compliance, Datenschutz, Haftung, Vertragsklauseln, Pönalen, NDA, Gewährleistung, SLA, Zertifizierungen.',
  'tech-stack':
    'Technologien, CMS, Frameworks, Programmiersprachen, Hosting/Cloud, Integrationen, Sicherheitsanforderungen.',
  facts:
    'Kernfakten aus den Dokumenten: Kunde, Projekt, Branche, Ziele, Umfang, Laufzeit, Links, Ansprechpartner.',
  contacts:
    'Ansprechpartner, Kontaktperson, Vergabestelle, Entscheider, E-Mail, Telefon, Ansprechpartnerstruktur.',
};

export function getPreQualSectionQueryTemplate(sectionId: string): string | null {
  return PREQUAL_SECTION_QUERIES[sectionId] ?? null;
}
