'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { ShieldPlus, Mail, Building2, MapPin, UserSquare2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function AddOfficialPage() {
    const { isAdmin } = useAuth();

    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [department, setDepartment] = useState('');
    const [jurisdiction, setJurisdiction] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    if (!isAdmin) {
        return (
            <div className="flex-1 flex flex-col pt-16 md:pt-0 p-4 lg:p-8 bg-gray-50/50 min-h-screen items-center justify-center">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-3">
                    <AlertCircle className="text-red-500" size={32} />
                    <p className="text-gray-900 font-semibold">Access Denied</p>
                    <p className="text-gray-500 text-sm">Only administrators can view this page.</p>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError("User not found. Ensure they have signed in to CivicLens at least once.");
                setLoading(false);
                return;
            }

            const userDoc = querySnapshot.docs[0];

            await updateDoc(doc(db, 'users', userDoc.id), {
                role: 'official',
                officialName: name,
                department: department,
                jurisdiction: jurisdiction,
            });

            setSuccess(`Successfully granted Official access to ${email}`);
            setEmail('');
            setName('');
            setDepartment('');
            setJurisdiction('');
        } catch (err: any) {
            console.error(err);
            setError("An error occurred while updating the user. Ensure you have the right permissions.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col pt-16 md:pt-0 p-4 lg:p-8 bg-[#F8FAFC] min-h-screen">
            <div className="max-w-2xl mx-auto w-full">
                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <ShieldPlus className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Add Official</h1>
                        <p className="text-sm text-gray-500 mt-1 pb-1">Grant administrative access to department officials.</p>
                    </div>
                </div>

                {/* Form Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-900/5 border border-gray-100"
                >
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-red-50 text-red-700 text-sm py-3 px-4 rounded-xl border border-red-100 flex items-start gap-3"
                                >
                                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                                    <p>{error}</p>
                                </motion.div>
                            )}
                            {success && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-[#E6F4EA] text-[#1E8E3E] text-sm py-3 px-4 rounded-xl border border-[#CEEAD6] flex items-start gap-3"
                                >
                                    <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
                                    <p>{success}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700 ml-1">Official's Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="official@department.gov"
                                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-gray-400 ml-1">The user must have already signed in to CivicLens once to be registered.</p>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <label className="text-sm font-semibold text-gray-700 ml-1">Full Name (Optional)</label>
                                <div className="relative group">
                                    <UserSquare2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Rahul Sharma"
                                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700 ml-1">Department</label>
                                    <div className="relative group">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                        <input
                                            type="text"
                                            value={department}
                                            onChange={(e) => setDepartment(e.target.value)}
                                            placeholder="e.g. Roads & Transportation"
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700 ml-1">Jurisdiction / Zone</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                        <input
                                            type="text"
                                            value={jurisdiction}
                                            onChange={(e) => setJurisdiction(e.target.value)}
                                            placeholder="e.g. Zone A, Delhi"
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading || !email || !department || !jurisdiction}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm focus:ring-4 focus:ring-blue-600/20 active:scale-[0.98]"
                            >
                                {loading ? (
                                    <Loader2 size={20} className="animate-spin" />
                                ) : (
                                    <>
                                        <ShieldPlus size={20} />
                                        Grant Official Rights
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
