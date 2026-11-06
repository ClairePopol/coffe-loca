import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "COFFE LOCA — Good Coffee, Good Company",
  description:
    "Kopi yang baik, teman yang baik, dan jeda kecil untuk dinikmati pelan-pelan.",
};

export const viewport: Viewport = {
  themeColor: "#090502",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
