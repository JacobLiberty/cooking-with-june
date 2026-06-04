import type { Metadata, Viewport } from "next";
import { Libre_Caslon_Display, Newsreader } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const libreCaslon = Libre_Caslon_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-caslon",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
});

export const viewport: Viewport = {
  themeColor: "#55622f",
};

export const metadata: Metadata = {
  title: "Cooking with June",
  description:
    "A warm, editorial home cookbook by Jacob & Lily — with June supervising.",
  appleWebApp: { capable: true, title: "Cooking with June", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${libreCaslon.variable} ${newsreader.variable}`}>
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
