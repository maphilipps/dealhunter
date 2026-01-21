# Content Cleanup

## Cleanup-Aufgaben

### HTML-Bereinigung

**Probleme:**
- Inline Styles aus WYSIWYG
- Deprecated HTML-Tags
- Redundante Wrapper-DIVs
- Nicht-semantische Elemente

**Lösung:**

```php
// HTML Cleanup Process Plugin
namespace Drupal\vfl_migrate\Plugin\migrate\process;

/**
 * @MigrateProcessPlugin(id = "html_cleanup")
 */
class HtmlCleanup extends ProcessPluginBase {

  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {
    if (empty($value)) {
      return $value;
    }

    // Remove inline styles
    $value = preg_replace('/style="[^"]*"/', '', $value);

    // Remove empty tags
    $value = preg_replace('/<(\w+)[^>]*>\s*<\/\1>/', '', $value);

    // Remove deprecated tags
    $value = preg_replace('/<font[^>]*>(.*?)<\/font>/i', '$1', $value);

    // Clean up whitespace
    $value = preg_replace('/\s+/', ' ', $value);

    return trim($value);
  }
}
```

### URL-Transformation

**Probleme:**
- Interne Links auf alte URLs
- Absolute URLs statt relative
- Asset-URLs müssen gemappt werden

**Lösung:**

```php
// URL Transform Process Plugin
class UrlTransform extends ProcessPluginBase {

  protected $urlMap = [
    '/site/de/' => '/',
    'https://backend.vfl-bochum.de/binaries/' => '/sites/default/files/',
  ];

  public function transform($value, ...) {
    foreach ($this->urlMap as $old => $new) {
      $value = str_replace($old, $new, $value);
    }
    return $value;
  }
}
```

### Image-Processing

**Aufgaben:**
1. Download von externem Server
2. Konvertierung zu WebP (optional)
3. Focal Point setzen (falls Metadaten vorhanden)
4. Alt-Text übernehmen

```yaml
# Image Process Pipeline
process:
  field_media_image:
    - plugin: download
      source:
        - url
        - destination
      file_exists: replace
    - plugin: image_dimension_skip
      method: min
      width: 100
      height: 100
    - plugin: entity_generate
```

### Taxonomy-Mapping

**Probleme:**
- Unterschiedliche Taxonomie-Strukturen
- Fehlende Übersetzungen
- Doppelte Terms

**Lösung:**

```yaml
# Taxonomy Cleanup
process:
  name:
    - plugin: get
      source: name
    - plugin: callback
      callable: trim
    - plugin: callback
      callable: ucfirst
  vid:
    plugin: default_value
    default_value: tags
```

### Duplikat-Erkennung

```php
// Duplicate Detection
public function checkDuplicates(string $title, string $bundle): ?int {
  $query = $this->nodeStorage->getQuery()
    ->condition('type', $bundle)
    ->condition('title', $title)
    ->accessCheck(FALSE);

  $results = $query->execute();

  if (!empty($results)) {
    return reset($results);
  }

  return NULL;
}
```

## Cleanup-Checkliste

### Pre-Migration

- [ ] Quell-Daten analysieren
- [ ] Cleanup-Regeln definieren
- [ ] Test-Set erstellen
- [ ] Transformationen entwickeln

### Während Migration

- [ ] HTML bereinigen
- [ ] URLs transformieren
- [ ] Bilder validieren
- [ ] Duplikate erkennen

### Post-Migration

- [ ] Broken Links finden
- [ ] Fehlende Bilder identifizieren
- [ ] Content validieren
- [ ] SEO-Check (Titles, Meta)

## Automatisierte Validierung

```php
// Post-Migration Validation
class MigrationValidator {

  public function validate(): array {
    $issues = [];

    // Check for broken internal links
    $broken_links = $this->findBrokenLinks();
    if (!empty($broken_links)) {
      $issues['broken_links'] = $broken_links;
    }

    // Check for missing images
    $missing_images = $this->findMissingImages();
    if (!empty($missing_images)) {
      $issues['missing_images'] = $missing_images;
    }

    // Check for empty required fields
    $empty_fields = $this->findEmptyRequiredFields();
    if (!empty($empty_fields)) {
      $issues['empty_fields'] = $empty_fields;
    }

    return $issues;
  }
}
```

## Aufwand

| Task | Stunden |
|------|---------|
| Cleanup-Regeln definieren | 8h |
| Process Plugins entwickeln | 16h |
| Validierung implementieren | 8h |
| Manuelle Nacharbeit | 16h |
| **Gesamt** | **~48h** |

*Enthalten im Migrations-Aufwand von 230h*
