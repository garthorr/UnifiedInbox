import type { Metadata, Viewport, ReactNode } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
