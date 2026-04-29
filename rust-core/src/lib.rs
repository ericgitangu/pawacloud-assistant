pub mod document;
pub mod markdown;
pub mod response;
pub mod text;

// re-export so doc tests and consumers can use pawacloud_core::function_name
pub use document::{chunk_markdown, detect_script, normalize_document_text, sha256_hex};
pub use markdown::{extract_code_blocks, validate_markdown};
pub use response::{compute_similarity, format_sources, truncate_response};
pub use text::{estimate_tokens, sanitize_input};

use pyo3::prelude::*;

#[pymodule]
fn pawacloud_core(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(text::sanitize_input, m)?)?;
    m.add_function(wrap_pyfunction!(text::estimate_tokens, m)?)?;
    m.add_function(wrap_pyfunction!(markdown::validate_markdown, m)?)?;
    m.add_function(wrap_pyfunction!(markdown::extract_code_blocks, m)?)?;
    m.add_function(wrap_pyfunction!(response::format_sources, m)?)?;
    m.add_function(wrap_pyfunction!(response::truncate_response, m)?)?;
    m.add_function(wrap_pyfunction!(response::compute_similarity, m)?)?;
    m.add_function(wrap_pyfunction!(document::sha256_hex, m)?)?;
    m.add_function(wrap_pyfunction!(document::detect_script, m)?)?;
    m.add_function(wrap_pyfunction!(document::normalize_document_text, m)?)?;
    m.add_function(wrap_pyfunction!(document::chunk_markdown, m)?)?;
    Ok(())
}
