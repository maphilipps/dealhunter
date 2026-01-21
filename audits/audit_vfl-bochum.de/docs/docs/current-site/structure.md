# Site Structure

## Hauptnavigation

Die Website ist in folgende Hauptbereiche unterteilt:

```
vfl-bochum.de
├── Verein
│   ├── Der VfL
│   ├── Geschichte
│   ├── Satzung & Ordnungen
│   ├── Gremien
│   ├── Datenschutz
│   └── Impressum
├── Profis
│   ├── Kader
│   ├── Trainerteam
│   └── Spielplan
├── Frauen
│   ├── Kader
│   ├── Trainerteam
│   └── Spielplan
├── Talentwerk
│   ├── U23
│   ├── U19
│   └── Nachwuchs
├── Stadion
│   ├── Vonovia Ruhrstadion
│   ├── Anfahrt
│   ├── Gastronomie
│   └── Business
├── Fans
│   ├── Fanbetreuung
│   ├── Fanclubs
│   ├── Dauerkarten
│   └── Mitgliedschaft
├── 1848TV (Videos)
├── News
├── Termine
├── Netzwerk (Partner)
└── Jobs
```

## URL-Struktur

| Bereich | URL-Muster | Beispiel |
|---------|-----------|----------|
| Homepage | `/` | vfl-bochum.de |
| Verein | `/verein/*` | /verein/geschichte |
| Profis | `/profis/*` | /profis/kader |
| Frauen | `/frauen/*` | /frauen/kader |
| Talentwerk | `/talentwerk/*` | /talentwerk/u19 |
| Stadion | `/stadion/*` | /stadion/anfahrt |
| Fans | `/fans/*` | /fans/mitgliedschaft |
| News | `/news/*` | /news/artikel-slug |
| Videos | `/1848tv/*` | /1848tv |
| Termine | `/termine/*` | /termine |
| Partner | `/netzwerk/*` | /netzwerk |
| Jobs | `/jobs/*` | /jobs |

## Subdomains

| Subdomain | Zweck |
|-----------|-------|
| www.vfl-bochum.de | Hauptseite |
| backend.vfl-bochum.de | CMS API |
| design.vfl-bochum.de | Design System |
| shop.vfl-bochum.de | Merchandise (extern) |
| tickets.vfl-bochum.de | Ticketing (extern) |

## Navigation-Typen

### Hauptnavigation (Desktop)

- Multi-level Mega-Menu
- Sticky on scroll
- Prominent Suchfunktion

### Mobile Navigation

- Burger-Menu
- Vollbild-Overlay
- Touch-optimiert

### Footer Navigation

- Sitemap-Links
- Legal Links (Impressum, Datenschutz)
- Social Media Links

### Utility Navigation

- Suche
- Shop-Link
- Ticket-Link
- Social Media

## Seitentypen

### Landing Pages

Flexible Sektionen mit verschiedenen Komponenten:
- Hero-Teaser
- News-Slider
- Video-Slider
- Teaser-Grids
- Partner-Grid

### Content Pages

Strukturierte Inhaltsseiten:
- Überschrift
- Inhalt (WYSIWYG)
- Bilder/Videos
- Downloads

### Listing Pages

Dynamische Listen:
- News-Übersicht
- Video-Übersicht
- Team-Übersicht
- Job-Liste

### Detail Pages

Einzelansichten:
- News-Artikel
- Video-Detail
- Spieler-Profil
- Job-Detail

## Breadcrumbs

Breadcrumb-Navigation ist vorhanden:

```
Home > Verein > Geschichte
Home > Profis > Kader > Spielername
Home > News > Artikeltitel
```

## Drupal-Mapping

| Aktuelle Struktur | Drupal-Entsprechung |
|-------------------|---------------------|
| Hauptnavigation | Menu: main |
| Footer Navigation | Menu: footer |
| Breadcrumbs | System Breadcrumb |
| Landing Pages | Content Type: Landing Page |
| Content Pages | Content Type: Basic Page |
| News | Content Type: Article |
