'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface VerifiedBadgeProps {
    department?: string;
    size?: 'sm' | 'md';
    label?: string;
}

export default function VerifiedBadge({ department, size = 'sm', label = 'Official' }: VerifiedBadgeProps) {
    const isSmall = size === 'sm';
    return (
        <span
            className={`inline-flex items-center gap-1 font-semibold rounded-full border
                ${isSmall
                    ? 'text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border-blue-200'
                    : 'text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200'
                }`}
        >
            <ShieldCheck size={isSmall ? 10 : 14} className="text-blue-600 flex-shrink-0" />
            {label}{department ? ` · ${department}` : ''}
        </span>
    );
}
