# Secret Manager wiring for the Cloud Run backend.
#
# The five secrets below are created and versioned OUTSIDE Terraform (via
# `gcloud secrets create/versions add`) so that rotating a credential never
# requires a terraform run and never puts the plaintext into tfvars or state.
# Terraform therefore READS them as data sources rather than managing them.
#
# Rotation is a one-liner, no apply needed:
#   printf '%s' 'NEW_VALUE' | gcloud secrets versions add database-url \
#     --project=<project> --data-file=-
# Cloud Run reads version "latest", so a new revision picks it up automatically.
#
# To add a NEW secret: create it with gcloud first, then add a data source here
# and reference it from cloud_run.tf.

locals {
  # Cloud Run env var name  =>  Secret Manager secret id
  backend_secrets = {
    DATABASE_URL         = "database-url"
    GEMINI_API_KEY       = "gemini-api-key"
    GOOGLE_CLIENT_SECRET = "google-client-secret"
    SESSION_SECRET       = "session-secret"
    REDIS_URL            = "redis-url"
  }
}

data "google_secret_manager_secret" "backend" {
  for_each  = local.backend_secrets
  secret_id = each.value
}

# The Cloud Run runtime SA must be able to read each secret, or the revision
# fails to start with a permission error rather than a clear message.
resource "google_secret_manager_secret_iam_member" "backend_accessor" {
  for_each  = local.backend_secrets
  secret_id = data.google_secret_manager_secret.backend[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}
