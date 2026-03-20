import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Email Work Console",
  description: "Cross-account Gmail work coordination dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
