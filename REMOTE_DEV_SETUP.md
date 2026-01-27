# Remote Development Server - Setup Abgeschlossen ✅

**Server:** 46.225.27.165 (Ubuntu 24.04.3 LTS ARM64)
**Setup-Datum:** 2026-01-27

## 🎉 Installierte Tools

| Tool | Version | Status |
|------|---------|--------|
| **Claude Code** | 2.1.20 | ✅ Installiert |
| **OpenAI Codex CLI** | 0.91.0 | ✅ Installiert |
| **AMP Code** | 0.0.1769500896 | ✅ Installiert |
| **TMUX** | 3.4 | ✅ Konfiguriert |
| **Mosh** | 1.4.0 | ✅ Installiert |
| **Node.js** | 20.20.0 | ✅ Installiert |
| **Bun** | 1.3.7 | ✅ Installiert |

## 🚀 Quick Start

### Verbindung zum Server

**Option 1: SSH mit automatischem TMUX** (Empfohlen)
```bash
ssh dev-server
```

**Option 2: Mosh (bessere Performance bei instabilen Verbindungen)**
```bash
dev-mosh
```

**Option 3: Manuell mit TMUX**
```bash
ssh -i ~/.ssh/id_rsa root@46.225.27.165
tmux attach -t development
```

### Claude Code verwenden

Der Server hat alle deine lokalen Claude Code Konfigurationen:

```bash
# Standard Claude Code
cc

# Mit adesso AI Hub
cc-aihub

# Mit GLM Provider
cc-glm

# Ohne ToolSearch (alle MCP-Tools direkt verfügbar)
cc-no-ts
```

**⚠️ Erste Verwendung:** Beim ersten Aufruf von `cc` musst du dich authentifizieren:
```bash
source ~/.bashrc
claude
# Folge dem Browser-Link für OAuth-Login
```

### OpenAI Codex CLI verwenden

```bash
codex
# Folge dem Browser-Link für ChatGPT-Login
```

**Alternative: API Key verwenden**
```bash
export OPENAI_API_KEY="sk-..."
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.bashrc
```

### AMP Code verwenden

```bash
amp
# Keine Authentifizierung erforderlich (kostenlos bis $10/Tag)
```

## 📋 TMUX Cheat Sheet

### Basis-Befehle

| Aktion | Befehl |
|--------|--------|
| **Prefix** | `Ctrl+a` (nicht Ctrl+b!) |
| Session detachen | `Ctrl+a` dann `d` |
| Config neu laden | `Ctrl+a` dann `r` |

### Panes verwalten

| Aktion | Befehl |
|--------|--------|
| Vertikaler Split | `Ctrl+a` dann `\|` |
| Horizontaler Split | `Ctrl+a` dann `-` |
| Zwischen Panes wechseln | `Ctrl+a` dann `h/j/k/l` |
| Pane vergrößern/verkleinern | `Ctrl+a` dann `H/J/K/L` (Shift) |
| Pane maximieren/minimieren | `Ctrl+a` dann `z` |
| Pane schließen | `exit` |

### Sessions verwalten

```bash
# Neue Session erstellen
tmux new-session -s mein-projekt

# An Session anhängen
tmux attach -t development

# Sessions auflisten
tmux ls

# Session umbenennen
tmux rename-session -t development neuer-name
```

## 📂 Wichtige Dateien

### Auf dem Server (46.225.27.165)

```
~/.bashrc                          # Shell-Konfiguration mit Aliasen
~/.tmux.conf                       # TMUX-Konfiguration
~/.claude/
  ├── settings.json                # Standard Claude Code Settings
  ├── settings-aihub.json          # adesso AI Hub Settings
  └── settings-glm.json            # GLM Provider Settings
~/.local/bin/
  ├── claude                       # Claude Code Binary
  └── amp                          # AMP Code Binary
~/.bun/bin/bun                     # Bun Runtime
```

### Lokal auf deinem Rechner

```
~/.ssh/config                      # SSH-Konfiguration mit dev-server Alias
~/.zshrc                           # Shell-Aliase (dev-ssh, dev-mosh)
```

## 🔧 Konfiguration

### Server-seitige Aliase (bereits eingerichtet)

```bash
# In ~/.bashrc
alias cc='claude --dangerously-skip-permissions'
alias cc-aihub='claude --dangerously-skip-permissions --settings ~/.claude/settings-aihub.json'
alias cc-glm='claude --dangerously-skip-permissions --settings ~/.claude/settings-glm.json'
alias cc-no-ts='claude --dangerously-skip-permissions --disallowedTools ToolSearch'
```

