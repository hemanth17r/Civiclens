'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getLeaderboardIssues, Issue } from '@/lib/issues';
import { Trophy, Clock, Search, MapPin, X, Loader2 } from 'lucide-react';
import { INDIAN_CITIES } from '@/data/cities';
import { clsx } from 'clsx';
import Link from 'next/link';

export default function LeaderboardPage() {
    const { user, userProfile } = useAuth();

    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [selectedCity, setSelectedCity] = useState<string | null>(null); // null = Nationwide

    // Default tier 1 cities + user city
    const baseCities = ['Delhi', 'Mumbai', 'Bangalore'];
    const [availableCities, setAvailableCities] = useState<string[]>([]);

    useEffect(() => {
        const defaultCities = [...baseCities];
        if (userProfile?.city && !defaultCities.includes(userProfile.city)) {
            defaultCities.unshift(userProfile.city);
        }
        setAvailableCities(defaultCities);
    }, [userProfile]);

    // Search state
    const [citySearch, setCitySearch] = useState('');
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);

    const filteredCities = citySearch === ''
        ? INDIAN_CITIES.sort((a, b) => a.tier - b.tier).slice(0, 5)
        : INDIAN_CITIES.filter(c =>
            c.name.toLowerCase().includes(citySearch.toLowerCase())
        ).slice(0, 5);

    // Data fetching
    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const data = await getLeaderboardIssues(selectedCity);
            setIssues(data);
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
        // Update every 2 minutes
        const interval = setInterval(() => {
            fetchLeaderboard();
        }, 120 * 1000);
        return () => clearInterval(interval);
    }, [selectedCity]); // Re-run when city changes

    // Handlers
    const addAndSelectCity = (cityName: string) => {
        if (!availableCities.includes(cityName)) {
            setAvailableCities([cityName, ...availableCities]);
        }
        setSelectedCity(cityName);
        setCitySearch('');
        setIsCityDropdownOpen(false);
    };

    return (
        <div className="bg-gray-50 min-h-screen pb-24 font-sans">
            {/* Header */}
            <div className="bg-white px-5 pt-8 pb-4 shadow-sm border-b border-gray-100 sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Trophy size={20} className="text-yellow-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Leaderboard</h1>
                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                            <Clock size={10} /> Updated every 2 mins
                        </p>
                    </div>
                </div>

                {/* City Search */}
                <div className="relative mb-4">
                    <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 gap-2">
                        <Search size={16} className="text-gray-400 flex-shrink-0" />
                        <input
                            type="text"
                            value={citySearch}
                            onChange={(e) => {
                                setCitySearch(e.target.value);
                                setIsCityDropdownOpen(true);
                            }}
                            onFocus={() => setIsCityDropdownOpen(true)}
                            className="flex-1 bg-transparent text-sm font-medium text-gray-800 focus:outline-none placeholder-gray-400"
                            placeholder="Search another city to view..."
                        />
                        {citySearch && (
                            <button
                                onClick={() => { setCitySearch(''); setIsCityDropdownOpen(false); }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    {/* Dropdown */}
                    {isCityDropdownOpen && citySearch && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-44 overflow-y-auto z-20">
                            {filteredCities.length > 0 ? (
                                filteredCities.map(c => (
                                    <button
                                        key={c.name}
                                        type="button"
                                        onClick={() => addAndSelectCity(c.name)}
                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <MapPin size={14} className="text-blue-500" />
                                            <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                                        </div>
                                        <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full tracking-wider">{c.state}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="p-4 text-center text-gray-400 text-sm">No cities found</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Filter Chips */}
                <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
                    <button
                        onClick={() => setSelectedCity(null)}
                        className={clsx(
                            "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-1",
                            selectedCity === null
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                        )}
                    >
                        Nationwide
                    </button>
                    {availableCities.map(city => (
                        <button
                            key={city}
                            onClick={() => setSelectedCity(city)}
                            className={clsx(
                                "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5",
                                selectedCity === city
                                    ? "bg-gray-900 text-white"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                            )}
                        >
                            <MapPin size={12} className={clsx("flex-shrink-0", selectedCity === city ? "text-gray-300" : "text-gray-500")} />
                            {city}
                        </button>
                    ))}
                </div>
            </div>

            {/* Leaderboard List */}
            <div className="px-5 pt-6 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                        <span className="text-sm font-medium">Updating Rankings...</span>
                    </div>
                ) : issues.length > 0 ? (
                    issues.map((issue, index) => (
                        <Link href={`/issue/${issue.id}`} key={issue.id} className="block group">
                            <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform active:scale-[0.98]">
                                {/* Rank Number */}
                                <div className="flex-shrink-0 w-8 flex justify-center items-center">
                                    <span className={clsx(
                                        "text-xl font-black italic tracking-tighter",
                                        index === 0 ? "text-yellow-500 text-2xl" :
                                            index === 1 ? "text-gray-400 text-2xl" :
                                                index === 2 ? "text-amber-700 text-2xl" :
                                                    "text-gray-300"
                                    )}>
                                        #{index + 1}
                                    </span>
                                </div>

                                {/* Image Square */}
                                <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                                    {issue.imageUrl ? (
                                        <img src={issue.imageUrl} alt={issue.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <Trophy size={20} />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-gray-900 mb-1 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                                        {issue.title}
                                    </h3>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            <span className="text-orange-500 font-bold">{issue.votes || 0}</span> hypes
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="text-gray-700 font-bold">{issue.commentCount || 0}</span> comments
                                        </span>
                                    </div>
                                    {/* Rank points display */}
                                    <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold">
                                        {(issue as any).rank || ((issue.votes || 0) + (issue.commentCount || 0))} Impact Points
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="text-center py-20 px-5">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex justify-center items-center mx-auto mb-4 text-gray-300">
                            <Trophy size={28} />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 mb-1">No reports ranking yet</h2>
                        <p className="text-gray-500 text-sm">
                            {selectedCity
                                ? `Be the first to create impact in ${selectedCity}!`
                                : "No open reports available. Start reporting to top the board!"}
                        </p>
                    </div>
                )}
            </div>

            {/* Disclaimer */}
            {issues.length > 0 && (
                <div className="text-center py-6 px-10">
                    <p className="text-[11px] text-gray-400 font-medium leading-relaxed uppercase tracking-widest">
                        Ranking based on community hypes, comments, and engagement
                    </p>
                </div>
            )}
        </div>
    );
}
