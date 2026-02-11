# Nginx Configuration for Production

Diese Konfiguration optimiert das Caching für Next.js Deployments und verhindert Server Action Mismatches nach Deployments.

## Optimierungen

1. **`/_next/static/`** — Immutable Cache (1 Jahr) für gehashte Assets
2. **`/_next/data/`** — Kurzes Caching (1h) mit Revalidation
3. **HTML/API** — Kein Caching, immer frisch

## Server-Config

**Location:** `/etc/nginx/sites-available/leads`

```nginx
server {
    server_name leads.adesso-dx-phpxcom.de;

    # Next.js static assets (immutable, long cache)
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Immutable cache für hashed assets
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Next.js data fetching (revalidate)
    location /_next/data/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Kurzes Caching mit Revalidation
        add_header Cache-Control "public, max-age=3600, must-revalidate";
    }

    # Alle anderen Requests (HTML, API, etc.)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;

        # Kein Caching für HTML
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/leads.adesso-dx-phpxcom.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/leads.adesso-dx-phpxcom.de/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = leads.adesso-dx-phpxcom.de) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name leads.adesso-dx-phpxcom.de;
    return 404;
}
```

## Änderungen anwenden

```bash
# Config bearbeiten
sudo nano /etc/nginx/sites-available/leads

# Config testen
sudo nginx -t

# Nginx neu laden
sudo systemctl reload nginx
```

## Warum diese Konfiguration?

### Problem bei Deployments

Ohne optimierte Cache-Headers:

1. Browser cached alte `/_next/static/` Bundles
2. Server deployt neue Version mit neuer `BUILD_ID`
3. Browser lädt alte Bundles mit neuen Server Actions
4. **Result:** `Failed to find Server Action "x"` Fehler

### Lösung

- **Static Assets (`/_next/static/`)**: Immutable Cache, da sie gehashed sind und sich nie ändern
- **HTML/Root**: Kein Cache, damit Browser immer die neuesten Bundle-URLs bekommt
- **Data Fetching (`/_next/data/`)**: Kurzes Caching mit Revalidation für optimale Performance

## Deployment-Flow

Mit dieser Config + `pm2 reload`:

1. GitHub Action deployt neuen Build
2. PM2 macht graceful reload (Zero-Downtime)
3. Neue Requests bekommen neue HTML mit neuen Bundle-URLs
4. Browser cached die neuen Bundles immutable
5. Keine Server Action Fehler mehr! ✅
