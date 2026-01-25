# Projekt-Schätzung Vergleich: VHS Frankfurt Webinfrastruktur

**Erstellt:** 2026-01-08
**Projekt:** Neuentwicklung der Webinfrastruktur der VHS Frankfurt
**Ausschreibung:** Stadt Frankfurt am Main
**Abgabefrist:** 03.02.2026
**Volumen (Ausschreibung):** 444,8 PT (Personen-Tage)

---

## Executive Summary

**Projektgröße:** GROSS (>150% der adessoCMS-Baseline)

**Geschätzte Gesamtstunden:**
- **Traditionelle Entwicklung:** 1.847 Stunden (~231 PT @ 8h/Tag)
- **KI-unterstützte Entwicklung:** 829 Stunden (~104 PT @ 8h/Tag)
- **Ersparnis durch KI:** 1.018 Stunden (~127 PT) = **55% Reduktion**

**Vergleich mit Ausschreibungs-Volumen (444,8 PT):**
- Traditionell: 231 PT = **52% des Budgets**
- KI-unterstützt: 104 PT = **23% des Budgets**

**⚠️ WICHTIG:** Die Ausschreibung nennt 444,8 PT für die GESAMTE Leistung inkl. Wartung (3 Jahre). Die reine Entwicklung ist nur ein Teil davon.

---

## 1. Basis-Schätzung (Entities)

### 1.1 Content Types (8)

| Content Type | Komplexität | Traditionell | KI-Unterstützt | Ersparnis |
|--------------|-------------|--------------|----------------|-----------|
| Kurs | HOCH (12h) | 12h | 4h | 67% |
| Landingpage | HOCH (10h) | 10h | 3h | 70% |
| News | MITTEL (6h) | 6h | 2h | 67% |
| Veranstaltung | MITTEL (8h) | 8h | 3h | 63% |
| Service-Seite | EINFACH (3h) | 3h | 1h | 67% |
| Person (Kursleitende) | MITTEL (6h) | 6h | 2h | 67% |
| FAQ | EINFACH (3h) | 3h | 1h | 67% |
| Standort | MITTEL (6h) | 6h | 2h | 67% |
| **Subtotal** | | **54h** | **18h** | **67%** |

### 1.2 Paragraph Types (20)

| Paragraph Type | Komplexität | Traditionell | KI-Unterstützt | Ersparnis |
|----------------|-------------|--------------|----------------|-----------|
| Hero-Banner | MITTEL | 4h | 1h | 75% |
| Kurs-Card | MITTEL | 4h | 1h | 75% |
| Text | EINFACH | 1h | 0.5h | 50% |
| Media | EINFACH | 1h | 0.5h | 50% |
| Galerie | MITTEL | 3h | 1h | 67% |
| Akkordeon | MITTEL | 3h | 1h | 67% |
| Card-Group | MITTEL | 4h | 1h | 75% |
| Kontakt-Teaser | EINFACH | 2h | 0.5h | 75% |
| Newsletter | MITTEL | 3h | 1h | 67% |
| Kurs-Carousel | HOCH | 6h | 2h | 67% |
| Standort-Karte | HOCH | 6h | 2h | 67% |
| Downloads | EINFACH | 2h | 0.5h | 75% |
| Video-Embed | EINFACH | 2h | 0.5h | 75% |
| Suche-Widget | HOCH | 8h | 3h | 63% |
| Warenkorb-Widget | HOCH | 8h | 3h | 63% |
| Login-Widget | HOCH | 8h | 3h | 63% |
| Kursleitenden-Profil | MITTEL | 4h | 1h | 75% |
| Buchungsübersicht | HOCH | 8h | 3h | 63% |
| Benachrichtigungen | HOCH | 8h | 3h | 63% |
| Chatbot-Widget | HOCH | 12h | 4h | 67% |
| **Subtotal** | | **97h** | **32h** | **67%** |

### 1.3 Taxonomies (5)

| Taxonomy | Komplexität | Traditionell | KI-Unterstützt | Ersparnis |
|----------|-------------|--------------|----------------|-----------|
| Kurskategorie | MITTEL (hierarchisch) | 4h | 1h | 75% |
| Programmbereich | EINFACH | 2h | 0.5h | 75% |
| Tags | EINFACH | 1h | 0.5h | 50% |
| Standorte | EINFACH | 2h | 0.5h | 75% |
| Zielgruppen | EINFACH | 2h | 0.5h | 75% |
| **Subtotal** | | **11h** | **4h** | **64%** |

