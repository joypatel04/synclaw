import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { PwaRegistrar } from "@/components/pwa/PwaRegistrar";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { UmamiAnalytics } from "@/components/analytics/UmamiAnalytics";
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
  title: brand.seo.titleDefault,
  description: brand.seo.descriptionDefault,
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
          defer
          src="https://sutraha-umami.zeabur.app/script.js"
          data-website-id="f7ff4521-6a76-4885-9932-44c7802db117"
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <PwaRegistrar />
        <Script
          defer
          src="https://sutraha-umami.zeabur.app/script.js"
          data-website-id="f7ff4521-6a76-4885-9932-44c7802db117"
        />
        <ThemeProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ThemeProvider>
        <UmamiAnalytics />
      </body>
    </html>
  );
}
