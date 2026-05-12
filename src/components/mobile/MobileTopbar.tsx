import React, { useEffect, useState } from 'react';
import { Search, X, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandLogo, SearchResult, TopbarSearchResultsContent } from '../shared/topbarShared';
import { useContentMode } from '../../utils/contentMode';
import SettingsModal from '../shared/SettingsModal';
import { clearRecentSearch, readRecentSearches, saveRecentSearch, type RecentSearchEntry } from '../../utils/recentSearches';

interface MobileTopbarProps {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  clearSearch: () => void;
  isSearching: boolean;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  searchMounted: boolean;
  searchResults: SearchResult[];
}

const MobileTopbar: React.FC<MobileTopbarProps> = ({
  searchQuery, onSearchQueryChange, clearSearch, isSearching, showSearch, setShowSearch, searchMounted, searchResults
}) => {
  const navigate = useNavigate();
  const { isAnimeMode } = useContentMode();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>([]);

  useEffect(() => {
    const syncRecentSearches = () => setRecentSearches(readRecentSearches());
    syncRecentSearches();
    window.addEventListener('storage', syncRecentSearches);
    window.addEventListener('recent-searches-changed', syncRecentSearches);
    return () => {
      window.removeEventListener('storage', syncRecentSearches);
      window.removeEventListener('recent-searches-changed', syncRecentSearches);
    };
  }, []);

  const handleNavigate = (slug?: string) => {
    setShowSearch(false);
    if (slug && typeof slug === 'string') {
      navigate(`/watch/${slug}`);
    } else {
      setRecentSearches(saveRecentSearch(searchQuery));
      navigate(`/browse?q=${encodeURIComponent(searchQuery)}`);
    }
    clearSearch();
  };

  const handleRecentSearch = (query: string) => {
    setRecentSearches(saveRecentSearch(query));
    setShowSearch(false);
    navigate(`/browse?q=${encodeURIComponent(query)}`);
    clearSearch();
  };

  const removeRecentSearch = (event: React.MouseEvent, query: string) => {
    event.stopPropagation();
    setRecentSearches(clearRecentSearch(query));
  };

  return (
    <div className="relative w-full z-[990]">
      {/* ─── Sleek App Header ─── */}
      <div
        className="relative z-[995] flex items-center justify-between px-4 py-3"
        style={{
          background: 'color-mix(in srgb, var(--app-bg) 65%, transparent)',
          backdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 30px -4px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 outline-none group"
        >
          <BrandLogo />
          <span className="text-[18px] font-bold tracking-tight text-white transition-colors" style={{ fontFamily: '"Syne", sans-serif' }}>
            kotatsutv
          </span>
        </motion.button>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Settings Button */}
          <motion.button
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsSettingsOpen(true)}
            className="group flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/5 bg-white/[0.04] text-zinc-400 transition-all duration-300 hover:text-white hover:border-white/10 hover:shadow-lg"
          >
            <Settings size={18} strokeWidth={2.5} className="transition-transform duration-700 ease-out group-hover:rotate-180" />
          </motion.button>

          {/* Search Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSearch(!showSearch)}
            className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-full border transition-all duration-300 overflow-hidden ${showSearch
              ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_15%,transparent)] text-[var(--app-accent)] shadow-[0_0_16px_color-mix(in_srgb,var(--app-accent)_40%,transparent)]'
              : 'border-white/5 bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10 hover:shadow-lg'
              }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {showSearch ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -180, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 180, opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <X size={18} strokeWidth={2.5} />
                </motion.div>
              ) : (
                <motion.div
                  key="search"
                  initial={{ rotate: 180, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -180, opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <Search size={18} strokeWidth={2.5} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* ─── Floating Search Drawer ─── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -16, scale: 0.96, filter: 'blur(8px)' }}
            transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.8 }}
            className="absolute top-full left-0 w-full px-3 pt-3 z-[990]"
          >
            <div
              className="rounded-[24px] border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.02)] overflow-hidden"
              style={{
                background: 'color-mix(in srgb, var(--app-surface-1) 90%, transparent)',
                backdropFilter: 'blur(32px) saturate(200%)',
              }}
            >
              {/* Input Area */}
              <div
                className={`relative flex items-center transition-colors duration-300 ${isInputFocused ? 'bg-white/[0.06]' : 'bg-white/[0.02]'}`}
              >
                {/* Accent glow line at the bottom of the input */}
                <div
                  className="absolute bottom-0 left-0 h-[2px] bg-[var(--app-accent)] transition-all duration-300"
                  style={{ width: isInputFocused ? '100%' : '0%', opacity: isInputFocused ? 1 : 0 }}
                />

                <Search
                  className={`absolute left-5 transition-colors duration-300 ${searchQuery.trim() ? 'text-[var(--app-accent)]' : 'text-zinc-500'}`}
                  size={18}
                  strokeWidth={2.5}
                />

                <input
                  autoFocus
                  value={searchQuery}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(); }}
                  className="w-full bg-transparent py-5 pl-[48px] pr-[52px] text-[15px] font-semibold text-white outline-none placeholder:text-zinc-500 placeholder:font-medium"
                  style={{ fontFamily: '"Onest", sans-serif' }}
                  placeholder="Search anime, studios, etc..."
                />

                <AnimatePresence>
                  {searchQuery && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      onClick={clearSearch}
                      className="absolute right-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-zinc-300 hover:text-white hover:bg-white/20 transition-colors shadow-sm"
                    >
                      <X size={14} strokeWidth={3} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Search Results */}
              <AnimatePresence>
                {searchQuery.trim().length === 0 && recentSearches.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                    className="border-t border-white/5 bg-[color-mix(in_srgb,var(--app-bg)_50%,transparent)] p-3"
                  >
                    <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      Recent searches
                    </div>
                    <div className="space-y-2">
                      {recentSearches.map((entry) => (
                        <button
                          key={entry.query}
                          type="button"
                          onClick={() => handleRecentSearch(entry.query)}
                          className="flex w-full items-center gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.025] px-3 py-3 text-left"
                        >
                          <Search size={15} className="text-zinc-500" />
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/80">
                            {entry.query}
                          </span>
                          <span
                            role="button"
                            tabIndex={-1}
                            onClick={(event) => removeRecentSearch(event, entry.query)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-white/10 hover:text-white"
                            aria-label={`Remove ${entry.query} from recent searches`}
                          >
                            <X size={13} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
                {searchMounted && searchQuery.length > 1 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }} // smooth ease out
                    className="border-t border-white/5 bg-[color-mix(in_srgb,var(--app-bg)_50%,transparent)] max-h-[60vh] overflow-y-auto"
                  >
                    <TopbarSearchResultsContent
                      isSearching={isSearching}
                      searchQuery={searchQuery}
                      searchResults={searchResults}
                      isAnimeMode={isAnimeMode}
                      onOpenResult={handleNavigate}
                      onSubmitSearch={() => handleNavigate()}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Search Backdrop Overlay ─── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 top-[62px] bg-black/60 z-[980]"
            onClick={() => setShowSearch(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Modals ─── */}
      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default MobileTopbar;