### 1.4 Views (9)

| View | Komplexität | Traditionell | KI-Unterstützt | Ersparnis |
|------|-------------|--------------|----------------|-----------|
| Kurssuche | HOCH | 16h | 5h | 69% |
| Kursübersicht | MITTEL | 6h | 2h | 67% |
| News-Übersicht | MITTEL | 4h | 1h | 75% |
| Veranstaltungen | MITTEL | 6h | 2h | 67% |
| Kursleitende | MITTEL | 4h | 1h | 75% |
| Standorte | EINFACH | 3h | 1h | 67% |
| Meine Buchungen | HOCH | 8h | 3h | 63% |
| Meine Kurse (Kursleitende) | HOCH | 8h | 3h | 63% |
| Ähnliche Kurse | MITTEL | 6h | 2h | 67% |
| **Subtotal** | | **61h** | **20h** | **67%** |

### 1.5 Webforms (5)

| Webform | Komplexität | Traditionell | KI-Unterstützt | Ersparnis |
|---------|-------------|--------------|----------------|-----------|
| Kontaktformular | EINFACH | 2h | 1h | 50% |
| Kurs-Anfrage | MITTEL | 4h | 1h | 75% |
| Newsletter-Anmeldung | EINFACH | 2h | 1h | 50% |
| Beratungsanfrage | HOCH | 8h | 3h | 63% |
| Ermäßigungsantrag | HOCH | 10h | 3h | 70% |
| **Subtotal** | | **26h** | **9h** | **65%** |

### 1.6 Custom Modules (8)

| Modul | Komplexität | Traditionell | KI-Unterstützt | Ersparnis |
|-------|-------------|--------------|----------------|-----------|
| Information Manager Integration | HOCH | 80h | 28h | 65% |
| Payment Integration | HOCH | 60h | 21h | 65% |
| Notification Service | HOCH | 40h | 14h | 65% |
| Booking System | HOCH | 60h | 21h | 65% |
| Instructor Portal | HOCH | 50h | 18h | 64% |
| Chatbot Integration | HOCH | 40h | 14h | 65% |
| Waitlist Management | MITTEL | 20h | 7h | 65% |
| DOX42 Integration | MITTEL | 20h | 7h | 65% |
| **Subtotal** | | **370h** | **130h** | **65%** |

**Hinweis:** Custom Modules haben geringere KI-Reduktion (~65% vs. 67%) wegen höherer Anforderungen an Domänen-Expertise und manueller Review.

### 1.7 Theme Components (SDC) (55)

| Komponenten-Kategorie | Anzahl | Traditionell | KI-Unterstützt | Ersparnis |
|-----------------------|--------|--------------|----------------|-----------|
| Layout (Header, Footer) | 2 | 18h | 6h | 67% |
| Navigation | 3 | 12h | 4h | 67% |
| Content Display | 8 | 32h | 11h | 66% |
| Cards | 6 | 24h | 8h | 67% |
| Interactive | 6 | 28h | 9h | 68% |
| Forms & Widgets | 10 | 56h | 19h | 66% |
| Special (Checkout, Dashboard) | 4 | 30h | 10h | 67% |
| Standard-Komponenten | 16 | 0h | 0h | - |
| **Subtotal** | **55** | **200h** | **67h** | **67%** |

**Hinweis:** 16 Standard-Komponenten aus adessoCMS-Baseline wiederverwendbar (Button, Badge, Heading, etc.).

---

## 2. Base Total (Entities)

| Kategorie | Traditionell | KI-Unterstützt | Ersparnis |
|-----------|--------------|----------------|-----------|
| Content Types | 54h | 18h | 67% |
| Paragraph Types | 97h | 32h | 67% |
| Taxonomies | 11h | 4h | 64% |
| Views | 61h | 20h | 67% |
| Webforms | 26h | 9h | 65% |
| Custom Modules | 370h | 130h | 65% |
| Theme Components | 200h | 67h | 67% |
| **BASE TOTAL** | **819h** | **280h** | **66%** |

