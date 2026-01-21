# Custom Modules

## Übersicht

4 Custom Modules werden für projekt-spezifische Funktionalitäten benötigt:

| # | Machine Name | Label | Komplexität | Stunden |
|---|--------------|-------|-------------|---------|
| 1 | vfl_sportdata | Sportdaten-Integration | Complex | 70h |
| 2 | vfl_salesforce | Salesforce Integration | Medium | 28h |
| 3 | vfl_video | 1848TV Integration | Medium | 28h |
| 4 | vfl_partner | Partner Management | Simple | 12h |
| | | **Gesamt** | | **138h** |

## 1. VfL Sportdata

**Machine Name:** `vfl_sportdata`

### Zweck

Integration der Sportdaten-API für:
- Spielplan
- Tabelle
- Liveticker
- Statistiken

### Services

```php
namespace Drupal\vfl_sportdata;

interface SportDataServiceInterface {

  /**
   * Get upcoming matches.
   *
   * @param int $limit
   * @return array
   */
  public function getUpcomingMatches(int $limit = 5): array;

  /**
   * Get match by ID.
   *
   * @param string $id
   * @return \Drupal\vfl_sportdata\Model\Match|null
   */
  public function getMatch(string $id): ?Match;

  /**
   * Get current standings.
   *
   * @param string $competition
   * @return array
   */
  public function getStandings(string $competition = 'bundesliga'): array;

  /**
   * Get live match data.
   *
   * @param string $matchId
   * @return \Drupal\vfl_sportdata\Model\LiveData|null
   */
  public function getLiveData(string $matchId): ?LiveData;
}
```

### Blocks

| Block | Beschreibung |
|-------|--------------|
| `vfl_next_match` | Nächstes Spiel Widget |
| `vfl_standings` | Tabellen-Block |
| `vfl_liveticker` | Liveticker (AJAX) |

### Caching

```php
// Cache mit Tags
$build = [
  '#theme' => 'vfl_standings',
  '#data' => $this->sportData->getStandings(),
  '#cache' => [
    'tags' => ['vfl_sportdata:standings'],
    'max-age' => 300, // 5 minutes
  ],
];
```

### Cron

```php
/**
 * Implements hook_cron().
 */
function vfl_sportdata_cron() {
  // Update standings every hour
  \Drupal::service('vfl_sportdata.updater')->updateStandings();

  // Invalidate cache
  \Drupal::service('cache_tags.invalidator')
    ->invalidateTags(['vfl_sportdata:standings']);
}
```

---

## 2. VfL Salesforce

**Machine Name:** `vfl_salesforce`

### Zweck

Salesforce Web-to-Case Integration für Kontaktformulare.

### Implementation

**Option A: Webform Handler (Empfohlen)**

```php
namespace Drupal\vfl_salesforce\Plugin\WebformHandler;

/**
 * @WebformHandler(
 *   id = "salesforce_web_to_case",
 *   label = @Translation("Salesforce Web-to-Case"),
 * )
 */
class SalesforceWebToCaseHandler extends WebformHandlerBase {

  public function submitForm(array &$form, FormStateInterface $form_state, WebformSubmissionInterface $webform_submission) {
    $data = $webform_submission->getData();

    $client = \Drupal::httpClient();
    $response = $client->post('https://webto.salesforce.com/servlet/servlet.WebToCase', [
      'form_params' => [
        'orgid' => $this->configuration['org_id'],
        'name' => $data['name'],
        'email' => $data['email'],
        'subject' => $data['subject'],
        'description' => $data['message'],
      ],
    ]);

    if ($response->getStatusCode() !== 200) {
      $this->messenger()->addError('Submission failed.');
    }
  }
}
```

**Option B: Salesforce Suite Module**

Für komplexere Integrationen (CRM-Sync).

---

## 3. VfL Video

**Machine Name:** `vfl_video`

### Zweck

1848TV Video-Integration:
- oEmbed Provider
- Custom Media Type
- Video Listing API

### oEmbed Provider

```php
namespace Drupal\vfl_video\OEmbed;

class VflTvProvider implements ProviderInterface {

  public function getName(): string {
    return '1848TV';
  }

  public function getProviderUrl(): string {
    return 'https://1848.tv';
  }

  public function getEndpoints(): array {
    return [
      [
        'url' => 'https://1848.tv/oembed',
        'schemes' => ['https://1848.tv/video/*'],
      ],
    ];
  }
}
```

### Media Type

```yaml
# media.type.vfl_video.yml
id: vfl_video
label: '1848TV Video'
source: oembed:video
source_configuration:
  providers:
    - 1848TV
    - YouTube
    - Vimeo
```

---

## 4. VfL Partner

**Machine Name:** `vfl_partner`

### Zweck

Erweiterte Partner-Verwaltung:
- Kategorien-basierte Anzeige
- Sortierung nach Weight
- Logo-Varianten (Farbe/Mono)

### Service

```php
namespace Drupal\vfl_partner;

class PartnerService {

  public function getPartnersByCategory(string $category): array {
    $query = $this->nodeStorage->getQuery()
      ->condition('type', 'partner')
      ->condition('status', 1)
      ->condition('field_category', $category)
      ->sort('field_weight', 'ASC')
      ->accessCheck(TRUE);

    $nids = $query->execute();
    return $this->nodeStorage->loadMultiple($nids);
  }

  public function getCategoryGroups(): array {
    $categories = ['lead', 'premium', 'top', 'gold', 'silver', 'bronze', 'network'];
    $groups = [];

    foreach ($categories as $category) {
      $partners = $this->getPartnersByCategory($category);
      if (!empty($partners)) {
        $groups[$category] = $partners;
      }
    }

    return $groups;
  }
}
```

---

## Modul-Struktur

```
modules/custom/
├── vfl_sportdata/
│   ├── vfl_sportdata.info.yml
│   ├── vfl_sportdata.module
│   ├── vfl_sportdata.services.yml
│   ├── src/
│   │   ├── Service/
│   │   │   └── SportDataService.php
│   │   ├── Model/
│   │   │   ├── Match.php
│   │   │   └── LiveData.php
│   │   └── Plugin/Block/
│   │       ├── NextMatchBlock.php
│   │       └── StandingsBlock.php
│   └── templates/
│       ├── vfl-next-match.html.twig
│       └── vfl-standings.html.twig
├── vfl_salesforce/
├── vfl_video/
└── vfl_partner/
```

## Testing

```php
namespace Drupal\Tests\vfl_sportdata\Unit;

class SportDataServiceTest extends UnitTestCase {

  public function testGetUpcomingMatches() {
    $service = new SportDataService($this->httpClient, $this->cache);
    $matches = $service->getUpcomingMatches(5);

    $this->assertCount(5, $matches);
    $this->assertInstanceOf(Match::class, $matches[0]);
  }
}
```
