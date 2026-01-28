# URL-Umstellung: dealhunter.adessocms.de → leads.adesso-dx-phpxcom.de

Diese Dokumentation beschreibt die Schritte zur URL-Umstellung von der alten zur neuen Domain.

## 1. Environment-Variablen aktualisieren

In `.env.production`:

```bash
# Alt
NEXTAUTH_URL=https://dealhunter.adessocms.de
NEXT_PUBLIC_APP_URL=https://dealhunter.adessocms.de

# Neu
NEXTAUTH_URL=https://leads.adesso-dx-phpxcom.de
NEXT_PUBLIC_APP_URL=https://leads.adesso-dx-phpxcom.de
```

## 2. DNS-Konfiguration

Stelle sicher, dass die neue Domain `leads.adesso-dx-phpxcom.de` auf den Server zeigt:

```bash
# A-Record (oder AAAA für IPv6)
leads.adesso-dx-phpxcom.de  A  <SERVER-IP>
```

## 3. Nginx/Reverse Proxy aktualisieren

Falls Nginx als Reverse Proxy verwendet wird:

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name leads.adesso-dx-phpxcom.de;

    # SSL-Zertifikat (z.B. Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/leads.adesso-dx-phpxcom.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/leads.adesso-dx-phpxcom.de/privkey.pem;

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

# Optional: Redirect alte Domain zur neuen
server {
    listen 80;
    listen 443 ssl;
    server_name dealhunter.adessocms.de;

    ssl_certificate /etc/letsencrypt/live/dealhunter.adessocms.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dealhunter.adessocms.de/privkey.pem;

    return 301 https://leads.adesso-dx-phpxcom.de$request_uri;
}
```

## 4. SSL-Zertifikat

Neues SSL-Zertifikat für die neue Domain generieren:

```bash
# Mit Certbot (Let's Encrypt)
sudo certbot certonly --nginx -d leads.adesso-dx-phpxcom.de
```

## 5. CORS-Konfiguration (falls vorhanden)

Falls CORS-Einstellungen existieren, die neue Domain hinzufügen:

```typescript
// In API-Routes oder Middleware
const allowedOrigins = [
  'https://leads.adesso-dx-phpxcom.de',
  // Temporär: alte Domain während der Übergangsphase
  'https://dealhunter.adessocms.de',
];
```

## 6. OAuth/Auth Callbacks

Falls OAuth-Provider verwendet werden (Google, GitHub, etc.), Callback-URLs aktualisieren:

- **Alte Callback-URL**: `https://dealhunter.adessocms.de/api/auth/callback/<provider>`
- **Neue Callback-URL**: `https://leads.adesso-dx-phpxcom.de/api/auth/callback/<provider>`

## 7. Deployment-Schritte

```bash
# 1. Environment aktualisieren
cp .env.production .env.production.backup
nano .env.production  # URLs ändern

# 2. DNS-Änderung durchführen (Propagation dauert bis zu 48h)

# 3. SSL-Zertifikat für neue Domain
sudo certbot certonly --nginx -d leads.adesso-dx-phpxcom.de

# 4. Nginx-Konfiguration aktualisieren und neustarten
sudo nginx -t
sudo systemctl reload nginx

# 5. Anwendung neustarten
./deploy.sh restart

# 6. Testen
curl -I https://leads.adesso-dx-phpxcom.de
```

## 8. Verifikation

Nach der Umstellung prüfen:

- [ ] Neue URL erreichbar: `https://leads.adesso-dx-phpxcom.de`
- [ ] SSL-Zertifikat gültig
- [ ] Login funktioniert
- [ ] API-Endpunkte erreichbar
- [ ] Keine CORS-Fehler in Browser Console
- [ ] Redirect von alter URL funktioniert (falls eingerichtet)

## 9. Rollback-Plan

Falls Probleme auftreten:

```bash
# Environment zurücksetzen
cp .env.production.backup .env.production

# Anwendung neustarten
./deploy.sh restart
```

## Hinweise

- **DNS-Propagation**: Kann bis zu 48 Stunden dauern
- **Browser-Cache**: Nutzer müssen ggf. Cache leeren
- **Bookmarks**: Nutzer auf neue URL hinweisen
- **Übergangsphase**: Alte URL kann temporär weiter funktionieren mit Redirect
