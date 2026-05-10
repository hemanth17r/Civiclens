import React from 'react';
import { Shield, MapPin, CheckCircle2, Trophy, Clock } from 'lucide-react';

export default function SemanticOverview() {
    return (
        <section className="mt-16 border-t border-gray-100 pt-16 pb-12">
            <div className="max-w-4xl mx-auto px-4">
                <header className="mb-12 text-center">
                    <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
                        CivicLens: The Community-Driven Civic Platform
                    </h2>
                    <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                        CivicLens maps the pulse of urban infrastructure. By connecting active citizens with local data, we transform reporting into resolution.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    <article className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-blue-600">
                            <Shield size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Trust-Weighted Verification</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            Every user in CivicLens has a reputation score. Reports from trusted contributors are prioritized, ensuring that the community feed remains high-quality and verified.
                        </p>
                    </article>

                    <article className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-4 text-green-600">
                            <MapPin size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Hyper-Local Context</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            We don't just show lists. CivicLens understands geographic relationships, surfacing issues in your immediate vicinity and tracking trends across city wards.
                        </p>
                    </article>
                </div>

                <div className="bg-white/50 backdrop-blur-md rounded-3xl p-6 md:p-12 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-4 text-purple-600">
                            <Clock size={24} />
                        </div>
                        <h3 className="text-2xl font-bold mb-8 text-gray-900">The Issue Lifecycle</h3>
                        <div className="space-y-6">
                            {[
                                { title: 'Reported', desc: 'Initial submission with photo and location data.' },
                                { title: 'Verification Needed', desc: 'Community members vote to confirm validity.' },
                                { title: 'Active', desc: 'Confirmed issue waiting for official attention.' },
                                { title: 'Action Seen', desc: 'Maintenance or repair work has commenced.' },
                                { title: 'Resolved', desc: 'Issue fixed and verified by the community.' },
                            ].map((step, i) => (
                                <div key={i} className="flex gap-4 items-start">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full border border-blue-100 flex items-center justify-center font-bold text-sm bg-blue-50 text-blue-600">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{step.title}</h4>
                                        <p className="text-gray-500 text-sm">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Subtle Background Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 blur-[100px] -mr-32 -mt-32" />
                </div>
            </div>
        </section>
    );
}
