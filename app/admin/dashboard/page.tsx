'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ShieldCheck, CheckCircle, XCircle, MessageSquare, Loader2, AlertTriangle, LayoutDashboard, Flag, Zap, ArrowLeft, Filter, MapPin } from 'lucide-react';
import { Issue } from '@/lib/issues';
import { notifyCitizenIssueApproved, notifyCitizenIssueRejected } from '@/lib/notifications';
import { warnUser, blockUser } from '@/lib/moderation';

export default function AdminDashboardPage() {
    const { user, isAdmin, loading } = useAuth();
    const router = useRouter();
    const [issues, setIssues] = useState<Issue[]>([]);
    const [approvedIssues, setApprovedIssues] = useState<Issue[]>([]);
    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [userReports, setUserReports] = useState<any[]>([]);
    const [fetching, setFetching] = useState(true);

    // Google Docs style active card view
    const [activeModule, setActiveModule] = useState<'home' | 'issues' | 'feedback' | 'reports'>('home');

    // Sort modules by usage
    const [recentModules, setRecentModules] = useState<string[]>(['issues', 'reports', 'feedback']);

    // Filters & Rejection state
    const [approvedCityFilter, setApprovedCityFilter] = useState<string>('All');
    const [rejectingIssueId, setRejectingIssueId] = useState<string | null>(null);
    const [rejectionRemark, setRejectionRemark] = useState('');

    useEffect(() => {
        if (!loading && !isAdmin) {
            router.replace('/');
        }
    }, [isAdmin, loading, router]);

    // Load recent modules from local storage for usage-based sorting
    useEffect(() => {
        // Module order is now fixed
    }, []);

    const openModule = (modId: string) => {
        setActiveModule(modId as any);
    };

    const fetchData = async () => {
        setFetching(true);
        try {
            // Fetch Pending Issues (First in, first out => oldest first)
            const pendingQuery = query(
                collection(db, 'issues'),
                where('status', '==', 'Reported'),
                // orderBy('createdAt', 'asc') -> Requires compound index, we will sort in memory for simplicity
            );
            const pendingSnap = await getDocs(pendingQuery);
            const allPending = pendingSnap.docs.map(d => ({ id: d.id, ...d.data() } as Issue));

            // Sort pending: Oldest at the top (lowest array index)
            allPending.sort((a, b) => {
                const tA = a.createdAt?.toMillis?.() || 0;
                const tB = b.createdAt?.toMillis?.() || 0;
                return tA - tB;
            });
            setIssues(allPending);

            // Fetch Approved Issues
            const approvedQuery = query(
                collection(db, 'issues'),
                where('status', 'in', ['Verification Needed', 'Verified', 'Active', 'Action Seen', 'Resolved']),
                limit(100)
            );
            const approvedSnap = await getDocs(approvedQuery);
            const allApproved = approvedSnap.docs.map(d => ({ id: d.id, ...d.data() } as Issue));
            allApproved.sort((a, b) => {
                const tA = a.createdAt?.toMillis?.() || 0;
                const tB = b.createdAt?.toMillis?.() || 0;
                return tB - tA; // Newest first
            });
            setApprovedIssues(allApproved);

            // Fetch Feedbacks
            const feedbackQuery = query(collection(db, 'feedbacks'));
            const feedbackSnap = await getDocs(feedbackQuery);
            setFeedbacks(feedbackSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // Fetch User Reports
            const reportsQuery = query(
                collection(db, 'user_reports'),
                where('status', '==', 'pending')
            );
            const reportsSnap = await getDocs(reportsQuery);
            setUserReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error('Error fetching admin data', e);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            fetchData();
        }
    }, [isAdmin]);

    const handleApprove = async (id: string, title: string, targetUid?: string) => {
        try {
            await updateDoc(doc(db, 'issues', id), {
                status: 'Verification Needed',
                approvedAt: serverTimestamp()
            });
            const approvedIssue = issues.find(i => i.id === id);
            setIssues(issues.filter(i => i.id !== id));

            if (approvedIssue) {
                // Add to approved list at top
                setApprovedIssues([{ ...approvedIssue, status: 'Verification Needed', approvedAt: Timestamp.now() }, ...approvedIssues]);
            }

            if (targetUid) {
                await notifyCitizenIssueApproved(id, title, targetUid);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const confirmReject = async () => {
        if (!rejectingIssueId) return;
        if (!rejectionRemark.trim()) {
            alert('Please provide a reason for rejection.');
            return;
        }

        const issueToReject = issues.find(i => i.id === rejectingIssueId);
        if (!issueToReject) return;

        try {
            await deleteDoc(doc(db, 'issues', rejectingIssueId));
            setIssues(issues.filter(i => i.id !== rejectingIssueId));

            if (issueToReject.userId) {
                await notifyCitizenIssueRejected(rejectingIssueId, issueToReject.title, issueToReject.userId, rejectionRemark);
            }

            setRejectingIssueId(null);
            setRejectionRemark('');
            alert('Issue rejected and user notified.');
        } catch (e) {
            console.error(e);
        }
    };


    // Extract unique cities for the approved issues filter
    const approvedCities = Array.from(new Set(approvedIssues.map(i => i.cityName || 'Unknown'))).filter(Boolean);

    // Filter approved issues by selected city
    const filteredApprovedIssues = approvedCityFilter === 'All'
        ? approvedIssues
        : approvedIssues.filter(i => (i.cityName || 'Unknown') === approvedCityFilter);

    if (loading || !isAdmin) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-gray-400" size={32} /></div>;
    }

    // Google Docs Style Card Renderer
    const renderModuleCards = () => {
        const moduleData = {
            issues: {
                title: 'Issues Management',
                icon: <AlertTriangle size={32} className="text-amber-500 mb-4" />,
                desc: 'Approve or reject citizen reports.',
                count: issues.length,
                color: 'bg-amber-50 border-amber-200'
            },
            feedback: {
                title: 'User Feedback',
                icon: <MessageSquare size={32} className="text-blue-500 mb-4" />,
                desc: 'Review comments and app suggestions.',
                count: feedbacks.length,
                color: 'bg-blue-50 border-blue-200'
            },
            reports: {
                title: 'User Reports',
                icon: <Flag size={32} className="text-red-500 mb-4" />,
                desc: 'Moderate flagged or toxic user accounts.',
                count: userReports.length,
                color: 'bg-red-50 border-red-200'
            }
        };

        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {recentModules.map(modId => {
                    const data = (moduleData as any)[modId];
                    if (!data) return null;
                    return (
                        <div
                            key={modId}
                            onClick={() => openModule(modId)}
                            className={`group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 ${data.color} bg-white`}
                        >
                            {data.count > 0 && (
                                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-500 text-white font-bold flex items-center justify-center shadow-md animate-bounce">
                                    {data.count}
                                </div>
                            )}
                            {data.icon}
                            <h3 className="font-bold text-gray-900 text-lg mb-2">{data.title}</h3>
                            <p className="text-center text-sm text-gray-500">{data.desc}</p>
                            <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity text-sm font-semibold text-indigo-600 flex items-center gap-1">
                                Open Database &rarr;
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white px-5 pt-12 pb-8 shadow-md relative z-10">
                <div className="max-w-6xl mx-auto flex justify-between items-center h-16">
                    {activeModule === 'home' ? (
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <LayoutDashboard size={20} className="text-blue-300" />
                                <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Admin Control</span>
                            </div>
                            <h1 className="text-2xl font-bold">Admin Workspace</h1>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setActiveModule('home')}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors flex items-center justify-center"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="text-xl font-bold capitalize">
                                {activeModule === 'issues' ? 'Issues Management' : activeModule === 'feedback' ? 'User Feedback' : 'User Reports'}
                            </h1>
                        </div>
                    )}

                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 mt-8 space-y-6">

                {activeModule === 'home' && renderModuleCards()}

                {/* --- ISSUES MANAGEMENT --- */}
                {activeModule === 'issues' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start h-[calc(100vh-200px)]">

                        {/* PENDING COLUMN */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-amber-50">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={18} className="text-amber-500" />
                                    <h2 className="font-bold text-gray-900">Pending Approval</h2>
                                </div>
                                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{issues.length}</span>
                            </div>

                            <div className="overflow-y-auto flex-1 p-4 bg-slate-50/50">
                                {fetching ? (
                                    <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
                                ) : issues.length === 0 ? (
                                    <div className="text-center mt-10 text-sm font-medium text-gray-400">Queue is empty.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {issues.map(issue => (
                                            <div key={issue.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col hover:border-blue-200 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-bold text-gray-900 text-sm">{issue.title}</h3>
                                                    <span className="text-[10px] font-semibold text-gray-400">
                                                        {new Date(issue.createdAt?.toMillis ? issue.createdAt.toMillis() : Date.now()).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                {issue.imageUrl && (
                                                    <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-gray-100">
                                                        <img src={issue.imageUrl} alt={issue.title} className="w-full h-full object-cover" />
                                                    </div>
                                                )}

                                                <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">{issue.description}</p>

                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{issue.category}</span>
                                                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1"><MapPin size={10} /> {issue.cityName || 'Any'}</span>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
                                                    <button onClick={() => handleApprove(issue.id, issue.title, issue.userId)} className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1 transition-colors">
                                                        <CheckCircle size={14} /> Approve
                                                    </button>
                                                    <button onClick={() => setRejectingIssueId(issue.id)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1 transition-colors">
                                                        <XCircle size={14} /> Reject
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* APPROVED COLUMN */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-green-50">
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={18} className="text-green-600" />
                                    <h2 className="font-bold text-gray-900">Recently Approved</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* City Filter */}
                                    <div className="relative flex items-center bg-white rounded-lg border border-green-200 px-2 py-1">
                                        <Filter size={12} className="text-green-600 mr-2" />
                                        <select
                                            value={approvedCityFilter}
                                            onChange={(e) => setApprovedCityFilter(e.target.value)}
                                            className="text-xs text-gray-700 font-medium bg-transparent outline-none cursor-pointer"
                                        >
                                            <option value="All">All Cities</option>
                                            {approvedCities.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-y-auto flex-1 p-4 bg-slate-50/50">
                                {fetching ? (
                                    <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
                                ) : filteredApprovedIssues.length === 0 ? (
                                    <div className="text-center mt-10 text-sm font-medium text-gray-400">No approved issues found.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredApprovedIssues.map(issue => (
                                            <div key={issue.id} className="bg-white p-3 rounded-xl border border-gray-100 opacity-90 grayscale-[20%]">
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-semibold text-gray-800 text-xs line-clamp-1">{issue.title}</h3>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${issue.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                                                        issue.status === 'Active' || issue.status === 'Action Seen' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {issue.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                                                    <span className="flex items-center gap-0.5"><MapPin size={10} /> {issue.cityName || 'Any'}</span>
                                                    <span>•</span>
                                                    <span>{(issue.votes || 0)} Hypes</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* --- FEEDBACK LIST --- */}
                {activeModule === 'feedback' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in max-w-3xl mx-auto">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 bg-blue-50">
                            <MessageSquare size={18} className="text-blue-500" />
                            <h2 className="font-bold text-gray-900">User Feedback Log</h2>
                            <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{feedbacks.length}</span>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {fetching ? (
                                <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
                            ) : feedbacks.length === 0 ? (
                                <div className="p-8 text-center text-sm text-gray-500">No feedback entries yet.</div>
                            ) : (
                                feedbacks.map(fb => (
                                    <div key={fb.id} className="p-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-semibold text-gray-900 text-sm">{fb.userEmail || 'Anonymous'}</span>
                                            {fb.createdAt && (
                                                <span className="text-xs text-gray-400">
                                                    {new Date(fb.createdAt?.toMillis ? fb.createdAt.toMillis() : fb.createdAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100">{fb.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* --- USER REPORTS --- */}
                {activeModule === 'reports' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in max-w-3xl mx-auto">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 bg-red-50">
                            <Flag size={18} className="text-red-500" />
                            <h2 className="font-bold text-gray-900">Pending User Moderations</h2>
                            <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{userReports.length}</span>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {fetching ? (
                                <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
                            ) : userReports.length === 0 ? (
                                <div className="p-8 text-center text-sm text-gray-500">No pending reports. Great!</div>
                            ) : (
                                userReports.map(report => (
                                    <div key={report.id} className="p-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg uppercase">
                                                    {report.reason}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {report.createdAt ? new Date(report.createdAt?.toMillis ? report.createdAt.toMillis() : report.createdAt).toLocaleDateString() : 'Just now'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 mb-3 space-y-1">
                                            <p><span className="font-bold text-gray-900">Reported UID:</span> <span className="font-mono text-xs">{report.reportedUid}</span></p>
                                            <p><span className="font-bold text-gray-900">Reporter UID:</span> <span className="font-mono text-xs">{report.reporterUid}</span></p>
                                            {report.details && (
                                                <p className="mt-2 text-gray-800">"{report.details}"</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    const msg = window.prompt("Enter warning message to send directly to this user:");
                                                    if (msg) {
                                                        await warnUser(report.reportedUid, msg);
                                                        await updateDoc(doc(db, 'user_reports', report.id), { status: 'acted_upon' });
                                                        setUserReports(prev => prev.filter(r => r.id !== report.id));
                                                        alert("Warning sent.");
                                                    }
                                                }}
                                                className="flex-1 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-bold transition-colors"
                                            >
                                                Send Warning
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm("Are you SURE you want to block this user completely?")) {
                                                        await blockUser(report.reportedUid);
                                                        await updateDoc(doc(db, 'user_reports', report.id), { status: 'acted_upon' });
                                                        setUserReports(prev => prev.filter(r => r.id !== report.id));
                                                        alert("User blocked.");
                                                    }
                                                }}
                                                className="flex-1 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-bold transition-colors"
                                            >
                                                Block User
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Rejection Modal */}
            {rejectingIssueId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={() => { setRejectingIssueId(null); setRejectionRemark(''); }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <XCircle size={20} />
                        </button>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Issue</h3>
                        <p className="text-sm text-gray-500 mb-4">Please provide a reason for rejecting this issue. This will be sent to the user.</p>

                        <textarea
                            value={rejectionRemark}
                            onChange={(e) => setRejectionRemark(e.target.value)}
                            placeholder="e.g., The provided photo is unclear..."
                            className="w-full h-32 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none resize-none text-sm mb-4"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setRejectingIssueId(null); setRejectionRemark(''); }}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmReject}
                                className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
                            >
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
