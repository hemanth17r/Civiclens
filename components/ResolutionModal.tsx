'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, CheckCircle, Loader2 } from 'lucide-react';

interface ResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onResolve: (file: File) => Promise<void>;
}

export default function ResolutionModal({ isOpen, onClose, onResolve }: ResolutionModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            setPreview(URL.createObjectURL(f));
        }
    };

    const handleSubmit = async () => {
        if (!file) return;
        setLoading(true);
        try {
            await onResolve(file);
            onClose();
        } catch (error) {
            console.error("Resolution failed", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                    className="relative bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
                >
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CheckCircle className="text-green-500" /> Mark as Fixed
                            </h2>
                            <button onClick={onClose}><X className="text-gray-400" /></button>
                        </div>

                        <p className="text-gray-600 mb-6 text-sm">
                            Upload a photo proving this issue has been resolved. You'll catch <span className="font-bold text-green-600">+200 XP</span>!
                        </p>

                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            {preview ? (
                                <img src={preview} alt="Proof" className="w-full h-48 object-cover rounded-lg" />
                            ) : (
                                <>
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 text-blue-600">
                                        <Upload size={24} />
                                    </div>
                                    <p className="font-medium text-gray-700">Tap to upload proof</p>
                                    <p className="text-xs text-gray-400 mt-1">Images only</p>
                                </>
                            )}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!file || loading}
                            className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Confirm Resolution'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
