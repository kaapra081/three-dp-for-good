import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3DP for Good — Tools for more independent care",
  description:
    "3DP for Good designs and 3D-prints assistive, adaptive, sensory, and patient-support tools with patients and healthcare partners.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
