use pyo3::prelude::*;

/// Check that markdown output doesn't contain script injection patterns.
///
/// ```
/// use pawacloud_core::validate_markdown;
/// assert!(validate_markdown("# Safe heading"));
/// assert!(!validate_markdown("<script>alert(1)</script>"));
/// ```
#[pyfunction]
pub fn validate_markdown(text: &str) -> bool {
    let dangerous = ["<script", "javascript:", "onerror=", "onload="];
    let lower = text.to_lowercase();
    !dangerous.iter().any(|p| lower.contains(p))
}

/// Extract (language, code) tuples from fenced code blocks.
///
/// ```
/// use pawacloud_core::extract_code_blocks;
/// let blocks = extract_code_blocks("```python\nprint('hi')\n```");
/// assert_eq!(blocks.len(), 1);
/// assert_eq!(blocks[0].0, "python");
/// ```
#[pyfunction]
pub fn extract_code_blocks(text: &str) -> Vec<(String, String)> {
    let mut blocks = Vec::new();
    let mut in_block = false;
    let mut lang = String::new();
    let mut code = String::new();

    for line in text.lines() {
        if line.starts_with("```") {
            if in_block {
                blocks.push((lang.clone(), code.trim().to_string()));
                lang.clear();
                code.clear();
                in_block = false;
            } else {
                lang = line.trim_start_matches('`').trim().to_string();
                in_block = true;
            }
        } else if in_block {
            code.push_str(line);
            code.push('\n');
        }
    }

    blocks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_clean_markdown() {
        assert!(validate_markdown("# Hello\nSome **bold** text"));
    }

    #[test]
    fn catches_script_injection() {
        assert!(!validate_markdown("some text <script>alert(1)</script>"));
    }

    #[test]
    fn catches_javascript_uri() {
        assert!(!validate_markdown("[click](javascript:alert(1))"));
    }

    #[test]
    fn extracts_single_code_block() {
        let md = "```python\nprint('hi')\n```";
        let blocks = extract_code_blocks(md);
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].0, "python");
        assert_eq!(blocks[0].1, "print('hi')");
    }

    #[test]
    fn extracts_multiple_blocks() {
        let md = "```rust\nfn main() {}\n```\ntext\n```bash\necho hi\n```";
        assert_eq!(extract_code_blocks(md).len(), 2);
    }

    #[test]
    fn handles_no_blocks() {
        assert!(extract_code_blocks("just plain text").is_empty());
    }
}
