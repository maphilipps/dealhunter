# DEA-136: RFP Detail - Sidebar Right Navigation mit Unterseiten

## Ziel

Umstrukturierung der RFP Detail Seite von Card-basiert zu **Sidebar Right Navigation mit Unterseiten** (analog zur Lead-Struktur).

## Layout-Struktur (3 Sidebars)

```
┌─────┬───────────────────────────┬──────────┐
│     │  RFP Header              │          │
│ APP ├──────────────────────────┤   RFP   │
│ NAV │                          │   NAV    │
│     │                          │  (right) │
│  L  │  CONTENT AREA            │          │
│  E  │  (Unterseiten-Content)   │   1. Übersicht│
│  F  │                          │   2. Timing   │
│  T  │                          │   3. Deliverables│
│     │                          │   4. Referenzen│
│     │                          │   5. Legal    │
│     │                          │   6. Tech     │
│     │                          │   7. Facts    │
│     │                          │   8. Kontakte │
│     │                          │   9. Routing  │
└─────┴───────────────────────────┴──────────┘
```

**Wie bei Leads**:

- Links: `AppSidebar` (Hauptnavigation)
- Mitte: Content (children - Unterseiten)
- Rechts: `RfpSidebarRight` (RFP-spezifische Navigation)

---

## Route-Struktur

### Übersicht: `/rfps/[id]`

**Inhalte**:

- Quick Scan Ergebnisse
- BL Routing (falls status >= 'routed')
- Wichtigste Facts auf einen Blick
- Status & Actions

**Datei**: `/app/(dashboard)/rfps/[id]/page.tsx` (ANPASSEN)

---

### 1. Timing: `/rfps/[id]/timing`

**Datenquelle**: `extractedData.requiredDeliverables`, RAG, `quickScan`

**Inhalte**:

- Timeline Card
- Projekt-Phasen (falls im Dokument)
- Submission Deadline (Hauptfrist)
- Wichtige Meilensteine

**Datei**: `/app/(dashboard)/rfps/[id]/timing/page.tsx` (NEU)

---

### 2. Deliverables: `/rfps/[id]/deliverables`

**Datenquelle**: `extractedData.requiredDeliverables`, `extractedData.deliverables`

**Inhalte**:

- Einzureichende Unterlagen (Name, Deadline, Format, Mandatory)
- Lieferumfang (Projekt-Deliverables in Stichpunkten)

**Datei**: `/app/(dashboard)/rfps/[id]/deliverables/page.tsx` (NEU)

---

### 3. Referenzen: `/rfps/[id]/references`

**Datenquelle**: `extractedData.requiredReferences`, RAG

**Inhalte**:

- Geforderte Referenzen (Anzahl, Art, Zeitraum)
- Referenz-Kriterien
- Adesso Matching-Vorschläge (optional)

**Datei**: `/app/(dashboard)/rfps/[id]/references/page.tsx` (NEU)

---

### 4. Legal: `/rfps/[id]/legal`

**Datenquelle**: `extractedData.legalRequirements`, RAG

**Inhalte**:

- Rechtliche Anforderungen
- Compliance-Vorgaben
- Vertragsklauseln
- Haftungsausschlüsse

**Datei**: `/app/(dashboard)/rfps/[id]/legal/page.tsx` (NEU)

---

### 5. Tech Stack: `/rfps/[id]/tech`

**Datenquelle**: `quickScan.techStack`, `quickScan.performanceIndicators`

**Inhalte**:

- Gefundene Technologien (ALLE anzeigen, kein "+13 mehr")
- Performance Indicators
- Tech Stack Details von HTTPX
- Accessibility Audit

**Datei**: `/app/(dashboard)/rfps/[id]/tech/page.tsx` (NEU)

---

### 6. Facts & Content: `/rfps/[id]/facts`

**Datenquelle**: `quickScan.contentVolume`, `quickScan.screenshots`

**Inhalte**:

- Website Facts (URL, Content Volume)
- Screenshots (Thumbnails mit Carousel Modal)
- SEO/Meta Informationen

**Datei**: `/app/(dashboard)/rfps/[id]/facts/page.tsx` (NEU)

---

