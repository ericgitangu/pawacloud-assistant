# NOTE: the secret-bearing variables below — gemini_api_key, redis_url,
# google_client_secret, session_secret and database_url — are NO LONGER wired
# into Cloud Run. Those values now live in Secret Manager and are read via
# data sources (see secrets.tf), so plaintext never reaches tfvars or state.
# The declarations are kept so existing terraform.tfvars files keep parsing;
# setting them has no effect. Rotate with `gcloud secrets versions add` instead.

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run"
  type        = string
  default     = "africa-south1"
}

variable "gemini_api_key" {
  description = "DEPRECATED — now read from Secret Manager (gemini-api-key). Unused."
  type        = string
  sensitive   = true
  default     = ""
}

variable "frontend_origins" {
  description = "Allowed CORS origins for the frontend"
  type        = list(string)
  default     = ["https://pawacloud-web.vercel.app", "http://localhost:3000"]
}

variable "redis_url" {
  description = "Redis connection URL (Upstash)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "session_secret" {
  description = "Session cookie signing secret"
  type        = string
  sensitive   = true
  default     = "change-me-in-prod"
}

variable "database_url" {
  description = "PostgreSQL connection URL (Neon)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oauth_redirect_uri" {
  description = "OAuth callback URL on the backend"
  type        = string
  default     = ""
}
