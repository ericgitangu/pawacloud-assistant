#!/bin/bash
set -euo pipefail

echo "==> Deploying backend to Cloud Run (africa-south1)"
cd "$(dirname "$0")/.."

PROJECT=pawacloud-assessment
REGION=africa-south1
SERVICE=pawacloud-api
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/pawacloud/backend:latest"

# cross-compile for amd64 — Cloud Run runs Linux x86_64
docker buildx build --platform linux/amd64 \
  -t "$IMAGE" -f backend/Dockerfile --push .

gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2

echo "==> Backend deployed to Cloud Run"
