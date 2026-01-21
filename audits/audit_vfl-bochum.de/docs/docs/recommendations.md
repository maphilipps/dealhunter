# Empfehlungen

## Strategische Empfehlungen

### 1. Migration zu Drupal CMS 2.0

**Empfehlung:** Wechsel von BloomReach Experience Manager zu Drupal CMS 2.0

| Aspekt | BloomReach (aktuell) | Drupal CMS 2.0 |
|--------|---------------------|----------------|
| Lizenzkosten | Hoch (Enterprise) | Open Source |
| Flexibilität | Eingeschränkt | Sehr hoch |
| AI-Integration | Begrenzt | Native (AI Module) |
| Editor Experience | Gut | Sehr gut (Canvas) |
| Community | Klein | Sehr groß |

### 2. Content-Architektur vereinfachen

**Aktuelle Situation:** 25 identifizierte Content-Typen mit komplexer Verschachtelung

**Empfehlung:**
- Reduzierung auf 9 Content-Typen in Drupal
- Flexibilität durch 18 Paragraph-Typen
- Einheitliches Component-System

### 3. Performance-Optimierung

**Aktuelle Werte:**
- TTFB: 172ms (gut)
- Initiales HTML: ~1.17 MB (zu groß)

**Maßnahmen:**
- Lazy Loading implementieren
- Image-Optimierung (WebP/AVIF)
- JSON-Payload reduzieren
- CDN-Caching optimieren

### 4. Accessibility-Verbesserungen

**Aktueller Stand:** Partial WCAG 2.1 Level A

**Ziel:** WCAG 2.1 Level AA

**Prioritäten:**
1. Kontrast-Verbesserungen
2. ARIA-Labels vervollständigen
3. Keyboard-Navigation
4. Skip-Links hinzufügen

## Technische Empfehlungen

### Drupal-Module

| Modul | Zweck | Priorität |
|-------|-------|-----------|
| Paragraphs | Flexible Layouts | Hoch |
| Search API | Suche | Hoch |
| Webform | Formulare | Hoch |
| Gin Admin | Admin-Theme | Hoch |
| AI Module | AI-Features | Mittel |
| Metatag | SEO | Mittel |

### Integrationen beibehalten

1. **Sportdaten-API** - Custom Module für Spielplan, Tabelle, Liveticker
2. **Salesforce** - Web-to-Case Integration für Kontaktformular
3. **1848TV** - Video-Embedding und API-Integration
4. **Google Tag Manager** - Analytics

### Migration-Strategie

**Empfohlener Ansatz:** Phasenweise Migration

1. **Phase 1:** Infrastruktur (4 Wochen)
2. **Phase 2:** Content-Architektur (8 Wochen)
3. **Phase 3:** Theme & Components (12 Wochen)
4. **Phase 4:** Migration (8 Wochen)
5. **Phase 5:** Testing & Launch (6 Wochen)

## Budget-Empfehlung

| Phase | Aufwand | Budget-Anteil |
|-------|---------|---------------|
| Discovery & Setup | 100h | 5% |
| Content Architecture | 200h | 9% |
| Development | 1000h | 46% |
| Migration | 230h | 11% |
| Testing & QA | 300h | 14% |
| Launch & Handover | 340h | 15% |
| **Gesamt** | **~2168h** | **100%** |

## Nächste Schritte

1. **Kick-off Meeting** - Scope und Timeline abstimmen
2. **Technisches Discovery** - API-Zugang zu BloomReach klären
3. **Proof of Concept** - Sportdaten-Integration validieren
4. **Content-Audit** - Detaillierte Content-Inventur
5. **Design Review** - Design-System adaptieren oder neu erstellen
