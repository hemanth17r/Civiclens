'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Map, Bell, User, LayoutDashboard } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { springSnappy } from '@/lib/motion';

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
    <motion.div
      initial={false}
      animate={{ width: isOpen ? 256 : 72 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="relative h-full flex-shrink-0"
    >
      <aside
        className={clsx(
          "bg-white flex flex-col h-full overflow-hidden absolute left-0 top-0 bottom-0 z-40 w-full"
        )}
      >
        <div className="flex flex-col gap-1.5 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const isSpecial = item.href === '/official' || item.href === '/admin/add-official' || item.href === '/admin/dashboard';
            return (
              <motion.div key={item.href} whileTap={{ scale: 0.96 }} transition={springSnappy}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-4 px-5 py-3.5 rounded-full transition-colors duration-150 min-w-max",
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
              </motion.div>
            );
          })}
        </div>
      </aside>
    </motion.div>
  );
};

export default Sidebar;

