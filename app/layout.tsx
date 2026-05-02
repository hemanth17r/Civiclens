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
  title: "CivicLens",
  description: "Accountability You Can See",
  verification: {
    google: "08wTaMLvsSQFGPhXn5S664z6Nq6_wNfGqM0T9tO1TDU",
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
