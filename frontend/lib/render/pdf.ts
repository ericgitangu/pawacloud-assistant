// SPDX-License-Identifier: MIT
"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { marked } from "marked";

export async function renderPdf(
  markdown: string,
  baseFilename: string,
): Promise<void> {
  const html = await marked.parse(markdown);

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "768px";
  container.style.padding = "32px";
  container.style.background = "#ffffff";
  container.style.color = "#0a0a0a";
  container.style.fontFamily = "system-ui, sans-serif";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.5";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
    });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`${baseFilename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
