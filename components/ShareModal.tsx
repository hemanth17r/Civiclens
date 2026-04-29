'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Instagram } from 'lucide-react';
import { clsx } from 'clsx';

// Custom icons since standard lucide-react doesn't have brand versions for these
const WhatsappIcon = ({ size = 26 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
    </svg>
)

const XIcon = ({ size = 26 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
)

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    issueId: string;
    issueTitle: string;
}

export default function ShareModal({ isOpen, onClose, issueId, issueTitle }: ShareModalProps) {
    const [copied, setCopied] = useState(false);

    // Explicitly set the base URL to .tech to avoid showing the old .app domain
    const shareUrl = `https://civiclens.tech/issue/${issueId}`;

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
            icon: WhatsappIcon,
            color: 'bg-[#25D366] text-white',
            url: `https://wa.me/?text=${encodeURIComponent(`Check out this issue on CivicLens: ${issueTitle} - ${shareUrl}`)}`
        },
        {
            name: 'X (Twitter)',
            icon: XIcon,
            color: 'bg-black text-white',
            url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this issue on CivicLens: ${issueTitle}`)}&url=${encodeURIComponent(shareUrl)}`
        },
        {
            name: 'Instagram',
            icon: Instagram,
            color: 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white',
            action: async () => {
                await handleCopy();
                // Instagram does not have a web intent URL that accepts parameters.
                // Best UX is to copy the link and open the app/website so they can paste it.
                window.open('https://instagram.com/', '_blank');
            }
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
                                {shareOptions.map((option) => {
                                    const content = (
                                        <>
                                            <div className={clsx("w-14 h-14 rounded-full flex items-center justify-center shadow-md group-active:scale-95 transition-transform", option.color)}>
                                                <option.icon size={26} />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-600">{option.name}</span>
                                        </>
                                    );

                                    return option.action ? (
                                        <button
                                            key={option.name}
                                            onClick={option.action}
                                            className="flex flex-col items-center gap-2 group"
                                        >
                                            {content}
                                        </button>
                                    ) : (
                                        <a
                                            key={option.name}
                                            href={option.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex flex-col items-center gap-2 group"
                                        >
                                            {content}
                                        </a>
                                    );
                                })}

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
