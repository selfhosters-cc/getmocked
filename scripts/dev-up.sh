#!/bin/bash
# Start the full dev environment
set -e

cd "$(dirname "$0")/.."

echo "Building and starting services..."
docker compose up --build -d

echo ""
echo "Waiting for frontend to be ready..."
until curl -sf http://localhost:3335 > /dev/null 2>&1; do
  sleep 1
done

echo ""
echo "Services running:"
echo "  Frontend + API: http://localhost:3335"
echo "  Database:       192.168.5.3:5432/getmocked_dev"
echo ""
echo "Tailing logs (Ctrl+C to stop)..."
docker compose logs -f
