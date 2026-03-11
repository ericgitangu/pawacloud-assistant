use pyo3::prelude::*;

/// Strip control characters and normalize whitespace.
///
/// ```
/// use pawacloud_core::sanitize_input;
/// assert_eq!(sanitize_input("  foo   bar  "), "foo bar");
/// assert_eq!(sanitize_input("hello\x00world"), "helloworld");
/// ```
#[pyfunction]
pub fn sanitize_input(text: &str) -> String {
    let cleaned: String = text
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect();

    cleaned.split_whitespace().collect::<Vec<&str>>().join(" ")
}

/// Approximate token count using a char/word heuristic.
///
/// ```
/// use pawacloud_core::estimate_tokens;
/// assert!(estimate_tokens("hello world this is a test") > 0);
/// assert_eq!(estimate_tokens(""), 0);
/// ```
#[pyfunction]
pub fn estimate_tokens(text: &str) -> usize {
    let char_count = text.len();
    let word_count = text.split_whitespace().count();
    (char_count / 4 + word_count * 4 / 3) / 2
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_strips_control_chars() {
        assert_eq!(sanitize_input("hello\x00world\x07test"), "helloworldtest");
    }

    #[test]
    fn sanitize_normalizes_whitespace() {
        assert_eq!(sanitize_input("  hello   world  "), "hello world");
    }

    #[test]
    fn sanitize_preserves_newlines_as_spaces() {
        let result = sanitize_input("line1\nline2");
        assert!(result.contains("line1"));
        assert!(result.contains("line2"));
    }

    #[test]
    fn token_estimate_nonempty() {
        assert!(estimate_tokens("hello world this is a test") > 0);
    }

    #[test]
    fn token_estimate_empty() {
        assert_eq!(estimate_tokens(""), 0);
    }
}
