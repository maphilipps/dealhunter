-- Umbenennung Business Lines → Business Units

-- 1. Tabelle umbenennen
ALTER TABLE business_lines RENAME TO business_units;

-- 2. Spalten in users Tabelle umbenennen
ALTER TABLE users RENAME COLUMN business_line_id TO business_unit_id;

-- 3. Spalten in bid_opportunities Tabelle umbenennen
ALTER TABLE bid_opportunities RENAME COLUMN assigned_business_line_id TO assigned_business_unit_id;

-- 4. Spalten in technologies Tabelle umbenennen
ALTER TABLE technologies RENAME COLUMN business_line_id TO business_unit_id;

-- 5. Spalten in employees Tabelle umbenennen
ALTER TABLE employees RENAME COLUMN business_line_id TO business_unit_id;

-- 6. Spalten in quick_scans Tabelle umbenennen
ALTER TABLE quick_scans RENAME COLUMN recommended_business_line TO recommended_business_unit;
