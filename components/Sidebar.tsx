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
        "bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden",
        "relative"
      )}
    >
      <div className="flex flex-col gap-2 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isSpecial = item.href === '/official' || item.href === '/admin/add-official' || item.href === '/admin/dashboard';
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-4 px-4 py-3 rounded-2xl transition-colors min-w-max",
                isSpecial
                  ? isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-blue-600 hover:bg-blue-50 border border-blue-200"
                  : isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <motion.span
                animate={{ opacity: isOpen ? 1 : 0, display: isOpen ? "block" : "none" }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap"
              >
                {item.name}
              </motion.span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto p-3 border-t border-gray-100">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-4 px-4 py-3 rounded-2xl text-gray-700 hover:bg-gray-100 w-full"
        >
          {isOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
          {isOpen && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
