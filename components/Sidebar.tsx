'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Map, Bell, User, ChevronLeft, ChevronRight, ShieldCheck, UserPlus, LayoutDashboard } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const pathname = usePathname();
  const { isOfficial, isAdmin } = useAuth();

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Explore', href: '/explore', icon: Compass },
    { name: 'City Insights', href: '/scorecard', icon: Map },
    { name: 'Notifications', href: '/notifications', icon: Bell },
    { name: 'Profile', href: '/profile', icon: User },
    // Official Portal (conditional) - HIDDEN FOR NOW
    // ...(isOfficial ? [{ name: 'Official Portal', href: '/official', icon: ShieldCheck }] : []),
    // ...(isAdmin ? [{ name: 'Add Official', href: '/admin/add-official', icon: UserPlus }] : []),
    ...(isAdmin ? [{ name: 'Admin Dashboard', href: '/admin/dashboard', icon: LayoutDashboard }] : []),
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 256 : 72 }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className={clsx(
        "bg-[#f6f8fc] flex flex-col h-full overflow-hidden",
        "relative"
      )}
    >
      <div className="flex flex-col gap-1.5 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isSpecial = item.href === '/official' || item.href === '/admin/add-official' || item.href === '/admin/dashboard';
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-4 px-5 py-3.5 rounded-full transition-all duration-200 min-w-max",
                isSpecial
                  ? isActive
                    ? "bg-blue-100 text-blue-900 font-bold"
                    : "text-blue-600 hover:bg-blue-50 border border-blue-200/40"
                  : isActive
                    ? "bg-blue-100 text-blue-900 font-bold"
                    : "text-gray-700 hover:bg-gray-200/60"
              )}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <motion.span
                animate={{ opacity: isOpen ? 1 : 0, display: isOpen ? "block" : "none" }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap text-sm font-medium"
              >
                {item.name}
              </motion.span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto p-3 border-t border-gray-200/50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-4 px-5 py-3 rounded-full text-gray-700 hover:bg-gray-200/60 w-full transition-all duration-200 text-sm font-medium"
        >
          {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          {isOpen && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
