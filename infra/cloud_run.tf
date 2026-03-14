resource "google_cloud_run_v2_service" "backend" {
  name     = "pawacloud-api"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/pawacloud/backend:latest"

      ports {
        container_port = 8000
      }

      env {
        name  = "GEMINI_API_KEY"
        value = var.gemini_api_key
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
        name  = "REDIS_URL"
        value = var.redis_url
      }

      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }

      env {
        name  = "GOOGLE_CLIENT_SECRET"
        value = var.google_client_secret
      }

      env {
        name  = "SESSION_SECRET"
        value = var.session_secret
      }

      env {
        name  = "FRONTEND_URL"
        value = "https://pawacloud-web.fly.dev"
      }

      env {
        name  = "DATABASE_URL"
        value = var.database_url
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
