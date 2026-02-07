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
## ANALYSEZIEL: Leistungsumfang & Deliverables

Du analysierst den kompletten geforderten Leistungsumfang.

### PRIMÄRE FRAGEN:
1. **Hauptleistungen** (Was muss geliefert werden?):
   - Software/System-Komponenten
   - Dienstleistungen (Beratung, Konzeption, Entwicklung, Migration)
   - Dokumentation, Schulungen, Support

2. **Strukturierung**:
   - Gibt es Lose? Wenn ja, welche?
   - Pflichtleistungen vs. optionale Leistungen (Bedarfspositionen)
   - Phasen / Arbeitspakete / Module

3. **Technische Anforderungen**:
   - Funktionale Anforderungen (Features, Use Cases)
   - Nicht-funktionale Anforderungen (Performance, Sicherheit, Barrierefreiheit)
   - Schnittstellen zu Drittsystemen
   - Technologie-Vorgaben oder -Einschränkungen

4. **Mengengerüste**:
   - Anzahl Nutzer, Seiten, Datensätze
   - Transaktionsvolumen, Speicherbedarf
   - Standorte, Sprachen

### INTERPRETATION FÜR DAS ANGEBOTSTEAM:
- Welche Leistungen sind der Kern, welche sind Beiwerk?
- Wo sind Aufwandstreiber versteckt?
- Welche Leistungen könnten wir besonders gut / innovativ anbieten?
- Gibt es Unklarheiten, die Rückfragen erfordern?
`,

  references: `
## ANALYSEZIEL: Referenzanforderungen & Eignungskriterien

Du analysierst alle Anforderungen an Referenzen und Nachweise.

### PRIMÄRE FRAGEN:
1. **Anzahl & Art der Referenzen**:
   - Wie viele Referenzen werden gefordert? (Minimum/Maximum)
   - Unternehmensreferenzen vs. Mitarbeiterreferenzen
   - Müssen es abgeschlossene Projekte sein?

2. **Eingrenzungskriterien** (KRITISCH für Machbarkeit!):
   - **Branche**: Öffentlicher Sektor? Spezifische Branche?
   - **Projektgröße**: Mindest-Budget? Mindest-Nutzerzahl?
   - **Technologie**: Bestimmte Systeme/Plattformen gefordert?
   - **Zeitraum**: Projekte der letzten X Jahre?
   - **Vergleichbarkeit**: "vergleichbar" - wie eng ausgelegt?

3. **Harte vs. weiche Kriterien**:
   - MUSS-Kriterien (Ausschluss bei Nichterfüllung)
   - SOLL-Kriterien (Punktabzug, aber kein Ausschluss)
   - KANN-Kriterien (Bonus-Punkte)

4. **Nachweisform**:
   - Formblätter / Eigenerklärungen
   - Bestätigungsschreiben vom Auftraggeber nötig?
   - Welche Details müssen genannt werden?

### INTERPRETATION FÜR DAS ANGEBOTSTEAM:
- Haben wir passende Referenzen? Welche?
- Sind die Kriterien so eng, dass sie den Wettbewerb einschränken?
- Gibt es Interpretationsspielraum bei "Vergleichbarkeit"?
- Müssen wir mit Bietergemeinschaft / Nachunternehmer arbeiten?
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
