'use client';

import React, { useState } from 'react';
import { X, Loader2, MapPin, Camera, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createIssue } from '@/lib/issues';
import { useAuth } from '@/context/AuthContext';
import { INDIAN_CITIES } from '@/data/cities';

interface ReportIssueDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const categories = ['Road', 'Waste', 'Water', 'Safety', 'Infrastructure', 'Environment', 'Other'];

const ReportIssueDialog: React.FC<ReportIssueDialogProps> = ({ isOpen, onClose }) => {
    const { user, userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');

    // City Logic
    const [citySearch, setCitySearch] = useState('');
    const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);

    const filteredCities = citySearch === ''
        ? INDIAN_CITIES.sort((a, b) => a.tier - b.tier).slice(0, 10)
        : INDIAN_CITIES.filter(city =>
            city.name.toLowerCase().includes(citySearch.toLowerCase())
        );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title || !category || !selectedCityName) {
            alert("Please fill in all required fields, including City.");
            return;
        }

        // Require authentication — guest userId is not allowed
        if (!user) {
            alert("You must be signed in to submit a report.");
            return;
        }

        setLoading(true);

        try {
            const imageUrl = ''; // Photo upload temporarily unavailable

            const cityData = INDIAN_CITIES.find(c => c.name === selectedCityName);

            // Derive handle safely — never send undefined to Firestore
            const handle = userProfile?.handle
                || (user?.email ? `@${user.email.split('@')[0]}` : undefined);

            const issueData: any = {
                title,
                category,
                description,
                location,
                imageUrl,
                userId: user.uid,
            };

            if (handle) issueData.userHandle = handle;
            if (userProfile?.photoURL) issueData.userAvatar = userProfile.photoURL;
            else if (user?.photoURL) issueData.userAvatar = user.photoURL;
            if (cityData?.name) issueData.cityName = cityData.name;
            if (cityData) issueData.cityCoordinates = { lat: cityData.lat, lng: cityData.lng };

            await createIssue(issueData);

            // First reset the form state, THEN close the dialog.
            resetForm();
            onClose();

        } catch (error: any) {
            console.error('Failed to submit issue', error);
            alert(`Failed to submit: ${error.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setCategory('');
        setDescription('');
        setLocation('');
        setCitySearch('');
        setSelectedCityName(null);
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                            <h2 className="text-xl font-bold text-gray-900">Report an Issue</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Photo Upload — temporarily unavailable until Firebase Storage is provisioned */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Photo Evidence</label>
                                    <div className="border-2 border-dashed border-amber-200 bg-amber-50 rounded-xl p-6 flex flex-col items-center justify-center text-amber-600 gap-1">
                                        <Camera size={32} className="mb-1 opacity-50" />
                                        <span className="font-semibold text-sm">Photo upload coming soon</span>
                                        <span className="text-xs text-amber-500 text-center">Photo uploads are temporarily unavailable. You can still submit your report without a photo.</span>
                                    </div>
                                </div>

                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Issue Title (e.g. Pothole on Main St)"
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                                    required
                                />

                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1">
                                        {category ? `Category: ${category}` : 'Select Category'}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {categories.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setCategory(c)}
                                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${category === c
                                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                    }`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="relative group">
                                    <MapPin className="absolute left-3 top-3.5 text-gray-400 z-10" size={18} />

                                    {/* City Search Input */}
                                    <input
                                        type="text"
                                        value={citySearch}
                                        onChange={(e) => {
                                            setCitySearch(e.target.value);
                                            setIsCityDropdownOpen(true);
                                            setSelectedCityName(null); // Reset selection on type
                                        }}
                                        onClick={() => setIsCityDropdownOpen(true)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none relative z-0 placeholder-gray-400"
                                        placeholder="Select City (e.g. Jalandhar)"
                                    />

                                    {/* Dropdown */}
                                    {isCityDropdownOpen && citySearch.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-48 overflow-y-auto z-20">
                                            {filteredCities.length > 0 ? (
                                                filteredCities.map(city => (
                                                    <button
                                                        key={city.name}
                                                        type="button"
                                                        onClick={() => {
                                                            setCitySearch(city.name);
                                                            setSelectedCityName(city.name);
                                                            setIsCityDropdownOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group"
                                                    >
                                                        <span className="font-medium text-gray-700 group-hover:text-blue-600">{city.name}</span>
                                                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Tier {city.tier}</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="p-4 text-center text-gray-400 text-sm">No cities found</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                                    placeholder="Specific Location (e.g. Near Bus Stand)"
                                />

                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe the issue in detail..."
                                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 h-24 resize-none placeholder-gray-400"
                                />

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                                    Submit Report
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ReportIssueDialog;
