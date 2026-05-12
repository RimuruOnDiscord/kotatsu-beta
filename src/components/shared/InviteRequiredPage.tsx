/* --- START OF FILE InviteRequiredPage.tsx --- */

import React, { useState } from 'react';
import { ArrowRight, KeyRound, Loader2, LogOut, ShieldCheck, X, Sparkles, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/AuthContext';
import AuthModal from './AuthModal';
import { BrandLogo } from './topbarShared';

const TOPBAR_FONT = '"Onest", ui-sans-serif, system-ui, -apple-system, sans-serif';
const DISPLAY_FONT = '"Syne", sans-serif';

const InviteRequiredPage: React.FC = () => {
  const { user, profile, loading, redeemInviteCode, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRedeem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (redeeming || !inviteCode.trim()) return;

    setRedeeming(true);
    setError(null);
    const result = await redeemInviteCode(inviteCode.trim());
    if (result.error) setError(result.error);
    setRedeeming(false);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.96, filter: 'blur(8px)' },
    visible: { 
      opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
      transition: { type: 'spring', damping: 28, stiffness: 300, mass: 0.8, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 24, stiffness: 300 } }
  };

  return (
    <div className="relative min-h-screen bg-[var(--app-bg,#09090b)] text-white flex items-center justify-center p-5 overflow-hidden" style={{ fontFamily: TOPBAR_FONT }}>
      
      {/* ══ AMBIENT BACKGROUND GLOW ══ */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 mix-blend-screen">
        <div className="w-[600px] h-[600px] rounded-full bg-[var(--app-accent,#8b5cf6)] blur-[140px] opacity-20 translate-y-[-10%]" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-blue-500 blur-[120px] opacity-10 translate-y-[20%] translate-x-[20%]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-[460px] relative z-10"
      >
        <div 
          className="rounded-[24px] overflow-hidden flex flex-col p-8"
          style={{
            backgroundColor: 'rgba(15, 15, 15, 0.45)',
            backdropFilter: 'blur(40px) saturate(150%)',
            WebkitBackdropFilter: 'blur(40px) saturate(150%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 38px 110px -26px rgba(0,0,0,0.98), 0 12px 36px -20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
        >
          {/* Header */}
<motion.div variants={itemVariants} className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04]">
                <BrandLogo />
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <ShieldCheck size={13} className="text-[var(--app-accent,#8b5cf6)]" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--app-accent,#8b5cf6)]">
                    Invite required
                  </p>
                </div>
                <h1 className="text-[22px] font-bold leading-tight tracking-tight text-white">
                  Sign in to your account
                </h1>
              </div>
            </div>
          </motion.div>

          <motion.p variants={itemVariants} className="mt-4 text-[14.5px] leading-relaxed text-zinc-400 font-medium">
            We're currently in a closed testing phase. You need a valid invite code to unlock and access the platform.
          </motion.p>

          <div className="mt-8">
            {loading ? (
              <motion.div variants={itemVariants} className="flex h-[120px] items-center justify-center rounded-[16px] border border-white/[0.04] bg-white/[0.02] text-[var(--app-accent,#8b5cf6)]">
                <Loader2 size={24} className="animate-spin" />
              </motion.div>
            ) : user ? (
              <motion.div variants={itemVariants} className="flex flex-col gap-5">
                
                {/* Active User Banner */}
                <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-black/40 border border-white/[0.08]">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-500">
                        <UserIcon size={18} />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-semibold text-white/95">
                      {profile?.display_name || 'Logged in user'}
                    </span>
                    <span className="truncate text-[11.5px] text-zinc-500">
                      {user.email}
                    </span>
                  </div>
                  <button
                    onClick={signOut}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-zinc-500 transition-colors hover:bg-white/[0.08] hover:text-white outline-none"
                    title="Sign out"
                  >
                    <LogOut size={15} />
                  </button>
                </div>

                <form onSubmit={handleRedeem} className="flex flex-col gap-3">
                  <div 
                    className="group relative flex h-[52px] items-center overflow-hidden rounded-[14px] border border-white/[0.08] bg-[rgba(0,0,0,0.4)] transition-all duration-300 focus-within:border-[var(--app-accent,#8b5cf6)] focus-within:bg-[color-mix(in_srgb,var(--app-accent,#8b5cf6)_10%,transparent)] focus-within:shadow-[0_0_0_1px_var(--app-accent,#8b5cf6)]"
                  >
                    <div className="flex h-full w-[48px] shrink-0 items-center justify-center text-zinc-500 transition-colors duration-300 group-focus-within:text-[var(--app-accent,#8b5cf6)]">
                      <KeyRound size={18} />
                    </div>
                    <input
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      placeholder="Paste your invite code here..."
                      spellCheck={false}
                      autoCapitalize="none"
                      className="h-full flex-1 bg-transparent pr-4 font-mono text-[14px] tracking-wide text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-zinc-600 outline-none"
                    />
                  </div>

                  <AnimatePresence mode="popLayout">
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-start gap-2.5 rounded-[12px] border border-red-500/20 bg-red-500/[0.08] px-3.5 py-3 text-[13px] font-medium text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                          <X size={15} strokeWidth={2.5} className="mt-[2px] shrink-0 text-red-400" />
                          <span className="leading-snug">{error}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={redeeming || !inviteCode.trim()}
                    className="transition-opacity duration-300 disabled:opacity-50 disabled:pointer-events-none"
                    style={{
                      background: 'linear-gradient(180deg, var(--app-accent, #8b5cf6) 0%, color-mix(in srgb, var(--app-accent, #8b5cf6) 80%, black) 100%)',
                    }}
                  >
                    {redeeming ? (
                      <Loader2 size={18} className="animate-spin text-white/80" />
                    ) : (
                      <Sparkles size={18} className="text-white/90" />
                    )}
                    Redeem Code
                  </motion.button>
                </form>
              </motion.div>
            ) : (
              <motion.div variants={itemVariants} className="flex flex-col gap-4">
                <div className="rounded-[16px] border border-dashed border-white/[0.1] bg-white/[0.02] p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] mb-3">
                    <UserIcon size={20} className="text-zinc-400" />
                  </div>
                  <h3 className="text-[15px] font-bold text-white mb-1.5" style={{ fontFamily: DISPLAY_FONT }}>Account Required</h3>
                  <p className="text-[13px] text-zinc-400 leading-relaxed max-w-[280px] mx-auto">
                    You must be logged in to an account before you can redeem your invite code.
                  </p>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setAuthOpen(true)}
                  className="group relative flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] overflow-hidden text-[14.5px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.5)] transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-white/[0.08] transition-colors group-hover:bg-white/[0.12]" />
                  <div className="absolute inset-0 border border-white/[0.1] rounded-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
                  
                  <span className="relative z-10">Log in or sign up</span>
                  <ArrowRight size={17} className="relative z-10 text-zinc-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" />
                </motion.button>
              </motion.div>
            )}
          </div>
        </div>
        
        {/* Footer text */}
        <motion.div variants={itemVariants} className="mt-6 text-center text-[12px] font-medium text-zinc-600">
          Experiencing issues? Reach out on our Discord server.
        </motion.div>
      </motion.div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
};

export default InviteRequiredPage;

/* --- END OF FILE InviteRequiredPage.tsx --- */