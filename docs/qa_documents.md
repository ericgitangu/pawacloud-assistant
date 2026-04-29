# Manual QA — Document upload

Walk through these on a real device before merging.

## Setup

- [ ] `make dev-backend` running on `:8000`
- [ ] `make dev-frontend` running on `:3000`
- [ ] Sign in (Google OAuth or email/password)

## Golden path — file upload

- [ ] Click paperclip → dialog opens
- [ ] Drag-drop a small PDF (or tap to choose)
- [ ] Click Upload → toast `"Document ready."` + haptic
- [ ] Pick `Summarize → English` → click Summarize
- [ ] ArtifactCard appears in chat thread (filename, page count, chips)
- [ ] Output bubble streams markdown chunk-by-chunk with caret cursor
- [ ] On `done`: toast `"Summary ready."` + haptic + Copy + Download buttons
- [ ] Re-run same upload + same action + same lang → toast `"Loaded from cache."`, instant render
- [ ] Re-run same upload + same action + different lang → fresh stream
- [ ] Click History → see paperclip-tagged item; click → restores in chat

## Camera path

- [ ] Click paperclip → switch to Camera tab
- [ ] Capture or upload a photo
- [ ] Sharpness pill shows (clear / soft / blurry)
- [ ] Submit disabled while blurry; warn haptic
- [ ] Retake works
- [ ] Use this photo → upload + stream same as the file path

## Edge cases

- [ ] Upload `.txt` file → toast `"Only .pdf and .docx files are supported."`
- [ ] Upload >10 MB pdf → toast `"That file is over the 10 MB limit."`
- [ ] Upload >8 MB image → toast `"That photo is over the 8 MB limit."`
- [ ] Upload scanned PDF without `GOOGLE_VISION_KEY_PATH` set
      → ArtifactCard shows `scanned_no_ocr` warning row
- [ ] Backend down mid-stream → toast `"Something went wrong. Try again."`
- [ ] Click Download → md/txt → file in Downloads
- [ ] Click Download → docx → opens cleanly in Word/LibreOffice
- [ ] Click Download → pdf → renders headings + lists
- [ ] Copy output → toast `"Copied."` + clipboard contains markdown

## Mobile (≤sm breakpoint)

- [ ] Dialog renders comfortably (drop zone, language picker chips)
- [ ] Paperclip button is at least 44×44 (touch-friendly)
- [ ] LanguagePicker chips wrap reasonably
- [ ] Download menu opens upward (no clipping)
- [ ] Haptics fire on tap (test device only)

## Cache invalidation

- [ ] Delete history item → next process call regenerates? (artifacts/outputs survive history deletion since they're keyed by sha256, not session)

© 2026 Eric Gitangu — MIT licensed.
