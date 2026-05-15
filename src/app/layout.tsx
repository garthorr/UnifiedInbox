import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { GlobalShortcuts } from "@/components/layout/GlobalShortcuts";

export const metadata: Metadata = {
  title: "Email Work Console",
  description: "Cross-account Gmail work coordination dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      </body>
    </html>
  );
}
