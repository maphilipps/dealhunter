# Taxonomies

## Übersicht

4 Taxonomie-Vokabulare wurden identifiziert:

| # | Vocabulary | Komplexität | Stunden | Terms (ca.) |
|---|------------|-------------|---------|-------------|
| 1 | Partner Category | Simple | 1.5h | 7 |
| 2 | Tags | Simple | 1.5h | 50+ |
| 3 | Team Category | Simple | 1.5h | 5 |
| 4 | Content Category | Simple | 1.5h | 10 |
| | **Gesamt** | | **6h** | |

## Detaillierte Beschreibungen

### 1. Partner Category

**Zweck:** Kategorisierung der Partner/Sponsoren

**Hierarchie:** Flat (keine Verschachtelung)

**Terms:**

| Term | Beschreibung | Weight |
|------|--------------|--------|
| Lead Partner | Hauptsponsoren | 1 |
| Premium Partner | Premium-Sponsoren | 2 |
| Top Partner | Top-Sponsoren | 3 |
| Gold Partner | Gold-Level | 4 |
| Silber Partner | Silber-Level | 5 |
| Bronze Partner | Bronze-Level | 6 |
| Network Partner | Netzwerk-Partner | 7 |

**Verwendung:**
- Partner Content Type (Pflichtfeld)
- Partner Grid Paragraph (Filter)
- Partner Views (Gruppierung)

---

### 2. Tags

**Zweck:** Freie Verschlagwortung für Content

**Hierarchie:** Flat (keine Verschachtelung)

**Beispiel-Terms:**

- Bundesliga
- Training
- Pressekonferenz
- Interview
- Spielbericht
- Transfer
- Verletzung
- Nachwuchs
- DFB-Pokal
- (weitere nach Bedarf)

**Verwendung:**
- News/Article Content Type (Multiple)
- Video Content Type (Multiple)
- Tag Cloud Block
- Verwandte Inhalte

---

### 3. Team Category

**Zweck:** Gruppierung von Teams/Mannschaften

**Hierarchie:** Hierarchisch (2 Ebenen)

**Terms:**

```
├── Profis
│   ├── Erste Mannschaft
│   └── Trainer-Team
├── Frauen
│   ├── Erste Mannschaft
│   └── Trainer-Team
└── Talentwerk
    ├── U23
    ├── U19
    ├── U17
    └── U15
```

**Verwendung:**
- Person Content Type
- Team Content Type
- Team Listings (Views Filter)

---

### 4. Content Category

**Zweck:** Kategorisierung von News und Content

**Hierarchie:** Flat (keine Verschachtelung)

**Terms:**

| Term | Beschreibung |
|------|--------------|
| News | Allgemeine News |
| Spielbericht | Match Reports |
| Interview | Interviews |
| Pressekonferenz | Press Conferences |
| Transfer | Transfer-News |
| Verein | Vereins-News |
| Ticketing | Ticket-Infos |
| Shop | Merchandise |
| Community | Fan-Community |
| Partner | Partner-News |

**Verwendung:**
- News/Article Content Type
- News Listings (Views Filter)
- News Slider (Filter)

## Taxonomie-Felder

### Standard-Felder pro Vocabulary

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Name | Text | Term-Name |
| Description | Text, Long | Beschreibung |
| Weight | Integer | Sortierung |
| Parent | Entity Reference | Für hierarchische Vokabulare |

### Zusätzliche Felder

#### Partner Category

| Feld | Typ |
|------|-----|
| Icon | Media Reference |
| Color | Color |

#### Team Category

| Feld | Typ |
|------|-----|
| Badge | Media Reference |
| Short Name | Text |

## Views mit Taxonomy-Filtern

| View | Taxonomy | Filter-Typ |
|------|----------|------------|
| News Listing | Content Category | Exposed |
| News Listing | Tags | Contextual |
| Partner Grid | Partner Category | Pre-filtered |
| Team Listing | Team Category | Exposed |
| Video Listing | Content Category | Exposed |

## Migration

### Mapping

| Aktuelle Kategorisierung | Drupal Vocabulary |
|--------------------------|-------------------|
| Partner-Typen | Partner Category |
| News-Tags | Tags |
| Team-Zuordnung | Team Category |
| Content-Kategorien | Content Category |

### Import-Reihenfolge

1. **Partner Category** - Statische Terms, manuell anlegen
2. **Team Category** - Statische Terms, manuell anlegen
3. **Content Category** - Statische Terms, manuell anlegen
4. **Tags** - Dynamisch während Content-Migration erstellen
