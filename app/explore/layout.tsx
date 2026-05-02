import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Trending Issues",
  description:
    "Discover trending civic issues in your city. Search by category, location, or user — find what matters to your community on CivicLens.",
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
