'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Share2, Instagram, MessageCircle, Twitter } from 'lucide-react';
import { clsx } from 'clsx';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    issueId: string;
    issueTitle: string;
}

export default function ShareModal({ isOpen, onClose, issueId, issueTitle }: ShareModalProps) {
    const [copied, setCopied] = useState(false);

    // In a real app this would be the actual URL
    const shareUrl = `https://civiclens.app/issue/${issueId}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const shareOptions = [
        {
            name: 'WhatsApp',
            icon: MessageCircle,
            color: 'bg-green-500 text-white',
            url: `https://wa.me/?text=Check out this issue on CivicLens: ${issueTitle} - ${shareUrl}`
        },
        {
            name: 'X (Twitter)',
            icon: Twitter,
            color: 'bg-black text-white',
            url: `https://twitter.com/intent/tweet?text=Check out this issue on CivicLens:&url=${shareUrl}`
        },
        {
            name: 'Instagram',
            icon: Instagram,
            color: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 text-white',
            url: `https://instagram.com/` // IG doesn't have a direct share link API, usually opens app
        },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-[80] backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-white z-[90] rounded-t-3xl shadow-xl pb-10"
                    >
                        {/* Handle */}
                        <div className="w-full flex justify-center pt-3 pb-2" onClick={onClose}>
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full cursor-pointer"></div>
                        </div>

                        <div className="px-6 py-2 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-lg text-gray-900">Share</h3>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 pt-4">
                            {/* Social Grid */}
                            <div className="flex justify-around">
                                {/* Standard Share Links */}
                                {shareOptions.map((option) => (
                                    <a
                                        key={option.name}
                                        href={option.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex flex-col items-center gap-2 group"
                                    >
                                        <div className={clsx("w-14 h-14 rounded-full flex items-center justify-center shadow-md group-active:scale-95 transition-transform", option.color)}>
                                            <option.icon size={26} />
                                        </div>
                                        <span className="text-xs font-semibold text-gray-600">{option.name}</span>
                                    </a>
                                ))}

                                {/* Copy Link Action */}
                                <button
                                    onClick={handleCopy}
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <div className={clsx(
                                        "w-14 h-14 rounded-full flex items-center justify-center shadow-md group-active:scale-95 transition-transform",
                                        copied ? "bg-green-500 text-white" : "bg-gray-100 text-gray-800"
                                    )}>
                                        {copied ? <Check size={26} /> : <Copy size={26} />}
                                    </div>
                                    <span className="text-xs font-semibold text-gray-600">
                                        {copied ? 'Copied!' : 'Copy Link'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
