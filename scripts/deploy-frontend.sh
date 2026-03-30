#!/bin/bash
set -euo pipefail

# I opted for Fly.io since it is a PaaS that is easy to use and deploy to.
# Vercel, Railway, Netlify, Render, etc. are also good options.
echo "==> Deploying frontend to Fly.io"
cd "$(dirname "$0")/../frontend"

# ensure lock file exists — remote builds need it for --frozen-lockfile
if [ ! -f pnpm-lock.yaml ]; then
  pnpm install
fi

flyctl deploy --remote-only

echo "==> Frontend deployed"