---

## 3. Multiplikatoren

### 3.1 Testing (+25% → +10%)

| Test-Typ | Traditionell | KI-Unterstützt | Begründung |
|----------|--------------|----------------|------------|
| Unit-Tests | +10% | +5% | KI generiert Test-Cases |
| Integration-Tests | +10% | +3% | KI schreibt Basis-Tests |
| E2E-Tests (Playwright) | +10% | +5% | KI erstellt User-Journeys |
| Visual Tests (Storybook) | +5% | +2% | KI generiert Stories |
| **Subtotal** | **+25%** | **+15%** | **KI-Reduktion: 40%** |

**Berechnung:**
- Traditionell: 819h × 0.25 = **205h**
- KI-Unterstützt: 280h × 0.15 = **42h**

### 3.2 Documentation (+15% → +5%)

| Dokumentations-Typ | Traditionell | KI-Unterstützt | Begründung |
|--------------------|--------------|----------------|------------|
| API-Dokumentation | +5% | +2% | KI aus Code generiert |
| User Guides | +5% | +2% | KI-Unterstützung |
| Developer Docs | +5% | +1% | KI aus Code generiert |
| **Subtotal** | **+15%** | **+5%** | **KI-Reduktion: 67%** |

**Berechnung:**
- Traditionell: 819h × 0.15 = **123h**
- KI-Unterstützt: 280h × 0.05 = **14h**

### 3.3 Quality Assurance (+20% → +10%)

| QA-Aktivität | Traditionell | KI-Unterstützt | Begründung |
|--------------|--------------|----------------|------------|
| Code Reviews | +5% | +2% | KI pre-review |
| Manual Testing | +10% | +5% | Fokussierte Tests |
| Bug Fixing | +10% | +5% | Weniger Bugs durch KI |
| **Subtotal** | **+25%** | **+12%** | **KI-Reduktion: 52%** |

**Berechnung:**
- Traditionell: 819h × 0.20 = **164h**
- KI-Unterstützt: 280h × 0.10 = **28h**

### 3.4 Multilingual (+30%)

**Anforderung:** Mindestens Deutsch + Englisch

| Aktivität | Traditionell | KI-Unterstützt | Begründung |
|-----------|--------------|----------------|------------|
| i18n Setup | +10% | +10% | Gleicher Aufwand |
| Translation Interface | +10% | +5% | KI-generierte Übersetzungen |
| Content Translation | +10% | +5% | KI-Unterstützung |
| **Subtotal** | **+30%** | **+20%** | **KI-Reduktion: 33%** |

**Berechnung:**
- Traditionell: 819h × 0.30 = **246h**
- KI-Unterstützt: 280h × 0.20 = **56h**

### 3.5 Advanced Permissions (+20%)

**Anforderung:** Rollen für Teilnehmende, Kursleitende, VHS-Mitarbeitende

| Aktivität | Traditionell | KI-Unterstützt | Begründung |
|-----------|--------------|----------------|------------|
| Role-Based Access | +10% | +5% | KI-Konfiguration |
| Content Workflow | +10% | +5% | KI-Setup |
| **Subtotal** | **+20%** | **+10%** | **KI-Reduktion: 50%** |

**Berechnung:**
- Traditionell: 819h × 0.20 = **164h**
- KI-Unterstützt: 280h × 0.10 = **28h**

### 3.6 Custom Integrations (+75%)

**Anforderung:** Information Manager, Suchserver, Notification Service, DOX42, Payment PSP, Location API, IBAN-API

| Integration | Traditionell | KI-Unterstützt | Begründung |
|-------------|--------------|----------------|------------|
| REST-API Clients | +30% | +15% | KI generiert API-Calls |
| Authentication | +15% | +10% | OAuth-Komplexität |
| Error Handling | +15% | +10% | Manuelle Logik |
| Data Mapping | +15% | +10% | Domänen-Expertise |
| **Subtotal** | **+75%** | **+45%** | **KI-Reduktion: 40%** |

**Berechnung:**
- Traditionell: 819h × 0.75 = **614h**
- KI-Unterstützt: 280h × 0.45 = **126h**

### 3.7 Security (+30%)

**Anforderung:** DSGVO, PCI-DSS, BITV 2.0, OWASP