### 7. Kontakte: `/rfps/[id]/contacts`

**Datenquelle**: `quickScan.decisionMakers`, Web Search, RAG

**Inhalte**:

- Entscheider & Stakeholder (Enhanced Decision Makers Card)
- Web Search Ergebnisse (LinkedIn Profile, Xing, etc.)
- Organisationsstruktur (falls vorhanden)
- Ansprechpartner aus Dokument

**Features**:

- Web Search Integration für Kontakte
- LinkedIn Profile Suche
- Kontakt-Details (Name, Position, Email, Telefon)

**Datei**: `/app/(dashboard)/rfps/[id]/contacts/page.tsx` (NEU)

---

### 8. Routing & Bewertung: `/rfps/[id]/routing`

**Datenquelle**: `bid.status`, `quickScan`, `bitEvaluationResult`

**Inhalte**:

- BL Routing Card
- 10 Questions Card
- Quick Scan Summary
- BID/NO-BID Confidence

**Datei**: `/app/(dashboard)/rfps/[id]/routing/page.tsx` (NEU)

---

## RFP Sidebar Right Component

**Datei**: `/components/bids/rfp-sidebar-right.tsx` (NEU)

**Features**:

- Rechte Sidebar mit Navigation zu RFP-Unterseiten
- Active Link Highlighting (basierend auf aktueller Route)
- Icons für jeden Bereich
- Gruppen: Overview, Analysis, Details, Routing
- Responsive (collapsible auf Mobile)

**ShadCN Components**:

- `Sidebar` (side="right")
- `SidebarContent`
- `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`
- `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`

**Navigation Sections**:

| Gruppe   | Item         | Icon            | Route                     |
| -------- | ------------ | --------------- | ------------------------- |
| Overview | Übersicht    | LayoutDashboard | `/rfps/[id]`              |
| Details  | Timing       | Clock           | `/rfps/[id]/timing`       |
| Details  | Deliverables | FileText        | `/rfps/[id]/deliverables` |
| Details  | Referenzen   | Award           | `/rfps/[id]/references`   |
| Details  | Legal        | Scale           | `/rfps/[id]/legal`        |
| Analysis | Tech Stack   | Code            | `/rfps/[id]/tech`         |
| Analysis | Facts        | Info            | `/rfps/[id]/facts`        |
| Analysis | Kontakte     | Users           | `/rfps/[id]/contacts`     |
| Routing  | BL Routing   | ArrowRight      | `/rfps/[id]/routing`      |

---

## Implementierungs-Plan

### Phase 1: Layout Struktur

1. **Layout erstellen**: `/app/(dashboard)/rfps/[id]/layout.tsx`
   - Analog zu `/app/(dashboard)/leads/[id]/layout.tsx`
   - SidebarProvider mit AppSidebar links, RfpSidebarRight rechts
   - Header mit RFP Title

2. **RFP Sidebar Right erstellen**: `/components/bids/rfp-sidebar-right.tsx`
   - Props: `rfpId`, `title`, `status`
   - Navigation Sections wie oben definiert

### Phase 2: Unterseiten erstellen

**Verzeichnisstruktur**:

```
app/(dashboard)/rfps/[id]/
├── layout.tsx (NEU)
├── page.tsx (ANPASSEN)
├── timing/page.tsx (NEU)
├── deliverables/page.tsx (NEU)
├── references/page.tsx (NEU)
├── legal/page.tsx (NEU)
├── tech/page.tsx (NEU)
├── facts/page.tsx (NEU)
├── contacts/page.tsx (NEU)
└── routing/page.tsx (NEU)
```

### Phase 3: Übersicht bereinigen

**Zu entfernen aus `/app/(dashboard)/rfps/[id]/page.tsx`**:

- DeepAnalysisCard
- BaselineComparisonCard
- ProjectPlanningCard
- TeamBuilder
- NotificationCard
- Team Assignment Summary Card

**Zu behalten**:

- ExtractionPreview (für Status 'extracted')
- QuickScanResults (für Status >= 'scanned')
- BLRoutingCard (für Status >= 'routed')
- WebsiteUrlInput (falls benötigt)

### Phase 4: Screenshot Carousel

**In Facts Unterseite**:

