'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Map, Bell, User, LayoutDashboard } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const isVisualOpen = isOpen;

  const navItems = [
    { name: 'Explore', href: '/explore', icon: Compass },
    { name: 'City Insights', href: '/scorecard', icon: Map },
    { name: 'Notifications', href: '/notifications', icon: Bell },
    { name: 'Profile', href: '/profile', icon: User },
    ...(isAdmin ? [{ name: 'Admin Dashboard', href: '/admin/dashboard', icon: LayoutDashboard }] : []),
  ];

  return (
    <div
      className="relative h-full transition-all duration-300 ease-in-out flex-shrink-0"
      style={{ width: isOpen ? 256 : 72 }}
    >
      <motion.aside
        initial={false}
        animate={{
          width: isVisualOpen ? 256 : 72,
          boxShadow: "none"
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        className={clsx(
          "bg-white flex flex-col h-full overflow-hidden absolute left-0 top-0 bottom-0 z-40"
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
                  animate={{ opacity: isVisualOpen ? 1 : 0, display: isVisualOpen ? "block" : "none" }}
                  transition={{ duration: 0.15 }}
                  className="whitespace-nowrap text-sm font-medium"
                >
                  {item.name}
                </motion.span>
              </Link>
            );
          })}
        </div>
      </motion.aside>
    </div>
  );
};

export default Sidebar;
