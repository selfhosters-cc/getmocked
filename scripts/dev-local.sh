#!/bin/bash
# Run both services locally without Docker.
# Requires: node, python3, pip
# Uses .env for config, overrides paths for local filesystem.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Local storage dirs
export UPLOAD_DIR="$ROOT/.local/uploads"
export RENDER_DIR="$ROOT/.local/rendered"
mkdir -p "$UPLOAD_DIR" "$RENDER_DIR"

# Load .env (skip comments and empty lines)
set -a
while IFS= read -r line; do
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  eval "export $line"
done < "$ROOT/.env"
set +a

# Override storage paths for local dev
export UPLOAD_DIR="$ROOT/.local/uploads"
export RENDER_DIR="$ROOT/.local/rendered"
export PROCESSING_URL="http://localhost:5000"
export FRONTEND_URL="http://localhost:3335"

# Install deps if needed
echo "=== Checking dependencies ==="

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend deps..."
  (cd "$ROOT/frontend" && npm install)
fi

if [ ! -d "$ROOT/processing/.venv" ]; then
  echo "Setting up Python venv..."
  python3 -m venv "$ROOT/processing/.venv"
  "$ROOT/processing/.venv/bin/pip" install -r "$ROOT/processing/requirements.txt"
fi

# Generate Prisma client
(cd "$ROOT/frontend" && npx prisma generate 2>/dev/null)

# Run migrations
echo ""
echo "=== Applying migrations ==="
(cd "$ROOT/frontend" && npx prisma migrate deploy 2>&1) || echo "Warning: migrations failed, db may need setup"

# Trap to kill all background processes on exit
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $(jobs -p) 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

# Kill any leftover processes from a previous session
echo "=== Checking for stale processes ==="
kill_port() {
  local port=$1
  # Try ss first (most reliable on Linux), fall back to lsof
  local pids=""
  if command -v ss &>/dev/null; then
    pids=$(ss -tlnp sport = :"$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u)
  fi
  if [ -z "$pids" ] && command -v lsof &>/dev/null; then
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
  fi
  if [ -n "$pids" ]; then
    for pid in $pids; do
      echo "Killing process on port $port (PID $pid)"
      kill "$pid" 2>/dev/null || true
    done
    sleep 1
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
  fi
}
kill_port 3335
kill_port 5000

echo ""
echo "=== Starting services ==="

# Processing service (Python)
(cd "$ROOT/processing" && \
  "$ROOT/processing/.venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port 5000 --reload) &
PROC_PID=$!

# Frontend (Next.js) - now includes the API
(cd "$ROOT/frontend" && PORT=3335 npm run dev) &
FRONT_PID=$!

echo ""
echo "Services starting:"
echo "  Frontend + API: http://localhost:3335"
echo "  Processing:     http://localhost:5000"
echo "  Database:       $DATABASE_URL"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# Wait for any process to exit
wait
