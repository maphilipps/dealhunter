# DealHunter Startup Guide

Vollständige Anleitung zum Einrichten und Betreiben von DealHunter.

## Inhaltsverzeichnis

- [Lokale Entwicklung](#lokale-entwicklung)
- [Production Server Setup](#production-server-setup)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [Monitoring & Wartung](#monitoring--wartung)

---

## Lokale Entwicklung

### Voraussetzungen

- Node.js 20+
- Docker (für PostgreSQL + Redis)
- Git

### 1. Repository klonen

```bash
git clone https://github.com/maphilipps/dealhunter.git
cd dealhunter
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Environment einrichten

```bash
cp .env.example .env.local
```

Bearbeite `.env.local` und setze mindestens:

```bash
# Database (Docker)
DATABASE_URL=postgresql://dealhunter:dealhunter@localhost:5433/dealhunter

# Redis (Docker)
REDIS_URL=redis://:dealhunter@localhost:6379

# Auth
AUTH_SECRET=<generieren mit: openssl rand -base64 32>

# AI Hub (Pflicht)
OPENAI_API_KEY=<dein-adesso-ai-hub-key>
OPENAI_BASE_URL=https://adesso-ai-hub.3asabc.de/v1

# Optional
GEMINI_API_KEY=<für schnelle Agents>
EXA_API_KEY=<für Web-Recherche>
```

### 4. Infrastruktur starten

```bash
# PostgreSQL + Redis via Docker
docker compose up -d postgres redis
```

### 5. Datenbank initialisieren

```bash
# Schema anwenden
npm run db:push

# Seed-Daten laden (Business Units, Technologien, Admin-User)
npm run db:seed
```

### 6. Development Server starten

```bash
npm run dev
```

App läuft unter: http://localhost:3000

### 7. Worker starten (optional)

Für Background Jobs (Deep Scans):

```bash
# In separatem Terminal
npm run worker
```

### Testbenutzer

| E-Mail            | Passwort   | Rolle |
| ----------------- | ---------- | ----- |
| `admin@adesso.de` | `admin123` | Admin |

---

## Production Server Setup

### Server-Voraussetzungen

- Ubuntu 22.04+ oder Debian 12+
- Node.js 20+ (via nvm empfohlen)
- PostgreSQL 16 mit pgvector
- Redis 7+
- PM2 (Process Manager)
- Nginx (Reverse Proxy)

### 1. System vorbereiten

```bash
# Als root
apt update && apt upgrade -y
apt install -y git curl nginx certbot python3-certbot-nginx

# Node.js via nvm installieren
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# PM2 global installieren
npm install -g pm2
```

### 2. PostgreSQL 16 + pgvector installieren

```bash
# PostgreSQL Repo hinzufügen
sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update

# PostgreSQL 16 installieren
sudo apt install -y postgresql-16 postgresql-16-pgvector

# Datenbank erstellen
sudo -u postgres psql << EOF
CREATE USER dealhunter WITH PASSWORD 'sicheres-passwort';
CREATE DATABASE dealhunter OWNER dealhunter;
\c dealhunter
CREATE EXTENSION IF NOT EXISTS vector;
EOF
```

### 3. Redis installieren

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server

# Optional: Passwort setzen in /etc/redis/redis.conf
# requirepass dein-redis-passwort
```

### 4. Anwendung deployen

```bash
# Verzeichnis erstellen
sudo mkdir -p /var/www/dealhunter
sudo chown $USER:$USER /var/www/dealhunter

# Code klonen
cd /var/www
git clone https://github.com/maphilipps/dealhunter.git
cd dealhunter

# Dependencies installieren
npm ci

# Production Environment erstellen
cp .env.example .env.production
```

### 5. Environment konfigurieren

Bearbeite `/var/www/dealhunter/.env.production`:

```bash
# Database
DATABASE_URL=postgresql://dealhunter:sicheres-passwort@localhost:5432/dealhunter

# Redis
REDIS_URL=redis://localhost:6379

# Auth
AUTH_SECRET=<openssl rand -base64 32>
AUTH_TRUST_HOST=true

# URLs
NEXTAUTH_URL=https://dealhunter.example.com
NEXT_PUBLIC_APP_URL=https://dealhunter.example.com

# AI Hub
OPENAI_API_KEY=<dein-key>
OPENAI_BASE_URL=https://adesso-ai-hub.3asabc.de/v1

# Optional
GEMINI_API_KEY=<key>
EXA_API_KEY=<key>

# Sentry (optional)
SENTRY_DSN=<dein-sentry-dsn>
```

### 6. Datenbank initialisieren

```bash
npx dotenv -e .env.production -- npm run db:push
npx dotenv -e .env.production -- npm run db:seed
```

### 7. Build erstellen

```bash
npm run build
```

### 8. PM2 Services starten

```bash
# Next.js App (Standalone)
pm2 start .next/standalone/server.js --name dealhunter \
  --node-args="--env-file=/var/www/dealhunter/.env.production"

# Worker
pm2 start npm --name dealhunter-worker -- run worker

# PM2 beim Systemstart aktivieren
pm2 save
pm2 startup
```

### 9. Nginx konfigurieren

Erstelle `/etc/nginx/sites-available/dealhunter`:

```nginx
server {
    listen 80;
    server_name dealhunter.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts für lange AI-Requests
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Aktivieren und SSL einrichten:

```bash
sudo ln -s /etc/nginx/sites-available/dealhunter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL mit Let's Encrypt
sudo certbot --nginx -d dealhunter.example.com
```

---

## GitHub Actions CI/CD

### Funktionsweise

Bei jedem Push auf `main`:

1. GitHub Actions baut die App
2. Build wird via rsync auf den Server übertragen
3. PM2 Services werden neu gestartet

### 1. Deploy-User auf Server erstellen

```bash
# Als root auf dem Server
sudo useradd -m -s /bin/bash deploy
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh

# SSH Key generieren
sudo -u deploy ssh-keygen -t ed25519 -f /home/deploy/.ssh/id_ed25519 -N '' -C 'github-actions-deploy'

# Public Key zu authorized_keys
sudo cat /home/deploy/.ssh/id_ed25519.pub >> /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh

# Berechtigungen für Deployment-Verzeichnisse
sudo chown -R deploy:deploy /var/www/dealhunter-standalone
sudo chown -R deploy:deploy /var/www/dealhunter

# PM2 sudo-Rechte ohne Passwort
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/pm2" | sudo tee /etc/sudoers.d/deploy-pm2
```

### 2. GitHub Secret einrichten

Private Key anzeigen und kopieren:

```bash
sudo cat /home/deploy/.ssh/id_ed25519
```

In GitHub Repository:

1. Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `SSH_PRIVATE_KEY`
4. Value: Gesamten Private Key einfügen (inkl. BEGIN/END)

### 3. Workflow-Datei

Die Datei `.github/workflows/deploy.yml` ist bereits konfiguriert:

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main
  workflow_dispatch: # Manueller Trigger

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install & Build
        run: |
          npm ci
          npm run build

      - name: Deploy via rsync
        run: |
          # SSH Setup
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H <server-ip> >> ~/.ssh/known_hosts

          # Transfer build
          rsync -avz --delete \
            -e "ssh -i ~/.ssh/deploy_key" \
            .next/standalone/ \
            deploy@<server-ip>:/var/www/dealhunter-standalone/

      - name: Restart services
        run: |
          ssh -i ~/.ssh/deploy_key deploy@<server-ip> "sudo pm2 restart dealhunter dealhunter-worker"
```

### Manuelles Deployment triggern

```bash
gh workflow run deploy.yml
```

---

## Monitoring & Wartung

### PM2 Befehle

```bash
# Status anzeigen
pm2 list
pm2 status

# Logs anzeigen
pm2 logs dealhunter
pm2 logs dealhunter-worker

# Neustart
pm2 restart dealhunter
pm2 restart dealhunter-worker

# Monitoring
pm2 monit
```

### Datenbank-Backup

```bash
# Backup erstellen
pg_dump -U dealhunter -h localhost dealhunter > backup_$(date +%Y%m%d).sql

# Backup komprimiert
pg_dump -U dealhunter -h localhost dealhunter | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Logs prüfen

```bash
# PM2 Logs
pm2 logs --lines 100

# Nginx Logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PostgreSQL Logs
tail -f /var/log/postgresql/postgresql-16-main.log
```

### Sentry (Error Tracking)

Falls konfiguriert, werden Fehler automatisch an Sentry gesendet:

- Client-Errors: Session Replays verfügbar
- Server-Errors: Stack Traces und Context

---

## Checkliste für neuen Server

- [ ] Node.js 20+ installiert
- [ ] PostgreSQL 16 + pgvector installiert
- [ ] Redis installiert
- [ ] PM2 installiert
- [ ] Nginx installiert
- [ ] SSL-Zertifikat eingerichtet
- [ ] `.env.production` konfiguriert
- [ ] Datenbank initialisiert (`db:push`, `db:seed`)
- [ ] PM2 Services gestartet
- [ ] Deploy-User für GitHub Actions erstellt
- [ ] GitHub Secret `SSH_PRIVATE_KEY` gesetzt
- [ ] Erster Deployment-Test erfolgreich

---

## Support

- **Lokale Probleme:** Prüfe `.env.local` und Docker-Container
- **Server-Probleme:** `pm2 logs` und `/var/log/nginx/error.log`
- **CI/CD-Probleme:** GitHub Actions Logs prüfen
- **Datenbank:** Drizzle Studio: `npm run db:studio`
