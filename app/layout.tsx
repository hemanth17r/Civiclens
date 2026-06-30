import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Shell from "@/components/Shell";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import JsonLd from "@/components/JsonLd";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://civiclens.tech"),
  title: {
    default: "CivicLens — Report & Track Civic Issues in Your City",
    template: "%s — CivicLens",
  },
  description:
    "Report potholes, waste, water, and infrastructure issues in your city. Track progress, verify resolutions, and hold officials accountable — all in one platform.",
  verification: {
    google: "08wTaMLvsSQFGFRaRQZq-E8gkXWS_pPWm8hWnc2_LaY",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CivicLens",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "CivicLens",
    title: "CivicLens — Report & Track Civic Issues in Your City",
    description:
      "Report potholes, waste, water, and infrastructure issues in your city. Track progress, verify resolutions, and hold officials accountable.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CivicLens — Accountability You Can See",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CivicLens — Report & Track Civic Issues in Your City",
    description:
      "Report potholes, waste, water, and infrastructure issues in your city. Track progress, verify resolutions, and hold officials accountable.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#2563eb" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                window.deferredPrompt = e;
                window.dispatchEvent(new CustomEvent('pwa-prompt-available', { detail: e }));
              });
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        <JsonLd />
        <AuthProvider>
          <ToastProvider>
            <Shell>
              {children}
            </Shell>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
