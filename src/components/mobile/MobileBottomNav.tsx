import React, { useState } from 'react';
import { Home, Compass, Calendar, Bookmark, User } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/AuthContext';
import AuthModal from '../shared/AuthModal';

const MobileBottomNav: React.FC = () => {
    const { user, profile } = useAuth();
    const location = useLocation();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const NAV_ITEMS = [
        { label: 'Home', to: '/home', icon: Home },
        { label: 'Discover', to: '/browse', icon: Compass },
        { label: 'Schedule', to: '/schedule', icon: Calendar },
        { label: 'My List', to: '/bookmarks', icon: Bookmark },
        { label: 'Profile', to: user ? `/profile/${user.id}` : '#', icon: User, isProfile: true },
    ];

    return (
        <>
            <div className="fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-0 right-0 z-[990] flex justify-center px-4 lg:hidden pointer-events-none">

                {/* Outer shell */}
                <motion.div
                    initial={{ opacity: 0, y: 32, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.05 }}
                    className="relative flex items-center justify-between p-[6px] rounded-full w-full max-w-[280px] pointer-events-auto"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface-1) 75%, transparent)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 20px 40px -8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                >
                    {NAV_ITEMS.map((item) => {
                        const isActive = item.to !== '#' && location.pathname.startsWith(item.to);

                        return (
                            <NavLink
                                key={item.label}
                                to={item.to}
                                onClick={(e) => {
                                    if (!user && item.isProfile) {
                                        e.preventDefault();
                                        setIsAuthModalOpen(true);
                                    }
                                }}
                                className="relative flex-1 flex justify-center items-center h-[48px] outline-none select-none"
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                            >
                                {/* 
                  Fixed-size wrapper (48x48) guarantees the active blob 
                  is a perfect circle and perfectly centered 
                */}
                                <div className="relative flex items-center justify-center w-[48px] h-[48px]">

                                    {/* Active Blob handled purely by Framer Motion layoutId */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="mobileNavBlob"
                                            className="absolute inset-0 rounded-full"
                                            transition={{ type: 'spring', stiffness: 500, damping: 32, mass: 1 }}
                                            style={{
                                                background: 'color-mix(in srgb, var(--app-accent) 15%, transparent)',
                                                border: '1px solid color-mix(in srgb, var(--app-accent) 30%, transparent)',
                                                boxShadow: 'inset 0 0 12px color-mix(in srgb, var(--app-accent) 10%, transparent)',
                                            }}
                                        />
                                    )}


                                    {/* Icon / Avatar */}
                                    <motion.div
                                        className="relative z-10 flex items-center justify-center w-8 h-8 shrink-0"
                                        animate={{ scale: isActive ? 1 : 1 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                    >
                                        {item.isProfile && profile?.avatar_url ? (
                                            <img
                                                src={profile.avatar_url}
                                                className="w-full h-full rounded-full object-cover"
                                                style={{
                                                    border: isActive ? '2px solid var(--app-accent)' : '2px solid transparent',
                                                    opacity: isActive ? 1 : 0.6,
                                                    transition: 'border-color 0.3s, opacity 0.3s',
                                                }}
                                                alt="Profile"
                                            />
                                        ) : (
                                            <item.icon
                                                size={22}
                                                strokeWidth={isActive ? 2.5 : 2}
                                                className="transition-colors duration-300"
                                                style={{
                                                    color: isActive ? 'var(--app-accent)' : 'rgba(255,255,255,0.45)',
                                                }}
                                            />
                                        )}
                                    </motion.div>
                                </div>
                            </NavLink>
                        );
                    })}
                </motion.div>
            </div>

            <AuthModal open={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </>
    );
};

export default MobileBottomNav;