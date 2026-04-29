#!/bin/bash
set -euo pipefail

echo "==> Deploying backend to Cloud Run (africa-south1)"
cd "$(dirname "$0")/.."

PROJECT=pawacloud-assessment
REGION=africa-south1
SERVICE=pawacloud-api
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/pawacloud/backend:latest"

# Vision OCR uses the runtime service account on Cloud Run via ADC —
# no JSON key is shipped in the image. Locally, GOOGLE_VISION_KEY_PATH
# is honoured when set (see app/services/document_service.py::_vision_client).
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

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
  --max-instances 2 \
  --service-account "$RUNTIME_SA"

echo "==> Backend deployed to Cloud Run"
