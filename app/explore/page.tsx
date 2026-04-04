'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, TrendingUp, Loader2, User, MapPin, Users, LayoutGrid, ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { getTrendingIssues, searchUsers, searchIssues, Issue, UserSearchResult } from '@/lib/issues';
import IssueCard from '@/components/IssueCard';
import { useRouter } from 'next/navigation';
import { INDIAN_CITIES } from '@/data/cities';

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
    const [isResultsView, setIsResultsView] = useState(false);
    const [activeTab, setActiveTab] = useState<'accounts' | 'posts' | 'places'>('posts');
    const [matchedCity, setMatchedCity] = useState<string | null>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const searchContainerRef = useRef<any>(null);

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

    // Debounced search for iterative dropdown (Accounts only)
    const handleSearchInput = (value: string) => {
        setSearchQuery(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (value.length < 1) {
            setShowSearchResults(false);
            setSearchResultsUsers([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearching(true);
            setShowSearchResults(true);
            try {
                const users = await searchUsers(value);
                setSearchResultsUsers(users);
            } catch (e) {
                console.error('Iterative search error:', e);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    };

    const handleSearchSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (searchQuery.length < 2) return;

        setIsSearching(true);
        setShowSearchResults(false);
        setIsResultsView(true);

        try {
            // Check for city match
            const cityMatch = INDIAN_CITIES.find(c => 
                c.name.toLowerCase() === searchQuery.trim().toLowerCase()
            );
            
            if (cityMatch) {
                setMatchedCity(cityMatch.name);
                setActiveTab('places');
            } else {
                setMatchedCity(null);
                setActiveTab('posts');
            }

            const [users, issues] = await Promise.all([
                searchUsers(searchQuery),
                searchIssues(searchQuery)
            ]);
            setSearchResultsUsers(users);
            setSearchResultsIssues(issues);
        } catch (e) {
            console.error('Full search error:', e);
        } finally {
            setIsSearching(false);
        }
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
                <form onSubmit={handleSearchSubmit} className="relative" ref={searchContainerRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search @handles, issues, places..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        onFocus={() => { if (searchQuery.length >= 1) setShowSearchResults(true); }}
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
                                                        router.push(`/profile/${u.uid}`);
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
                </form>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block p-6 bg-white border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isResultsView ? 'Search Results' : 'Explore Community Issues'}
                    </h1>
                    {isResultsView && (
                        <button 
                            onClick={() => setIsResultsView(false)}
                            className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                        >
                            <ChevronLeft size={16} />
                            Back to Trending
                        </button>
                    )}
                </div>
                <form onSubmit={handleSearchSubmit} className="relative max-w-xl" ref={searchContainerRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search @handles, issues, places..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        onFocus={() => { if (searchQuery.length >= 1) setShowSearchResults(true); }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-full py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                </form>
            </div>

            {/* Main Content Area */}
            {!isResultsView ? (
                <>
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
                </>
            ) : (
                <>
                    {/* Search Tabs */}
                    <div className="bg-white border-b border-gray-100 flex sticky top-0 z-10 md:static">
                        <button 
                            onClick={() => setActiveTab('accounts')}
                            className={clsx(
                                "flex-1 py-3 flex flex-col items-center gap-1 border-b-2 transition-all",
                                activeTab === 'accounts' ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400"
                            )}
                        >
                            <Users size={20} />
                            <span className="text-[10px] font-bold uppercase tracking-tight">Accounts</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('posts')}
                            className={clsx(
                                "flex-1 py-3 flex flex-col items-center gap-1 border-b-2 transition-all",
                                activeTab === 'posts' ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400"
                            )}
                        >
                            <LayoutGrid size={20} />
                            <span className="text-[10px] font-bold uppercase tracking-tight">Posts</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('places')}
                            className={clsx(
                                "flex-1 py-3 flex flex-col items-center gap-1 border-b-2 transition-all",
                                activeTab === 'places' ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400"
                            )}
                        >
                            <MapPin size={20} />
                            <span className="text-[10px] font-bold uppercase tracking-tight">
                                {matchedCity ? matchedCity : 'Places'}
                            </span>
                        </button>
                    </div>

                    {/* Results View */}
                    <div className="max-w-2xl mx-auto px-4 py-6">
                        {isSearching ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="animate-spin text-blue-600" size={32} />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {activeTab === 'accounts' && (
                                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                        {searchResultsUsers.length > 0 ? (
                                            searchResultsUsers.map(u => (
                                                <button
                                                    key={u.uid}
                                                    onClick={() => router.push(`/profile/${u.uid}`)}
                                                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[2px]">
                                                        <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                                                            {u.photoURL ? (
                                                                <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User size={20} className="text-gray-300" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-left flex-1">
                                                        <p className="font-bold text-gray-900">{u.handle}</p>
                                                        <p className="text-sm text-gray-500">{u.displayName}</p>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-12 text-center text-gray-400">
                                                <Users size={48} className="mx-auto mb-4 opacity-10" />
                                                <p className="font-medium">No accounts found</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'posts' && (
                                    <>
                                        {searchResultsIssues.length > 0 ? (
                                            searchResultsIssues.map(issue => (
                                                <IssueCard key={issue.id} issue={issue} />
                                            ))
                                        ) : (
                                            <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
                                                <LayoutGrid size={48} className="mx-auto mb-4 opacity-10" />
                                                <p className="font-medium">No matches in reports</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {activeTab === 'places' && (
                                    <>
                                        {searchResultsIssues.filter(i => 
                                            matchedCity 
                                                ? i.cityName?.toLowerCase() === matchedCity.toLowerCase()
                                                : i.location?.toLowerCase().includes(searchQuery.toLowerCase()) || i.cityName?.toLowerCase().includes(searchQuery.toLowerCase())
                                        ).length > 0 ? (
                                            searchResultsIssues
                                                .filter(i => 
                                                    matchedCity 
                                                        ? i.cityName?.toLowerCase() === matchedCity.toLowerCase()
                                                        : i.location?.toLowerCase().includes(searchQuery.toLowerCase()) || i.cityName?.toLowerCase().includes(searchQuery.toLowerCase())
                                                )
                                                .map(issue => (
                                                    <IssueCard key={issue.id} issue={issue} />
                                                ))
                                        ) : (
                                            <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
                                                <MapPin size={48} className="mx-auto mb-4 opacity-10" />
                                                <p className="font-medium">No reports found for this location</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
