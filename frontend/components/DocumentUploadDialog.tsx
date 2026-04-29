// SPDX-License-Identifier: MIT
"use client";

import { Loader2, Upload, FileText } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CameraCapture } from "@/components/CameraCapture";
import { LanguagePicker } from "@/components/LanguagePicker";
import {
  uploadDocument,
  type ArtifactSummary,
  type ProcessAction,
} from "@/lib/api";
import { haptics } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onReady: (
    artifact: ArtifactSummary,
    action: ProcessAction,
    targetLang: string,
  ) => void;
}

const MAX_BYTES = 10 * 1024 * 1024;

export function DocumentUploadDialog({ open, onOpenChange, onReady }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [action, setAction] = useState<ProcessAction>("summarize");
  const [lang, setLang] = useState("en");
  const [uploading, setUploading] = useState(false);
  const [artifact, setArtifact] = useState<ArtifactSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setArtifact(null);
    setUploading(false);
  }, []);

  const handleFile = useCallback((f: File) => {
    haptics.tap();
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      toast.warn("Only .pdf and .docx files are supported.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.warn("That file is over the 10 MB limit.");
      return;
    }
    setFile(f);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const summary = await uploadDocument(file);
      setArtifact(summary);
      toast.success("Document ready.");
      if (lang === "en" && summary.source_lang) setLang(summary.source_lang);
    } catch {
      toast.error("Couldn't upload. Check your connection.");
      setUploading(false);
    }
  }, [file, lang, uploading]);

  const handleSubmit = useCallback(() => {
    if (!artifact) return;
    onReady(artifact, action, lang);
    onOpenChange(false);
    setTimeout(reset, 200);
  }, [artifact, action, lang, onOpenChange, onReady, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>PDF or DOCX, up to 10 MB.</DialogDescription>
        </DialogHeader>

        {!artifact ? (
          <Tabs defaultValue="file">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">File</TabsTrigger>
              <TabsTrigger value="camera">Camera</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-3">
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/40 px-6 py-10 text-center transition-colors",
                  file
                    ? "border-pawa-cyan/40 bg-pawa-cyan/5"
                    : "hover:border-pawa-cyan/30",
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {file ? (
                  <>
                    <FileText className="h-8 w-8 text-pawa-cyan" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-[var(--muted-foreground)]" />
                    <p className="text-sm">Tap to choose or drop a file here</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      .pdf or .docx
                    </p>
                  </>
                )}
              </div>
            </TabsContent>
            <TabsContent value="camera" className="mt-3">
              <CameraCapture
                uploading={uploading}
                onPicked={async (f) => {
                  setFile(f);
                  setUploading(true);
                  try {
                    const summary = await uploadDocument(f);
                    setArtifact(summary);
                    toast.success("Document ready.");
                    if (lang === "en" && summary.source_lang)
                      setLang(summary.source_lang);
                  } catch {
                    toast.error("Couldn't upload. Check your connection.");
                    setUploading(false);
                  }
                }}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-3 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-pawa-cyan" />
              <span className="font-medium">{artifact.filename}</span>
              <span className="ml-auto text-xs text-[var(--muted-foreground)]">
                {artifact.page_count} pp · {artifact.char_count.toLocaleString()} chars
              </span>
            </div>
            {artifact.parsed_preview && (
              <p className="line-clamp-3 text-xs text-[var(--muted-foreground)]">
                {artifact.parsed_preview}
              </p>
            )}
            {artifact.warnings.map((w) => (
              <p key={w.code} className="text-xs text-pawa-error">
                {w.message}
              </p>
            ))}

            <Tabs
              value={action}
              onValueChange={(v) => setAction(v as ProcessAction)}
            >
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="summarize">Summarize</TabsTrigger>
                <TabsTrigger value="translate">Translate</TabsTrigger>
              </TabsList>
            </Tabs>

            <LanguagePicker
              value={lang}
              onChange={setLang}
              detectedSource={artifact.source_lang}
            />
          </div>
        )}

        <DialogFooter>
          {!artifact ? (
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Upload
            </Button>
          ) : (
            <Button onClick={handleSubmit}>
              {action === "summarize" ? "Summarize" : "Translate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
