# Quick Start: Risolvere Autenticazione Strava

## ⚡ In 5 Minuti

### Problema
```
POST http://localhost:3001/webhook/strava/subscribe
→ Error: "Bad Request" - callback url non valido
```

### Ragione
Strava non può raggiungere `http://localhost:3001` perché è dentro un container Docker.

### Soluzione
Esponi il backend al mondo con **ngrok**:

---

## 🔧 Setup (Opzione 1: Automatico)

```bash
# Assicurati che Docker sia avviato
docker-compose down  # Ferma se era già in esecuzione

# Dai permessi allo script
chmod +x setup-ngrok.sh

# Esegui (ti guiderà step-by-step)
./setup-ngrok.sh
```

Finito! ✅ L'applicazione è pronta su http://localhost:8080

---

## 🔧 Setup (Opzione 2: Manuale)

### 1. Installa ngrok
```bash
brew install ngrok
# oppure scarica da https://ngrok.com/download
```

### 2. Avvia ngrok (nuovo terminale)
```bash
ngrok http 3001
```
Vedrai output simile a:
```
Forwarding    https://abc123def456.ngrok-free.dev -> http://localhost:3001
```
Copia l'URL `https://abc123def456.ngrok-free.dev`

### 3. Configura le variabili
Crea file `.env.local` nella root del progetto:
```bash
echo "BACKEND_URL=https://abc123def456.ngrok-free.dev" > .env.local
echo "FRONTEND_URL=http://localhost:8080" >> .env.local
echo "STRAVA_REDIRECT_URI=https://abc123def456.ngrok-free.dev/auth/strava/callback" >> .env.local
```

In Strava (https://www.strava.com/settings/api), imposta anche:
- Authorization Callback Domain: `abc123def456.ngrok-free.dev`

### 4. Avvia Docker Compose
```bash
source .env.local
docker compose up -d
```

Aspetta 30 secondi perché i container si avviino.

### 5. Registra la webhook
```bash
curl -X POST http://localhost:3001/webhook/strava/subscribe
```

Se vedi un JSON con `"id": ...` → ✅ Funziona!
Se vedi `"Bad Request"` → Controlla che ngrok stia girando e l'URL sia corretto.

Per debug OAuth rapido:
```bash
curl -sI http://localhost:8080/api/auth/strava | grep -i '^location:'
```
Deve contenere `redirect_uri=https://...ngrok-free.dev/auth/strava/callback`.

---

## 📱 Test Completo

1. Apri il browser: http://localhost:8080
2. Clicca su **"Login con Strava"**
3. Autorizza l'app
4. Dovresti tornare all'app loggato ✅

---

## 🆘 Checklist Troubleshooting

- [ ] ngrok è installato: `which ngrok`
- [ ] ngrok sta girando: controlla il terminale con ngrok
- [ ] `.env.local` esiste: `cat .env.local`
- [ ] Docker container sono up: `docker-compose ps`
- [ ] Backend raggiungibile: `curl https://[ngrok-url]/health`
- [ ] La webhook è registrata: controlla `docker-compose logs api | grep webhook`

---

## 📚 Documenti Completi

Per più dettagli su configurazione, produzione, e troubleshooting:
- **[STRAVA_SETUP.md](STRAVA_SETUP.md)** - Guida tecnica completa
- **[STRAVA_MIGRATION_FIX.md](STRAVA_MIGRATION_FIX.md)** - Analisi del problema e soluzioni
- **[docker-compose.yml](docker-compose.yml)** - Configurazione dei container

---

## ⏱️ Tempo Stima
- Con script automatico: **2 minuti**
- Setup manuale: **5 minuti**
- Produzione (con dominio): **10 minuti**
