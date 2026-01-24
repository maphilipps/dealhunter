# PRD: RAG Data Visibility

## Problem Statement

Als Entwickler und Power-User möchte ich verstehen, welche Daten das RAG-System zu einem Lead/RFP gespeichert hat. Derzeit gibt es keine Möglichkeit, die gespeicherten Embeddings, Raw-Chunks und Lead-Section-Daten einzusehen. Dies erschwert:

1. **Debugging**: Wenn RAG-Queries unerwartete Ergebnisse liefern, ist unklar welche Daten vorhanden sind
2. **Qualitätskontrolle**: Keine Sichtbarkeit ob Agents ihre Outputs korrekt in RAG gespeichert haben
3. **Verständnis**: Kein Einblick welche Chunk-Typen, Agents und Metadaten pro Lead existieren

## Solution

Eine neue **"RAG Data"** Seite in der Lead-Detail-Navigation, die alle gespeicherten RAG-Daten transparent anzeigt:

1. **Übersichts-Dashboard**: Statistiken zu Embeddings, Chunks, Agents
2. **Agent-Output-Browser**: Durchsuchbare Liste aller `rfpEmbeddings` pro Agent
3. **Raw-Chunks-Browser**: Durchsuchbare Liste aller `rawChunks` vom Dokument
4. **Section-Data-Browser**: Alle `leadSectionData` Einträge
5. **Similarity-Tester**: Eingabefeld für Test-Queries mit Live-Similarity-Scores

## User Stories

1. Als Entwickler möchte ich sehen, wie viele Embeddings pro Agent gespeichert sind, damit ich prüfen kann ob alle Agents ihre Daten korrekt persistiert haben.

2. Als Entwickler möchte ich alle Chunks eines bestimmten Agents (z.B. `quick_scan`) auflisten können, damit ich die Qualität der Chunking-Strategie bewerten kann.

3. Als Entwickler möchte ich die Metadaten eines Chunks einsehen können (agentName, chunkType, chunkIndex), damit ich verstehe wie die Daten strukturiert sind.

4. Als Entwickler möchte ich nach Text in Chunks suchen können, damit ich spezifische Inhalte schnell finden kann.

5. Als Entwickler möchte ich Raw-Chunks vom Originaldokument einsehen können, damit ich prüfen kann welcher Text extrahiert wurde.

6. Als Entwickler möchte ich die Token-Anzahl pro Raw-Chunk sehen, damit ich die Chunk-Größen bewerten kann.

7. Als Entwickler möchte ich eine Test-Query eingeben und die Top-N ähnlichsten Chunks mit Similarity-Scores sehen, damit ich RAG-Retrieval debuggen kann.

8. Als Entwickler möchte ich den Embedding-Status pro Agent sehen (Anzahl Chunks, letztes Update), damit ich einen schnellen Überblick bekomme.

9. Als Entwickler möchte ich Lead-Section-Daten einsehen können, damit ich prüfen kann was die Synthesizer-Agents gespeichert haben.

10. Als Entwickler möchte ich den Confidence-Score und Sources pro Section sehen, damit ich die Qualität bewerten kann.

11. Als Entwickler möchte ich nach chunkType filtern können (tech_stack, performance, etc.), damit ich spezifische Datentypen isolieren kann.

12. Als Entwickler möchte ich die JSON-Metadaten eines Chunks formatiert anzeigen können, damit ich alle Details sehen kann.

13. Als Power-User möchte ich verstehen welche Informationen zum Lead gespeichert sind, damit ich informierte Entscheidungen treffen kann.

14. Als Entwickler möchte ich Embeddings zwischen verschiedenen Leads vergleichen können, damit ich Konsistenz prüfen kann.

15. Als Entwickler möchte ich die Seite über die Lead-Navigation erreichen können, damit sie in den bestehenden Workflow integriert ist.

## Implementation Decisions

### Module-Struktur

1. **RAG Stats Service** (neues Modul)
   - Funktion: `getRAGStats(rfpId/leadId)`
   - Output: Aggregierte Statistiken (Chunk-Counts pro Agent, pro Type, Total Tokens)
   - Nutzt bestehende `getEmbeddingStatus()` als Basis

2. **RAG Data Query Service** (Erweiterung bestehend)
   - Erweiterte Funktionen für Pagination, Filtering, Search
   - `getChunksByAgent(rfpId, agentName, options: { limit, offset, search })`
   - `getRawChunks(rfpId, options: { limit, offset, search })`
   - `getSectionData(leadId, options: { sectionId? })`

