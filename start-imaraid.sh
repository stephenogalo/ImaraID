#!/usr/bin/env bash
set -e

PROJECT="$HOME/ai-blockchain-identity"
CHAIN="$PROJECT/blockchain"
BACKEND="$PROJECT/backend"
FRONTEND="$PROJECT/frontend"
LOGS="$PROJECT/logs"
STATE="$CHAIN/persistent-chain/anvil-state.json"

mkdir -p "$LOGS"

# Start Anvil only if the expected blockchain is not responding.
if ! curl -sf --max-time 2 -X POST http://127.0.0.1:8546 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' |
  grep -q '"result":"0x7a69"'; then

  if [ ! -s "$STATE" ]; then
    echo "ERROR: Persistent blockchain state file is missing."
    exit 1
  fi

  nohup "$HOME/.foundry/bin/anvil" \
    --host 127.0.0.1 --port 8546 --chain-id 31337 \
    --state "$STATE" --state-interval 60 \
    > "$LOGS/anvil.log" 2>&1 < /dev/null &
fi

echo "Waiting for blockchain..."
for i in {1..30}; do
  if curl -sf --max-time 1 -X POST http://127.0.0.1:8546 \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' |
    grep -q '"result":"0x7a69"'; then
    break
  fi
  sleep 1
done

if ! curl -sf --max-time 2 -X POST http://127.0.0.1:8546 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' |
  grep -q '"result":"0x7a69"'; then
  echo "ERROR: Blockchain did not start. Check $LOGS/anvil.log"
  exit 1
fi

# Start backend if port 5000 is not responding.
if ! curl -s --max-time 2 http://127.0.0.1:5000/ >/dev/null; then
  if ss -ltn | grep -q ':5000 '; then
    echo "ERROR: Port 5000 is occupied but the backend is not responding."
    exit 1
  fi
  (cd "$BACKEND" && nohup npm start > "$LOGS/backend.log" 2>&1 < /dev/null &)
fi

echo "Waiting for backend..."
for i in {1..30}; do
  if curl -s --max-time 1 http://127.0.0.1:5000/ >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl -s --max-time 2 http://127.0.0.1:5000/ >/dev/null; then
  echo "ERROR: Backend did not start. Check $LOGS/backend.log"
  exit 1
fi

# Start frontend if port 5173 is not occupied.
if ! curl -s --max-time 2 http://localhost:5173/ >/dev/null; then
  if ss -ltn | grep -q ':5173 '; then
    echo "ERROR: Port 5173 is occupied but the frontend is not responding."
    exit 1
  fi
  (cd "$FRONTEND" && nohup npm run dev -- --host 127.0.0.1 > "$LOGS/frontend.log" 2>&1 < /dev/null &)
fi

echo "Waiting for frontend..."
for i in {1..30}; do
  if curl -s --max-time 1 http://localhost:5173/ >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl -s --max-time 2 http://localhost:5173/ >/dev/null; then
  echo "ERROR: Frontend did not start. Check $LOGS/frontend.log"
  exit 1
fi

echo
echo "ImaraID startup complete!"
echo "Open: http://localhost:5173"
echo "Logs: $LOGS/"
