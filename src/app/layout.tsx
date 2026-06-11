import type { Metadata, Viewport } from "next";
import { Libre_Caslon_Display, Newsreader } from "next/font/google";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { SITE_URL } from "@/lib/site";

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
  themeColor: "#a04a28",
};

const DESCRIPTION =
  "A warm, editorial home cookbook by Jacob & Lily — with June supervising.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cooking with June",
    template: "%s · Cooking with June",
  },
  description: DESCRIPTION,
  applicationName: "Cooking with June",
  appleWebApp: { capable: true, title: "Cooking with June", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  openGraph: {
    type: "website",
    siteName: "Cooking with June",
    title: "Cooking with June",
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Cooking with June" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cooking with June",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`${libreCaslon.variable} ${newsreader.variable}`}>
        <body className="min-h-screen bg-paper font-body text-ink antialiased">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