3. **RAG Data Page** (neue Route)
   - Route: `/leads/[id]/rag-data`
   - Server Component mit parallelem Data Fetching
   - Tab-basierte Navigation (Overview, Agents, Raw Chunks, Sections, Query Tester)

4. **RAG Data Components** (neue Client Components)
   - `RAGStatsCard`: Dashboard-Übersicht mit Statistiken
   - `ChunkBrowser`: Durchsuchbare, paginierte Chunk-Liste
   - `ChunkDetailDialog`: Modal für Chunk-Details (Content, Metadata, Embedding-Preview)
   - `SimilarityTester`: Query-Input mit Live-Results

### Technische Entscheidungen

- **Keine Embedding-Visualisierung**: Embeddings (3072 Dimensionen) werden nicht visualisiert, nur deren Existenz und Statistiken
- **Pagination**: Max 50 Chunks pro Seite (Performance)
- **Search**: Client-seitige Textsuche in geladenen Chunks (keine Embedding-basierte Suche in dieser View)
- **Similarity-Tester**: Nutzt bestehende `queryRAG()` mit konfigurierbarem Threshold

### Navigation-Integration

- Neuer Eintrag in `LeadSidebarRight` unter "Intelligence" Sektion
- Icon: `Database` (bereits importiert)
- Label: "RAG Data"
- Route: `/leads/${leadId}/rag-data`

### Datenbank-Queries

- Nutzt bestehende Tabellen ohne Schema-Änderungen
- Aggregations-Queries für Stats
- Indexed Queries auf `rfp_chunk_idx` und `rfp_agent_idx`

## Testing Decisions

### Was macht einen guten Test aus

Tests prüfen externes Verhalten, nicht Implementierungsdetails:

- Prüft ob Stats korrekt aggregiert werden (nicht wie)
- Prüft ob Pagination funktioniert (nicht die SQL-Query)
- Prüft ob Filter richtig angewendet werden

### Zu testende Module

1. **RAG Stats Service** (Unit Tests)
   - Mock: Drizzle DB
   - Tests: Stats-Aggregation, Edge Cases (keine Daten)
   - Prior Art: Bestehende Service-Tests unter `/lib/**/*.test.ts`

2. **RAG Data Query Service** (Unit Tests)
   - Mock: Drizzle DB
   - Tests: Pagination, Filtering, Search
   - Prior Art: Bestehende Service-Tests

3. **RAG Data Page** (Integration Test optional)
   - Mock: Services
   - Tests: Korrekte Darstellung der Tabs
   - Prior Art: Bestehende Page-Tests (falls vorhanden)

### Test Coverage Target

- Minimum 80% für neue Service-Module
- Component-Tests optional (manuelle Visual Verification via d3k)

## Out of Scope

1. **Embedding-Editierung**: Kein CRUD für Embeddings (nur Read)
2. **Embedding-Visualisierung**: Keine t-SNE/UMAP Visualisierung der Vektoren
3. **Embedding-Deletion**: Keine Möglichkeit einzelne Chunks zu löschen
4. **Re-Embedding**: Keine Möglichkeit Embeddings neu zu generieren
5. **Cross-Lead-Comparison**: Keine Vergleichsansicht zwischen mehreren Leads
6. **Export-Funktion**: Kein CSV/JSON Export der RAG-Daten
7. **Admin-Ansicht**: Keine globale Ansicht aller RAG-Daten über alle Leads

## Further Notes

### Bestehende Services die genutzt werden

- `getEmbeddingStatus()` aus `/lib/rag/retrieval-service.ts`
- `queryRAG()` aus `/lib/rag/retrieval-service.ts`
- `queryRawChunks()` aus `/lib/rag/raw-retrieval-service.ts`

### Performance-Überlegungen

- Embeddings (JSON Arrays mit 3072 Floats) werden NICHT an Client gesendet
- Nur Content, Metadata und Similarity-Scores werden übertragen
- Lazy Loading für Chunk-Details

### UI-Konsistenz

- Nutzt bestehende ShadCN Components (Card, Table, Tabs, Dialog, Input, Badge)
- Folgt bestehendem Lead-Detail Design-Pattern
- Responsive Design (Mobile: Tabs stacken vertikal)
