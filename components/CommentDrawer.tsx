'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import CommentSection from './CommentSection';

interface CommentDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    issueId: string;
    onCommentAdded?: () => void;
}

export default function CommentDrawer({ isOpen, onClose, issueId, onCommentAdded }: CommentDrawerProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="md:hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-[80] backdrop-blur-xs"
                    />

                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 28, stiffness: 320 }}
                        className="fixed bottom-0 left-0 right-0 bg-white z-[90] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] max-h-[85vh] h-[80vh] flex flex-col"
                    >
                        {/* Drag Handle */}
                        <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
                            <div className="w-10 h-1 bg-gray-200 rounded-full cursor-pointer hover:bg-gray-300 transition-colors" />
                        </div>

                        {/* Header */}
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between shadow-xs">
                            <h3 className="font-bold text-base text-gray-900">Comments</h3>
                            <button
                                onClick={onClose}
                                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body with CommentSection */}
                        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                            <CommentSection
                                issueId={issueId}
                                onCommentAdded={onCommentAdded}
                                maxHeightClass="flex-1 overflow-y-auto"
                                className="h-full flex-1 justify-between"
                            />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
