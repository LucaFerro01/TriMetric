# Configurazione Strava con Docker Compose

## Problema

Quando l'applicazione è stata migrata a microservizi in container Docker, l'autenticazione Strava ha smesso di funzionare perché:

1. **Callback URL non raggiungibile**: Strava non può contattare `http://localhost:3001/webhook/strava` perché `localhost` non è raggiungibile da servizi esterni
2. **Redirect URI OAuth incorretto**: Il frontend URL non corrisponde alla porta effettivamente esposta
3. **Configurazione ambiente incompleta**: Le variabili `BACKEND_URL` e `FRONTEND_URL` non erano correttamente configurate per l'ambiente containerizzato

## Soluzione

### Opzione A: Sviluppo Locale con ngrok (Scelta Consigliata)

Per lo sviluppo locale, Strava ha bisogno di raggiungere il backend tramite un URL pubblico. Usa **ngrok** o **Cloudflare Tunnel** per esporre il backend locale.

#### 1. Installa ngrok
```bash
brew install ngrok              # su macOS
# o scarica da https://ngrok.com/download
```

#### 2. Crea un tunnel ngrok
```bash
ngrok http 3001
```

Questo ti darà un URL simile a: `https://abc123def456.ngrok-free.dev`

#### 3. Configura le variabili d'ambiente

Crea un file `.env.local` nella root del progetto:

```bash
# .env.local
BACKEND_URL=https://abc123def456.ngrok-free.dev
FRONTEND_URL=http://localhost:8080
```

#### 4. Avvia i container con le variabili
```bash
source .env.local
docker-compose up
```

#### 5. Registra la webhook con Strava
```bash
curl -X POST http://localhost:3001/webhook/strava/subscribe
```

Dovresti ricevere una risposta con l'ID della subscription (non un errore 400).

### Opzione B: Ambiente di Produzione

Se hai un dominio pubblico (es: `api.example.com`), configura:

```bash
# Nel docker-compose.yml o .env
BACKEND_URL=https://api.example.com
FRONTEND_URL=https://app.example.com
```

Assicurati che:
- Il backend sia accessibile da `https://api.example.com`
- Strava possa raggiungere `https://api.example.com/webhook/strava`
- Tu abbia configurato i certificati SSL/TLS

## Dettagli Tecnici

### Flow di Autenticazione OAuth di Strava

1. **Utente clicca su "Login con Strava"**
   - Frontend reindirizza a Strava con `redirect_uri` = `FRONTEND_URL/api/auth/strava/callback`
   - Strava autentica l'utente

2. **Strava reindirizza il browser**  
   - Reindirizza a `FRONTEND_URL/api/auth/strava/callback?code=...`
   - Il frontend riceve il codice e lo invia al backend

3. **Backend scambia il codice per token**
   - Contatta Strava con il codice e riceve i token di accesso
   - Istituisce l'utente nel database

### Flow della Webhook di Strava

1. **Registrazione**: POST a `https://www.strava.com/api/v3/push_subscriptions`
   - Payload include `callback_url` = `BACKEND_URL/webhook/strava`
   - Strava verifica che il callback URL sia raggiungibile

2. **Verifica**: Strava invia una richiesta GET a `callback_url?hub.mode=subscribe&hub.challenge=...`
   - Il backend deve rispondere con `hub.challenge` nel JSON

3. **Eventi**: Quando l'atleta crea/modifica un'attività, Strava invia POST a `callback_url`
   - Il backend risponde con 200 entro 2 secondi
   - Elabora l'evento in background

## Debugging

### Errore: "Bad Request" su /webhook/strava/subscribe

**Causa**: Strava non riesce a raggiungere il callback URL

**Soluzione**: 
- Verifica che il `BACKEND_URL` sia accessibile e raggiungibile da internet
- Testa manualmente: `curl https://your-backend-url/webhook/strava` dovrebbe restituire 403 (token mancante)

### Errore: "Invalid redirect_uri" durante OAuth

**Causa**: Il `redirect_uri` registrato in Strava non corrisponde a `FRONTEND_URL/api/auth/strava/callback`

**Soluzione**:
- Accedi a https://www.strava.com/settings/oauth
- Aggiorna "Authorization Callback Domain" al tuo dominio
- Assicurati che `FRONTEND_URL` sia correttamente configurato

### Webhook non riceve eventi

**Causa**: La webhook non è stata registrata correttamente

**Soluzione**:
- Verifica che `/webhook/strava/subscribe` abbia restituito un ID subscription
- Controlla i log di Docker: `docker-compose logs api`
- Se necessario, registra nuovamente con il comando curl

## File di Configurazione Aggiornati

Vedi i seguenti file per i dettagli:
- [docker-compose.yml](docker-compose.yml) - Configurazione dei container con nuove variabili d'ambiente
- [backend/src/config.ts](backend/src/config.ts) - Logica di configurazione
- [backend/src/routes/webhook.routes.ts](backend/src/routes/webhook.routes.ts) - Registrazione webhook
- [backend/src/routes/auth.routes.ts](backend/src/routes/auth.routes.ts) - Flow OAuth
