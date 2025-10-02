#!/usr/bin/env bash
set -e  # Exit on error

echo "======================================"
echo "🚀 Railway Deployment Script"
echo "======================================"

# Change to project root
cd "$(dirname "$0")/.."
echo "📂 Working directory: $(pwd)"

# Run migrations
echo ""
echo "🔄 Running database migrations..."
if npm run migrate; then
    echo "✅ Migrations completed successfully"
else
    echo "❌ Migration failed!"
    exit 1
fi

# Run seed
echo ""
echo "🌱 Seeding database..."
if node ./src/database/seed.js; then
    echo "✅ Seed completed successfully"
else
    echo "❌ Seed failed!"
    exit 1
fi

echo ""
echo "======================================"
echo "✅ Railway deployment script completed"
echo "======================================"