### Lokale Aliase (bereits eingerichtet)

```bash
# In ~/.zshrc
alias dev-ssh='ssh dev-server'
alias dev-mosh='mosh root@46.225.27.165 -- bash -l -c "export PATH=\"\$HOME/.local/bin:\$HOME/.bun/bin:\$PATH\" && tmux new-session -A -s development"'
```

## 🔐 Authentifizierung

### Claude Code

**Erster Start:**
```bash
ssh dev-server
source ~/.bashrc
claude
# Browser-Link öffnen und mit Claude Max/Anthropic Console einloggen
```

Die Authentifizierung wird gespeichert und muss nur einmalig durchgeführt werden.

### OpenAI Codex CLI

**Option 1: Browser-Login (Empfohlen)**
```bash
codex
# Browser-Link öffnen und mit ChatGPT-Konto einloggen
```

**Option 2: API Key**
```bash
export OPENAI_API_KEY="sk-..."
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.bashrc
```

### AMP Code

Keine Authentifizierung erforderlich - funktioniert out-of-the-box!

## 🎯 Empfohlener Workflow

### 1. Verbinden und Session starten

```bash
# Von deinem lokalen Rechner
ssh dev-server
# Oder
dev-mosh
```

Du landest automatisch in der TMUX Session "development".

### 2. Multi-Tool Setup erstellen

```bash
# In der TMUX Session:
# Pane 1: Claude Code (bereits geöffnet)
cc

# Neues Pane für Codex (Ctrl+a dann |)
codex

# Neues Pane für AMP (Ctrl+a dann -)
amp
```

### 3. Zwischen Tools wechseln

```bash
# Zwischen Panes wechseln: Ctrl+a dann h/j/k/l
# Pane maximieren: Ctrl+a dann z
# Session detachen: Ctrl+a dann d
```

### 4. Später wieder verbinden

```bash
# Von deinem lokalen Rechner
ssh dev-server
# Die TMUX Session läuft noch mit allen Tools!
```

## 🐛 Troubleshooting

### Claude Code: "Raw mode is not supported"

Dies ist normal beim Ausführen von `claude doctor` über SSH. Das Tool funktioniert dennoch normal für die eigentliche Entwicklung.

**Lösung:** Führe `claude` direkt aus, nicht `claude doctor`.

### TMUX Session nicht gefunden

```bash
# Neue Session erstellen
tmux new-session -s development

# Oder automatisch erstellen/anhängen
tmux new-session -A -s development
```

### PATH nicht gesetzt

```bash
# Shell neu laden
source ~/.bashrc

# Oder PATH manuell setzen
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
```

### Mosh-Verbindung schlägt fehl

```bash
# Fallback zu SSH
ssh dev-server

# Oder mit explizitem Key
ssh -i ~/.ssh/id_rsa root@46.225.27.165
```

### TPM Plugins installieren

Falls die TMUX Plugins (resurrect, continuum) noch nicht installiert sind:

```bash
# In TMUX Session:
# Drücke: Ctrl+a dann I (großes i)
# TPM installiert automatisch alle Plugins
```

## 🎨 TMUX Customization

Die TMUX-Konfiguration ist in `~/.tmux.conf` auf dem Server gespeichert.

**Änderungen vornehmen:**
```bash
# Auf dem Server
nano ~/.tmux.conf

# Config neu laden
# In TMUX: Ctrl+a dann r
```

## 📊 Nächste Schritte

1. **Projekte klonen:**
   ```bash
   ssh dev-server
   cd ~
   git clone <dein-repository>
   ```

2. **Development-Workflow etablieren:**
   - Hauptarbeit in TMUX Session "development"
   - Zusätzliche Sessions für Tests, Logs, Monitoring

3. **Backup-Strategie:**
   - Code in Git versionieren
   - Wichtige Configs regelmäßig sichern

## 🔗 Nützliche Links

- [Claude Code Docs](https://code.claude.com/docs)
- [OpenAI Codex CLI](https://developers.openai.com/codex/cli/)
- [AMP Code](https://ampcode.com)
- [TMUX Cheat Sheet](https://tmuxcheatsheet.com)
- [TMUX Resurrect](https://github.com/tmux-plugins/tmux-resurrect)

## 📝 Setup-Details

- **Server OS:** Ubuntu 24.04.3 LTS
- **Architektur:** ARM64 (aarch64)
- **SSH Key:** ~/.ssh/id_rsa
- **Installation durchgeführt:** 2026-01-27
- **Letzte Verifizierung:** 2026-01-27 12:41 CET

---

**Viel Erfolg mit deiner Remote-Entwicklungsumgebung! 🚀**
