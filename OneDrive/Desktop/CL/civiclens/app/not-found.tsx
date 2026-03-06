import Link from 'next/link';
import { MapPinOff } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-gray-50">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-gray-400">
                <MapPinOff size={48} />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Lost Citizen?</h2>
            <p className="text-gray-500 max-w-sm mb-8">
                We couldn't find the page you're looking for. It might have been resolved or moved to another district.
            </p>
            <Link
                href="/"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full transition-colors shadow-lg shadow-blue-200"
            >
                Return to HQ
            </Link>
        </div>
    );
}
