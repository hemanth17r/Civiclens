import type { Metadata } from "next";
import { db } from "@/lib/firebase-admin";

interface IssuePageParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: IssuePageParams): Promise<Metadata> {
  const { id } = await params;

  // Fallback metadata if Firestore fetch fails
  const fallback: Metadata = {
    title: "Issue Details",
    description: "View civic issue details, status updates, and community verification progress on CivicLens.",
  };

  try {
    // firebase-admin may not be available in all environments (e.g. missing service account key)
    if (!db) return fallback;

    const docSnap = await db.collection("issues").doc(id).get();

    if (!docSnap.exists) {
      return {
        title: "Issue Not Found",
        description: "This civic issue could not be found on CivicLens.",
      };
    }

    const data = docSnap.data();
    if (!data) return fallback;

    // Only expose metadata for approved issues (not "Reported" / pending approval)
    const status = data.status || "Reported";
    if (status === "Reported") {
      return {
        title: "Issue Under Review",
        description: "This issue is currently under review by CivicLens moderators.",
        robots: { index: false, follow: false },
      };
    }

    const title = data.title || "Civic Issue";
    const city = data.cityName || "";
    const category = data.category || "";
    const description = data.description
      ? data.description.slice(0, 155)
      : `${category} issue${city ? ` in ${city}` : ""} — tracked and verified by the community on CivicLens.`;

    return {
      title: `${title}${city ? ` — ${city}` : ""}`,
      description,
      openGraph: {
        title: `${title}${city ? ` — ${city}` : ""}`,
        description,
        type: "article",
        ...(data.imageUrl ? { images: [{ url: data.imageUrl }] } : {}),
      },
      twitter: {
        card: data.imageUrl ? "summary_large_image" : "summary",
        title: `${title}${city ? ` — ${city}` : ""}`,
        description,
        ...(data.imageUrl ? { images: [data.imageUrl] } : {}),
      },
    };
  } catch (error) {
    // Graceful degradation — don't break the page if admin SDK fails
    console.error("generateMetadata: Failed to fetch issue:", error);
    return fallback;
  }
}

export default function IssueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
