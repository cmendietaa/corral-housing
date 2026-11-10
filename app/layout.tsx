import type { Metadata, Viewport } from "next";
import "@fontsource/caprasimo/400.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/400-italic.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corral",
  description:
    "A private shared board for UCSB roommate groups to save, map, compare and follow up on Isla Vista and Goleta rentals."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
