#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo "[Railway] Running database migrations..."
npm run migrate

echo "[Railway] Seeding baseline game data..."
if [[ "${FORCE_SEED:-false}" == "true" ]]; then
  node -e "require('./src/database/seed').seedDatabase({ force: true }).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });"
else
  node ./src/database/seed.js
fi

echo "[Railway] Migrations and seed completed successfully."
