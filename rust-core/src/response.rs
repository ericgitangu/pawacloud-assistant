use pyo3::prelude::*;
use std::collections::HashSet;

/// Extract and deduplicate URLs from markdown text, returned as JSON array.
///
/// ```
/// use pawacloud_core::format_sources;
/// let json = format_sources("See https://github.com/foo and https://github.com/foo");
/// let urls: Vec<String> = serde_json::from_str(&json).unwrap();
/// assert_eq!(urls.len(), 1);
/// ```
#[pyfunction]
pub fn format_sources(text: &str) -> String {
    let mut seen_domains: HashSet<String> = HashSet::new();
    let mut urls: Vec<String> = Vec::new();

    for word in text.split_whitespace() {
        let trimmed = word.trim_matches(|c: char| c == '(' || c == ')' || c == '<' || c == '>');
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            if let Some(domain) = trimmed
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .split('/')
                .next()
            {
                if seen_domains.insert(domain.to_string()) {
                    urls.push(trimmed.to_string());
                }
            }
        }
    }

    urls.sort_by_key(|u| u.to_lowercase());
    serde_json::to_string(&urls).unwrap_or_else(|_| "[]".to_string())
}

/// Token-aware truncation that tries not to break mid-sentence.
///
/// ```
/// use pawacloud_core::truncate_response;
/// assert_eq!(truncate_response("Short text.", 2048), "Short text.");
/// ```
#[pyfunction]
pub fn truncate_response(text: &str, max_tokens: usize) -> String {
    let words: Vec<&str> = text.split_whitespace().collect();
    let estimated = words.len() * 4 / 3;

    if estimated <= max_tokens {
        return text.to_string();
    }

    let keep = max_tokens * 3 / 4;
    let kept: Vec<&str> = words.iter().take(keep).copied().collect();

    for i in (kept.len().saturating_sub(20)..kept.len()).rev() {
        if let Some(w) = kept.get(i) {
            if w.ends_with('.') || w.ends_with('!') || w.ends_with('?') {
                return kept[..=i].join(" ");
            }
        }
    }

    format!("{}...", kept.join(" "))
}

/// Jaccard similarity on word sets.
///
/// ```
/// use pawacloud_core::compute_similarity;
/// assert!((compute_similarity("hello world", "hello world") - 1.0).abs() < f64::EPSILON);
/// assert_eq!(compute_similarity("a b", "c d"), 0.0);
/// ```
#[pyfunction]
pub fn compute_similarity(a: &str, b: &str) -> f64 {
    let words_a: Vec<&str> = a.to_lowercase().leak().split_whitespace().collect();
    let words_b: Vec<&str> = b.to_lowercase().leak().split_whitespace().collect();

    let set_a: HashSet<&str> = words_a.into_iter().collect();
    let set_b: HashSet<&str> = words_b.into_iter().collect();

    let intersection = set_a.intersection(&set_b).count();
    let union = set_a.union(&set_b).count();

    if union == 0 {
        0.0
    } else {
        intersection as f64 / union as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_sources_dedup_same_domain() {
        let text = "Check https://cloud.google.com/run and https://cloud.google.com/sql";
        let result = format_sources(text).unwrap();
        let parsed: Vec<String> = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed.len(), 1);
    }

    #[test]
    fn format_sources_different_domains() {
        let text = "See https://cloud.google.com and https://github.com/foo";
        let result = format_sources(text).unwrap();
        let parsed: Vec<String> = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed.len(), 2);
    }

    #[test]
    fn truncate_short_text_unchanged() {
        assert_eq!(truncate_response("Short text.", 2048), "Short text.");
    }

    #[test]
    fn similarity_identical() {
        let score = compute_similarity("hello world", "hello world");
        assert!((score - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn similarity_disjoint() {
        assert!(compute_similarity("hello world", "foo bar") < f64::EPSILON);
    }

    #[test]
    fn similarity_partial() {
        let score = compute_similarity("hello world foo", "hello world bar");
        assert!(score > 0.0 && score < 1.0);
    }
}
