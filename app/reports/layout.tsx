import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
