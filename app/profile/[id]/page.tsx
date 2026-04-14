'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Issue } from '@/lib/issues';
import IssueCard from '@/components/IssueCard';
import { ArrowLeft, UserCircle2, AlertTriangle, ShieldCheck, ChevronDown, Award, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { reportUser } from '../../../lib/moderation';
import { getFollowStatus, getFollowStats, followUser, unfollowUser } from '@/lib/followers';
import ConnectionsModal from '@/components/ConnectionsModal';
import { getUserGamificationStats } from '@/lib/gamification';
import { getUserTrustStats, getVoteWeightTier } from '@/lib/trust';
import { getUserCityRank } from '@/lib/users';
import { TrustBadge } from '@/components/GamificationUI';
import VerifiedBadge from '@/components/VerifiedBadge';

export default function PublicProfilePage() {
    const params = useParams();
    const router = useRouter();
    const profileId = params?.id as string;
    const { user: currentUser } = useAuth();

    const [profile, setProfile] = useState<any>(null);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Gamification & Trust state
    const [gamification, setGamification] = useState<any>(null);
    const [trustInfo, setTrustInfo] = useState<{ 
        trustScore: number; 
        tier: ReturnType<typeof getVoteWeightTier>;
        accurateVotes: number;
        wrongVotes: number;
    } | null>(null);
    const [cityRank, setCityRank] = useState<number>(0);

    // Reporting state
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('Inappropriate Content');
    const [reportDetails, setReportDetails] = useState('');
    const [reporting, setReporting] = useState(false);
    const [isReportDropdownOpen, setIsReportDropdownOpen] = useState(false);

    // Follow logic state
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [connectionsModalType, setConnectionsModalType] = useState<'followers' | 'following' | null>(null);

    useEffect(() => {
        if (!profileId) return;

        const fetchProfileData = async () => {
            setLoading(true);
            try {
                // Fetch User Docs
                const userDoc = await getDoc(doc(db, 'users', profileId));
                if (!userDoc.exists()) {
                    setError("User not found.");
                    setLoading(false);
                    return;
                }
                const userData = userDoc.data();
                setProfile({ ...userData, uid: profileId });

                // Fetch Public Issues reported by this user
                const issuesQuery = query(
                    collection(db, 'issues'),
                    where('userId', '==', profileId),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );

                const snap = await getDocs(issuesQuery);
                const fetchedIssues = snap.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
                // Allow all statuses so the community can vote on 'Verification Needed' / 'Reported' ones
                const publicIssues = fetchedIssues;
                setIssues(publicIssues);

                // Fetch Gamification & Trust Data
                const [gData, tData] = await Promise.all([
                    getUserGamificationStats(profileId),
                    getUserTrustStats(profileId),
                ]);
                setGamification(gData);
                setTrustInfo({
                    trustScore: tData.trustScore,
                    tier: tData.tier,
                    accurateVotes: tData.accurateVotes,
                    wrongVotes: tData.wrongVotes
                });

                if (userData.city) {
                    const rank = await getUserCityRank(userData.city, gData.xp);
                    setCityRank(rank);
                }

            } catch (err) {
                console.error("Error fetching profile:", err);
                setError("Failed to load profile.");
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, [profileId]);

    // Fetch Follow Data
    useEffect(() => {
        if (!profileId) return;
        const fetchFollowData = async () => {
            const stats = await getFollowStats(profileId);
            setFollowersCount(stats.followersCount);
            setFollowingCount(stats.followingCount);

            if (currentUser) {
                const following = await getFollowStatus(currentUser.uid, profileId);
                setIsFollowing(following);
            }
        };
        fetchFollowData();
    }, [profileId, currentUser]);

    const handleFollowToggle = async () => {
        if (!currentUser) {
            alert("You must be logged in to follow users.");
            return;
        }
        setActionLoading(true);
        try {
            if (isFollowing) {
                await unfollowUser(currentUser.uid, profileId);
                setFollowersCount(prev => prev - 1);
                setIsFollowing(false);
            } else {
                await followUser(currentUser.uid, profileId);
                setFollowersCount(prev => prev + 1);
                setIsFollowing(true);
            }
        } catch (e) {
            console.error('Follow action failed:', e);
            alert("Failed to update follow status.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReport = async () => {
        if (!currentUser) {
            alert("You must be logged in to report a user.");
            return;
        }
        setReporting(true);
        try {
            await reportUser(profileId, currentUser.uid, reportReason, reportDetails);
            alert("Report submitted successfully.");
            setShowReportModal(false);
        } catch (e) {
            alert("Failed to submit report.");
        } finally {
            setReporting(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading profile...</div>;
    }

    if (error || !profile) {
        return (
            <div className="max-w-2xl mx-auto p-4 md:p-8 text-center">
                <button onClick={() => router.back()} className="mb-4 text-blue-600 font-semibold hover:underline flex items-center justify-center mx-auto gap-2">
                    <ArrowLeft size={16} /> Back
                </button>
                <h1 className="text-2xl font-bold text-gray-900">{error || "User not found"}</h1>
            </div>
        );
    }

    const isSelf = currentUser?.uid === profileId;

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                >
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Public Profile</h1>
                </div>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left relative">

                {/* Report Button (Top Right) */}
                {!isSelf && currentUser && (
                    <button
                        onClick={() => setShowReportModal(true)}
                        className="absolute top-6 right-6 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Report User"
                    >
                        <AlertTriangle size={20} />
                    </button>
                )}

                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0 border-4 border-white shadow-lg overflow-hidden">
                    {profile.photoURL ? (
                        <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                    ) : (
                        <UserCircle2 size={40} className="text-blue-500" />
                    )}
                </div>

                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {profile.displayName || 'Anonymous Citizen'}
                        </h2>
                        {trustInfo && (
                            <TrustBadge
                                trustScore={trustInfo.trustScore}
                                tierName={trustInfo.tier.name}
                                tierColor={trustInfo.tier.color}
                                size="sm"
                            />
                        )}
                        {profile.email === 'hemanthreddya276@gmail.com' ? (
                            <VerifiedBadge label="Admin" size="sm" />
                        ) : profile.role === 'official' && (
                            <div title="Verified Official" className="flex items-center text-blue-600">
                                <ShieldCheck size={20} />
                            </div>
                        )}
                    </div>

                    <p className="text-lg text-blue-600 font-medium">@{profile.handle || 'citizen'}</p>

                    {profile.role === 'official' && profile.department && (
                        <p className="text-sm text-gray-600 bg-gray-100 inline-block px-3 py-1 rounded-full">
                            {profile.email === 'hemanthreddya276@gmail.com' ? 'Admin' : profile.department} Department • {profile.jurisdiction}
                        </p>
                    )}

                    <div className="pt-4 flex gap-6 justify-center md:justify-start">
                        <div
                            className="text-center md:text-left cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setConnectionsModalType('followers')}
                        >
                            <p className="text-xl font-bold text-gray-900">{followersCount}</p>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Followers</p>
                        </div>
                        <div
                            className="text-center md:text-left cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setConnectionsModalType('following')}
                        >
                            <p className="text-xl font-bold text-gray-900">{followingCount}</p>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Following</p>
                        </div>
                    </div>

                    {!isSelf && (
                        <div className="pt-5 mt-2 flex gap-3 w-full md:w-auto">
                            <button
                                onClick={handleFollowToggle}
                                disabled={actionLoading}
                                className={`flex-1 md:flex-none md:w-32 py-2 rounded-xl font-bold transition-all text-sm ${isFollowing
                                    ? 'bg-gray-100 text-gray-800 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-transparent'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20'
                                    }`}
                            >
                                {actionLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Civic Impact Section */}
            {gamification && (
                <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm">
                    <h3 className="text-[13px] font-bold text-gray-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Award size={18} className="text-blue-500" />
                        Civic Impact
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-gray-900">{issues.length}</span>
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Issues Reported</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-blue-600">{gamification.stats.totalVerifications}</span>
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Issues Verified</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-emerald-600">{gamification.stats.totalResolved}</span>
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Issues Resolved</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-purple-600">
                                {trustInfo && (trustInfo.accurateVotes + trustInfo.wrongVotes) > 0 
                                    ? Math.round((trustInfo.accurateVotes / (trustInfo.accurateVotes + trustInfo.wrongVotes)) * 100) + '%'
                                    : '--'}
                            </span>
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Verification Accuracy</span>
                        </div>
                        
                        <div className="col-span-2 md:col-span-4 mt-2 pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Contribution Score</span>
                                <span className="text-4xl font-black text-amber-500 flex items-center gap-2 mt-1">
                                    <Zap size={28} className="fill-amber-500" /> {gamification.xp}
                                </span>
                            </div>
                            <div className="flex flex-col text-left md:text-right w-full md:w-auto">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">City Rank</span>
                                <span className="text-3xl font-black text-gray-900 mt-1">
                                    {cityRank > 0 ? `#${cityRank}` : '--'} <span className="text-lg font-semibold text-gray-500 ml-1">in {profile.city || 'City'}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reported Issues Feed */}
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    Reported Issues
                    <span className="bg-blue-100 text-blue-700 text-xs py-0.5 px-2.5 rounded-full font-bold">
                        {issues.length}
                    </span>
                </h3>

                {issues.length === 0 ? (
                    <div className="bg-gray-50 rounded-2xl p-12 text-center border border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserCircle2 size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No Community Activity Yet</h3>
                        <p className="text-gray-500">This user hasn't reported any public issues.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {issues.map(issue => (
                            <IssueCard key={issue.id} issue={issue} />
                        ))}
                    </div>
                )}
            </div>

            {/* Report Modal */}
            {showReportModal && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm"
                    onClick={() => setShowReportModal(false)}
                >
                    <div 
                        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <AlertTriangle className="text-red-500" />
                                Report User
                            </h2>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="relative">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Reason</label>

                                <button
                                    type="button"
                                    onClick={() => setIsReportDropdownOpen((prev) => !prev)}
                                    className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium text-left"
                                >
                                    <span className="text-gray-900">{reportReason}</span>
                                    <ChevronDown size={20} strokeWidth={2.5} className="text-gray-400" />
                                </button>

                                {isReportDropdownOpen && (
                                    <div className="absolute z-10 top-[76px] left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                        {[
                                            'Inappropriate Content',
                                            'Spam or Abuse',
                                            'Fake Account / Impersonation',
                                            'Harassment',
                                            'Other'
                                        ].map((reason) => (
                                            <button
                                                key={reason}
                                                type="button"
                                                onClick={() => {
                                                    setReportReason(reason);
                                                    setIsReportDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-sm font-medium ${reportReason === reason ? 'text-red-600 bg-red-50 hover:bg-red-50' : 'text-gray-700'
                                                    }`}
                                            >
                                                {reason}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Details (Optional)</label>
                                <textarea
                                    value={reportDetails}
                                    onChange={e => setReportDetails(e.target.value)}
                                    placeholder="Please provide any additional context..."
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all min-h-[100px] resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 flex gap-3 justify-end items-center">
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReport}
                                disabled={reporting}
                                className="px-5 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {reporting ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConnectionsModal
                isOpen={!!connectionsModalType}
                onClose={() => setConnectionsModalType(null)}
                type={connectionsModalType || 'followers'}
                userId={profileId}
            />
        </div>
    );
}
