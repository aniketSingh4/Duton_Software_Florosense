#!/bin/bash

# Production Deployment Script for Duton Backend
# Exit on any error
set -e

# Configuration
APP_NAME="duton-backend"
DEPLOY_DIR=$(pwd)
LOG_FILE="./logs/deploy.log"
NODE_MIN_VERSION=20
REQUIRED_ENV_VARS=("NEW_DB_URL" "JWT_SECRET" "CALIBRATION_API_KEY" "FLOROSENSE_BASE_URL" "FLOROSENSE_API_KEY")

# Create logs directory if it doesn't exist
mkdir -p "$DEPLOY_DIR/logs"

echo "[$(date)] --- Starting Deployment for $APP_NAME ---" | tee -a "$LOG_FILE"

# 1. System Check
echo "[1/7] Validating System Requirements..." | tee -a "$LOG_FILE"
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]; then
    echo "ERROR: Node.js version $NODE_MIN_VERSION or higher is required (current: v$NODE_VERSION)" | tee -a "$LOG_FILE"
    exit 1
fi

# Check disk space (warn if < 10%)
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "WARNING: Disk usage is high ($DISK_USAGE%). Deployment may fail." | tee -a "$LOG_FILE"
fi

# 2. Environment Check
echo "[2/7] Checking Environment Variables..." | tee -a "$LOG_FILE"
if [ ! -f .env ]; then
    echo "ERROR: .env file missing! Use .env.example to create one." | tee -a "$LOG_FILE"
    exit 1
fi

for var in "${REQUIRED_ENV_VARS[@]}"; do
    if ! grep -q "^$var=" .env || grep -q "^$var=$" .env; then
        echo "ERROR: Required environment variable $var is missing or empty in .env" | tee -a "$LOG_FILE"
        exit 1
    fi
done

# 3. Pull Latest Code (Optional - assuming manual pull or CI trigger)
# echo "[3/7] Pulling latest code from Git..." | tee -a "$LOG_FILE"
# git pull origin main

# 4. Install Dependencies
echo "[4/7] Installing Production Dependencies..." | tee -a "$LOG_FILE"
npm ci --only=production

# 5. Security Audit
echo "[5/7] Running Security Audit..." | tee -a "$LOG_FILE"
npm audit --audit-level=high || (echo "ERROR: High/Critical vulnerabilities found during audit!" | tee -a "$LOG_FILE" && exit 1)

# 6. Start/Restart Application
echo "[6/7] Starting Application with PM2..." | tee -a "$LOG_FILE"
if pm2 list | grep -q "$APP_NAME"; then
    pm2 reload ecosystem.config.js --env production
else
    pm2 start ecosystem.config.js --env production
fi
pm2 save

# 7. Verification
echo "[7/7] Verifying Deployment..." | tee -a "$LOG_FILE"
sleep 5 # Wait for app to start
if curl -s http://127.0.0.1:8001/health | grep -q "ok"; then
    echo "SUCCESS: $APP_NAME is running and healthy!" | tee -a "$LOG_FILE"
else
    echo "ERROR: Health check failed! Check logs at $DEPLOY_DIR/logs/err.log" | tee -a "$LOG_FILE"
    exit 1
fi

# Post-Deployment Cleanup (As requested in rules)
echo "Running post-deployment cleanup..." | tee -a "$LOG_FILE"
# Note: Be careful with RM in scripts. Only removing specific unnecessary files.
# rm -rf tests/ # If exists
# rm -rf docs/ # If exists
# find . -maxdepth 1 -name "*.md" ! -name "README.md" -delete

echo "[$(date)] --- Deployment Finished Successfully ---" | tee -a "$LOG_FILE"
