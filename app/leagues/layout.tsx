import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Civic Champions Leaderboard",
  description:
    "See the top civic contributors in your city. Compete on XP, trust score, and community impact on the CivicLens leaderboard.",
};

export default function LeaguesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
