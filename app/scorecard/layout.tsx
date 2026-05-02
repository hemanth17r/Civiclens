import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "City Scorecard",
  description:
    "Track civic issue resolution in your city. See active issues, recently resolved problems, and the top contributors making a difference.",
};

export default function ScorecardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
