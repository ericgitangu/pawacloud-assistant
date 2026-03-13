import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Status — PawaCloud Assistant",
  description: "Live health monitoring for PawaCloud Assistant services: API, Gemini LLM, Rust Core, and Cloud Run infrastructure.",
  openGraph: {
    title: "System Status — PawaCloud Assistant",
    description: "Real-time health dashboard for PawaCloud backend services.",
  },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
