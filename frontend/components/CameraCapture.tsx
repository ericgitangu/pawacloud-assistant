// SPDX-License-Identifier: MIT
"use client";

import { Camera, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { estimateBlur, type BlurVerdict } from "@/lib/blurDetect";
import { haptics } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
  onPicked: (file: File) => void;
  uploading?: boolean;
}

const VERDICT_COPY: Record<BlurVerdict, { label: string; tone: string }> = {
  clear: {
    label: "Looks clear ✓",
    tone: "border-pawa-accent/40 bg-pawa-accent/10 text-pawa-accent",
  },
  soft: {
    label: "A little soft — try again?",
    tone: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500",
  },
  blurry: {
    label: "Try a steadier shot",
    tone: "border-pawa-error/40 bg-pawa-error/10 text-pawa-error",
  },
};

export function CameraCapture({ onPicked, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<BlurVerdict | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [picked, setPicked] = useState<File | null>(null);

  const handle = useCallback(async (file: File) => {
    haptics.tap();
    if (!file.type || !/^image\/(jpeg|png)$/.test(file.type)) {
      toast.warn("Only JPG or PNG photos.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.warn("That photo is over the 8 MB limit.");
      return;
    }
    setPicked(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalyzing(true);
    try {
      const { verdict: v } = await estimateBlur(file);
      setVerdict(v);
      if (v === "blurry") haptics.warn();
      else haptics.success();
    } catch {
      setVerdict("soft");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!picked || verdict === "blurry") return;
    onPicked(picked);
  }, [picked, verdict, onPicked]);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handle(f);
        }}
      />

      {!previewUrl ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/40 px-6 py-10 text-center transition-colors hover:border-pawa-cyan/30"
        >
          <Camera className="h-8 w-8 text-[var(--muted-foreground)]" />
          <p className="text-sm">Tap to open camera</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            JPG or PNG, up to 8 MB
          </p>
        </button>
      ) : (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="captured preview"
            className="max-h-64 w-full rounded-xl object-contain"
          />
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs",
              verdict
                ? VERDICT_COPY[verdict].tone
                : "border-[var(--border)] text-[var(--muted-foreground)]",
            )}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking sharpness…
              </>
            ) : verdict === "blurry" ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" /> {VERDICT_COPY.blurry.label}
              </>
            ) : verdict ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> {VERDICT_COPY[verdict].label}
              </>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPicked(null);
                setPreviewUrl(null);
                setVerdict(null);
                inputRef.current?.click();
              }}
              disabled={uploading}
            >
              Retake
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!verdict || verdict === "blurry" || uploading || analyzing}
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Use this photo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
