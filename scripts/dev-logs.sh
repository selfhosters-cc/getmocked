#!/bin/bash
# Tail logs for a specific service or all
# Usage: ./scripts/dev-logs.sh [service]
set -e

cd "$(dirname "$0")/.."

docker compose logs -f ${1:-}
