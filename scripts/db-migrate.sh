#!/bin/bash
# Run Prisma migrations inside the frontend container
# Usage: ./scripts/db-migrate.sh [name]
# Examples: ./scripts/db-migrate.sh add_updated_at
#           ./scripts/db-migrate.sh              (applies pending migrations)
set -e

cd "$(dirname "$0")/.."

if [ -n "$1" ]; then
  echo "Creating new migration: $1"
  docker compose exec frontend npx prisma migrate dev --name "$1"
else
  echo "Applying pending migrations..."
  docker compose exec frontend npx prisma migrate deploy
fi
