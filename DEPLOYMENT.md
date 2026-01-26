# DealHunter Production Deployment Guide

Anleitung für das Deployment von DealHunter auf einem lokalen Server mit Docker.

## Voraussetzungen

- Docker & Docker Compose installiert
- Mindestens 4 GB RAM
- Mindestens 20 GB freier Festplattenspeicher
- Git installiert
- Zugriff auf den Server (SSH)

## Schnellstart

### 1. Repository klonen

```bash
git clone <repository-url> dealhunter
cd dealhunter
```

### 2. Environment-Variablen konfigurieren

```bash
# Kopiere das Template
cp .env.production.example .env.production

# Bearbeite die Datei mit einem Editor
nano .env.production
```

**Wichtig:** Folgende Werte MÜSSEN angepasst werden:
- `POSTGRES_PASSWORD` - Sicheres Passwort für PostgreSQL
- `REDIS_PASSWORD` - Sicheres Passwort für Redis
- `NEXTAUTH_SECRET` - Generiere mit: `openssl rand -base64 32`
- `ANTHROPIC_API_KEY` - Dein Anthropic API Key
- `NEXTAUTH_URL` - Deine Domain (z.B. https://dealhunter.example.com)
- `NEXT_PUBLIC_APP_URL` - Deine Domain

### 3. Deployment starten

```bash
# Erste Deployment
./deploy.sh start

# Warte bis alle Services laufen
./deploy.sh status

# Führe Datenbank-Migration aus
./deploy.sh migrate
```

### 4. Überprüfung

Öffne im Browser: `http://localhost:3000` oder deine konfigurierte Domain.

## Verfügbare Befehle

```bash
./deploy.sh start      # Startet alle Services
./deploy.sh stop       # Stoppt alle Services
./deploy.sh restart    # Neustart aller Services
./deploy.sh rebuild    # Rebuild nach Code-Änderungen
./deploy.sh logs       # Zeigt Live-Logs
./deploy.sh status     # Zeigt Status aller Services
./deploy.sh migrate    # Führt DB-Migrationen aus
./deploy.sh help       # Zeigt Hilfe
```

## Services

Die Docker-Compose-Konfiguration startet folgende Services:

1. **PostgreSQL** (Port 5432)
   - Datenbank mit pgvector Extension
   - Persistente Daten in Volume `pgdata_prod`

2. **Redis** (Port 6379)
   - Job Queue für BullMQ
   - Persistente Daten in Volume `redis_data_prod`

3. **Next.js App** (Port 3000)
   - Hauptanwendung
   - Health Check: `/api/health`

4. **BullMQ Workers** (3 Container)
   - `worker-prequal`: Pre-Qualification Processing
   - `worker-quickscan`: Quick Scan Jobs
   - `worker-deepscan`: Deep Scan Jobs

## Updates deployen

### Code-Updates

```bash
# Pull neuesten Code
git pull origin main

# Rebuild und Restart
./deploy.sh rebuild

# Optional: Migrations ausführen
./deploy.sh migrate
```

### Nur Container-Restart (ohne Rebuild)

```bash
./deploy.sh restart
```

## Monitoring

### Logs ansehen

```bash
# Alle Services
./deploy.sh logs

# Nur App
docker compose -f docker-compose.prod.yml logs -f app

# Nur Worker
docker compose -f docker-compose.prod.yml logs -f worker-prequal
docker compose -f docker-compose.prod.yml logs -f worker-quickscan
docker compose -f docker-compose.prod.yml logs -f worker-deepscan

# Nur Datenbank
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Service-Status prüfen

```bash
./deploy.sh status
```

### Ressourcen-Nutzung

```bash
docker stats
```

## Backup & Restore

### Datenbank-Backup

```bash
# Backup erstellen
docker compose -f docker-compose.prod.yml exec postgres pg_dump \
  -U dealhunter dealhunter > backup_$(date +%Y%m%d_%H%M%S).sql

# Mit Kompression
docker compose -f docker-compose.prod.yml exec postgres pg_dump \
  -U dealhunter dealhunter | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Datenbank-Restore

```bash
# Aus unkomprimiertem Backup
cat backup_20240126_120000.sql | docker compose -f docker-compose.prod.yml \
  exec -T postgres psql -U dealhunter dealhunter

# Aus komprimiertem Backup
gunzip -c backup_20240126_120000.sql.gz | docker compose -f docker-compose.prod.yml \
  exec -T postgres psql -U dealhunter dealhunter
```

### Volumes-Backup

```bash
# Stoppe Services
./deploy.sh stop

# Backup der Volumes
docker run --rm -v dealhunter_pgdata_prod:/data -v $(pwd):/backup \
  alpine tar czf /backup/pgdata_backup_$(date +%Y%m%d).tar.gz /data

# Starte Services wieder
./deploy.sh start
```

## Troubleshooting

### Services starten nicht

```bash
# Prüfe Logs
./deploy.sh logs

# Prüfe .env.production
cat .env.production

# Prüfe Docker-Status
docker ps -a
```

### Datenbank-Verbindungsfehler

```bash
# Prüfe ob PostgreSQL läuft
docker compose -f docker-compose.prod.yml ps postgres

# Prüfe Logs
docker compose -f docker-compose.prod.yml logs postgres

# Teste Verbindung
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U dealhunter -d dealhunter -c "SELECT version();"
```

### Worker-Probleme

```bash
# Prüfe Worker-Logs
docker compose -f docker-compose.prod.yml logs worker-prequal
docker compose -f docker-compose.prod.yml logs worker-quickscan
docker compose -f docker-compose.prod.yml logs worker-deepscan

# Restart einzelner Worker
docker compose -f docker-compose.prod.yml restart worker-prequal
```

### App startet nicht

```bash
# Prüfe Build-Logs
docker compose -f docker-compose.prod.yml logs app

# Rebuild mit verbose Output
docker compose -f docker-compose.prod.yml up --build app

# Prüfe Health Check
curl http://localhost:3000/api/health
```

## Sicherheit

### Empfehlungen

1. **Starke Passwörter verwenden**
   - PostgreSQL Password
   - Redis Password
   - NextAuth Secret

2. **Firewall konfigurieren**
   ```bash
   # Nur notwendige Ports öffnen
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

3. **Reverse Proxy einrichten** (z.B. Nginx)
   - SSL/TLS-Verschlüsselung
   - Rate Limiting
   - CORS-Konfiguration

4. **Regelmäßige Updates**
   ```bash
   # Docker Images aktualisieren
   docker compose -f docker-compose.prod.yml pull
   ./deploy.sh rebuild
   ```

5. **Regelmäßige Backups**
   - Tägliche Datenbank-Backups
   - Volume-Backups
   - Off-site Backup-Kopien

## Nginx Reverse Proxy (Optional)

Beispiel-Konfiguration für Nginx mit SSL:

```nginx
server {
    listen 80;
    server_name dealhunter.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dealhunter.example.com;

    ssl_certificate /etc/ssl/certs/dealhunter.crt;
    ssl_certificate_key /etc/ssl/private/dealhunter.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Performance-Optimierung

### Worker skalieren

Passe in `docker-compose.prod.yml` an:

```yaml
worker-quickscan:
  deploy:
    replicas: 3  # Mehrere Worker-Instanzen
```

### PostgreSQL optimieren

Füge in `docker-compose.prod.yml` hinzu:

```yaml
postgres:
  command: postgres -c shared_buffers=256MB -c max_connections=200
```

## Support

Bei Problemen:
1. Prüfe die Logs: `./deploy.sh logs`
2. Prüfe den Status: `./deploy.sh status`
3. Dokumentation lesen
4. GitHub Issues erstellen
