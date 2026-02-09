export const PREQUAL_SECTION_QUERIES: Record<string, string> = {
  budget: `
## ANALYSEZIEL: Budget & Finanzrahmen

Du analysierst die Ausschreibungsdokumente auf alle finanziellen Aspekte.

### PRIMÄRE FRAGEN:
1. **Explizites Budget**: Wird ein konkreter Kostenrahmen, Budgetdeckel oder Schätzwert genannt?
   - Suche nach: "Budget", "Kostenrahmen", "Auftragswert", "Schätzung", "EUR", "€"
   - Achte auf Ober-/Untergrenzen, Spannen, Einzelpreise vs. Gesamtpreise

2. **Vergütungsmodell**: Wie wird bezahlt?
   - Festpreis / Pauschal / Time & Material / Rahmenvertrag mit Abruf
   - Zahlungsmeilensteine, Abschlagszahlungen, Schlussrechnung

3. **Vertragslaufzeit & Volumen**:
   - Grundlaufzeit vs. Verlängerungsoptionen
   - Geschätztes Abrufvolumen bei Rahmenverträgen
   - Mindest-/Maximalmengen

### INTERPRETATION FÜR DAS ANGEBOTSTEAM:
- Ist das Budget realistisch für den Scope?
- Gibt es Preisdruck-Signale (z.B. "wirtschaftlichstes Angebot")?
- Welche Kostenrisiken sind erkennbar?

### WENN KEINE ANGABEN GEFUNDEN:
Erkläre, dass kein explizites Budget genannt wurde und was das für die Angebotskalkulation bedeutet (z.B. "Marktübliche Preise kalkulieren, ggf. Nachfrage beim Auftraggeber").
`,

  timing: `
## ANALYSEZIEL: Zeitplan & Verfahrensablauf

Du analysierst den kompletten Ausschreibungs- und Projektzeitplan.

### PRIMÄRE FRAGEN:
1. **Verfahrensart**:
   - Offenes Verfahren (direkt Angebot) vs. Verhandlungsverfahren mit Teilnahmewettbewerb?
   - Gibt es eine Shortlist / engere Wahl?
   - Sind Verhandlungsrunden geplant?

2. **Kritische Fristen**:
   - Abgabefrist Teilnahmeantrag (falls zweistufig)
   - Abgabefrist Angebot
   - Bindefrist / Zuschlagsfrist
   - Geplanter Projektstart / Go-Live

3. **Verfahrensmeilensteine**:
   - Bieterfragen / Rückfragen bis wann?
   - Präsentationstermine / Pitches?
   - Verhandlungsrunden mit Terminen?

### INTERPRETATION FÜR DAS ANGEBOTSTEAM:
- Wie viel Zeit bleibt für die Angebotserstellung? (Realistisch?)
- Welche internen Deadlines ergeben sich daraus?
- Gibt es Urlaubszeiten / Feiertage zu beachten?
- Ist der Projektstart realistisch nach Zuschlag?

### TIMELINE-VISUALISIERUNG:
Erstelle wenn möglich eine chronologische Auflistung aller Termine.
`,

  contracts: `
## ANALYSEZIEL: Vertragstyp & Rechtliche Rahmenbedingungen

Du analysierst alle vertragsrechtlichen Aspekte der Ausschreibung.

### PRIMÄRE FRAGEN:
1. **Vertragstyp**:
   - EVB-IT (welcher? System, Erstellung, Service, Cloud, etc.)
   - Werkvertrag vs. Dienstvertrag vs. Mischform
   - Rahmenvertrag vs. Einzelauftrag
   - Welche AGB gelten? (VOL/A, UVgO, eigene AGB des AG)

2. **Kritische Vertragsklauseln**:
   - **Haftung**: Haftungsobergrenzen? Unbeschränkte Haftung?
   - **Gewährleistung**: Dauer? Umfang? Verjährungsfristen?
   - **SLAs**: Verfügbarkeit? Reaktionszeiten? Pönalen?
   - **Kündigungsrechte**: Ordentlich/außerordentlich? Fristen?
   - **IP/Nutzungsrechte**: Wem gehört was? Exklusiv?

3. **Risiko-Signale**:
   - Vertragsstrafen / Pönalen bei Verzug
   - Unbeschränkte Nachbesserungspflichten
   - Einseitige Änderungsrechte des AG

### INTERPRETATION FÜR DAS ANGEBOTSTEAM:
- Welche Vertragsrisiken müssen eingepreist werden?
- Gibt es Verhandlungsspielraum bei kritischen Klauseln?
- Empfehlung: Welche Klauseln sollten juristisch geprüft werden?
`,

  deliverables: `
## ANALYSEZIEL: Deliverables (Einreichungsunterlagen) + Aufwand für Bid-Team

Du analysierst die Ausschreibungsdokumente auf alle **abzugebenden Unterlagen/Deliverables** (Teilnahmeantrag/Angebot)
und was das Angebotsteam konkret erstellen muss.

WICHTIG (Qualitäts-Gate):
- Ergebnisse müssen **decision-grade** sein: Inventar, Anforderungen, Risiken, offene Fragen, konkrete Next Steps.
- Jede Aussage muss **belegt** sein (Quelle) oder als **Annahme** markiert werden.

### 1) INVENTAR (zwingend, als Tabelle denken)
Erstelle ein vollständiges Inventar der abzugebenden Deliverables, inkl.:
- Name des Deliverables / Formblatt / Konzept
- Pflicht vs. optional
- Format (PDF/Portal-Formular/Signatur) und Abgabeweg (Portal/E-Mail/physisch)
- Seitenlimit oder Umfangsbeschränkungen (wenn genannt)
- Deadlines (Angebot/Teilnahmeantrag/Präsentationstermin; getrennt wenn vorhanden)

### 2) AUFWAND & DAUER (Bid-Unterlagen, NICHT Projektumsetzung)
Leite für jedes Deliverable eine grobe, nachvollziehbare Aufwandsschätzung ab (Stunden / PT / Kalenderdauer)
und liste eine kurze WBS (Tasks + Rollen).
Wenn Details fehlen: nenne Annahmen explizit (z.B. Review-Overhead).

### 3) RISIKEN & OFFENE FRAGEN
- Risiken/Stolpersteine (z.B. Signaturpflicht, harte Formvorgaben, unklare Anlagen)
- Offene Fragen, die als Bieterfrage geklärt werden sollten (mit Begründung)

### 4) NEXT STEPS
- Konkrete ToDos für das Angebotsteam (Checkliste, Verantwortlichkeiten, Reihenfolge).
`,

  references: `
## ANALYSEZIEL: Referenzen (Anforderungen) + optimale Referenz-Struktur + interne Matches

Du analysierst alle Anforderungen an Referenzen/Eignungsnachweise und machst sie diskussionsfaehig.

WICHTIG (Qualitäts-Gate):
- Ergebnisse müssen **decision-grade** sein.
- Jede Aussage muss **belegt** sein (Quelle) oder als **Annahme** markiert werden.

### 1) ANFORDERUNGEN (Must/Should/K.O.)
Extrahiere alle Referenzanforderungen und klassifiziere:
- KO (Ausschluss), MUST (zwingend), SHOULD (bewertungsrelevant), CAN (optional)

### 2) OPTIMALE REFERENZ (Template)
Beschreibe, wie eine optimale Referenz aussehen sollte (als Template/Checkliste)
und markiere das als Best Practice/Annahme (nicht RFP-spezifisch).

### 3) INTERNE REFERENZEN (Top 3-5)
Schlage konkrete interne Referenzen vor (IDs), in Reihenfolge:
1) RFP-Anforderung
2) optimale Referenz (Template)
3) interne Matches: "ggfs. passt das:" inkl. Gaps und Positionierung

### 4) OFFENE FRAGEN
Wenn Anforderungen unklar sind: klare Rückfragen formulieren (inkl. warum es relevant ist).
`,

  'award-criteria': `
## ANALYSEZIEL: Zuschlagskriterien & Bewertungsmatrix

Du analysierst alle Kriterien, nach denen das Angebot bewertet wird.

### PRIMÄRE FRAGEN:
1. **Hauptkriterien mit Gewichtung**:
   - Preis: Wie viel Prozent? Wie wird bewertet (absolut, relativ, Formel)?
   - Qualität / Leistung: Welche Unterkriterien?
   - Konzepte: Welche Konzepte werden bewertet?

2. **Detaillierte Bewertungskriterien**:
   - Technisches Konzept (Architektur, Lösung)
   - Vorgehenskonzept (Methodik, Projektmanagement)
   - Personalkonzept (Team, Qualifikationen)
   - Betriebskonzept (Support, SLAs)
   - Weitere Konzepte?

3. **Bewertungsmethodik**:
   - Punkteskala (0-10? 0-5? 0-100?)
   - Wie werden Punkte vergeben? (Kriterien für volle Punktzahl?)
   - Gibt es K.O.-Kriterien (Mindestpunktzahl)?

4. **Unterschiede Teilnahmeantrag vs. Angebot**:
   - Welche Kriterien gelten für die Shortlist?
   - Welche Kriterien nur für die finale Bewertung?

### INTERPRETATION FÜR DAS ANGEBOTSTEAM:
- Wo können wir am meisten Punkte holen?
- Welche Konzepte brauchen besondere Aufmerksamkeit?
- Wie aggressiv sollten wir beim Preis sein?
- Gibt es Gewichtungs-Anomalien (z.B. Preis nur 30% = Qualität entscheidet)?
`,

  risks: `
## ANALYSEZIEL: Risikoanalyse

Du analysierst die Ausschreibungsdokumente auf alle erkennbaren Projektrisiken.

### RISIKOKATEGORIEN:
Bewerte jede Kategorie mit Impact (hoch/mittel/niedrig) und Eintrittswahrscheinlichkeit (hoch/mittel/niedrig).

1. **Terminrisiken (Schedule)**:
   - Unrealistische Fristen, enger Zeitplan, parallele Meilensteine
   - Abhängigkeit von Zulieferungen/Entscheidungen des AG
   - Saisonale Engpässe (Urlaubszeit, Jahresende)

2. **Budgetrisiken (Budget)**:
   - Kein explizites Budget, Festpreis bei unscharfem Scope
   - Nachträge/Change Requests nicht geregelt
   - Preisdruck durch Bewertungskriterien

3. **Technische Risiken (Technical)**:
   - Komplexe Migration, Legacy-Systeme, Schnittstellenvielfalt
   - Unbekannte/proprietäre Technologien
   - Hohe nicht-funktionale Anforderungen (Performance, Sicherheit, Barrierefreiheit)

4. **Rechtliche Risiken (Legal)**:
   - Vertragsstrafen/Pönalen bei Verzug
   - Unbeschränkte Haftung, fehlende Haftungsobergrenzen
   - IP/Nutzungsrechte-Problematik, DSGVO-Anforderungen

5. **Personalrisiken (Staffing)**:
   - Spezielle Qualifikationsanforderungen, Zertifizierungen
   - Vor-Ort-Pflicht, Sicherheitsüberprüfungen
   - Hoher Personalbedarf parallel zu anderen Projekten

6. **Scope-Risiken (Scope)**:
   - Unscharfe Leistungsbeschreibung, Interpretationsspielraum
   - Scope Creep durch offene Formulierungen
   - Lose-Struktur mit Abhängigkeiten

7. **Abhängigkeitsrisiken (Dependencies)**:
   - Zulieferungen durch AG oder Dritte
   - Parallele Vergaben, die aufeinander aufbauen
   - Externe Genehmigungen/Freigaben

### VISUALISIERUNG:
1. **Zusammenfassung** (Paragraph): Gesamtrisikobewertung in 4-8 Sätzen
2. **Risikomatrix** (KeyValueTable): Kategorie → Impact × Wahrscheinlichkeit = Risikoscore (1-9)
3. **SubSections** pro Risikokategorie: Details, Belege aus Dokumenten, Mitigationsansätze
4. **Mitigationsmassnahmen** (SubSection): Konkrete Empfehlungen für das Angebotsteam

### INTERPRETATION FÜR DAS ANGEBOTSTEAM:
- Welche Risiken müssen eingepreist werden?
- Welche Risiken erfordern Rückfragen vor Angebotsabgabe?
- Welche Risiken sollten als Angebotsannahmen formuliert werden?
- Gibt es Show-Stopper, die gegen ein Angebot sprechen?
`,

  'offer-structure': `
## ANALYSEZIEL: Angebotsstruktur & erforderliche Unterlagen

Du analysierst, was das Angebotsteam konkret erarbeiten muss.

### PRIMÄRE FRAGEN:
1. **Bei zweistufigem Verfahren - TEILNAHMEANTRAG**:
   - Welche Formulare/Eigenerklärungen?
   - Welche Nachweise (Handelsregister, Unbedenklichkeit, etc.)?
   - Referenzdarstellung (Umfang, Format)
   - Eignungsnachweise Personal
   - Gibt es Seitenbegrenzungen?

2. **ANGEBOT - Pflichtbestandteile**:
   - Preisblatt / Kalkulation (welches Format?)
   - Technisches Konzept (Umfang? Gliederung vorgegeben?)
   - Vorgehenskonzept / Projektplan
   - Personalkonzept mit CVs
   - Weitere Konzepte?

3. **Formale Anforderungen**:
   - Einreichungsform (elektronisch via Vergabeplattform?)
   - Seitenbegrenzungen pro Dokument
   - Formatvorgaben (PDF, Word, Schriftgröße?)
   - Sprache (Deutsch? Englisch erlaubt?)

4. **Präsentation / Pitch**:
   - Ist eine Präsentation Teil der Bewertung?
   - Dauer, Teilnehmer, Inhalte?
   - Wann im Verfahren?

### INTERPRETATION FÜR DAS ANGEBOTSTEAM:
- Welche Dokumente haben Priorität?
- Geschätzter Aufwand pro Dokument?
- Wer aus dem Team muss was liefern?
- Kritischer Pfad für die Angebotserstellung?
`,
};

export function getPreQualSectionQueryTemplate(sectionId: string): string | null {
  return PREQUAL_SECTION_QUERIES[sectionId] ?? null;
}
