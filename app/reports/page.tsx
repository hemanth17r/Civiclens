import IssueFeed from "@/components/IssueFeed";

export default function MyReportsPage() {
    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">My Reports</h1>
                <p className="text-gray-500 mt-2">Track the status of issues you've reported.</p>
            </div>
            {/* Hardcoded user ID to match what we use in createIssue */}
            <IssueFeed userId="guest_user_123" />
        </div>
    );
}
