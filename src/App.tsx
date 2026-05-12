import { useState, useEffect, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import BookmarksPage from './pages/Bookmarks';
import AppFooter from './components/AppFooter';
import DesktopTopbar from './components/desktop/DesktopTopbar';
import MobileTopbar from './components/mobile/MobileTopbar';
import MobileBottomNav from './components/mobile/MobileBottomNav'; // <-- Added Bottom Nav
import { ContentModeProvider } from './utils/contentMode';
import { AuthProvider, useAuth } from './lib/AuthContext';
import InviteRequiredPage from './components/shared/InviteRequiredPage';

import AnimeBrowse from './pages/AnimeBrowse';
import AnimeDetail from './pages/AnimeDetail';
import AnimeHome from './pages/AnimeHome';
import AnimeWatch from './pages/AnimeWatchPage';
import AnimeRandom from './pages/AnimeRandom';
import AnimeSchedule from './pages/AnimeSchedule';
import ContinueWatchingPage from './pages/AnimeContinueWatching';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import ProfileModal from './components/shared/ProfileModal';

import InteractiveBackground from './components/InteractiveBackground';
import { fetchAnimeSearch, getAnimeCover, getAnimeDisplayTitle, getAnimeScore, getAnimeTypeLabel } from './utils/animeApi';
import type { SearchResult } from './components/shared/topbarShared';

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') return window.matchMedia(query).matches;
    return false;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

// ─── PAGE WRAPPER ───
// Notice the pt-[60px] and pb-[70px] for mobile to clear the fixed top/bottom bars!
const PageWrapper = ({ children, showFooter = true }: { children: ReactNode; showFooter?: boolean }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25, ease: "easeInOut" }}
    className="relative z-10 flex flex-col min-h-screen pt-[60px] pb-[80px] lg:pt-[80px] lg:pb-0"
  >
    <div className="flex-1">
      {children}
    </div>
    {showFooter && <AppFooter />}
  </motion.div>
);

// ─── APP CONTENT ───
function AppContent() {
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 1024px)');

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await fetchAnimeSearch(query, 6);
        if (cancelled) return;
        setSearchResults((data.results || []).map((entry) => ({
          id: entry.id,
          title: getAnimeDisplayTitle(entry.title),
          score: getAnimeScore(entry),
          type: getAnimeTypeLabel(entry),
          images: { jpg: { image_url: getAnimeCover(entry) } },
        })));
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const topbarProps = {
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    showSearch,
    setShowSearch,
    isSearching,
    searchResults,
    searchMounted: true,
    clearSearch: () => setSearchQuery('')
  };

  return (
    <div className="relative w-full min-h-screen bg-[var(--app-bg)] text-white overflow-x-hidden">

      <InteractiveBackground />

      {/* ─── NAVIGATION BARS ─── */}
      {isMobile ? (
        <>
          <div className="fixed top-0 left-0 right-0 z-[999]">
            <MobileTopbar {...topbarProps} />
          </div>
          <MobileBottomNav />
        </>
      ) : (
        <div className="fixed top-0 left-0 right-0 z-[999] bg-[var(--app-bg)]/90 backdrop-blur-md border-b border-white/5">
          <DesktopTopbar {...topbarProps} />
        </div>
      )}

      <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<PageWrapper><AnimeHome /></PageWrapper>} />
          <Route path="/browse" element={<PageWrapper><AnimeBrowse /></PageWrapper>} />
          <Route path="/random" element={<PageWrapper><AnimeRandom /></PageWrapper>} />
          <Route path="/schedule" element={<PageWrapper><AnimeSchedule /></PageWrapper>} />
          <Route path="/bookmarks" element={<PageWrapper><BookmarksPage /></PageWrapper>} />
          <Route path="/continuewatching" element={<PageWrapper><ContinueWatchingPage /></PageWrapper>} />
          <Route path="/watch/:animeId" element={<PageWrapper><AnimeDetail /></PageWrapper>} />
          <Route path="/watch/:animeId/:provider/:category/:episodeId" element={<PageWrapper showFooter={false}><AnimeWatch /></PageWrapper>} />
          <Route path="/profile/:userId" element={<PageWrapper><ProfilePage /></PageWrapper>} />
          <Route path="/users" element={<PageWrapper><UsersPage /></PageWrapper>} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AnimatePresence>

      {/* ─── GLOBAL MODALS ─── */}

    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ContentModeProvider>
        <InviteGate>
          <Router>
            <AppContent />
          </Router>
        </InviteGate>
      </ContentModeProvider>
    </AuthProvider>
  );
}

const InviteGate = ({ children }: { children: ReactNode }) => {
  const { user, loading, hasInviteAccess } = useAuth();

  if (loading || !user || !hasInviteAccess) {
    return <InviteRequiredPage />;
  }

  return <>{children}</>;
};

export default App;
