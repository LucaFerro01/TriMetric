#!/bin/bash

# Script per configurare TriMetric con ngrok per lo sviluppo locale con Strava

set -e

echo "================================================"
echo "TriMetric - Strava ngrok Setup"
echo "================================================"
echo ""

# Check se ngrok è installato
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok non trovato. Installa con:"
    echo "   brew install ngrok"
    echo "   oppure scarica da https://ngrok.com/download"
    exit 1
fi

echo "✅ ngrok trovato"
echo ""

# Informa l'utente di avviare ngrok manualmente
echo "⚠️  Questo script ha bisogno che ngrok stia girando in background."
echo ""
echo "Apri un nuovo terminale ed esegui:"
echo "   ngrok http 3001"
echo ""
echo "Aspetta che ngrok mostri l'URL pubblico (es: https://abc123.ngrok-free.dev)"
echo ""
read -p "Premi invio quando ngrok è pronto..."

# Chiedi l'URL ngrok
read -p "Inserisci l'URL ngrok completo (es: https://abc123.ngrok-free.dev): " NGROK_URL

# Valida l'URL
if [[ ! "$NGROK_URL" =~ ^https:// ]]; then
    echo "❌ URL non valido. Deve iniziare con https://"
    exit 1
fi

echo ""
echo "Creando .env.local con:"
echo "  BACKEND_URL=$NGROK_URL"
echo "  FRONTEND_URL=http://localhost:8080"
echo ""

# Crea .env.local
cat > .env.local << EOF
BACKEND_URL=$NGROK_URL
FRONTEND_URL=http://localhost:8080
EOF

echo "✅ File .env.local creato"
echo ""

# Avvia docker-compose
echo "Avviando i container Docker..."
echo ""

docker-compose up -d

# Aspetta che i container siano pronti
echo "Aspetto che i container siano pronti..."
sleep 10

# Testa la connessione al backend
echo ""
echo "Testando connessione al backend..."

if curl -s "$NGROK_URL/health" > /dev/null; then
    echo "✅ Backend raggiungibile tramite ngrok"
else
    echo "⚠️  Backend non raggiungibile. Controlla i log:"
    echo "   docker-compose logs api"
    exit 1
fi

# Registra la webhook
echo ""
echo "Registrando webhook Strava..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3001/webhook/strava/subscribe)
echo "Risposta da Strava:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

if echo "$RESPONSE" | grep -q '"id"'; then
    echo ""
    echo "✅ Webhook registrata con successo!"
    echo ""
    echo "L'applicazione è pronta su:"
    echo "  Frontend: http://localhost:8080"
    echo "  Backend (da Strava): $NGROK_URL"
    echo ""
    echo "Puoi ora testare il login con Strava!"
else
    echo ""
    echo "⚠️  Errore nella registrazione della webhook"
    echo "Controlla i log:"
    echo "   docker-compose logs api"
fi

echo ""
echo "================================================"
echo "Setup completato! Comandi utili:"
echo "================================================"
echo ""
echo "Visualizzare i log:"
echo "   docker-compose logs -f"
echo ""
echo "Fermare i container:"
echo "   docker-compose down"
echo ""
echo "Riavviare i container:"
echo "   docker-compose restart"
echo ""
