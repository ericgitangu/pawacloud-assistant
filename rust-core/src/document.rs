// SPDX-License-Identifier: MIT
//! Document-pipeline utilities — sha256, script detection, normalization, chunking.

use pyo3::prelude::*;
use sha2::{Digest, Sha256};

/// Compute a hex-encoded SHA-256 of the given bytes. Used for upload de-dup.
///
/// ```
/// use pawacloud_core::sha256_hex;
/// assert_eq!(
///     sha256_hex(b"hello"),
///     "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
/// );
/// assert_eq!(sha256_hex(b"").len(), 64);
/// ```
#[pyfunction]
pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

/// Detect a likely BCP-47 language hint by Unicode block scan over a sample.
/// Returns one of: "en", "ar", "zh", "ru", "hi", "am", "und".
///
/// ```
/// use pawacloud_core::detect_script;
/// assert_eq!(detect_script("hello world", 1024), "en");
/// assert_eq!(detect_script("مرحبا بالعالم", 1024), "ar");
/// assert_eq!(detect_script("你好世界", 1024), "zh");
/// assert_eq!(detect_script("привет мир", 1024), "ru");
/// assert_eq!(detect_script("नमस्ते दुनिया", 1024), "hi");
/// assert_eq!(detect_script("", 1024), "und");
/// ```
#[pyfunction]
pub fn detect_script(text: &str, sample_chars: usize) -> String {
    let mut counts = [0usize; 6]; // latin, arabic, cjk, cyrillic, devanagari, ethiopic
    let mut total = 0usize;

    for ch in text.chars().take(sample_chars) {
        if !ch.is_alphabetic() {
            continue;
        }
        total += 1;
        let cp = ch as u32;
        match cp {
            0x0041..=0x024F => counts[0] += 1,                   // Latin
            0x0600..=0x06FF | 0x0750..=0x077F => counts[1] += 1, // Arabic
            0x4E00..=0x9FFF | 0x3400..=0x4DBF => counts[2] += 1, // CJK
            0x0400..=0x04FF => counts[3] += 1,                   // Cyrillic
            0x0900..=0x097F => counts[4] += 1,                   // Devanagari
            0x1200..=0x137F => counts[5] += 1,                   // Ethiopic (Amharic, Tigrinya)
            _ => {}
        }
    }

    if total == 0 {
        return "und".to_string();
    }

    let (winner_idx, &winner_count) = counts.iter().enumerate().max_by_key(|(_, &c)| c).unwrap();

    if winner_count * 100 / total < 60 {
        return "und".to_string();
    }

    match winner_idx {
        0 => "en",
        1 => "ar",
        2 => "zh",
        3 => "ru",
        4 => "hi",
        5 => "am",
        _ => "und",
    }
    .to_string()
}

/// Normalize document text — preserves paragraph breaks (distinct from `sanitize_input`
/// which collapses all whitespace). Strips control chars, collapses spaces inside
/// paragraphs, dedupes consecutive blank lines, normalizes line endings to `\n`.
///
/// ```
/// use pawacloud_core::normalize_document_text;
/// assert_eq!(normalize_document_text("a\r\n\r\n\r\nb"), "a\n\nb");
/// assert_eq!(normalize_document_text("foo   bar\nbaz"), "foo bar\nbaz");
/// assert_eq!(normalize_document_text("hello\x00world"), "helloworld");
/// ```
#[pyfunction]
pub fn normalize_document_text(raw: &str) -> String {
    let unified = raw.replace("\r\n", "\n").replace('\r', "\n");

    let mut out = String::with_capacity(unified.len());
    let mut blank_streak = 0usize;

    for line in unified.split('\n') {
        let cleaned: String = line
            .chars()
            .filter(|c| !c.is_control() || *c == '\t')
            .collect();
        let collapsed: String = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");

        if collapsed.is_empty() {
            blank_streak += 1;
            // emit the paragraph-break newline on first blank line only
            if blank_streak == 1 && !out.is_empty() {
                out.push('\n');
            }
        } else {
            blank_streak = 0;
            // invariant: the blank-line branch always leaves at most one trailing '\n',
            // so a single push here yields the desired '\n\n' paragraph separator.
            if !out.is_empty() {
                out.push('\n');
            }
            out.push_str(&collapsed);
        }
    }

    out.trim_matches('\n').to_string()
}

/// Token-budgeted markdown chunker. Splits on heading boundaries first, then
/// paragraph boundaries. Never splits mid-sentence; respects the budget loosely
/// (won't split a single oversize paragraph — caller can apply secondary truncation).
///
/// ```
/// use pawacloud_core::chunk_markdown;
/// let chunks = chunk_markdown("## A\npara one.\n\n## B\npara two.", 100);
/// assert_eq!(chunks.len(), 1);
/// let big: String = (0..50).map(|_| "## H\nx\n\n").collect();
/// let chunks = chunk_markdown(&big, 50);
/// assert!(chunks.len() > 1);
/// ```
#[pyfunction]
pub fn chunk_markdown(text: &str, max_tokens: usize) -> Vec<String> {
    fn estimate(s: &str) -> usize {
        let chars = s.len();
        let words = s.split_whitespace().count();
        (chars / 4 + words * 4 / 3) / 2
    }

    if estimate(text) <= max_tokens {
        return vec![text.to_string()];
    }

    let blocks: Vec<&str> = text.split("\n\n").collect();
    let mut chunks = Vec::new();
    let mut current = String::new();

    for block in blocks {
        let block_tokens = estimate(block);
        let current_tokens = estimate(&current);

        if !current.is_empty() && current_tokens + block_tokens > max_tokens {
            chunks.push(current.trim().to_string());
            current = String::new();
        }

        if !current.is_empty() {
            current.push_str("\n\n");
        }
        current.push_str(block);
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_string());
    }

    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_hex_known_vector() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn sha256_hex_empty() {
        assert_eq!(sha256_hex(b"").len(), 64);
    }

    #[test]
    fn detect_script_mixed_returns_und() {
        let mixed = "abcde مرحبا";
        let result = detect_script(mixed, 1024);
        assert_eq!(result, "und");
    }

    #[test]
    fn detect_script_ethiopic() {
        assert_eq!(detect_script("ሰላም ዓለም", 1024), "am");
    }

    #[test]
    fn normalize_strips_control_keeps_paragraph() {
        let raw = "Para one\x00 stuff\n\nPara two\n\n\n\nPara three";
        let out = normalize_document_text(raw);
        assert_eq!(out, "Para one stuff\n\nPara two\n\nPara three");
    }

    #[test]
    fn normalize_handles_windows_line_endings() {
        assert_eq!(
            normalize_document_text("line1\r\nline2\r\n\r\nline3"),
            "line1\nline2\n\nline3"
        );
    }

    #[test]
    fn normalize_handles_leading_blank_lines() {
        // documents that start with blank lines should drop them entirely,
        // not produce a leading "\n" — the trim_matches at the end + the
        // !out.is_empty() guard on the blank-streak path together cover this.
        assert_eq!(normalize_document_text("\n\nfoo"), "foo");
        assert_eq!(normalize_document_text("\n\n\n\nfoo\n\nbar"), "foo\n\nbar");
    }

    #[test]
    fn chunk_markdown_splits_when_oversize() {
        let big: String = (0..200)
            .map(|i| format!("para {i} with words.\n\n"))
            .collect();
        let chunks = chunk_markdown(&big, 100);
        assert!(chunks.len() > 1);
    }

    #[test]
    fn chunk_markdown_single_when_small() {
        let chunks = chunk_markdown("short doc", 1000);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "short doc");
    }
}
