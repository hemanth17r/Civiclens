import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/context/AuthContext';
import { ShieldCheck, UserX, AlertTriangle, ExternalLink, XCircle, Unlock } from 'lucide-react';
import Link from 'next/link';

interface UserReportCardProps {
    report: any; // The report object from firestore
    activeTab: 'pending' | 'warned' | 'blocked' | 'dismissed';
    onWarn: (report: any) => void;
    onBlock: (report: any) => void;
    onDismiss: (report: any) => void;
    onUnblock: (report: any) => void;
    onDelete: (id: string) => void;
}

const UserProfileChip = ({ uid, label, role }: { uid: string, label: string, role: 'target' | 'reporter' }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!uid) return;
        getDoc(doc(db, 'users', uid)).then(docSnap => {
            if (docSnap.exists()) {
                setUser({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [uid]);

    return (
        <div className={`p-4 rounded-xl border flex items-center gap-4 ${role === 'target' ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
            <div className={`h-12 w-12 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border-2 ${role === 'target' ? 'bg-red-100 text-red-500 border-red-200' : 'bg-slate-200 text-slate-500 border-slate-200'}`}>
                {loading ? (
                    <div className="w-full h-full bg-slate-200 animate-pulse" />
                ) : user?.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                ) : (
                    <UserX size={24} />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${role === 'target' ? 'text-red-500' : 'text-slate-500'}`}>
                    {label}
                </p>
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                         {loading ? (
                             <div className="h-4 bg-slate-200/50 rounded w-24 animate-pulse mb-1"></div>
                         ) : (
                             <p className="text-sm font-bold text-gray-900 truncate">
                                 {user?.displayName || 'Unknown User'}
                             </p>
                         )}
                         {loading ? (
                             <div className="h-3 bg-slate-200/50 rounded w-16 animate-pulse"></div>
                         ) : (
                             <p className="text-xs text-gray-500 truncate">
                                 @{user?.handle?.replace(/^@/, '') || uid.slice(0, 8)}
                             </p>
                         )}
                    </div>
                </div>
            </div>
            <Link 
                href={`/profile/${uid}`} 
                target="_blank"
                className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                    role === 'target' ? 'bg-white text-red-600 hover:bg-red-50 border border-red-100 hover:border-red-200 shadow-sm' : 'bg-white text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 shadow-sm'
                }`}
                title="View Full Profile"
            >
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold sm:hidden lg:inline hidden">Profile</span>
                    <ExternalLink size={16} />
                </div>
            </Link>
        </div>
    );
};

export default function UserReportCard({ report, activeTab, onWarn, onBlock, onDismiss, onUnblock, onDelete }: UserReportCardProps) {
    return (
        <div className="bg-white rounded-2xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border border-gray-200 overflow-hidden hover:shadow-[0_8px_16px_-6px_rgba(0,0,0,0.1)] transition-all flex flex-col group relative">
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg uppercase tracking-wide border border-red-200">
                        {report.reason || 'Reported'}
                    </span>
                </div>
                <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                    {report.createdAt ? new Date(report.createdAt?.toMillis ? report.createdAt.toMillis() : report.createdAt).toLocaleString() : 'Just now'}
                </span>
            </div>

            {/* Content */}
            <div className="p-5 flex-1 space-y-4">
                <div className="space-y-3">
                    {/* Target User */}
                    <UserProfileChip uid={report.reportedUid} label="Reported User (Target)" role="target" />
                    
                    {/* Reporter */}
                    <UserProfileChip uid={report.reporterUid} label="Reported By" role="reporter" />
                </div>

                {report.details && (
                    <div className="mt-5 bg-gradient-to-br from-gray-50 to-slate-50 p-4 rounded-xl border border-gray-100 shadow-inner">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Reporter Comments</p>
                        <p className="text-sm text-gray-800 italic leading-relaxed">"{report.details}"</p>
                    </div>
                )}
            </div>

            {/* Actions Footer */}
            {activeTab === 'pending' && (
                <div className="p-4 border-t border-gray-100 bg-slate-50/50 grid grid-cols-3 gap-3">
                    <button onClick={() => onWarn(report)} className="py-2.5 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-none focus:ring-offset-1">
                        <AlertTriangle size={16} /> Warn
                    </button>
                    <button onClick={() => onBlock(report)} className="py-2.5 bg-red-600 text-white hover:bg-red-700 hover:shadow shadow-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-red-500 focus:outline-none focus:ring-offset-1">
                        <UserX size={16} /> Block
                    </button>
                    <button onClick={() => onDismiss(report)} className="py-2.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-gray-500 focus:outline-none focus:ring-offset-1">
                        <ShieldCheck size={16} /> Dismiss
                    </button>
                </div>
            )}
            
            {activeTab === 'blocked' && (
                <div className="p-4 border-t border-gray-100 bg-rose-50/30 flex gap-2">
                    <button onClick={() => onUnblock(report)} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 shadow-sm rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none focus:ring-offset-1">
                        <Unlock size={18} /> Restore User Access
                    </button>
                </div>
            )}

            {activeTab !== 'pending' && (
                <button 
                    onClick={() => {
                        onDelete(report.id);
                    }}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-red-50 p-1.5 rounded-lg border border-gray-100 hover:border-red-100 shadow-sm z-10"
                    title="Delete Record"
                >
                    <XCircle size={16} />
                </button>
            )}
        </div>
    );
}
