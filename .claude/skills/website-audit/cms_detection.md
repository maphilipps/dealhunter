# CMS Detection - IMMER ZUERST!

## Problem

Beim Locarno-Audit wurde das CMS (Magnolia) nicht erkannt. Dies muss in Zukunft als **erster Schritt** durchgeführt werden.

---

## Empfohlene Tools

### 1. Wappalyzer (Browser Extension)
- Chrome/Firefox Extension installieren
- Website besuchen
- Extension zeigt Tech-Stack

**Download:** https://www.wappalyzer.com/

### 2. BuiltWith
```bash
curl "https://api.builtwith.com/free1/api.json?KEY=&LOOKUP=locarnofestival.ch"
```
Oder: https://builtwith.com/locarnofestival.ch

### 3. WhatRuns (Browser Extension)
Alternative zu Wappalyzer

### 4. Netcraft
https://sitereport.netcraft.com/?url=https://www.locarnofestival.ch

---

## Manuelle Erkennung

### HTTP Headers prüfen
```bash
curl -I https://www.locarnofestival.ch/ 2>&1 | grep -i "x-powered-by\|server\|x-generator"
```

### Magnolia-spezifische Indikatoren
- URL-Pattern: `.html` Endungen
- Pfade: `/.magnolia/`, `/.resources/`
- Cookies: `JSESSIONID` (Java-basiert)
- Headers: `X-Magnolia-*`

### HTML Source prüfen
```javascript
// In Browser Console
document.documentElement.outerHTML.match(/magnolia|mgnl/gi)
```

---

## Audit-Prozess Update

### Phase 1: Discovery (NEU)

**Schritt 0: CMS Detection** ⚠️
1. Wappalyzer Browser Extension nutzen
2. BuiltWith Website checken
3. HTTP Headers analysieren
4. HTML Source durchsuchen

**Erst danach:** Screenshots, Content-Analyse, etc.

---

## Häufige CMS-Signaturen

| CMS | Indikatoren |
|-----|-------------|
| **Magnolia** | `.html` URLs, JSESSIONID, Java-Stack |
| **WordPress** | `wp-content`, `wp-includes`, Generator-Tag |
| **Drupal** | `Drupal.settings`, `/sites/default/files` |
| **TYPO3** | `typo3temp`, `typo3conf`, `t3://` Links |
| **Sitecore** | `/sitecore/`, SC_ANALYTICS_COOKIE |
| **AEM** | `/content/dam/`, `/etc/designs/` |
| **Contentful** | `cdn.contentful.com` in Network |

---

## Magnolia Migration

### Vorteile für Migration
- Java-basiert → Strukturierte Daten
- Content-Repository (JCR) → Export möglich
- REST API verfügbar (prüfen!)

### Zu prüfen
1. Magnolia REST API Zugang?
2. JCR Export möglich?
3. Admin-Zugang für Content-Export?

**Mit Magnolia ist die Migration einfacher als mit Web Scraping!**

---

*Erstellt nach Locarno-Audit - November 2025*
