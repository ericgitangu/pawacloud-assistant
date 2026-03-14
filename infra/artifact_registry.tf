resource "google_artifact_registry_repository" "pawacloud" {
  location      = var.region
  repository_id = "pawacloud"
  format        = "DOCKER"
  description   = "Container images for PawaCloud Assistant"
}
