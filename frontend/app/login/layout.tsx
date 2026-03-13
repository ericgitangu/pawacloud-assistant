import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — PawaCloud Assistant",
  description: "Sign in to PawaCloud Assistant.",
  openGraph: {
    title: "Sign In — PawaCloud Assistant",
    description: "Sign in to continue your conversations.",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
