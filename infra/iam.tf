resource "google_service_account" "backend" {
  account_id   = "pawacloud-backend"
  display_name = "PawaCloud Backend SA"
  description  = "Least-privilege SA for Cloud Run backend"
}