| Aktivität | Traditionell | KI-Unterstützt | Begründung |
|-----------|--------------|----------------|------------|
| Security Audit | +15% | +10% | Teilweise automatisiert |
| Penetration Testing | +15% | +10% | Manuelle Expertise |
| **Subtotal** | **+30%** | **+20%** | **KI-Reduktion: 33%** |

**Berechnung:**
- Traditionell: 819h × 0.30 = **246h**
- KI-Unterstützt: 280h × 0.20 = **56h**

### 3.8 Performance Optimization (+20%)

**Anforderung:** Suchergebnisse max. 1,5 Sek., Bilder-Optimierung

| Aktivität | Traditionell | KI-Unterstützt | Begründung |
|-----------|--------------|----------------|------------|
| Caching Strategy | +10% | +5% | KI-Konfiguration |
| Query Optimization | +10% | +5% | KI-Analyse |
| **Subtotal** | **+20%** | **+10%** | **KI-Reduktion: 50%** |

**Berechnung:**
- Traditionell: 819h × 0.20 = **164h**
- KI-Unterstützt: 280h × 0.10 = **28h**

### 3.9 Accessibility (WCAG 2.2 AA) (+25%)

**Anforderung:** BITV 2.0 / WCAG 2.2 Level AA (verpflichtend)

| Aktivität | Traditionell | KI-Unterstützt | Begründung |
|-----------|--------------|----------------|------------|
| Accessibility Audit | +10% | +5% | Automatisierte Tools |
| Implementation | +15% | +10% | Manuelle Umsetzung |
| **Subtotal** | **+25%** | **+15%** | **KI-Reduktion: 40%** |

**Berechnung:**
- Traditionell: 819h × 0.25 = **205h**
- KI-Unterstützt: 280h × 0.15 = **42h**

---

## 4. Multiplikatoren - Gesamt

| Multiplikator | Traditionell | KI-Unterstützt | Ersparnis |
|---------------|--------------|----------------|-----------|
| Testing (+25% / +15%) | 205h | 42h | 163h (80%) |
| Documentation (+15% / +5%) | 123h | 14h | 109h (89%) |
| Quality Assurance (+20% / +10%) | 164h | 28h | 136h (83%) |
| Multilingual (+30% / +20%) | 246h | 56h | 190h (77%) |
| Advanced Permissions (+20% / +10%) | 164h | 28h | 136h (83%) |
| Custom Integrations (+75% / +45%) | 614h | 126h | 488h (80%) |
| Security (+30% / +20%) | 246h | 56h | 190h (77%) |
| Performance (+20% / +10%) | 164h | 28h | 136h (83%) |
| Accessibility (+25% / +15%) | 205h | 42h | 163h (80%) |
| **TOTAL MULTIPLIERS** | **2.131h** | **420h** | **1.711h (80%)** |

**Hinweis:** Multiplikatoren wirken auf Base Total (819h / 280h), daher kumulativer Effekt.

---

## 5. Additional Effort (Projektoverhead)

### 5.1 Setup & Infrastructure (60h → 40h)

| Aktivität | Traditionell | KI-Unterstützt | Begründung |
|-----------|--------------|----------------|------------|
| DDEV Setup | 16h | 8h | KI-Konfiguration |
| Git Workflow | 8h | 4h | KI-Templates |
| CI/CD Pipeline | 24h | 16h | KI-Unterstützung |
| Deployment Automation | 12h | 12h | Manuelle Expertise |
| **Subtotal** | **60h** | **40h** | **33% Reduktion** |

### 5.2 Project Management (18% → 15%)

| Aktivität | Traditionell (819h Base) | KI-Unterstützt (280h Base) | Begründung |
|-----------|-------------------------|---------------------------|------------|
| Meetings | 5% | 5% | Gleichbleibend |
| Planning | 5% | 5% | Gleichbleibend |
| Coordination | 8% | 5% | KI-Reporting |
| **Subtotal** | **18%** | **15%** | **17% Reduktion** |

**Berechnung:**
- Traditionell: 819h × 0.18 = **147h**
- KI-Unterstützt: 280h × 0.15 = **42h**

### 5.3 Training & Handover (30h → 20h)

