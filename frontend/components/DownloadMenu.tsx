// SPDX-License-Identifier: MIT
"use client";

import {
  Download,
  FileText,
  FileJson,
  FileType,
  FileSpreadsheet,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { toast } from "@/lib/toast";

interface Props {
  markdown: string;
  filename: string;
}

const stripMarkdown = (md: string): string =>
  md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, ""))
    .replace(/[#*_`>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const saveBlob = (data: string, mime: string, filename: string) => {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export function DownloadMenu({ markdown, filename }: Props) {
  const handle = async (format: "md" | "txt" | "docx" | "pdf") => {
    haptics.tap();
    try {
      switch (format) {
        case "md":
          saveBlob(markdown, "text/markdown", `${filename}.md`);
          break;
        case "txt":
          saveBlob(stripMarkdown(markdown), "text/plain", `${filename}.txt`);
          break;
        case "docx": {
          const { renderDocx } = await import("@/lib/render/docx");
          await renderDocx(markdown, filename);
          break;
        }
        case "pdf": {
          const { renderPdf } = await import("@/lib/render/pdf");
          await renderPdf(markdown, filename);
          break;
        }
      }
      toast.success("Downloaded.");
    } catch {
      toast.error("Couldn't generate the download.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          />
        }
      >
        <Download className="mr-1 h-3.5 w-3.5" />
        Download
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handle("md")}>
          <FileText className="mr-2 h-4 w-4" /> Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("txt")}>
          <FileJson className="mr-2 h-4 w-4" /> Plain text (.txt)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("docx")}>
          <FileType className="mr-2 h-4 w-4" /> Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("pdf")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
