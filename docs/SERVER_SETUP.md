# Server Setup für leads.adesso-dx-phpxcom.de

## Übersicht

- **Server IP**: 95.216.208.185
- **Neue Domain**: leads.adesso-dx-phpxcom.de
- **App läuft auf**: Port 3000 (PM2)
- **Reverse Proxy**: Caddy (automatisches SSL)

---

## 1. DNS-Einstellungen

### Bei deinem DNS-Provider (z.B. Cloudflare, Hetzner DNS)

Erstelle einen A-Record:

```
Type: A
Name: leads.adesso-dx-phpxcom.de
Value: 95.216.208.185
TTL: Auto / 300
```

**Prüfen:**

```bash
# Warte 2-5 Minuten, dann:
dig leads.adesso-dx-phpxcom.de +short
# Sollte zeigen: 95.216.208.185
```

---

## 2. Auf den Server connecten

```bash
ssh deploy@95.216.208.185
```

Falls SSH-Key erforderlich:

```bash
ssh -i ~/.ssh/your_deploy_key deploy@95.216.208.185
```

---

## 3. Caddy installieren (falls noch nicht vorhanden)

```bash
# Prüfen ob Caddy bereits installiert ist
caddy version

# Falls nicht installiert:
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

---

## 4. Caddy konfigurieren

### Caddyfile erstellen/bearbeiten:

```bash
sudo nano /etc/caddy/Caddyfile
```

### Inhalt der Caddyfile:

```caddy
# DealHunter / Leads App
leads.adesso-dx-phpxcom.de {
    # Automatisches HTTPS via Let's Encrypt

    # Reverse Proxy zu Next.js App (Port 3000)
    reverse_proxy localhost:3000 {
        # Preserve Host header
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }

    # Logs
    log {
        output file /var/log/caddy/leads.log {
            roll_size 100mb
            roll_keep 5
        }
    }

    # Security Headers
    header {
        # Enable HSTS
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"

        # Prevent MIME sniffing
        X-Content-Type-Options "nosniff"

        # Enable XSS protection
        X-XSS-Protection "1; mode=block"

        # Referrer policy
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Compression
    encode gzip zstd
}
```

**Speichern:** `Ctrl + O`, `Enter`, `Ctrl + X`

---

## 5. Caddy neustarten

```bash
# Konfiguration testen
sudo caddy validate --config /etc/caddy/Caddyfile

# Caddy neu laden (holt automatisch SSL-Zertifikat!)
sudo systemctl reload caddy

# Status prüfen
sudo systemctl status caddy

# Logs prüfen
sudo journalctl -u caddy -f
```

**Wichtig:** Caddy holt automatisch ein Let's Encrypt SSL-Zertifikat für `leads.adesso-dx-phpxcom.de`!

---

## 6. Umgebungsvariablen aktualisieren

```bash
cd /var/www/dealhunter
sudo nano .env.production
```

**Aktualisiere:**

```env
# App URL
NEXT_PUBLIC_APP_URL=https://leads.adesso-dx-phpxcom.de
NEXTAUTH_URL=https://leads.adesso-dx-phpxcom.de

# Rest bleibt gleich
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ANTHROPIC_API_KEY=...
NEXTAUTH_SECRET=...
```

**Speichern:** `Ctrl + O`, `Enter`, `Ctrl + X`

---

## 7. App neu bauen und deployen

```bash
cd /var/www/dealhunter

# Code pullen
git pull origin main

# Dependencies installieren
npm ci

# Build mit neuer URL
npm run build

# PM2 neustarten
sudo pm2 restart dealhunter
sudo pm2 restart dealhunter-worker

# Status prüfen
sudo pm2 list
sudo pm2 logs dealhunter --lines 50
```

---

## 8. GitHub Repository Settings aktualisieren (optional)

Falls du GitHub Pages oder andere GitHub-Features nutzt:

1. Gehe zu: `https://github.com/maphilipps/dealhunter/settings`
2. **Pages** (falls aktiviert):
   - Custom Domain: `leads.adesso-dx-phpxcom.de`
3. **Secrets** (Environment Variables):
   - Prüfe ob `NEXT_PUBLIC_APP_URL` in GitHub Actions aktualisiert werden muss

---

## 9. Testen

### SSL-Zertifikat prüfen:

```bash
curl -I https://leads.adesso-dx-phpxcom.de
```

### App im Browser öffnen:

```
https://leads.adesso-dx-phpxcom.de
```

### SSL-Test:

```
https://www.ssllabs.com/ssltest/analyze.html?d=leads.adesso-dx-phpxcom.de
```

---

## 10. Firewall-Regeln (falls nötig)

```bash
# Port 80 (HTTP - für Let's Encrypt Challenge)
sudo ufw allow 80/tcp

# Port 443 (HTTPS)
sudo ufw allow 443/tcp

# Status prüfen
sudo ufw status
```

---

## Troubleshooting

### SSL-Zertifikat wird nicht ausgestellt?

```bash
# Caddy Logs prüfen
sudo journalctl -u caddy -n 100 --no-pager

# Caddy im Vordergrund starten (für Debug)
sudo systemctl stop caddy
sudo caddy run --config /etc/caddy/Caddyfile
```

**Häufige Probleme:**

- DNS noch nicht propagiert → Warte 10-15 Minuten
- Port 80/443 geblockt → Firewall prüfen
- Domain zeigt auf falsche IP → DNS-Records prüfen

### App läuft nicht?

```bash
# PM2 Status
sudo pm2 list

# Logs anschauen
sudo pm2 logs dealhunter

# App manuell starten
cd /var/www/dealhunter
npm start
```

### Caddy läuft nicht?

```bash
# Status prüfen
sudo systemctl status caddy

# Neustarten
sudo systemctl restart caddy

# Aktivieren (auto-start)
sudo systemctl enable caddy
```

---

## Schnell-Zusammenfassung

```bash
# 1. DNS setzen (A-Record: leads.adesso-dx-phpxcom.de → 95.216.208.185)

# 2. Auf Server connecten
ssh deploy@95.216.208.185

# 3. Caddy konfigurieren
sudo nano /etc/caddy/Caddyfile
# (Inhalt von oben einfügen)

# 4. Caddy neuladen
sudo systemctl reload caddy

# 5. ENV-Variablen aktualisieren
cd /var/www/dealhunter
sudo nano .env.production
# NEXT_PUBLIC_APP_URL=https://leads.adesso-dx-phpxcom.de
# NEXTAUTH_URL=https://leads.adesso-dx-phpxcom.de

# 6. App neu bauen
git pull origin main
npm ci
npm run build
sudo pm2 restart dealhunter

# 7. Testen
curl -I https://leads.adesso-dx-phpxcom.de
```

---

## Erfolgskriterien ✅

- [ ] DNS zeigt auf richtige IP (95.216.208.185)
- [ ] Caddy läuft (`sudo systemctl status caddy`)
- [ ] SSL-Zertifikat wird automatisch geholt
- [ ] `https://leads.adesso-dx-phpxcom.de` öffnet die App
- [ ] Login funktioniert
- [ ] Keine Mixed-Content-Warnings im Browser

---

## Support

Bei Problemen:

1. Prüfe Caddy Logs: `sudo journalctl -u caddy -f`
2. Prüfe App Logs: `sudo pm2 logs dealhunter`
3. Prüfe DNS: `dig leads.adesso-dx-phpxcom.de`
4. Prüfe SSL: `curl -I https://leads.adesso-dx-phpxcom.de`
