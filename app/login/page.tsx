'use client';

import React, { useState, useEffect } from 'react';
import { Mail, ArrowRight, Loader2, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const { user, sendMagicLink, loginWithGoogle } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            router.push('/');
        }
    }, [user, router]);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError('Please enter your email.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await sendMagicLink(email);
            setIsSent(true);
        } catch (err: any) {
            console.error("Failed to send magic link:", err);
            if (err.code === 'auth/operation-not-allowed') {
                setError('Magic links are disabled. Please enable "Email link" in Firebase Console.');
            } else {
                setError('Failed to send link. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true);
            setError('');
            await loginWithGoogle();
            router.push('/');
        } catch (e: any) {
            console.error(e);
            setError('Google sign-in was cancelled or failed.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100"
            >
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 text-2xl border border-blue-100 shadow-sm">
                        👋
                    </div>

                    <h1 className="text-3xl font-black text-gray-900 mb-2">
                        Welcome to CivicLens
                    </h1>
                    <p className="text-gray-500 mb-8 max-w-sm text-sm">
                        {isSent
                            ? "Check your inbox for the magic link to complete sign in."
                            : "Sign in or sign up to join the movement and improve your community."}
                    </p>

                    {!isSent ? (
                        <div className="w-full space-y-6">
                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={isLoading}
                                className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3.5 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-3 relative focus:ring-2 focus:ring-gray-900/10 outline-none cursor-pointer disabled:opacity-70"
                            >
                                <svg className="w-5 h-5 absolute left-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </button>

                            <div className="flex items-center text-xs font-semibold text-gray-400 before:flex-1 before:border-t before:border-gray-200 before:mr-4 after:flex-1 after:border-t after:border-gray-200 after:ml-4 uppercase tracking-wider">
                                or
                            </div>

                            <form onSubmit={handleEmailSubmit} className="w-full space-y-4">
                                {error && (
                                    <div className="w-full bg-red-50 text-red-600 text-sm py-2 px-3 rounded-lg text-left border border-red-100/50">
                                        {error}
                                    </div>
                                )}
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-800 transition-colors" size={18} />
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 text-gray-800"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer shadow-blue-600/10"
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Continue with Email'}
                                    {!isLoading && <ArrowRight size={18} />}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="w-full text-center">
                            <p className="text-gray-600 mb-6 text-sm">
                                We've sent a magic link to <span className="font-semibold text-gray-900">{email}</span>. Click the link in your email to sign in instantly.
                            </p>
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-gray-100 w-full flex justify-center">
                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                        >
                            <Home size={16} />
                            Return to Home Screen
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
