import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Official Portal",
  robots: { index: false, follow: false },
};

export default function OfficialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