- Thumbnails (max 200px width)
- Click → Dialog öffnen
- Dialog: Carousel mit allen Screenshots
- Navigation: CarouselNext, CarouselPrevious

**ShadCN Components**: `Dialog`, `Carousel`

---

## Kritische Dateien

### Neu zu erstellen

| Datei                                              | Beschreibung             |
| -------------------------------------------------- | ------------------------ |
| `/app/(dashboard)/rfps/[id]/layout.tsx`            | Layout mit Sidebar Right |
| `/components/bids/rfp-sidebar-right.tsx`           | RFP Navigation Sidebar   |
| `/app/(dashboard)/rfps/[id]/timing/page.tsx`       | Timing Unterseite        |
| `/app/(dashboard)/rfps/[id]/deliverables/page.tsx` | Deliverables Unterseite  |
| `/app/(dashboard)/rfps/[id]/references/page.tsx`   | References Unterseite    |
| `/app/(dashboard)/rfps/[id]/legal/page.tsx`        | Legal Unterseite         |
| `/app/(dashboard)/rfps/[id]/tech/page.tsx`         | Tech Stack Unterseite    |
| `/app/(dashboard)/rfps/[id]/facts/page.tsx`        | Facts Unterseite         |
| `/app/(dashboard)/rfps/[id]/contacts/page.tsx`     | Contacts Unterseite      |
| `/app/(dashboard)/rfps/[id]/routing/page.tsx`      | Routing Unterseite       |

### Zu modifizieren

| Datei                                 | Änderung                  |
| ------------------------------------- | ------------------------- |
| `/app/(dashboard)/rfps/[id]/page.tsx` | Bereinigen, nur Übersicht |

### Optional zu entfernen

- `/components/bids/deep-analysis-card.tsx`
- `/components/bids/baseline-comparison-card.tsx`
- `/components/bids/project-planning-card.tsx`
- `/components/bids/team-builder.tsx`
- `/components/bids/notification-card.tsx`

---

## Verification Checklist

### UI & Navigation

- [ ] 3-Sidebar Layout (AppSidebar, Content, RfpSidebarRight)
- [ ] RFP Sidebar Right mit 9 Unterseiten-Links
- [ ] Active Link Highlighting
- [ ] Responsive Design (Desktop/Tablet/Mobile)
- [ ] Alle Unterseiten erreichbar (keine 404s)

### Unterseiten Content

- [ ] Übersicht: Quick Scan, BL Routing, keine unerwünschten Cards
- [ ] Timing: Timeline & Deadlines
- [ ] Deliverables: Unterlagen & Lieferumfang
- [ ] References: Referenz-Anforderungen
- [ ] Legal: Rechtliche Vorgaben
- [ ] Tech Stack: ALLE Technologien, Performance, HTTPX
- [ ] Facts: Screenshots mit Carousel Modal
- [ ] Kontakte: Entscheider mit Web Search
- [ ] Routing: BL Routing & 10 Questions

### Code Quality

- [ ] Keine Console Errors
- [ ] Keine Build Errors
- [ ] Performance OK (< 3s Page Load)

---

## Test URLs

```bash
# Übersicht
http://localhost:3000/rfps/xztqrqoudardauod4yfr6a3e

# Unterseiten
http://localhost:3000/rfps/xztqrqoudardauod4yfr6a3e/timing
http://localhost:3000/rfps/xztqrqoudardauod4yfr6a3e/deliverables
http://localhost:3000/rfps/xztqrqoudardauod4yfr6a3e/references
http://localhost:3000/rfps/xztqrqoudardauod4yfr6a3e/legal
http://localhost:3000/rfps/xztqrqoudardauod4yfr6a3e/tech
http://localhost:3000/rfps/xztqrqoudardauod4yfr6a3e/facts
http://localhost:3000/rfps/xztqrqoudardauod4yfr6a3e/contacts
http://localhost:3000/rfps/xztqrqoudardauod4yfr6a3e/routing
```

---

## Linear Issue

**Issue**: DEA-136
**URL**: https://linear.app/adessocms/issue/DEA-136
**Estimate**: 8 Story Points
**Labels**: `enhancement`, `ui-restructure`, `rfp-detail`
