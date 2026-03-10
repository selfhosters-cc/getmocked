#!/bin/bash
# Rebuild and restart a specific service (or all)
# Usage: ./scripts/dev-rebuild.sh [service]
# Examples: ./scripts/dev-rebuild.sh backend
#           ./scripts/dev-rebuild.sh          (rebuilds all)
set -e

cd "$(dirname "$0")/.."

SERVICE=${1:-}

if [ -n "$SERVICE" ]; then
  echo "Rebuilding $SERVICE..."
  docker compose up --build -d "$SERVICE"
else
  echo "Rebuilding all services..."
  docker compose up --build -d
fi

echo "Done. Tailing logs..."
docker compose logs -f $SERVICE
