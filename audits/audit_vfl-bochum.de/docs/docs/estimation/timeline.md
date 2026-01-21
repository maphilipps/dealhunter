# Project Timeline

## Gesamtdauer

| Szenario | Team | Dauer |
|----------|------|-------|
| Aggressiv | 3 Entwickler Vollzeit | 4-5 Monate |
| **Realistisch** | **2 Entwickler + 1 Teilzeit** | **6-7 Monate** |
| Konservativ | 1-2 Entwickler | 10-12 Monate |

## Phasen-Übersicht (Tabellarisch)

| Phase | Wochen | Start | Ende |
|-------|--------|-------|------|
| **Discovery** | 3 | Woche 1 | Woche 3 |
| **Infrastructure** | 2 | Woche 4 | Woche 5 |
| **Content Architecture** | 4 | Woche 6 | Woche 9 |
| **Theme Development** | 6 | Woche 8 | Woche 13 |
| **Custom Modules** | 5 | Woche 6 | Woche 10 |
| **Integration** | 3 | Woche 11 | Woche 13 |
| **Migration** | 4 | Woche 10 | Woche 13 |
| **QA & Testing** | 4 | Woche 14 | Woche 17 |
| **UAT** | 2 | Woche 18 | Woche 19 |
| **Go-Live** | 1 | Woche 20 | Woche 20 |
| **Hypercare** | 4 | Woche 21 | Woche 24 |

## Projekt-Timeline (Visuell)

```
Woche:  1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24
        |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
Discovery   ████████
Infra               ████
Content                 ████████████████
Theme                           ████████████████████████
Modules                 ████████████████████
Integration                                     ████████████
Migration                               ████████████████
QA                                                          ████████████████
UAT                                                                         ████████
Go-Live                                                                             ██
Hypercare                                                                               ████████████████
```

## Detaillierte Phasen

### Phase 1: Discovery (3 Wochen, 12 PT)

| Task | Tage | Team |
|------|------|------|
| Kick-off Meeting | 0.5 PT | Alle |
| Anforderungs-Workshop | 2 PT | Lead + PM |
| Technical Discovery | 4 PT | Entwickler |
| API-Analyse (BloomReach) | 4 PT | Senior Dev |
| Feinspezifikation | 1.5 PT | Lead |

**Deliverables:**
- Anforderungsdokumentation
- Technische Spezifikation
- API-Dokumentation
- Projektplan final

### Phase 2: Infrastructure (2 Wochen, 6 PT)

| Task | Tage |
|------|------|
| DDEV Setup | 1 PT |
| Drupal CMS 2.0 Installation | 1 PT |
| CI/CD Pipeline | 2 PT |
| Staging Environment | 1 PT |
| Git Repository | 0.5 PT |
| **Total** | **5.5 PT** |

::: tip Drupal CMS Vorteil
Mit Drupal CMS 2.0 reduziert sich die Infrastruktur-Phase um ~1 PT durch vorkonfigurierte Recipes.
:::

### Phase 3: Content Architecture (4 Wochen, 25 PT)

| Task | Wochen | Tage |
|------|--------|------|
| Content Types | 1 | 6 PT |
| Paragraph Types | 1.5 | 9 PT |
| Taxonomies | 0.25 | 1 PT |
| Media Types | 0.25 | 1 PT |
| Views | 1 | 8 PT |
| **Total** | **4** | **25 PT** |

### Phase 4: Theme Development (6 Wochen, 35 PT)

| Task | Wochen | Tage |
|------|--------|------|
| Theme Setup (Mercury) | 0.5 | 2.5 PT |
| Design System | 1 | 5 PT |
| Components (SDC) | 3 | 15 PT |
| Templates | 1 | 5 PT |
| Responsive | 0.5 | 2.5 PT |
| **Total** | **6** | **35 PT** |

### Phase 5: Custom Modules (5 Wochen, 17 PT)

| Modul | Wochen | Tage |
|-------|--------|------|
| vfl_sportdata | 2 | 9 PT |
| vfl_video | 0.75 | 3.5 PT |
| vfl_salesforce | 0.75 | 3.5 PT |
| vfl_partner | 0.25 | 1.5 PT |
| **Total** | **3.75** | **17 PT** |

### Phase 6: Migration (4 Wochen, 29 PT)

| Task | Wochen | Tage |
|------|--------|------|
| Migration Scripts | 2 | 10 PT |
| Media Migration | 0.5 | 4 PT |
| Test Migration | 1 | 8 PT |
| Final Migration | 0.5 | 7 PT |
| **Total** | **4** | **29 PT** |

### Phase 7: QA & Launch (7 Wochen, 30 PT)

| Task | Wochen | Tage |
|------|--------|------|
| Functional Testing | 1.5 | 8 PT |
| Performance Testing | 0.5 | 4 PT |
| Accessibility Testing | 0.5 | 4 PT |
| UAT | 1.5 | 5 PT |
| Bug Fixing | 1.5 | 8 PT |
| Go-Live Prep | 0.5 | 2 PT |
| **Total** | **6** | **30 PT** |

### Phase 8: Post-Launch (4 Wochen, 10 PT)

| Task | Wochen | Tage |
|------|--------|------|
| Hypercare | 3 | 5 PT |
| Training | 0.5 | 2 PT |
| Dokumentation | 0.5 | 3 PT |
| **Total** | **4** | **10 PT** |

## Meilensteine

| Meilenstein | Woche | Kriterium |
|-------------|-------|-----------|
| M1: Kick-off | 1 | Projekt gestartet |
| M2: Spec Complete | 3 | Spezifikation abgenommen |
| M3: Infrastructure | 5 | Umgebungen ready |
| M4: Content Model | 9 | Alle CTs/Paragraphs |
| M5: Theme Alpha | 13 | Basis-Theme fertig |
| M6: Feature Complete | 13 | Alle Features implementiert |
| M7: Migration Test | 13 | Test-Migration erfolgreich |
| M8: QA Complete | 17 | Alle Tests bestanden |
| M9: UAT Start | 18 | Bereit für Abnahme |
| M10: Go-Live | 20 | Launch! |
| M11: Handover | 24 | Projekt abgeschlossen |

## Ressourcen-Plan

### Empfohlenes Team

| Rolle | FTE | Phasen |
|-------|-----|--------|
| Tech Lead / Architect | 0.5 | Alle |
| Senior Backend Dev | 1.0 | Phase 2-7 |
| Frontend Dev | 1.0 | Phase 4-7 |
| DevOps | 0.25 | Phase 2, 7, 8 |
| QA Engineer | 0.5 | Phase 6-7 |
| Project Manager | 0.25 | Alle |

### Kritischer Pfad

1. API-Dokumentation von BloomReach
2. Sportdaten-API Zugang
3. Design-Freigabe
4. Content-Freeze für Migration
5. UAT-Ressourcen vom Kunden

## Zusammenfassung

| Metrik | Wert |
|--------|------|
| **Gesamtaufwand** | 256 PT (mit Drupal CMS) |
| **Projektdauer** | 24 Wochen (6 Monate) |
| **Team-Größe** | 2-3 Entwickler |
| **Go-Live Ziel** | Woche 20 |
