'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle, Loader2, Camera } from 'lucide-react';
import { supabase, getAuthenticatedSupabase } from '@/lib/supabase';
import { officialResolveIssue, Issue } from '@/lib/issues';
import { useAuth } from '@/context/AuthContext';

interface Props {
    issue: Issue;
    isOpen: boolean;
    onClose: () => void;
    onResolved: () => void;
}

export default function OfficialResolveModal({ issue, isOpen, onClose, onResolved }: Props) {
    const { user, userProfile } = useAuth();
    const [statement, setStatement] = useState('');
    const [afterFile, setAfterFile] = useState<File | null>(null);
    const [afterPreview, setAfterPreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAfterFile(file);
            setAfterPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async () => {
        if (!user || !userProfile || !afterFile || !statement.trim()) return;
        setSubmitting(true);
        try {
            // Upload after image to Supabase
            const uniqueName = Date.now() + '_' + afterFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
            const filePath = `resolutions/${issue.id}/${uniqueName}`;
            
            const authSupabase = await getAuthenticatedSupabase(user);
            const { data, error } = await authSupabase.storage
                .from('media')
                .upload(filePath, afterFile);

            if (error) {
                console.error('Supabase upload error:', error);
                throw new Error('Failed to upload resolution image to Supabase.');
            }

            const { data: publicUrlData } = authSupabase.storage
                .from('media')
                .getPublicUrl(filePath);
                
            const afterImageUrl = publicUrlData.publicUrl;

            await officialResolveIssue(
                issue.id,
                user.uid,
                userProfile.handle || userProfile.displayName,
                userProfile.department || 'Unknown',
                statement.trim(),
                afterImageUrl
            );

            setSuccess(true);
            setTimeout(() => {
                onResolved();
                onClose();
                setSuccess(false);
                setStatement('');
                setAfterFile(null);
                setAfterPreview(null);
            }, 1500);
        } catch (e) {
            console.error('Resolution failed:', e);
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = afterFile && statement.trim().length > 10 && !submitting;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between rounded-t-2xl z-10">
                    <h2 className="text-lg font-bold text-gray-900">Resolve Issue</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {success ? (
                    <div className="p-12 text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                            <CheckCircle size={40} className="text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Issue Resolved!</h3>
                        <p className="text-gray-500 mt-1">The public scorecard has been updated.</p>
                    </div>
                ) : (
                    <div className="p-5 space-y-5">
                        {/* Before / After Photos */}
                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">Photo Evidence</p>
                            <div className="grid grid-cols-2 gap-3">
                                {/* Before */}
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-1">Before</p>
                                    <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                                        {issue.imageUrl ? (
                                            <img src={issue.imageUrl} alt="Before" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No photo</div>
                                        )}
                                    </div>
                                </div>
                                {/* After */}
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-1">After</p>
                                    <button
                                        onClick={() => fileRef.current?.click()}
                                        className="aspect-square rounded-xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors w-full flex flex-col items-center justify-center gap-1"
                                    >
                                        {afterPreview ? (
                                            <img src={afterPreview} alt="After" className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <Camera size={24} className="text-gray-400" />
                                                <span className="text-xs text-gray-500 font-medium">Upload photo</span>
                                            </>
                                        )}
                                    </button>
                                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                                </div>
                            </div>
                        </div>

                        {/* Official Statement */}
                        <div>
                            <label className="text-sm font-semibold text-gray-700">Official Statement</label>
                            <textarea
                                value={statement}
                                onChange={e => setStatement(e.target.value)}
                                placeholder="Describe the resolution taken, who was involved, and the current status of the area..."
                                rows={4}
                                className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                            />
                            <p className="text-[10px] text-gray-400 mt-0.5">{statement.length} / 500 characters</p>
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="w-full py-3 rounded-xl font-bold text-sm bg-green-600 text-white hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                            ) : (
                                <><CheckCircle size={16} /> Mark as Resolved</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
