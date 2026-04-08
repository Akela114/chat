#!/bin/sh
set -e
cd /app/apps/back

echo "Waiting for database to be ready..."
until nc -z -w 2 "postgres" "5432"; do
  echo "Database is unavailable - sleeping..."
  sleep 2
done

echo "Running database migrations..."
npm run migrate

echo "Migrations completed successfully!"

echo "Starting the application..."
exec node src/index.ts