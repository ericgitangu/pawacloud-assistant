terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "enable_log_metrics" {
  description = "Create log-based metrics for document pipeline errors"
  type        = bool
  default     = false
}

resource "google_logging_metric" "doc_pipeline_errors" {
  count       = var.enable_log_metrics ? 1 : 0
  name        = "pawacloud_doc_errors"
  description = "Counter of document pipeline error events emitted by the backend"
  filter      = "resource.type=\"cloud_run_revision\" AND jsonPayload.event_code=\"error\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}
