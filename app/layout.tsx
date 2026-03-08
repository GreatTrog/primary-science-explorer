import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const bodyFont = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Baloo_2({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Primary Science Explorer",
  description: "Metadata-driven enquiry science investigations for primary pupils.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-screen antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
