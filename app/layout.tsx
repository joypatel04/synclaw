import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { PwaRegistrar } from "@/components/pwa/PwaRegistrar";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { brand } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://synclaw.in"),
  title: {
    default: brand.seo.titleDefault,
    template: "%s | Synclaw",
  },
  description: brand.seo.descriptionDefault,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: brand.seo.titleDefault,
    description: brand.seo.descriptionDefault,
    url: "https://synclaw.in",
    siteName: "Synclaw",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: brand.seo.titleDefault,
    description: brand.seo.descriptionDefault,
    images: ["/og-image.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: brand.product.name,
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires innerHTML
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: "Synclaw",
                  url: "https://synclaw.in",
                  description: brand.seo.descriptionDefault,
                },
                {
                  "@type": "WebSite",
                  name: "Synclaw",
                  url: "https://synclaw.in",
                },
                {
                  "@type": "SoftwareApplication",
                  name: "Synclaw",
                  applicationCategory: "DeveloperApplication",
                  operatingSystem: "Web",
                  description: brand.seo.descriptionDefault,
                  url: "https://synclaw.in",
                  offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "USD",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <PwaRegistrar />
        <ThemeProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
