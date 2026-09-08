#!/bin/bash

# Production Deployment Script for Node.js / Next.js
# Security-Hardened and Production-Ready

set -e # Exit on error
set -o pipefail # Exit on pipe failures

# --- Configuration ---
APP_NAME="duton-frontend"
NODE_VERSION="20" # Target LTS
PORT=3000
BIND_ADDRESS="127.0.0.1"
LOG_FILE="deploy.log"

# Function for logging
log() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

log "Starting deployment for $APP_NAME..."

# 1. Validate Node.js Version
CURRENT_NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$CURRENT_NODE_VERSION" -lt "$NODE_VERSION" ]; then
    error_exit "Node.js version $NODE_VERSION or higher is required. Current: v$(node -v)"
fi

# 2. Check Resources
MEM_FREE=$(free -m | awk '/^Mem:/{print $4}')
if [ "$MEM_FREE" -lt 512 ]; then
    log "WARNING: Low memory available ($MEM_FREE MB). Build might fail."
fi

# 3. Pull latest code
log "Pulling latest changes from Git..."
# git pull origin main || error_exit "Git pull failed"

# 4. Environment Variable Validation
log "Validating environment variables..."
if [ ! -f .env ]; then
    error_exit ".env file missing. Deployment aborted."
fi

# Essential Variables Check
REQUIRED_VARS=("BACKEND_URL" "NEXT_PUBLIC_API_URL")
for VAR in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^$VAR=" .env; then
        error_exit "Missing required environment variable: $VAR"
    fi
done

# 5. Clean Dependencies and Install
log "Installing production dependencies..."
npm ci --only=production || error_exit "Dependency installation failed"

# 6. Security Check
log "Running security audit..."
npm audit --audit-level=high || log "WARNING: Security vulnerabilities found. Please check manually."

# 7. Production Build
log "Building the application..."
npm run build || error_exit "Build failed"

# 8. Start/Restart Application with PM2
log "Starting application with PM2..."
if pm2 list | grep -q "$APP_NAME"; then
    pm2 reload "$APP_NAME" --update-env || error_exit "PM2 reload failed"
else
    pm2 start npm --name "$APP_NAME" -- start || error_exit "PM2 start failed"
fi

# 9. Verification
log "Verifying application status..."
sleep 5
if ! curl -s "http://$BIND_ADDRESS:$PORT" > /dev/null; then
    error_exit "Application verification failed. Not responding on http://$BIND_ADDRESS:$PORT"
fi

# 10. Port Binding Verification
log "Verifying port binding security..."
if netstat -tuln | grep ":$PORT " | grep -v "$BIND_ADDRESS"; then
    error_exit "SECURITY ALERT: Application is bound to a public interface! Expected $BIND_ADDRESS"
fi

log "Deployment successful!"
