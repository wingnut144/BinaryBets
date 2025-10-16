#!/bin/bash
# This script downloads and runs the init.sql from GitHub

echo "Downloading init.sql from GitHub..."
curl -sSL https://raw.githubusercontent.com/wingnut144/BinaryBets/main/init.sql -o /tmp/init.sql

echo "Running database initialization..."
psql -h postgres -U binaryuser -d binarybets -f /tmp/init.sql

echo "Database initialization complete!"
