import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Mono, Cormorant_Garamond } from "next/font/google";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  weight: ["300", "400"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pawacloud-web.fly.dev"),
  title: "PawaCloud Assistant",
  description: "Your AI assistant for cloud infrastructure, general knowledge, and everything in between.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PawaCloud",
  },
  openGraph: {
    title: "PawaCloud Assistant",
    description: "AI assistant for cloud, code, and general questions.",
    url: "https://pawacloud-web.fly.dev",
    siteName: "PawaCloud Assistant",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "PawaCloud Assistant" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PawaCloud Assistant",
    description: "AI assistant for cloud, code, and general questions.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#00b4d8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${dmSans.variable} ${dmMono.variable} ${cormorant.variable} min-h-screen antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