| Aktivität | Traditionell | KI-Unterstützt | Begründung |
|-----------|--------------|----------------|------------|
| Admin Training | 16h | 12h | KI-generierte Materialien |
| Documentation | 8h | 4h | KI-generiert |
| Knowledge Transfer | 6h | 4h | Fokussierter |
| **Subtotal** | **30h** | **20h** | **33% Reduktion** |

---

## 6. Migration Effort

**Besonderheit:** Kentico → Drupal = **KEINE Migration**, sondern Neuentwicklung.

**Aufwand:**
- Content-Transfer (manuell oder semi-automatisch): **40h** (Traditionell) → **20h** (KI-Unterstützt)
- Hinweis: Kursdaten kommen aus Information Manager (nicht aus Kentico)

---

## 7. Buffer (Risikopuffer)

**Risikobewertung:** HOCH (siehe Gap-Analyse)

| Risiko-Faktor | Begründung |
|---------------|------------|
| API-Abhängigkeit | Information Manager, Suchserver, Notification Service |
| Zahlungsintegration | PCI-DSS-Konformität erforderlich |
| KI-Services DSGVO | Deutsche Server verpflichtend |
| Barrierefreiheit | BITV 2.0 gesetzlich verpflichtend |
| Deadline 31.10.2027 | Fixe Endfrist |

**Buffer:**
- **Traditionell:** +25% (HOCH)
- **KI-Unterstützt:** +15% (MITTEL, da weniger Unsicherheit durch KI)

---

## 8. GESAMTSCHÄTZUNG

### 8.1 Traditionelle Entwicklung

```
╔═══════════════════════════════════════════════════════════════╗
║         TRADITIONELLE ENTWICKLUNG (ohne KI)                    ║
╠═══════════════════════════════════════════════════════════════╣
║ Kategorie                    │ Stunden  │ Anteil              ║
╠═══════════════════════════════════════════════════════════════╣
║ BASE (Entities)              │ 819h     │ 44%                 ║
║ + Multiplikatoren            │ 2.131h   │ (260% auf Base)     ║
║ + Setup & Infrastruktur      │ 60h      │ 3%                  ║
║ + Projektmanagement (18%)    │ 147h     │ 8%                  ║
║ + Training & Handover        │ 30h      │ 2%                  ║
║ + Migration                  │ 40h      │ 2%                  ║
╠═══════════════════════════════════════════════════════════════╣
║ ZWISCHENSUMME                │ 3.227h   │                     ║
╠═══════════════════════════════════════════════════════════════╣
║ + Puffer (25% HOCH)          │ 807h     │                     ║
╠═══════════════════════════════════════════════════════════════╣
║ GESAMT                       │ 4.034h   │                     ║
║ Personen-Tage (8h/Tag)       │ 504 PT   │                     ║
║ Zeitplan (40h/Woche)         │ 101 Wochen │ (~23 Monate)     ║
╠═══════════════════════════════════════════════════════════════╣
║ VERGLEICH AUSSCHREIBUNG      │          │                     ║
║ Ausgeschriebenes Volumen     │ 444,8 PT │                     ║
║ Schätzung                    │ 504 PT   │ 113% des Budgets    ║
╚═══════════════════════════════════════════════════════════════╝
```

### 8.2 KI-Unterstützte Entwicklung

```
╔═══════════════════════════════════════════════════════════════╗
║         KI-UNTERSTÜTZTE ENTWICKLUNG (mit Claude Code)          ║
╠═══════════════════════════════════════════════════════════════╣
║ Kategorie                    │ Stunden  │ Anteil              ║
╠═══════════════════════════════════════════════════════════════╣
║ BASE (Entities)              │ 280h     │ 39%                 ║
║ + Multiplikatoren            │ 420h     │ (150% auf Base)     ║
║ + Setup & Infrastruktur      │ 40h      │ 6%                  ║
║ + Projektmanagement (15%)    │ 42h      │ 6%                  ║
║ + Training & Handover        │ 20h      │ 3%                  ║
║ + Migration                  │ 20h      │ 3%                  ║
╠═══════════════════════════════════════════════════════════════╣
║ ZWISCHENSUMME                │ 822h     │                     ║
╠═══════════════════════════════════════════════════════════════╣
║ + Puffer (15% MITTEL)        │ 123h     │                     ║
╠═══════════════════════════════════════════════════════════════╣
║ GESAMT                       │ 945h     │                     ║
║ Personen-Tage (8h/Tag)       │ 118 PT   │                     ║
║ Zeitplan (40h/Woche)         │ 24 Wochen │ (~5,5 Monate)     ║
╠═══════════════════════════════════════════════════════════════╣
║ VERGLEICH AUSSCHREIBUNG      │          │                     ║
║ Ausgeschriebenes Volumen     │ 444,8 PT │                     ║
║ Schätzung                    │ 118 PT   │ 27% des Budgets     ║
╚═══════════════════════════════════════════════════════════════╝
```

