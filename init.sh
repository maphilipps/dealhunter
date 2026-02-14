#!/usr/bin/env bash
set -euo pipefail

# ─── DealHunter – Lokale Entwicklungsumgebung initialisieren ─────────────────
#
# Dieses Script startet die Infrastruktur (Postgres + Redis),
# wendet alle DB-Migrationen an und seeded die Stammdaten.
#
# Voraussetzungen:
#   - Docker & Docker Compose
#   - Node.js >= 20
#   - npm
#
# Erstmaliges Setup:
#   cp .env.example .env.local   # API-Keys eintragen
#   chmod +x init.sh
#   ./init.sh
#
# Danach normal entwickeln:
#   npm run dev

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${BLUE}▸ $1${NC}"; }
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }

# ── 1. Env-Datei prüfen ─────────────────────────────────────────────────────
step "Umgebungsvariablen prüfen"

if [ ! -f .env.local ]; then
  if [ -f .env ]; then
    warn ".env.local fehlt, verwende .env"
  else
    echo "Keine .env.local gefunden. Erstelle aus .env.example..."
    cp .env.example .env.local
    warn "Bitte API-Keys in .env.local eintragen, dann erneut starten."
    exit 1
  fi
fi
ok "Env-Datei vorhanden"

# ── 2. Dependencies installieren ─────────────────────────────────────────────
step "npm install"
npm install --prefer-offline 2>&1 | tail -3
ok "Dependencies installiert"

# ── 3. Docker-Infrastruktur starten ──────────────────────────────────────────
step "Docker Compose (Postgres + Redis)"

if ! command -v docker &>/dev/null; then
  warn "Docker nicht gefunden. Bitte manuell installieren: https://docs.docker.com/get-docker/"
  exit 1
fi

docker compose up -d --wait
ok "Postgres und Redis laufen"

# ── 4. Auf Postgres warten ──────────────────────────────────────────────────
step "Warte auf PostgreSQL..."
MAX_RETRIES=30
RETRY=0
until docker compose exec -T postgres pg_isready -U dealhunter -d dealhunter &>/dev/null; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    warn "PostgreSQL ist nach ${MAX_RETRIES}s nicht bereit. Bitte 'docker compose logs postgres' prüfen."
    exit 1
  fi
  sleep 1
done
ok "PostgreSQL bereit"

# ── 5. pgvector Extension aktivieren ─────────────────────────────────────────
step "pgvector Extension"
docker compose exec -T postgres psql -U dealhunter -d dealhunter -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null
ok "pgvector aktiviert"

# ── 6. DB-Migrationen anwenden ───────────────────────────────────────────────
step "Datenbank-Migrationen"

# drizzle-kit push synchronisiert das Schema automatisch
npx drizzle-kit push 2>&1 | tail -5
ok "Schema synchronisiert"

# Zusätzliche Migrationen, die drizzle-kit push ggf. nicht abdeckt
for migration in drizzle/00*.sql; do
  filename=$(basename "$migration")
  echo "  Applying ${filename}..."
  npx dotenv -e .env.local -- psql "$DATABASE_URL" -f "$migration" 2>/dev/null || true
done
ok "Alle Migrationen angewendet"

# ── 7. Seed-Daten laden ─────────────────────────────────────────────────────
step "Stammdaten seeden (Business Units, Technologies, Features)"
npx dotenv -e .env.local -- npx tsx lib/db/seed.ts
ok "Seed abgeschlossen"

# ── 8. Zusammenfassung ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  DealHunter ist bereit!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Starten:     npm run dev"
echo "  Worker:      npm run worker"
echo "  DB Studio:   npm run db:studio"
echo ""
echo "  Postgres:    localhost:5433 (User: dealhunter)"
echo "  Redis:       localhost:6379"
echo "  App:         http://localhost:3000"
echo ""
echo "  Login:       admin@adesso.de / admin123"
echo ""
