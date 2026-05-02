import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Shell from "@/components/Shell";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";

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
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "CivicLens",
    title: "CivicLens — Report & Track Civic Issues in Your City",
    description:
      "Report potholes, waste, water, and infrastructure issues in your city. Track progress, verify resolutions, and hold officials accountable.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CivicLens — Report & Track Civic Issues in Your City",
    description:
      "Report potholes, waste, water, and infrastructure issues in your city. Track progress, verify resolutions, and hold officials accountable.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
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
