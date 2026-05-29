import type { Metadata } from "next";
import { Fraunces, Newsreader } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Cooking with June",
  description:
    "A warm, editorial home cookbook by Jacob & Lily — with June supervising.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${newsreader.variable}`}>
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-5 py-10 md:py-14">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
