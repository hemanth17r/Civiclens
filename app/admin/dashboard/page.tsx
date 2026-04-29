'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ShieldCheck, CheckCircle, XCircle, MessageSquare, Loader2, AlertTriangle, LayoutDashboard, Flag, Zap, ArrowLeft, Filter, MapPin, Unlock } from 'lucide-react';
import { Issue } from '@/lib/issues';
import { notifyCitizenIssueApproved, notifyCitizenIssueRejected } from '@/lib/notifications';
import { warnUser, blockUser, unblockUser } from '@/lib/moderation';
import UserReportCard from '@/components/admin/UserReportCard';

export default function AdminDashboardPage() {
    const { user, isAdmin, loading } = useAuth();
    const router = useRouter();
    const [issues, setIssues] = useState<Issue[]>([]);
    const [approvedIssues, setApprovedIssues] = useState<Issue[]>([]);
    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [resolvedFeedbacks, setResolvedFeedbacks] = useState<any[]>([]);
    const [userReports, setUserReports] = useState<any[]>([]);
    const [resolvedUserReports, setResolvedUserReports] = useState<any[]>([]);
    const [fetching, setFetching] = useState(true);

    // Google Docs style active card view
    const [activeModule, setActiveModule] = useState<'home' | 'issues' | 'feedback' | 'reports'>('home');
    const [activeReportsTab, setActiveReportsTab] = useState<'home' | 'pending' | 'warned' | 'blocked' | 'dismissed'>('home');

    // Custom confirm/prompt state
    const [confirmAction, setConfirmAction] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        isPrompt?: boolean;
        promptPlaceholder?: string;
        onConfirm: (val?: string) => void;
    } | null>(null);

    // Sort modules by usage
    const [recentModules, setRecentModules] = useState<string[]>(['issues', 'reports', 'feedback']);

    // Filters & Rejection state
    const [approvedCityFilter, setApprovedCityFilter] = useState<string>('All');
    const [rejectingIssueId, setRejectingIssueId] = useState<string | null>(null);
    const [rejectionRemark, setRejectionRemark] = useState('');

    // Toast state
    const [toast, setToast] = useState<{ title: string, type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = (title: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ title, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        if (!loading && !isAdmin) {
            router.replace('/');
        }
    }, [isAdmin, loading, router]);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            if (!hash || hash === 'home') {
                setActiveModule('home');
                setActiveReportsTab('home');
            } else if (hash === 'issues' || hash === 'feedback' || hash === 'reports') {
                setActiveModule(hash as any);
                setActiveReportsTab('home');
            } else if (hash.startsWith('reports-')) {
                setActiveModule('reports');
                setActiveReportsTab(hash.split('-')[1] as any);
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange(); // sync on mount

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const openModule = (modId: string) => {
        window.location.hash = modId;
    };

    const goHome = () => {
        window.location.hash = 'home';
    };

    const openReportsTab = (tabId: string) => {
        window.location.hash = `reports-${tabId}`;
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
                where('status', 'in', ['Verification Needed', 'Active', 'Action Seen', 'Resolved']),
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
            const allFeedbacks = feedbackSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            
            allFeedbacks.sort((a: any, b: any) => {
                const tA = a.createdAt?.toMillis?.() || (typeof a.createdAt === 'number' ? a.createdAt : 0);
                const tB = b.createdAt?.toMillis?.() || (typeof b.createdAt === 'number' ? b.createdAt : 0);
                return tB - tA; // Newest first
            });

            setFeedbacks(allFeedbacks.filter((f: any) => f.status === 'pending' || !f.status));
            setResolvedFeedbacks(allFeedbacks.filter((f: any) => f.status === 'resolved'));

            // Fetch User Reports
            const reportsQuery = query(collection(db, 'user_reports'));
            const reportsSnap = await getDocs(reportsQuery);
            const allReports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

            const pendingReports = allReports.filter((r: any) => r.status === 'pending' || !r.status);
            pendingReports.sort((a: any, b: any) => {
                const tA = a.createdAt?.toMillis?.() || (typeof a.createdAt === 'number' ? a.createdAt : 0);
                const tB = b.createdAt?.toMillis?.() || (typeof b.createdAt === 'number' ? b.createdAt : 0);
                return tA - tB; // oldest pending first
            });
            setUserReports(pendingReports);

            const resolvedReps = allReports.filter((r: any) => r.status && r.status !== 'pending');
            resolvedReps.sort((a: any, b: any) => {
                const tA = a.createdAt?.toMillis?.() || (typeof a.createdAt === 'number' ? a.createdAt : 0);
                const tB = b.createdAt?.toMillis?.() || (typeof b.createdAt === 'number' ? b.createdAt : 0);
                return tB - tA; // Newest acted upon first
            });
            setResolvedUserReports(resolvedReps);
        } catch (e) {
            console.warn('Error fetching admin data', e);
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
            showToast('Issue approved and moved to active feed');
        } catch (e) {
            console.error('Error approving issue:', e);
            showToast('Failed to approve issue', 'error');
        }
    };

    const handleResolveFeedback = async (fb: any) => {
        try {
            console.log("Attempting to resolve feedback:", fb.id);
            const fbRef = doc(db, 'feedbacks', fb.id);
            await updateDoc(fbRef, { 
                status: 'resolved',
                resolvedAt: serverTimestamp() 
            });
            
            setFeedbacks(prev => prev.filter(f => f.id !== fb.id));
            setResolvedFeedbacks(prev => [{ ...fb, status: 'resolved', resolvedAt: new Date() }, ...prev]);
            
            showToast('Feedback marked as resolved');
            console.log("Feedback resolution successful");
        } catch (error: any) {
            console.error("Error updating feedback:", error);
            showToast(`Error: ${error.message}`, 'error');
        }
    };

    const handleDismissReport = (report: any) => {
        setConfirmAction({
            isOpen: true,
            title: 'Dismiss Report',
            message: 'Dismiss this report without taking action against the target?',
            onConfirm: async () => {
                try {
                    await updateDoc(doc(db, 'user_reports', report.id), { 
                        status: 'dismissed',
                        resolvedAt: serverTimestamp()
                    });
                    setUserReports(prev => prev.filter(r => r.id !== report.id));
                    setResolvedUserReports(prev => [{ ...report, status: 'dismissed' }, ...prev]);
                    showToast('Report dismissed');
                } catch(e: any) {
                    console.error('Error dismissing report:', e);
                    showToast(`Failed: ${e.message}`, 'error');
                }
            }
        });
    };

    const handleWarnUser = (report: any) => {
        setConfirmAction({
            isOpen: true,
            title: 'Warn User',
            message: 'Enter warning message to send directly to this user:',
            isPrompt: true,
            promptPlaceholder: 'Your warning message...',
            onConfirm: async (msg) => {
                if (!msg) return;
                try {
                    await warnUser(report.reportedUid, msg);
                    await updateDoc(doc(db, 'user_reports', report.id), { 
                        status: 'warned',
                        resolvedAt: serverTimestamp() 
                    });
                    setUserReports(prev => prev.filter(r => r.id !== report.id));
                    setResolvedUserReports(prev => [{ ...report, status: 'warned', resolvedAt: new Date() }, ...prev]);
                    showToast('Warning sent to user');
                } catch(e: any) {
                    console.error('Error sending warning:', e);
                    showToast(`Failed: ${e.message}`, 'error');
                }
            }
        });
    };

    const handleBlockUser = (report: any) => {
        setConfirmAction({
            isOpen: true,
            title: 'Block User',
            message: 'Are you SURE you want to block this user completely? This will prevent them from accessing most features.',
            onConfirm: async () => {
                try {
                    await blockUser(report.reportedUid);
                    await updateDoc(doc(db, 'user_reports', report.id), { 
                        status: 'blocked',
                        resolvedAt: serverTimestamp()
                    });
                    setUserReports(prev => prev.filter(r => r.id !== report.id));
                    setResolvedUserReports(prev => [{ ...report, status: 'blocked', resolvedAt: new Date() }, ...prev]);
                    showToast('User has been blocked', 'error');
                } catch(e: any) {
                    console.error('Error blocking user:', e);
                    showToast(`Failed: ${e.message}`, 'error');
                }
            }
        });
    };

    const handleUnblockUser = (report: any) => {
        setConfirmAction({
            isOpen: true,
            title: 'Restore User Access',
            message: 'Are you SURE you want to unblock this user? This will restore their privileges.',
            onConfirm: async () => {
                try {
                    await unblockUser(report.reportedUid);
                    const ref = doc(db, 'user_reports', report.id);
                    await updateDoc(ref, { 
                        status: 'dismissed', // Mark as dismissed so they show in the dismissed pile
                        resolvedAt: serverTimestamp()
                    });
                    setResolvedUserReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'dismissed', resolvedAt: new Date() } : r));
                    showToast('User has been unblocked');
                } catch(e: any) {
                    console.error('Error unblocking user:', e);
                    showToast(`Failed: ${e.message}`, 'error');
                }
            }
        });
    };

    const confirmReject = async () => {
        if (!rejectingIssueId) return;
        if (!rejectionRemark.trim()) {
            showToast('Please provide a reason for rejection.', 'error');
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
            showToast('Issue rejected and user notified', 'info');
        } catch (e) {
            console.error('Error rejecting issue:', e);
            showToast('Failed to reject issue', 'error');
        }
    };

    const handleDeleteApproved = (id: string) => {
        setConfirmAction({
            isOpen: true,
            title: 'Delete Approved Report',
            message: 'Are you sure you want to completely delete this approved report? This action cannot be undone.',
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'issues', id));
                    setApprovedIssues(approvedIssues.filter(i => i.id !== id));
                    showToast('Report permanently deleted');
                } catch (e) {
                    console.error('Error deleting issue:', e);
                    showToast('Failed to delete report', 'error');
                }
            }
        });
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
                                onClick={goHome}
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
                                                    <button onClick={() => handleDeleteApproved(issue.id)} className="ml-auto text-red-500 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded cursor-pointer transition-colors hover:bg-red-100 flex items-center justify-center">
                                                        Delete
                                                    </button>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start h-[calc(100vh-200px)]">
                        {/* PENDING FEEDBACK COLUMN */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50">
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={18} className="text-blue-500" />
                                    <h2 className="font-bold text-gray-900">Pending Feedback</h2>
                                </div>
                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{feedbacks.length}</span>
                            </div>

                            <div className="overflow-y-auto flex-1 p-4 bg-slate-50/50">
                                {fetching ? (
                                    <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
                                ) : feedbacks.length === 0 ? (
                                    <div className="text-center mt-10 text-sm font-medium text-gray-400">No pending feedback.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {feedbacks.map(fb => (
                                            <div key={fb.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col hover:border-blue-200 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-semibold text-gray-900 text-sm">{fb.userEmail || 'Anonymous'}</span>
                                                    {fb.createdAt && (
                                                        <span className="text-[10px] font-semibold text-gray-400">
                                                            {new Date(fb.createdAt?.toMillis ? fb.createdAt.toMillis() : fb.createdAt).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">{fb.message}</p>
                                                
                                                <div className="mt-auto pt-2 border-t border-gray-50 flex gap-2">
                                                    <button 
                                                        onClick={() => handleResolveFeedback(fb)}
                                                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                                                    >
                                                        <CheckCircle size={14} /> Mark Resolved
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RESOLVED FEEDBACK COLUMN */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-100">
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={18} className="text-slate-600" />
                                    <h2 className="font-bold text-gray-900">Resolved Feedback</h2>
                                </div>
                                <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{resolvedFeedbacks.length}</span>
                            </div>

                            <div className="overflow-y-auto flex-1 p-4 bg-slate-50/50">
                                {fetching ? (
                                    <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
                                ) : resolvedFeedbacks.length === 0 ? (
                                    <div className="text-center mt-10 text-sm font-medium text-gray-400">No resolved feedback yet.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {resolvedFeedbacks.map(fb => (
                                            <div key={fb.id} className="bg-white p-3 rounded-xl border border-gray-100 opacity-90 grayscale-[20%] relative group">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-semibold text-gray-700 text-xs">{fb.userEmail || 'Anonymous'}</span>
                                                    {fb.createdAt && (
                                                        <span className="text-[10px] text-gray-400">
                                                            {new Date(fb.createdAt?.toMillis ? fb.createdAt.toMillis() : fb.createdAt).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500">{fb.message}</p>
                                                
                                                <button 
                                                    onClick={() => {
                                                        setConfirmAction({
                                                            isOpen: true,
                                                            title: 'Delete Feedback Record',
                                                            message: 'Permanently delete this feedback record?',
                                                            onConfirm: async () => {
                                                                try {
                                                                    await deleteDoc(doc(db, 'feedbacks', fb.id));
                                                                    setResolvedFeedbacks(prev => prev.filter(f => f.id !== fb.id));
                                                                    showToast('Feedback record deleted');
                                                                } catch (e: any) {
                                                                    showToast('Delete failed', 'error');
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 p-1 rounded-md"
                                                    title="Delete Record"
                                                >
                                                    <XCircle size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- USER REPORTS --- */}
                {activeModule === 'reports' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {activeReportsTab === 'home' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Dashboard Cards */}
                                <div onClick={() => openReportsTab('pending')} className="bg-white p-6 rounded-2xl border-2 border-red-100 hover:border-red-300 cursor-pointer transition-all hover:shadow-lg flex flex-col items-center justify-center">
                                    <Flag size={40} className="text-red-500 mb-4" />
                                    <h3 className="font-bold text-gray-900 text-lg">Pending Moderation</h3>
                                    <p className="text-sm font-semibold text-red-600 mt-2">{userReports.length} Reports</p>
                                </div>
                                <div onClick={() => openReportsTab('warned')} className="bg-white p-6 rounded-2xl border-2 border-amber-100 hover:border-amber-300 cursor-pointer transition-all hover:shadow-lg flex flex-col items-center justify-center">
                                    <AlertTriangle size={40} className="text-amber-500 mb-4" />
                                    <h3 className="font-bold text-gray-900 text-lg">Warned Users</h3>
                                    <p className="text-sm font-semibold text-amber-600 mt-2">{resolvedUserReports.filter(r => r.status === 'warned').length} Reports</p>
                                </div>
                                <div onClick={() => openReportsTab('blocked')} className="bg-white p-6 rounded-2xl border-2 border-rose-900/20 hover:border-rose-900/50 cursor-pointer transition-all hover:shadow-lg flex flex-col items-center justify-center">
                                    <XCircle size={40} className="text-rose-900 mb-4" />
                                    <h3 className="font-bold text-gray-900 text-lg">Blocked Users</h3>
                                    <p className="text-sm font-semibold text-rose-900 mt-2">{resolvedUserReports.filter(r => r.status === 'blocked').length} Reports</p>
                                </div>
                                <div onClick={() => openReportsTab('dismissed')} className="bg-white p-6 rounded-2xl border-2 border-gray-200 hover:border-gray-400 cursor-pointer transition-all hover:shadow-lg flex flex-col items-center justify-center">
                                    <ShieldCheck size={40} className="text-gray-500 mb-4" />
                                    <h3 className="font-bold text-gray-900 text-lg">Dismissed Reports</h3>
                                    <p className="text-sm font-semibold text-gray-600 mt-2">{resolvedUserReports.filter(r => r.status === 'dismissed').length} Reports</p>
                                </div>
                            </div>
                        )}
                        
                        {activeReportsTab !== 'home' && (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-200px)] overflow-hidden">
                                <div className={`px-5 py-4 border-b border-gray-100 flex items-center justify-between ${
                                    activeReportsTab === 'pending' ? 'bg-red-50' : 
                                    activeReportsTab === 'warned' ? 'bg-amber-50' :
                                    activeReportsTab === 'blocked' ? 'bg-rose-50' : 'bg-slate-100'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => openModule('reports')} className="p-1.5 bg-white/50 hover:bg-white rounded-full transition-colors flex items-center justify-center">
                                            <ArrowLeft size={16} />
                                        </button>
                                        <h2 className="font-bold text-gray-900 capitalize">{activeReportsTab} Reports</h2>
                                    </div>
                                    <span className="bg-white/50 text-gray-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                        {activeReportsTab === 'pending' ? userReports.length : resolvedUserReports.filter(r => r.status === activeReportsTab).length}
                                    </span>
                                </div>
                                <div className="overflow-y-auto flex-1 p-4 bg-slate-50/50">
                                    {fetching ? (
                                        <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
                                    ) : (activeReportsTab === 'pending' ? userReports : resolvedUserReports.filter(r => r.status === activeReportsTab)).length === 0 ? (
                                        <div className="text-center mt-10 text-sm font-medium text-gray-400">No {activeReportsTab} reports found.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {(activeReportsTab === 'pending' ? userReports : resolvedUserReports.filter(r => r.status === activeReportsTab)).map(report => (
                                                <UserReportCard 
                                                    key={report.id} 
                                                    report={report} 
                                                    activeTab={activeReportsTab}
                                                    onWarn={handleWarnUser}
                                                    onBlock={handleBlockUser}
                                                    onDismiss={handleDismissReport}
                                                    onUnblock={handleUnblockUser}
                                                    onDelete={(id) => {
                                                        setConfirmAction({
                                                            isOpen: true,
                                                            title: 'Delete User Report Record',
                                                            message: 'Permanently delete this report record?',
                                                            onConfirm: async () => {
                                                                try {
                                                                    await deleteDoc(doc(db, 'user_reports', id));
                                                                    setResolvedUserReports(prev => prev.filter(r => r.id !== id));
                                                                    showToast('Report record deleted');
                                                                } catch (e: any) {
                                                                    showToast('Failed to delete record', 'error');
                                                                }
                                                            }
                                                        });
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Rejection Modal */}
            {rejectingIssueId && (
                <div 
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => { setRejectingIssueId(null); setRejectionRemark(''); }}
                >
                    <div 
                        className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
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

            {/* Custom General Confirm/Prompt Modal */}
            {confirmAction?.isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setConfirmAction(null)}
                >
                    <div 
                        className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                            {confirmAction.title.includes('Delete') || confirmAction.title.includes('Block') ? (
                                <AlertTriangle className="text-red-500" size={20} />
                            ) : confirmAction.title.includes('Warn') ? (
                                <AlertTriangle className="text-amber-500" size={20} />
                            ) : null}
                            {confirmAction.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">{confirmAction.message}</p>
                        
                        {confirmAction.isPrompt && (
                            <textarea
                                id="prompt-input"
                                placeholder={confirmAction.promptPlaceholder}
                                className="w-full h-24 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none resize-none text-sm mb-4"
                                autoFocus
                            />
                        )}
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    let val = undefined;
                                    if (confirmAction.isPrompt) {
                                        val = (document.getElementById('prompt-input') as HTMLTextAreaElement)?.value;
                                         if (!val) {
                                             showToast('This field is required', 'error');
                                             return;
                                         }
                                    }
                                    confirmAction.onConfirm(val);
                                    setConfirmAction(null);
                                }}
                                className={`flex-1 px-4 py-2 text-white font-semibold rounded-xl transition-colors cursor-pointer ${
                                    confirmAction.title.includes('Delete') || confirmAction.title.includes('Block') ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 
                                    confirmAction.title.includes('Warn') ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 
                                    'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                                } shadow-sm`}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 w-full max-w-xs">
                {toast && (
                    <div className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
                        toast.type === 'success' ? 'bg-emerald-600 text-white' : 
                        toast.type === 'error' ? 'bg-red-600 text-white' : 
                        'bg-slate-800 text-white'
                    }`}>
                        {toast.type === 'success' ? <CheckCircle size={20} /> : toast.type === 'error' ? <AlertTriangle size={20} /> : <MessageSquare size={20} />}
                        <span className="text-sm font-bold">{toast.title}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
