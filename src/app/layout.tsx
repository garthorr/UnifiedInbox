import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { GlobalShortcuts } from "@/components/layout/GlobalShortcuts";
import { ServiceWorkerRegistrar } from "@/components/layout/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Email Work Console",
  description: "Cross-account Gmail work coordination dashboard",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "UnifiedInbox", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster />
        <GlobalShortcuts />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
