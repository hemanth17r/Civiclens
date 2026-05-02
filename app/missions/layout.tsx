import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flash Missions",
  robots: { index: false, follow: false },
};

export default function MissionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
