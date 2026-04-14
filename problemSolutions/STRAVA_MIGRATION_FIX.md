# Risoluzione Autenticazione Strava - Microservizi Docker

## 🔴 Problemi Identificati

Dopo la migrazione a microservizi Docker, l'autenticazione Strava è fallita perché:

### 1. **Callback URL non raggiungibile da Strava**
- **File**: [backend/src/routes/webhook.routes.ts](backend/src/routes/webhook.routes.ts#L34)
- **Problema**: Usa `config.backendUrl` che è impostato di default a `http://localhost:3001`
- **Motivo**: Strava (servizio esterno) non può raggiungere `localhost` - le richieste arrivano dall'esterno dei container Docker
- **Errore ricevuto**: `"Bad Request"` con messaggio `"callback url"` non valido

### 2. **Redirect URI OAuth incorretto**
- **File**: [backend/src/config.ts](backend/src/config.ts#L16)
- **Problema**: `FRONTEND_URL` nel docker-compose era `http://localhost` (porta 80 di default)
- **Realtà**: Il frontend è esposto sulla porta 8080 (Nginx) o 5173 (Vite dev)
- **Impatto**: Il browser non riesce a raggiungere il callback di autenticazione

### 3. **Configurazione environment incompleta**
- **File**: [docker-compose.yml](docker-compose.yml)
- **Problema**: 
  - `BACKEND_URL` non era esplicitamente configurato nel servizio `api`
  - `FRONTEND_URL` usava un default sbagliato
  - Nessun commento su come configurare per la webhook di Strava

### 4. **URL hardcoded nel PWA cache**
- **File**: [frontend/vite.config.ts](frontend/vite.config.ts)
- **Problema**: Hardcoded `http://localhost:3001/api/*` non funziona in produzione
- **Soluzione**: Generalizzato a `/api/**` (path relativo)

---

## ✅ Soluzioni Implementate

### 1. Aggiornamento docker-compose.yml
```yaml
# Aggiunto BACKEND_URL con spiegazione chiara
BACKEND_URL: ${BACKEND_URL:-http://localhost:3001}

# Corretto FRONTEND_URL per la porta esposta
FRONTEND_URL: ${FRONTEND_URL:-http://localhost:8080}
```

### 2. Creato STRAVA_SETUP.md
Guida completa con:
- Spiegazione tecnica del problema
- Istruzioni per setup con ngrok (sviluppo locale)
- Istruzioni per produzione
- Debugging troubleshooting
- Flow dettagliato di OAuth e webhook

### 3. Creato setup-ngrok.sh
Script automatizzato che:
- Verifica installazione ngrok
- Crea `.env.local` con URL ngrok
- Avvia docker-compose
- Registra automaticamente webhook Strava
- Testa la connessione

### 4. Aggiornato backend/.env.example
File di esempio con commenti dettagliati su ogni variabile, incluso come generare URL corretti.

### 5. Corretto vite.config.ts
PWA cache config generalizzato per supportare qualsiasi URL API.

---

## 🚀 Come Usare - Sviluppo Locale con ngrok

### Opzione Rapida (Script Automatico)
```bash
chmod +x setup-ngrok.sh
./setup-ngrok.sh
```

### Opzione Manuale

1. **Avvia ngrok in un terminale**:
```bash
ngrok http 3001
# Otterrai: https://abc123def456.ngrok-free.dev
```

2. **Crea `.env.local` nella root**:
```bash
BACKEND_URL=https://abc123def456.ngrok-free.dev
FRONTEND_URL=http://localhost:8080
```

3. **Avvia docker-compose**:
```bash
source .env.local
docker-compose up
```

4. **Registra webhook Strava**:
```bash
curl -X POST http://localhost:3001/webhook/strava/subscribe
# Dovresti ricevere un ID di subscription, non un errore 400
```

5. **Accedi all'app**:
- Frontend: http://localhost:8080
- Clicca su "Login con Strava"
- Dovresti essere reindirizzato a Strava e poi tornare all'app

---

## 🏭 Per Ambienti di Produzione

Configura le variabili d'ambiente nei tuoi sistemi:
- `BACKEND_URL`: URL pubblico del backend (es: https://api.example.com)
- `FRONTEND_URL`: URL pubblico del frontend (es: https://app.example.com)

Assicurati che:
1. Il backend sia accessibile da `https://BACKEND_URL/health`
2. Strava possa contattare `https://BACKEND_URL/webhook/strava`
3. I certificati SSL/TLS siano validi

---

## 📋 File Modificati

| File | Tipo | Modifica |
|------|------|----------|
| [docker-compose.yml](docker-compose.yml) | Modifica | Aggiunti BACKEND_URL e FRONTEND_URL corretti |
| [frontend/vite.config.ts](frontend/vite.config.ts) | Modifica | Generalizzato PWA cache config |
| [backend/.env.example](backend/.env.example) | Nuovo | Template con documentazione |
| [STRAVA_SETUP.md](STRAVA_SETUP.md) | Nuovo | Guida completa troubleshooting |
| [setup-ngrok.sh](setup-ngrok.sh) | Nuovo | Script setup automatico |

---

## 🧪 Testing

Dopo il setup, verifica che tutto funzioni:

```bash
# 1. Controlla che i container siano up
docker-compose ps

# 2. Testa il frontend
curl http://localhost:8080

# 3. Testa il backend (interno)
curl http://localhost:3001/health

# 4. Testa il backend (esterno, se ngrok)
curl https://abc123def456.ngrok-free.dev/health

# 5. Verifica webhook registrata
curl http://localhost:3001/webhook/strava 

# 6. Controlla i log
docker-compose logs -f api
```

---

## 🐛 Problemi Comuni

**Q: Ancora errore "Bad Request" da Strava?**
- A: Verifica che il `BACKEND_URL` sia effettivamente raggiungibile da internet
- Test: `curl $BACKEND_URL/health` da una rete diversa

**Q: Il browser non raggiunge il callback OAuth?**
- A: Controlla che `FRONTEND_URL` corrisponda alla porta reale (8080 per Docker)

**Q: La webhook è registrata ma non riceve eventi?**
- A: Controlla che `STRAVA_WEBHOOK_VERIFY_TOKEN` nel `.env` corrisponda a quello usato

**Q: Quando depLoy in produzione, cosa configuro?**
- A: Vedi sezione "Ambienti di Produzione" sopra

---

Per ulteriori dettagli tecnici, vedi [STRAVA_SETUP.md](STRAVA_SETUP.md).
