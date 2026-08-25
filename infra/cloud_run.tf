resource "google_cloud_run_v2_service" "backend" {
  name     = "pawacloud-api"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/pawacloud/backend:latest"

      ports {
        container_port = 8000
      }

      # Secret-bearing env vars resolve from Secret Manager at revision start,
      # never from tfvars or Terraform state. Driven by local.backend_secrets
      # (see secrets.tf) so the env wiring and the IAM grants cannot drift apart.
      dynamic "env" {
        for_each = local.backend_secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.backend[env.key].secret_id
              version = "latest"
            }
          }
        }
      }

      env {
        name  = "ALLOWED_ORIGINS"
        value = jsonencode(var.frontend_origins)
      }

      env {
        name  = "GEMINI_MODEL"
        value = "gemini-2.5-flash"
      }

      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }

      env {
        name  = "FRONTEND_URL"
        value = "https://pawacloud-web.vercel.app"
      }

      env {
        name  = "OAUTH_REDIRECT_URI"
        value = var.oauth_redirect_uri
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    service_account = google_service_account.backend.email
  }
}

# public access — assessment spec says disregard security
resource "google_cloud_run_service_iam_member" "public" {
  location = google_cloud_run_v2_service.backend.location
  service  = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
