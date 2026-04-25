'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';

export default function HeartAnimation({ isVisible }: { isVisible: boolean }) {
    return (
        <AnimatePresence>
            {isVisible && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1.5 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Flame className="fill-orange-500 text-orange-600 drop-shadow-2xl" size={100} />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
