// SPDX-License-Identifier: MIT
"use client";

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { marked } from "marked";

export async function renderDocx(
  markdown: string,
  baseFilename: string,
): Promise<void> {
  const tokens = marked.lexer(markdown);
  const blocks: Paragraph[] = [];

  for (const tok of tokens) {
    if (tok.type === "heading") {
      const t = tok as { depth: number; text: string };
      const level =
        t.depth === 1
          ? HeadingLevel.HEADING_1
          : t.depth === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
      blocks.push(
        new Paragraph({ heading: level, children: [new TextRun(t.text)] }),
      );
    } else if (tok.type === "paragraph") {
      const t = tok as { text: string };
      blocks.push(new Paragraph({ children: [new TextRun(t.text)] }));
    } else if (tok.type === "list") {
      const t = tok as { items: { text: string }[] };
      for (const item of t.items) {
        blocks.push(
          new Paragraph({ children: [new TextRun({ text: `• ${item.text}` })] }),
        );
      }
    } else if (tok.type === "code") {
      const t = tok as { text: string };
      for (const line of t.text.split("\n")) {
        blocks.push(
          new Paragraph({
            children: [new TextRun({ text: line, font: "Courier New" })],
          }),
        );
      }
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children: blocks }],
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${baseFilename}.docx`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