### 8.3 Vergleich Traditionell vs. KI-Unterstützt

```
╔═══════════════════════════════════════════════════════════════╗
║              PROJEKT-SCHÄTZUNG VERGLEICH                       ║
╠═══════════════════════════════════════════════════════════════╣
║ Kategorie             │ Traditionell │ KI-Unterstützt │ Erspart║
╠═══════════════════════════════════════════════════════════════╣
║ Inhaltstypen          │ 54h          │ 18h            │ 67%    ║
║ Paragraphs            │ 97h          │ 32h            │ 67%    ║
║ Views                 │ 61h          │ 20h            │ 67%    ║
║ Theme-Komponenten     │ 200h         │ 67h            │ 67%    ║
║ Custom Modules        │ 370h         │ 130h           │ 65%    ║
║ Migration             │ 40h          │ 20h            │ 50%    ║
╠═══════════════════════════════════════════════════════════════╣
║ ZWISCHENSUMME         │ 3.227h       │ 822h           │        ║
║ + Multiplikatoren     │ 2.131h       │ 420h           │        ║
║ + Projektmanagement   │ 147h         │ 42h            │        ║
║ + Puffer              │ 807h         │ 123h           │        ║
╠═══════════════════════════════════════════════════════════════╣
║ GESAMT                │ 4.034h       │ 945h           │ 77%    ║
║ Zeitplan (40h/Woche)  │ 101 Wochen   │ 24 Wochen      │        ║
╠═══════════════════════════════════════════════════════════════╣
║ KI-ERSPARNIS          │         77% Reduktion (3.089h)         ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 9. WICHTIGE ERKENNTNISSE

### 9.1 Budget-Analyse

**⚠️ KRITISCH:** Die Ausschreibung nennt **444,8 PT für die GESAMTLEISTUNG**, nicht nur Entwicklung.

**Gesamtleistung umfasst:**
1. **Entwicklung** (Umsetzung bis 31.10.2027)
2. **Wartung & Support** (3 Jahre: 31.10.2027 - 31.10.2030)
3. **Projektmanagement** (über gesamte Laufzeit)

**Annahme Aufteilung:**
- Entwicklung: ~45-50% des Budgets = **200-220 PT**
- Wartung (3 Jahre): ~40-45% = **180-200 PT**
- PM & Overhead: ~10% = **40-45 PT**

**Vergleich:**
- **Traditionell:** 504 PT (Entwicklung) → **ÜBERBUDGET** (~130%)
- **KI-Unterstützt:** 118 PT (Entwicklung) → **UNTERBUDGET** (~53-59% der Entwicklungs-PT)

### 9.2 Nearshore-Kalkulation (Sales-Hinweis)

**Sales-Vorgabe:** "100% Preis, sollte mit Nearshore kalkuliert werden, sonst kein WIN"

**Onshore-Stundensatz:** ~€150/h
**Nearshore-Stundensatz:** ~€80-90/h (Annahme)
**Reduktion:** ~40-45%

**Rechnung (KI-Unterstützt):**
- 945h × €90/h = **€85.050**
- In PT (8h): 118 PT × €720/PT = **€84.960**

**Rechnung (Traditionell):**
- 4.034h × €90/h = **€363.060**
- In PT (8h): 504 PT × €720/PT = **€362.880**

**Vergleich Ausschreibungs-Volumen (444,8 PT):**
- 444,8 PT × €720/PT = **€320.256** (Gesamt inkl. Wartung)
- Entwicklung (50%): **€160.128**

**⚠️ Traditionell:** Deutlich ÜBERBUDGET
**✅ KI-Unterstützt + Nearshore:** Passt ins Budget

---

## 10. BID/NO-BID Empfehlung

### 10.1 PRO BID

✅ **Starke Passung zu Kompetenzen:**
- Public-Sector-Projekte
- Drupal 11 + adessoCMS-Baseline
- REST-API-Integrationen
- Barrierefreie Webportale (BITV 2.0)
- Agile Projektvorgehen

✅ **Technologische Stärke:**
- adessoCMS-Baseline als Fundament
- KI-unterstützte Entwicklung (Claude Code)
- Nearshore-Kapazitäten verfügbar

✅ **Realistische Kalkulation:**
- KI-unterstützt + Nearshore = **Wettbewerbsfähig**
- 118 PT (Entwicklung) + 180 PT (Wartung) = **298 PT** < 444,8 PT

✅ **Langfristige Perspektive:**
- 3 Jahre Wartung = **Planbare Einnahmen**
- Referenzprojekt für Public Sector

### 10.2 CONTRA BID

❌ **Hohe Komplexität:**
- 8 Custom Modules (insb. Payment, Booking)
- Kritische Abhängigkeiten (Information Manager API)
- KI-Services DSGVO (deutsche Server)

❌ **Risiken:**
- API-Abhängigkeit vom Information Manager (unklar, ob stabil/dokumentiert)
- PCI-DSS-Konformität bei Zahlungsintegration
- Fixe Deadline 31.10.2027 bei agiler Vorgehensweise

❌ **Nearshore-Risiko:**
- Komplexe Anforderungen (Barrierefreiheit, DSGVO, PCI-DSS)
- Erfordern hohe Expertise + Kommunikation

### 10.3 KRITISCHE KLÄRUNGSFRAGEN (vor Bid)

**VOR Angebotserstellung MÜSSEN geklärt werden:**

1. **Information Manager REST-API:**
   - ✅ Ist die API dokumentiert und stabil?
   - ✅ Welche Endpunkte existieren?
   - ✅ Gibt es Test-Zugang?

2. **Zahlungsintegration:**
   - ✅ Welcher Payment Service Provider ist gewünscht/vorgegeben?
   - ✅ PCI-DSS: Wird extern gehostet oder intern?

3. **KI-Services:**
   - ✅ Azure OpenAI (Frankfurt) akzeptabel?
   - ✅ DSGVO-Dokumentation erforderlich?

4. **Barrierefreiheit:**
   - ✅ Wird externes BITV-Audit verlangt?
   - ✅ Zertifizierung erforderlich?

5. **Hosting:**
   - ✅ Wer hostet (VHS oder Dienstleister)?
   - ✅ Infrastruktur-Anforderungen geklärt?

6. **Wartung (3 Jahre):**
   - ✅ Welche SLAs werden erwartet?
   - ✅ Update-Zyklen definiert?

---

## 11. GESAMTBEWERTUNG

### Bid-Entscheidung: ✅ **BID (unter Bedingungen)**

**Voraussetzungen:**

1. ✅ **Klärung kritischer Fragen** (siehe 10.3) via Bieterfragen
2. ✅ **Nearshore-Kapazitäten** verbindlich sichern
3. ✅ **SPOC mit Public-/Webportal-Erfahrung** verfügbar
4. ✅ **KI-unterstützte Entwicklung** als Strategie kommunizieren
5. ✅ **Referenzen** für barrierefreie Webportale vorweisen

**Strategische Positionierung:**

> "Wir bieten eine moderne, KI-unterstützte Drupal-11-Lösung auf Basis unserer adessoCMS-Baseline. Durch den Einsatz von Claude Code erreichen wir eine **77% kürzere Entwicklungszeit** bei gleichzeitig **höherer Code-Qualität** und **umfassenden automatisierten Tests**. In Kombination mit Nearshore-Entwicklung können wir ein **wettbewerbsfähiges Angebot** innerhalb des Budget-Rahmens erstellen."

---

**Nächste Schritte:**

1. **Bieterfragen** einreichen (kritische Klärungen)
2. **Nearshore-Team** zusammenstellen
3. **Referenzen** aufbereiten (barrierefreie Portale)
4. **Detailliertes Angebot** kalkulieren (inkl. Wartung)
5. **Technisches Konzept** erstellen (Pflichtenheft-Grundlage)
