'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, TrendingUp, Loader2, User, MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { getTrendingIssues, searchUsers, searchIssues, Issue, UserSearchResult } from '@/lib/issues';
import IssueCard from '@/components/IssueCard';
import { useRouter } from 'next/navigation';

// Match categories with ReportIssueDialog
const categories = ["All", "Road", "Waste", "Water", "Safety", "Infrastructure", "Environment", "Other"];

export default function ExplorePage() {
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState("All");

    // Trending
    const [trendingIssues, setTrendingIssues] = useState<Issue[]>([]);
    const [loadingTrending, setLoadingTrending] = useState(true);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResultsUsers, setSearchResultsUsers] = useState<UserSearchResult[]>([]);
    const [searchResultsIssues, setSearchResultsIssues] = useState<Issue[]>([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    // Fetch trending issues
    const fetchTrending = useCallback(async (cat: string) => {
        setLoadingTrending(true);
        try {
            const data = await getTrendingIssues(cat);
            setTrendingIssues(data);
        } catch (e) {
            console.error('Error fetching trending:', e);
        } finally {
            setLoadingTrending(false);
        }
    }, []);

    useEffect(() => {
        fetchTrending(selectedCategory);
    }, [selectedCategory, fetchTrending]);

    // Debounced search
    const handleSearchInput = (value: string) => {
        setSearchQuery(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (value.length < 2) {
            setShowSearchResults(false);
            setSearchResultsUsers([]);
            setSearchResultsIssues([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearching(true);
            setShowSearchResults(true);
            try {
                const [users, issues] = await Promise.all([
                    searchUsers(value),
                    searchIssues(value)
                ]);
                setSearchResultsUsers(users);
                setSearchResultsIssues(issues);
            } catch (e) {
                console.error('Search error:', e);
            } finally {
                setIsSearching(false);
            }
        }, 400);
    };

    // Close search results on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md pt-4 pb-2 px-4 shadow-sm md:hidden">
                <div className="relative" ref={searchContainerRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search @handles, issues, places..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        onFocus={() => { if (searchQuery.length >= 2) setShowSearchResults(true); }}
                        className="w-full bg-gray-100 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />

                    {/* Search Results Dropdown */}
                    {showSearchResults && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-[70vh] overflow-y-auto z-30">
                            {isSearching ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin text-gray-400" size={20} />
                                </div>
                            ) : (
                                <>
                                    {/* User results */}
                                    {searchResultsUsers.length > 0 && (
                                        <div className="p-3">
                                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-2">Accounts</p>
                                            {searchResultsUsers.map(u => (
                                                <button
                                                    key={u.uid}
                                                    onClick={() => {
                                                        setShowSearchResults(false);
                                                        // Could navigate to user profile in the future
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[1.5px] flex-shrink-0">
                                                        <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                                                            {u.photoURL ? (
                                                                <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User size={16} className="text-gray-400" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-sm font-bold text-gray-900">{u.handle}</p>
                                                        <p className="text-xs text-gray-500">{u.displayName}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Issue results */}
                                    {searchResultsIssues.length > 0 && (
                                        <div className="p-3 border-t border-gray-100">
                                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-2">Issues</p>
                                            {searchResultsIssues.slice(0, 5).map(issue => (
                                                <button
                                                    key={issue.id}
                                                    onClick={() => {
                                                        setShowSearchResults(false);
                                                        router.push(`/issue/${issue.id}`);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                                                        {issue.imageUrl ? (
                                                            <img src={issue.imageUrl} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <MapPin size={16} className="text-gray-300" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-left flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">{issue.title}</p>
                                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                                            <MapPin size={10} />
                                                            {issue.cityName || issue.location || 'Unknown'}
                                                            <span className="text-gray-300 mx-1">•</span>
                                                            {issue.votes || 0} hypes
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* No results */}
                                    {searchResultsUsers.length === 0 && searchResultsIssues.length === 0 && !isSearching && (
                                        <div className="p-8 text-center text-gray-400">
                                            <p className="text-sm font-medium">No results found</p>
                                            <p className="text-xs mt-1">Try a different search term</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block p-6 bg-white border-b border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Explore Community Issues</h1>
                <div className="relative max-w-xl" ref={searchContainerRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search @handles, issues, places..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        onFocus={() => { if (searchQuery.length >= 2) setShowSearchResults(true); }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-full py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                </div>
            </div>

            {/* Category Pills */}
            <div className="bg-white border-b border-gray-100 py-3 overflow-x-auto no-scrollbar">
                <div className="flex px-4 gap-2 min-w-max">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={clsx(
                                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                                selectedCategory === cat
                                    ? "bg-gray-900 text-white border-gray-900"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Trending Header */}
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <TrendingUp size={18} className="text-blue-600" />
                <h2 className="text-sm font-bold text-gray-900">Trending</h2>
                <span className="text-xs text-gray-400 font-medium">• Past 7 days</span>
            </div>

            {/* Trending Content */}
            <div className="max-w-2xl mx-auto px-4 pb-4">
                {loadingTrending ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="animate-spin text-gray-400" size={28} />
                    </div>
                ) : trendingIssues.length > 0 ? (
                    <div className="space-y-5">
                        {trendingIssues.map((issue) => (
                            <IssueCard key={issue.id} issue={issue} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <TrendingUp size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">No trending issues</h3>
                        <p className="text-gray-500 text-sm max-w-xs mx-auto">
                            {selectedCategory !== 'All'
                                ? `No trending issues in "${selectedCategory}" right now. Try a different category.`
                                : 'No issues trending right now. Be the first to report one!'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
