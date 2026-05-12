/* --- START OF FILE AnimeDetail.tsx --- */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CommentSection from '../components/shared/CommentSection';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, Star, Loader2, Bookmark, BookmarkCheck, Languages,
  Info, ArrowDownUp, Youtube, Clock, Users, ExternalLink, TrendingUp, Heart,
  Calendar, Library, Play, Bell, ChevronDown, Building2, X, Clapperboard,
  CheckCircle2, CalendarDays, Sparkles, Maximize2
} from 'lucide-react';

import { readBookmarks, toggleBookmark, isFollowed, toggleFollow } from '../utils/bookmarks';
import {
  AnimeWatchProviderPayload,
  fetchAnimeEpisodes,
  fetchAnimeSearch,
  fetchAnimeInfo,
  getProviderEpisodes,
} from '../utils/animeApi';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────
// STYLES & VARIANTS
// ─────────────────────────────────────────
const DESIGN_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Onest:wght@300;400;500;600;700&display=swap');

  :root {
    --aw-bg:          var(--app-bg);
    --aw-s1:          var(--app-bg-2);
    --aw-s2:          var(--app-bg-3);
    --aw-card:        var(--app-card);
    --aw-border:      var(--app-border);
    --aw-accent:      var(--app-accent);
    --aw-muted:       #ffffffb7;
    --aw-text:        #ffffff;
    --aw-font-display: 'Syne', sans-serif;
    --aw-font-body:    'Onest', sans-serif;
  }

  .aw-root { font-family: var(--aw-font-body); background: transparent; color: var(--aw-text); }

  .aw-noise::before {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
    background-repeat: repeat; background-size: 180px;
  }

  .aw-label {
    font-family: var(--aw-font-display); font-size: 10px; letter-spacing: 0.18em;
    font-weight: 600; text-transform: uppercase; color: var(--aw-accent);
  }

  .aw-skeleton-card {
    position: relative; background: var(--aw-s1); backdrop-filter: blur(12px);
    border: 1px solid var(--aw-border); 
    border-radius: 14px; overflow: hidden;
  }
  .aw-skeleton-card::before {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--aw-text), transparent 97%), transparent);
    transform: translateX(-100%);
    animation: aw-shimmer 2s infinite ease-in-out;
  }
  @keyframes aw-shimmer {
    100% { transform: translateX(100%); }
  }

  /* CSS Animation for Lists (Prevents Framer Motion Lag on 100+ items) */
  @keyframes fadeUpIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-up {
    animation: fadeUpIn 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    opacity: 0;
  }

  .aw-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .aw-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .aw-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
  .aw-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }

  .hover-lift {
    transition:
      transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.4s ease,
      border-color 0.3s ease,
      background 0.3s ease,
      color 0.3s ease;
  }
  .hover-lift:hover {
    transform: translateY(-6px) scale(1.01);
    box-shadow: 0 20px 40px -12px rgba(0,0,0,0.5);
  }
  .hover-lift:active {
    transform: translateY(-2px) scale(0.98);
    transition-duration: 0.1s;
  }

  .press-squish {
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .press-squish:active {
    transform: scale(0.93);
  }

  .aw-btn-primary,
  .aw-btn-ghost,
  .bookmark-btn {
    transform-origin: center;
    position: relative;
    z-index: 1;
    transition:
      transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
      filter 0.3s ease,
      letter-spacing 0.3s ease,
      border-color 0.3s ease,
      background 0.3s ease,
      box-shadow 0.3s ease,
      color 0.3s ease,
      border-radius 0.35s ease;
  }
  .aw-btn-primary:hover {
    transform: scale(1.04);
    filter: brightness(1.1);
    letter-spacing: 0.08em;
    z-index: 10;
  }
  .aw-btn-primary svg,
  .aw-btn-ghost svg,
  .bookmark-btn svg {
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .aw-btn-primary:hover svg {
    transform: scale(1.2) translateX(2px) rotate(10deg);
  }
  .aw-btn-ghost:hover {
    background: color-mix(in srgb, var(--aw-accent), transparent 85%) !important;
    border-color: var(--aw-accent) !important;
    color: var(--aw-accent) !important;
    transform: scale(1.04);
    letter-spacing: 0.08em;
    box-shadow: 0 10px 25px -10px rgba(0,0,0,0.5);
    z-index: 10;
  }
  .aw-btn-ghost:hover svg {
    transform: scale(1.2) rotate(-10deg);
  }
  .subscribe-btn {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .subscribe-btn:hover {
    transform: scale(1.04);
  }
  .subscribe-btn.subscribed {
    border-color: var(--aw-accent);
    color: var(--aw-accent);
  }
  .subscribe-btn.subscribed:hover {
    background: color-mix(in srgb, var(--aw-accent), transparent 85%);
  }
  @keyframes subscribe-pulse {
    0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--aw-accent), transparent 50%); }
    70% { box-shadow: 0 0 0 8px transparent; }
    100% { box-shadow: 0 0 0 0 transparent; }
  }
  .subscribe-btn.just-subscribed {
    animation: subscribe-pulse 0.6s ease-out;
  }
  .bookmark-btn:hover {
    background: color-mix(in srgb, var(--aw-accent), transparent 85%) !important;
    border-color: var(--aw-accent) !important;
    color: var(--aw-accent) !important;
    transform: scale(1.1) rotate(5deg);
    border-radius: 18px !important;
    box-shadow: 0 10px 25px -10px rgba(0,0,0,0.5);
  }
  .bookmark-btn:hover svg {
    transform: scale(1.25) rotate(-15deg);
  }

  .genre-chip {
    position: relative;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .genre-chip::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--aw-accent);
    opacity: 0;
    transform: translateX(-100%);
    transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    z-index: 0;
  }
  .genre-chip:hover::after {
    opacity: 0.1;
    transform: translateX(0);
  }
  .genre-chip:hover {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 8px 20px -8px rgba(0,0,0,0.5);
  }
  .genre-chip:active {
    transform: translateY(-1px) scale(0.97);
  }
  .genre-chip > span {
    position: relative;
    z-index: 1;
  }

  .episode-card {
    transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    transform-origin: left center;
  }
  .episode-card:hover {
    transform: translateX(8px) translateY(-2px);
    background: color-mix(in srgb, var(--aw-accent), transparent 92%) !important;
    border-color: var(--aw-accent) !important;
    box-shadow: 0 12px 30px -8px rgba(0,0,0,0.4);
  }
  .episode-card:active {
    transform: translateX(4px) scale(0.99);
    transition-duration: 0.1s;
  }
  .episode-card .ep-number,
  .episode-card .ep-thumb {
    transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .episode-card:hover .ep-number {
    transform: scale(1.2);
    color: var(--aw-accent);
  }
  .episode-card:hover .ep-thumb {
    transform: scale(1.08);
    opacity: 1;
  }

  .aw-title-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.25rem;
  }
  @media (min-width: 768px) {
    .aw-title-facts { justify-content: flex-start; }
  }
  .aw-fact-chip {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid color-mix(in srgb, var(--aw-border), transparent 12%);
    background: color-mix(in srgb, var(--aw-s1), transparent 34%);
    color: rgba(255,255,255,0.82);
    border-radius: 999px;
    padding: 0 0.78rem;
    font-family: var(--aw-font-display);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    backdrop-filter: blur(14px);
    transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }
  button.aw-fact-chip {
    cursor: pointer;
  }
  .aw-fact-chip:hover {
    color: white;
    border-color: color-mix(in srgb, var(--aw-accent), transparent 35%);
    background: color-mix(in srgb, var(--aw-accent), transparent 88%);
    transform: translateY(-2px);
  }
  .aw-fact-chip svg {
    color: var(--aw-accent);
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .aw-fact-chip:hover svg {
    transform: scale(1.16) rotate(-6deg);
  }

  .trailer-modal-backdrop {
    position: fixed !important;
    inset: 0;
    z-index: 9999 !important;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(12px);
  }
  .trailer-modal-content {
    position: relative;
    width: 100%;
    max-width: 960px;
    background: var(--aw-s1);
    border: 1px solid var(--aw-border);
    border-radius: 24px;
    box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.05) inset;
    overflow: hidden;
  }
  .trailer-modal-content::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 30%);
    z-index: 1;
  }
  .trailer-video-wrapper {
    position: relative;
    padding-top: 56.25%;
    background: #000;
  }
  .trailer-video-wrapper iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .trailer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--aw-border);
  }
  .trailer-header-title {
    min-width: 0;
  }
  .trailer-close-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    border: 1px solid var(--aw-border);
    background: var(--aw-s2);
    color: white;
    transition: all 0.2s ease;
  }
  .trailer-close-btn:hover {
    background: var(--aw-accent);
    border-color: var(--aw-accent);
    color: #04110d;
    transform: scale(1.05);
  }
  .trailer-preview {
    position: relative;
    overflow: hidden;
    border-radius: 18px;
    border: 1px solid color-mix(in srgb, var(--aw-accent), transparent 45%);
    background: #05070a;
    box-shadow: 0 30px 80px -30px rgba(0,0,0,0.85);
  }
  .trailer-preview::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg, transparent 48%, rgba(0,0,0,0.62));
    z-index: 1;
  }
  .trailer-preview iframe {
    position: relative;
    z-index: 2;
  }
`;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
  exit: { opacity: 0, transition: { staggerChildren: 0.03, staggerDirection: -1 as const } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, damping: 20, stiffness: 200 } },
  exit: { opacity: 0, y: -20, scale: 0.96, transition: { duration: 0.15, ease: "easeIn" } }
};

// ─────────────────────────────────────────
// HELPER COMPONENTS & UTILS
// ─────────────────────────────────────────
const NextAiringTimer: React.FC<{ airingAt: number; episode: number; compact?: boolean }> = ({ airingAt, episode, compact }) => {
  const [timeLeft, setTimeLeft] = useState(airingAt * 1000 - Date.now());

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(airingAt * 1000 - Date.now()), 60000);
    return () => clearInterval(interval);
  }, [airingAt]);

  if (!airingAt || timeLeft <= 0) return <span>Airing Now / Aired</span>;

  const d = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const h = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
  const m = Math.floor((timeLeft / 1000 / 60) % 60);

  let timeString = '';
  if (d > 0) timeString = `${d}d ${h}h`;
  else if (h > 0) timeString = `${h}h ${m}m`;
  else timeString = `${m}m`;

  return <span>{compact ? `Ep ${episode}: ` : `Episode ${episode} in `}{timeString}</span>;
};

const genreToParam = (genre: string) => genre.toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const createSlug = (title: string) => (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
const normalizeTitle = (t: string) => (t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const getEpisodeHref = (animeSlugOrId: string | number, provider: string, category: 'sub' | 'dub', episodeId: string) => `/watch/${animeSlugOrId}/${encodeURIComponent(provider)}/${category}/${encodeURIComponent(episodeId.split('/').pop() || episodeId)}`;

const formatNumber = (num?: number) => {
  if (!num) return '?';
  // Use Intl.NumberFormat to cleanly abbreviate (e.g. 897,712 -> 897.7K)
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(num);
};

interface ContinueWatchingData {
  animeId: string; episodeId: string; animeTitle: string; animeCover?: string;
  episodeTitle: string; episodeNumber: number; href: string; updatedAt: number;
}

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────
const AnimeDetail: React.FC = () => {
  const { user } = useAuth();
  const { animeId: urlSlug } = useParams<{ animeId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any | null>(null);
  const [episodesData, setEpisodesData] = useState<Record<string, AnimeWatchProviderPayload>>({});
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState<'sub' | 'dub'>('sub');

  const [loading, setLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const [bookmarked, setBookmarked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [savedBookmarkId, setSavedBookmarkId] = useState<string | null>(null);
  const isSyncingBookmark = React.useRef(false);

  const [watchProgress, setWatchProgress] = useState<ContinueWatchingData | null>(null);
  const [episodeSearchQuery] = useState('');
  const [episodeSortOrder, setEpisodeSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);

  const [reviews, setReviews] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const [topStatsCollapsed, setTopStatsCollapsed] = useState(false);
  const [reviewsCollapsed, setReviewsCollapsed] = useState(false);
  const [recommendationsCollapsed, setRecommendationsCollapsed] = useState(false);
  const [streamingCollapsed, setStreamingCollapsed] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [navTabs, setNavTabs] = useState<any[]>([]);
  const [animeLogo, setAnimeLogo] = useState<string | null>(null);

  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isCoverOpen, setIsCoverOpen] = useState(false);
  const activeTab = navTabs.find(tab => tab.active) || navTabs[0];

  const resolvedSlug = useMemo(() => {
    if (urlSlug && Number.isNaN(Number(urlSlug))) return urlSlug;
    if (data) return createSlug(data.title?.english || data.title?.romaji || data.title?.native || '');
    return '';
  }, [urlSlug, data]);

  const streamingLinks = useMemo(() => data?.externalLinks?.filter((link: any) => link.type === 'STREAMING') || [], [data]);

  // Build Related Seasons Tabs
  useEffect(() => {
    let isMounted = true;
    const buildSeasons = async () => {
      if (!data) return;
      const allowedRelations = ['SEQUEL', 'PREQUEL', 'ALTERNATIVE', 'PARENT', 'SIDE_STORY'];
      const excludedFormats = ['SPECIAL', 'MUSIC', 'TV_SHORT', 'OVA', 'ONA', 'MOVIE'];
      const currentTitle = data.title?.english || data.title?.romaji || data.title?.native || '?';
      const seenIds = new Set<number>([data.id]);
      const tabs: any[] = [{
        id: data.id,
        title: currentTitle,
        format: data.format,
        active: true,
        slug: resolvedSlug,
        displayLabel: data.parsedSeason?.isParsed ? data.parsedSeason.parsedString : ''
      }];

      let queue = [data]; let depth = 0; const MAX_DEPTH = 6; const MAX_TOTAL = 15;

      while (queue.length > 0 && depth < MAX_DEPTH && tabs.length < MAX_TOTAL) {
        const nextQueue: any[] = []; const idsToFetch: number[] = [];
        queue.forEach(item => {
          const relations = Array.isArray(item.relations) ? item.relations : item.relations?.edges?.map((e: any) => ({ ...e.node, relationType: e.relationType })) || [];
          relations.forEach((rel: any) => {
            if (rel?.type === 'ANIME' && allowedRelations.includes(rel.relationType) && !excludedFormats.includes(rel.format) && !seenIds.has(rel.id)) {
              idsToFetch.push(rel.id); seenIds.add(rel.id);
            }
          });
        });

        if (idsToFetch.length === 0) break;
        const results = await Promise.allSettled(idsToFetch.slice(0, 5).map(id => fetchAnimeInfo(id)));
        results.forEach(res => {
          if (res.status === 'fulfilled' && res.value) {
            tabs.push({
              id: res.value.id,
              title: res.value.title?.english || res.value.title?.romaji || res.value.title?.native || '',
              format: res.value.format,
              active: false,
              slug: String(res.value.id),
              displayLabel: res.value.parsedSeason?.isParsed ? res.value.parsedSeason.parsedString : ''
            });
            nextQueue.push(res.value);
          }
        });
        queue = nextQueue; depth++;
      }

      if (!isMounted) return;
      tabs.sort((a, b) => a.id - b.id);
      tabs.forEach((tab, idx) => {
        if (!tab.displayLabel) tab.displayLabel = `Season ${idx + 1}`;
      });
      setNavTabs(tabs);
    };
    buildSeasons();
    return () => { isMounted = false; };
  }, [data, resolvedSlug]);

  useEffect(() => {
    const id = 'aw-design-styles-anime-detail';
    if (!document.getElementById(id)) {
      const tag = document.createElement('style'); tag.id = id; tag.textContent = DESIGN_STYLES; document.head.appendChild(tag);
    }
  }, []);

  // Sync Watch Progress
  useEffect(() => {
    if (!data && !urlSlug) return;
    const syncProgress = async () => {
      try {
        if (user) {
          const { data: dbData, error } = await supabase.from('anime_watch_history').select('*').eq('user_id', user.id).or(`anime_id.eq.${data?.idMal || 0},anime_id.eq.${data?.id || 0},anime_id.eq.${urlSlug}`);
          if (!error && dbData && dbData.length > 0) {
            const match = dbData[0];
            setWatchProgress({ animeId: match.anime_id, episodeId: match.episode_id, animeTitle: match.anime_title, animeCover: match.anime_cover, episodeTitle: match.episode_title, episodeNumber: match.episode_number, href: match.href, updatedAt: new Date(match.updated_at).getTime() });
            return;
          }
        }
        const raw = window.localStorage.getItem('anime-continue-watching');
        if (raw) {
          const entries = JSON.parse(raw);
          const match = (Array.isArray(entries) ? entries : []).find((e: any) => String(e.animeId) === String(data?.idMal) || String(e.animeId) === String(data?.id) || String(e.animeId) === String(urlSlug) || (data?.title?.romaji && e.animeTitle === data.title?.romaji));
          setWatchProgress(match || null);
        }
      } catch (e) { }
    };
    syncProgress();
    window.addEventListener('storage', syncProgress); window.addEventListener('focus', syncProgress);
    return () => { window.removeEventListener('storage', syncProgress); window.removeEventListener('focus', syncProgress); };
  }, [data, urlSlug, user]);

  // Main Fetch Logic
  useEffect(() => {
    const fetchAll = async () => {
      if (!urlSlug) return;
      try {
        setLoading(true); setLoadFailed(false); setData(null); setEpisodesData({});
        let fetchId = Number(urlSlug);
        if (isNaN(fetchId)) {
          const searchRes = await fetchAnimeSearch(urlSlug, 1);
          if (searchRes?.results?.length) fetchId = searchRes.results[0].id;
          else throw new Error("Anime not found in database.");
        }

        const [info, epsPayload] = await Promise.all([
          fetchAnimeInfo(fetchId),
          fetchAnimeEpisodes(fetchId).catch(() => null)
        ]);

        if (!info) throw new Error('API returned no info data');

        setData(info);
        if (info.title) document.title = info.title.english || info.title.romaji || info.title.native || 'Anime Details';

        const providersMap = epsPayload?.providers || {};
        setEpisodesData(providersMap);

        const availableKeys = Object.keys(providersMap);

        // Auto-select Provider
        if (availableKeys.length > 0) {
          const lowerKeys = availableKeys.map(k => k.toLowerCase());
          const prefOrder = ['kiwi', 'bee', 'ally'];
          let bestProvider = '';

          for (const pref of prefOrder) {
            const matchIndex = lowerKeys.findIndex(k => k.includes(pref));
            if (matchIndex !== -1) {
              bestProvider = availableKeys[matchIndex];
              break;
            }
          }

          if (!bestProvider) {
            let maxEps = 0;
            bestProvider = availableKeys[0];
            for (const key of availableKeys) {
              const count = (providersMap[key]?.episodes?.sub?.length || 0) + (providersMap[key]?.episodes?.dub?.length || 0);
              if (count > maxEps) { maxEps = count; bestProvider = key; }
            }
          }

          setProvider(bestProvider);
          setCategory((providersMap[bestProvider]?.episodes?.sub?.length || 0) > 0 ? 'sub' : 'dub');
        }

        if (info.id) {
          setLoadingReviews(true);
          try {
            const query = `query ($id: Int) { 
              Media (id: $id) { 
                reviews (limit: 5, sort: [ID_DESC]) { nodes { id summary rating siteUrl user { name avatar { medium } } } }
                recommendations (sort: RATING_DESC, page: 1, perPage: 4) { nodes { rating mediaRecommendation { id title { romaji english native } coverImage { large extraLarge } format averageScore } } }
              } 
            }`;
            const extraRes = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { id: info.id } }) });
            const extraJson = await extraRes.json();
            setReviews(extraJson.data?.Media?.reviews?.nodes || []);
            setRecommendations(extraJson.data?.Media?.recommendations?.nodes || []);
          } catch (err) { } finally { setLoadingReviews(false); }

          // Fetch clearlogo via AniZip (preferred) + TVDB (fallback)
          fetch(`https://api.ani.zip/mappings?anilist_id=${info.id}`)
            .then(res => { if (res.ok) return res.json(); throw new Error(); })
            .then(async (mappingData) => {
              let logoUrl = '';

              // 1) Try AniZip cached Clearlogo first (clean, no white halo)
              if (mappingData.images && Array.isArray(mappingData.images)) {
                const logoArt = mappingData.images.find((img: any) => img.coverType === 'Clearlogo');
                if (logoArt) logoUrl = logoArt.url;
              }

              // 2) Fallback to TVDB extended artworks if AniZip didn't have one
              if (!logoUrl && mappingData?.mappings?.thetvdb_id) {
                const tvdbId = mappingData.mappings.thetvdb_id;
                const tvdbRes = await fetch("https://api4.thetvdb.com/v4/login", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ apikey: "8d5ef3e7-1b6c-4474-ab39-ad6610bd4b80" })
                }).then(r => r.json()).catch(() => null);

                if (tvdbRes?.data?.token) {
                  const token = tvdbRes.data.token;
                  const extRes = await fetch(`https://api4.thetvdb.com/v4/series/${tvdbId}/extended`, {
                    headers: { Authorization: `Bearer ${token}` }
                  }).then(r => r.json()).catch(() => null);

                  if (extRes?.data?.artworks) {
                    const logoArt = extRes.data.artworks.find((art: any) => art.type === 23 || art.type === 24);
                    if (logoArt) logoUrl = logoArt.image;
                  }
                }
              }

              if (logoUrl) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return setAnimeLogo(logoUrl);
                    ctx.drawImage(img, 0, 0);
                    const { data: idata, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    let top = height, left = width, right = 0, bottom = 0;
                    for (let y = 0; y < height; y++) {
                      for (let x = 0; x < width; x++) {
                        if (idata[(y * width + x) * 4 + 3] > 10) {
                          if (y < top) top = y; if (y > bottom) bottom = y;
                          if (x < left) left = x; if (x > right) right = x;
                        }
                      }
                    }
                    if (top >= bottom || left >= right) return setAnimeLogo(logoUrl);
                    top = Math.max(0, top - 2); left = Math.max(0, left - 2);
                    right = Math.min(width - 1, right + 2); bottom = Math.min(height - 1, bottom + 2);
                    const trimW = right - left + 1, trimH = bottom - top + 1;
                    const trimCanvas = document.createElement('canvas');
                    trimCanvas.width = trimW; trimCanvas.height = trimH;
                    const trimCtx = trimCanvas.getContext('2d');
                    if (!trimCtx) return setAnimeLogo(logoUrl);
                    trimCtx.drawImage(canvas, left, top, trimW, trimH, 0, 0, trimW, trimH);
                    setAnimeLogo(trimCanvas.toDataURL('image/png'));
                  } catch { setAnimeLogo(logoUrl); }
                };
                img.onerror = () => setAnimeLogo(logoUrl);
                img.src = logoUrl;
              }
            }).catch(() => { });
        }

      } catch (e) {
        console.error('Fetch Error:', e); setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [urlSlug]);

  // Bookmarks Sync Logic
  useEffect(() => {
    const syncBookmarkState = async () => {
      if (isSyncingBookmark.current) return;
      if (!data?.idMal && !data?.id && !urlSlug) { setBookmarked(false); return; }

      let isFound = false; let foundId: string | null = null;
      const targetIdMal = data?.idMal ? String(data.idMal) : null;
      const targetIdAni = data?.id ? String(data.id) : null;
      const targetIdStr = String(urlSlug);
      const currentSlug = resolvedSlug;
      const normTitle = normalizeTitle(data?.title?.english || data?.title?.romaji || data?.title?.native || '');

      const checkMatch = (b: any) => (targetIdMal && String(b.malId || b.mal_id) === targetIdMal) || (targetIdAni && String(b.malId || b.mal_id) === targetIdAni) || String(b.malId || b.mal_id) === targetIdStr || (urlSlug && createSlug(b.title) === urlSlug) || (currentSlug && createSlug(b.title) === currentSlug) || (normTitle && normalizeTitle(b.title) === normTitle);

      if (user) {
        try {
          const { data: dbData } = await supabase.from('anime_bookmarks').select('*').eq('user_id', user.id);
          if (dbData) {
            const match = dbData.find(checkMatch);
            if (match) { isFound = true; foundId = match.mal_id; }
          }
        } catch { }
      } else {
        const localBookmarks = readBookmarks();
        const match = localBookmarks.find(checkMatch);
        if (match) { isFound = true; foundId = String(match.malId); }
      }

      setBookmarked(isFound); setSavedBookmarkId(foundId);
      if (data) setIsFollowing(isFollowed(Number(foundId || data.idMal || data.id)));
    };

    syncBookmarkState();
    window.addEventListener('storage', syncBookmarkState); window.addEventListener('focus', syncBookmarkState); window.addEventListener('mv_bookmark_updated', syncBookmarkState);
    return () => { window.removeEventListener('storage', syncBookmarkState); window.removeEventListener('focus', syncBookmarkState); window.removeEventListener('mv_bookmark_updated', syncBookmarkState); };
  }, [data, user, urlSlug, resolvedSlug]);

  // Provider Episodes Extraction
  const providerEpisodes = useMemo(() => getProviderEpisodes({ providers: episodesData }, provider, category), [category, episodesData, provider]);
  const noEpisodes = !providerEpisodes.length;

  const sortedEpisodes = [...providerEpisodes].sort((a, b) => episodeSortOrder === 'desc' ? (b.number || 0) - (a.number || 0) : (a.number || 0) - (b.number || 0));
  const visibleEpisodes = sortedEpisodes.filter((ep) => String(ep.number).includes(episodeSearchQuery.trim()) || (ep.title && ep.title.toLowerCase().includes(episodeSearchQuery.trim().toLowerCase())));

  const handleBookmarkToggle = useCallback(async () => {
    if (!data || isSyncingBookmark.current) return;
    const previousState = bookmarked; setBookmarked(!previousState);
    isSyncingBookmark.current = true;
    try {
      const targetId = savedBookmarkId || String(data.idMal || data.id);
      const title = data.title?.english || data.title?.romaji || data.title?.native || 'Unknown Title';
      const coverUrl = data.coverImage?.extraLarge || data.coverImage?.large || data.coverImage;

      if (user) {
        if (previousState) {
          const { error } = await supabase.from('anime_bookmarks').delete().eq('user_id', user.id).eq('mal_id', targetId);
          if (error) setBookmarked(previousState); else setSavedBookmarkId(null);
        } else {
          const { error } = await supabase.from('anime_bookmarks').insert({ user_id: user.id, mal_id: targetId, title, cover: coverUrl, type: data.format || 'Anime', status: data.status || 'Unknown', score: data.averageScore || null, author: data.studios?.[0]?.name || null });
          if (error) setBookmarked(previousState); else setSavedBookmarkId(targetId);
        }
      } else {
        const numericId = Number(targetId) || 0;
        const result = toggleBookmark({ malId: numericId, title, cover: coverUrl, type: data.format || 'Anime', status: data.status, score: data.averageScore, author: data.studios?.[0]?.name });
        setBookmarked(result.bookmarked); setSavedBookmarkId(result.bookmarked ? String(numericId) : null);
      }
    } catch (err) { setBookmarked(previousState); } finally {
      isSyncingBookmark.current = false; window.dispatchEvent(new Event('mv_bookmark_updated')); window.dispatchEvent(new Event('storage'));
    }
  }, [data, user, bookmarked, savedBookmarkId]);

  const handleFollowToggle = useCallback(() => {
    if (!data) return;
    const targetId = savedBookmarkId || String(data.idMal || data.id);
    const title = data.title?.english || data.title?.romaji || data.title?.native || 'Unknown Title';
    const coverUrl = data.coverImage?.extraLarge || data.coverImage?.large || data.coverImage;
    const result = toggleFollow({ malId: Number(targetId) || 0, title, cover: coverUrl, type: data.format || 'Anime', status: data.status || 'Unknown' });
    setIsFollowing(result.followed);
  }, [data, savedBookmarkId]);

  const handleWatchFirst = () => { if (!providerEpisodes.length || !provider) return; setIsLinking(true); const sortedAsc = [...providerEpisodes].sort((a, b) => (a.number || 0) - (b.number || 0)); navigate(getEpisodeHref(resolvedSlug, provider, category, sortedAsc[0].id)); };

  const statsUrl = data?.id ? `https://anilist.co/anime/${data.id}/stats` : undefined;
  const displayTitle = data?.title?.english || data?.title?.romaji || data?.title?.native || '?';
  const studioNodes = data?.studios?.nodes || [];
  const animationStudio = studioNodes.find((s: any) => s.isAnimationStudio);
  const studioName = animationStudio?.name || studioNodes[0]?.name || '';
  const trailerVideoId = data?.trailer?.site?.toLowerCase() === 'youtube' && data?.trailer?.id ? String(data.trailer.id) : '';
  const trailerThumb = trailerVideoId ? `https://img.youtube.com/vi/${trailerVideoId}/maxresdefault.jpg` : '';
  const trailerEmbedUrl = trailerVideoId ? `https://www.youtube.com/embed/${trailerVideoId}?autoplay=1&rel=0&modestbranding=1` : '';

  useEffect(() => {
    if (!isTrailerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsTrailerOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTrailerOpen]);

  // ─────────────────────────────────────────
  // RENDER BLOCKS
  // ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="aw-root aw-noise relative min-h-screen pb-20">
        <div style={{ position: 'sticky', top: 0, zIndex: 60, borderBottom: '1px solid color-mix(in srgb, var(--aw-border), transparent 30%)', background: 'color-mix(in srgb, var(--aw-bg), transparent 15%)', backdropFilter: 'blur(20px)' }} />
        <motion.div initial="hidden" animate="visible" exit="exit" variants={containerVariants} className="relative z-10 mx-auto w-full max-w-[1460px] px-4 pt-8">
          <div className="flex flex-col md:flex-row gap-8 lg:gap-12 mb-12">
            <motion.div variants={itemVariants} className="w-full md:w-[17.5rem] lg:w-[20.125rem] flex-shrink-0 aw-skeleton-card aspect-[2/3] rounded-[16px]" />
            <motion.div variants={itemVariants} className="flex-1 flex flex-col justify-end pb-2">
              <div className="h-14 w-3/4 rounded-xl aw-skeleton-card mb-6" />
              <div className="h-4 w-1/2 rounded-md aw-skeleton-card mb-8" />
              <div className="flex gap-2 mb-6">
                <div className="h-6 w-20 rounded-full aw-skeleton-card" />
                <div className="h-6 w-24 rounded-full aw-skeleton-card" />
              </div>
              <div className="space-y-2 mb-8">
                <div className="h-4 w-full rounded-md aw-skeleton-card" />
                <div className="h-4 w-[90%] rounded-md aw-skeleton-card" />
                <div className="h-4 w-[80%] rounded-md aw-skeleton-card" />
              </div>
              <div className="flex gap-4">
                <div className="h-12 w-32 rounded-[14px] aw-skeleton-card" />
                <div className="h-12 w-32 rounded-[14px] aw-skeleton-card" />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!data || loadFailed) {
    return (
      <div className="aw-root aw-noise relative min-h-screen pb-20 selection:bg-[var(--aw-accent)]/20 flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center rounded-[1.7rem] border border-[var(--aw-border)] bg-[var(--aw-s1)] px-6 py-12 text-center backdrop-blur-md max-w-lg mx-auto w-full">
          <p className="aw-label text-red-400 mb-2">{loadFailed ? 'Fetch Failed' : 'Not Found'}</p>
          <h3 className="mt-2 text-2xl font-bold uppercase tracking-tight text-white" style={{ fontFamily: 'var(--aw-font-display)' }}>
            {loadFailed ? 'Anime data failed to load' : 'Anime not found'}
          </h3>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 flex h-[48px] items-center justify-center rounded-[14px] border border-[var(--aw-border)] bg-[var(--aw-s2)] px-8 text-[12px] font-bold uppercase tracking-[0.18em] text-white transition-colors duration-150 hover:bg-white/10" style={{ fontFamily: 'var(--aw-font-display)' }}>
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="aw-root aw-noise relative min-h-screen text-white pb-20 selection:bg-[var(--aw-accent)]/20">
      <div style={{ position: 'sticky', top: 0, zIndex: 60, borderBottom: '1px solid color-mix(in srgb, var(--aw-border), transparent 30%)', background: 'color-mix(in srgb, var(--aw-bg), transparent 15%)', backdropFilter: 'blur(20px)' }} />

      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="relative z-10 mx-auto w-full max-w-[1460px] px-4 pt-4 md:pt-8">

        <motion.button variants={itemVariants} onClick={() => navigate(-1)} className="group flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4 md:mb-6 text-sm font-medium w-fit relative z-50">
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Back
        </motion.button>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 w-full max-w-full">
          {/* LEFT COLUMN */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* --- Top Section: Cover & Info --- */}
            <div className="flex flex-col md:flex-row gap-6 lg:gap-12 mb-10 md:mb-12">
              {/* Mobile centered cover, Desktop left aligned */}
              <motion.div variants={itemVariants} className="w-[140px] sm:w-[180px] md:w-[17.5rem] lg:w-[20.125rem] flex-shrink-0 mx-auto md:mx-0 -mt-[40px] md:mt-0 relative z-20">
                <div
                  className="group relative aspect-[2/3] rounded-[16px] overflow-hidden border border-[var(--aw-border)] bg-[color-mix(in_srgb,var(--aw-s1),transparent_30%)] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)] cursor-pointer"
                  onClick={() => setIsCoverOpen(true)}
                >
                  <img src={data.coverImage?.extraLarge || data.coverImage?.large} className="w-full h-full object-cover transition-all duration-500" alt={displayTitle} />
                  {/* Dark overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-300" />

                </div>
              </motion.div>

              <div className="flex-1 flex flex-col justify-end pb-2 min-w-0 items-center md:items-start text-center md:text-left">
                {animeLogo ? (
                  <motion.img
                    variants={itemVariants}
                    src={animeLogo}
                    alt={displayTitle}
                    className="max-w-[80%] md:max-w-[400px] lg:max-w-[600px] max-h-[140px] md:max-h-[180px] object-contain mb-6"
                    style={{
                      filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.95)) drop-shadow(0 10px 30px rgba(0,0,0,0.4)) contrast(1.15) brightness(0.95)'
                    }}
                  />
                ) : (
                  <h1 className="text-4xl md:text-6xl lg:text-[4rem] font-black uppercase tracking-tighter leading-[1.05] text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 mb-4 line-clamp-3 anim-fade-in-up" style={{ fontFamily: 'var(--aw-font-display)', letterSpacing: '-0.02em', animationDelay: '0.1s' }}>
                    {displayTitle}
                  </h1>
                )}

                <motion.div variants={itemVariants} className="aw-title-facts">
                  {studioName && (
                    <button
                      type="button"
                      onClick={() => navigate(`/browse?studio=${encodeURIComponent(studioName)}`)}
                      className="aw-fact-chip"
                      title={`Browse anime by ${studioName}`}
                    >
                      <Building2 size={12} />
                      {studioName}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/browse?format=${encodeURIComponent(data.format || 'TV')}`)}
                    className="aw-fact-chip"
                    title={`Browse ${data.format || 'TV'} anime`}
                  >
                    <Clapperboard size={12} />
                    {data.format || 'TV'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/browse?status=${encodeURIComponent(data.status || '')}`)}
                    className="aw-fact-chip"
                    title={`Browse ${data.status || ''} anime`}
                  >
                    <CheckCircle2 size={12} />
                    {data.status ? String(data.status).replace(/_/g, ' ') : 'Status TBA'}
                  </button>
                  <span className="aw-fact-chip">
                    <Star size={12} className="fill-[var(--aw-accent)]" />
                    {data.averageScore ? `${data.averageScore}%` : 'No score'}
                  </span>
                  {(data.seasonYear || data.episodes) && (
                    <button
                      type="button"
                      onClick={() => data.seasonYear && navigate(`/browse?year=${data.seasonYear}`)}
                      className="aw-fact-chip"
                      title={`Browse ${data.seasonYear} anime`}
                    >
                      <CalendarDays size={12} />
                      {[data.seasonYear, data.episodes ? `${data.episodes} EP` : null].filter(Boolean).join(' / ')}
                    </button>
                  )}
                </motion.div>



                <motion.div variants={itemVariants} className="mb-6 md:mb-8 overflow-hidden transition-all duration-300">
                  <p className={`text-[14px] md:text-[15px] leading-[1.8] text-white/70 ${!synopsisExpanded ? 'line-clamp-3 md:line-clamp-4' : ''}`} style={{ fontFamily: 'var(--aw-font-body)' }}>
                    {data.description?.replace(/<[^>]*>?/gm, '') || 'No synopsis available.'}
                  </p>
                  <button onClick={() => setSynopsisExpanded(!synopsisExpanded)} className="mt-2.5 mx-auto md:mx-0 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--aw-accent)] transition-opacity hover:opacity-80">
                    <ChevronRight size={14} className={`transition-transform duration-300 ${synopsisExpanded ? '-rotate-90' : 'rotate-90'}`} />
                    <span>{synopsisExpanded ? 'Read Less' : 'Read More'}</span>
                  </button>
                </motion.div>

                {/* MOBILE OPTIMIZED ACTION BUTTONS */}
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full md:w-auto">
                  {watchProgress ? (
                    <button
                      onClick={() => { setIsLinking(true); navigate(watchProgress.href); }}
                      disabled={isLinking}
                      className="aw-btn-primary group relative overflow-hidden press-squish flex h-[48px] items-center gap-2 rounded-[14px] px-6 text-sm font-bold disabled:opacity-60"
                      style={{ backgroundColor: 'var(--aw-accent)', color: '#04110d', fontFamily: 'var(--aw-font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      <div className="absolute inset-0 bg-white/25 translate-x-[-120%] skew-x-[-20deg] transition-transform duration-500 group-hover:translate-x-[120%]" />
                      <span className="relative z-10 flex items-center gap-2">
                        {isLinking ? <Loader2 className="spin-smooth" size={16} /> : <Play size={15} fill="currentColor" />}
                        Resume {watchProgress.episodeNumber ? `Ep. ${watchProgress.episodeNumber}` : 'Watching'}
                      </span>
                    </button>
                  ) : (
                    <div className={`flex items-center gap-3 transition-all ${!providerEpisodes.length ? 'opacity-40 pointer-events-none' : ''}`}>
                      <button onClick={handleWatchFirst} disabled={!providerEpisodes.length || isLinking} className="aw-btn-primary group relative overflow-hidden press-squish flex h-[48px] items-center justify-center rounded-[14px] border px-6 text-sm font-bold disabled:opacity-60" style={{ background: 'var(--aw-accent-dim)', color: 'var(--aw-accent)', borderColor: 'var(--aw-accent)', fontFamily: 'var(--aw-font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <div className="absolute inset-0 bg-white/25 translate-x-[-120%] skew-x-[-20deg] transition-transform duration-500 group-hover:translate-x-[120%]" />
                        <span className="relative z-10 flex items-center gap-2">
                          <Play size={15} fill="currentColor" />
                          {isLinking ? <Loader2 className="spin-smooth" size={15} /> : 'Watch First'}
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {trailerVideoId && (
                      <button
                        type="button"
                        onClick={() => setIsTrailerOpen(true)}
                        className="aw-btn-ghost press-squish flex h-[48px] items-center justify-center gap-2 rounded-[14px] border border-[var(--aw-border)] bg-[var(--aw-s1)] backdrop-blur-md px-6 text-sm font-bold uppercase"
                        style={{ fontFamily: 'var(--aw-font-display)', letterSpacing: '0.05em', color: 'white' }}
                      >
                        <Youtube size={16} />
                        Trailer
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        handleFollowToggle();
                        if (!isFollowing) {
                          const btn = document.getElementById('subscribe-btn');
                          if (btn) {
                            btn.classList.add('just-subscribed');
                            setTimeout(() => btn.classList.remove('just-subscribed'), 600);
                          }
                        }
                      }}
                      className={`subscribe-btn aw-btn-ghost press-squish flex h-[48px] items-center justify-center gap-2 rounded-[14px] border border-[var(--aw-border)] bg-[var(--aw-s1)] backdrop-blur-md px-6 text-sm font-bold uppercase ${isFollowing ? 'subscribed' : ''}`}
                      style={{ fontFamily: 'var(--aw-font-display)', letterSpacing: '0.05em' }}
                      id="subscribe-btn"
                    >
                      <Bell size={18} className={isFollowing ? 'fill-current' : ''} />
                      {isFollowing ? 'Subscribed' : 'Subscribe'}
                    </button>


                    <button
                      type="button"
                      onClick={handleBookmarkToggle}
                      style={{
                        background: 'var(--aw-s1)',
                        borderColor: bookmarked ? 'var(--aw-accent)' : 'var(--aw-border)',
                        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                      className={`group relative flex h-[48px] w-[48px] items-center justify-center overflow-hidden rounded-[14px] border 
                  hover:scale-[1.05] active:scale-[0.96] active:duration-100
                  ${bookmarked ? 'text-[var(--aw-accent)]' : 'text-white'}
                `}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--aw-accent), transparent 85%)';
                        e.currentTarget.style.borderColor = 'var(--aw-accent)';
                        e.currentTarget.style.color = 'var(--aw-accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--aw-s1)';
                        e.currentTarget.style.borderColor = bookmarked ? 'var(--aw-accent)' : 'var(--aw-border)';
                        e.currentTarget.style.color = bookmarked ? 'var(--aw-accent)' : 'white';
                      }}
                    >
                      <span className="relative z-10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                        {bookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                      </span>
                    </button>
                  </div>
                </motion.div>

              </div>
            </div>
            {/* --- Bottom Section: Layout Grid --- */}

            {/* LEFT COL: Content */}
            <div className="space-y-8 md:space-y-10 min-w-0">
              <div className="flex flex-col min-w-0">

                {/* EPISODES SECTION */}
                <motion.div variants={itemVariants} className="mb-4 md:mb-6 flex items-end justify-between border-b border-[color-mix(in_srgb,var(--aw-border),transparent_50%)] pb-3">
                  <h3 className="text-lg md:text-2xl font-bold uppercase tracking-tight text-white" style={{ fontFamily: 'var(--aw-font-display)' }}>Episodes</h3>
                </motion.div>

                <motion.div variants={itemVariants} className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3 justify-between relative z-50">

                  {/* Left Side: Seasons & Sub/Dub */}
                  <div className="flex items-center gap-2 flex-wrap z-50">
                    {/* Seasons Dropdown */}
                    {navTabs.length > 1 && (
                      <div className="relative z-50 flex-shrink-0">
                        <button type="button" onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)} className="flex min-w-[220px] h-[42px] items-center justify-between gap-3 rounded-[14px] border border-[var(--aw-border)] bg-[var(--aw-s1)] backdrop-blur-md px-4 md:px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors duration-150 hover:bg-white/5" style={{ fontFamily: 'var(--aw-font-display)' }}>
                          {activeTab?.displayLabel || 'Seasons'}
                          <ChevronDown size={14} className={`transition-transform duration-150 ${isSeasonDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {isSeasonDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsSeasonDropdownOpen(false)} />
                              <motion.div initial={{ opacity: 0, y: -5, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5, scale: 0.98 }} transition={{ duration: 0.15 }} className="absolute left-0 top-[calc(100%+8px)] w-full z-50 rounded-[16px] border border-[var(--aw-border)] bg-[var(--aw-s1)] p-1.5 shadow-2xl backdrop-blur-xl">
                                <div className="max-h-[260px] overflow-y-auto aw-scrollbar flex flex-col gap-1">
                                  {navTabs.map(tab => {
                                    const isSelected = tab.active;
                                    return (
                                      <button key={tab.id} onClick={() => { setIsSeasonDropdownOpen(false); navigate(`/watch/${tab.slug}`); }} className={`w-full flex flex-col items-center text-center px-4 py-3 rounded-[10px] transition-colors duration-150 ${isSelected ? 'bg-[color-mix(in_srgb,var(--aw-accent),transparent_85%)] text-[var(--aw-accent)]' : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`}>
                                        <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ fontFamily: 'var(--aw-font-display)' }}>{tab.displayLabel}</span>
                                        <span className="text-[12px] font-medium truncate w-full mt-1" style={{ fontFamily: 'var(--aw-font-body)' }}>{tab.title}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Sub / Dub Selection */}
                    <div className="flex items-center gap-1 p-1 rounded-[14px] border border-[var(--aw-border)] bg-[var(--aw-s1)] backdrop-blur-md flex-shrink-0">
                      {(['sub', 'dub'] as const).map((audioMode) => {
                        const isActive = category === audioMode;
                        const isDisabled = (episodesData[provider]?.episodes?.[audioMode]?.length || 0) === 0;

                        return (
                          <button
                            key={audioMode}
                            type="button"
                            onClick={() => setCategory(audioMode)}
                            disabled={isDisabled}
                            className={`relative flex h-[34px] items-center justify-center rounded-[10px] px-4 md:px-5 text-[10px] font-bold uppercase tracking-[0.18em] transition-all duration-150 outline-none disabled:opacity-30 disabled:cursor-not-allowed ${isActive ? 'text-[var(--aw-accent)]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'}`}
                            style={{ fontFamily: 'var(--aw-font-display)' }}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="audioModePill"
                                className="absolute inset-0 rounded-[10px] border border-[color-mix(in_srgb,var(--aw-accent),transparent_60%)] bg-[color-mix(in_srgb,var(--aw-accent),transparent_85%)] shadow-sm"
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                              />
                            )}
                            <span className="relative z-10">{audioMode}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Side: Provider & Sort */}
                  <div className="flex items-center gap-2 flex-wrap sm:justify-end z-40">

                    {/* Provider Dropdown */}
                    {Object.keys(episodesData).length > 1 && (
                      <div className="relative z-50 flex-shrink-0">
                        <button type="button" onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)} className="flex min-w-[150px] h-[42px] items-center justify-between gap-3 rounded-[14px] border border-[var(--aw-border)] bg-[var(--aw-s1)] backdrop-blur-md px-4 md:px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors duration-150 hover:bg-white/5" style={{ fontFamily: 'var(--aw-font-display)' }}>
                          {provider}
                          <ChevronDown size={14} className={`transition-transform duration-150 ${isProviderDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {isProviderDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsProviderDropdownOpen(false)} />
                              <motion.div initial={{ opacity: 0, y: -5, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5, scale: 0.98 }} transition={{ duration: 0.15 }} className="absolute left-0 top-[calc(100%+8px)] w-full z-50 rounded-[16px] border border-[var(--aw-border)] bg-[var(--aw-s1)] p-1.5 shadow-2xl backdrop-blur-xl">
                                <div className="max-h-[260px] overflow-y-auto aw-scrollbar flex flex-col gap-1">
                                  {Object.keys(episodesData).map(p => {
                                    const isSelected = provider === p;
                                    return (
                                      <button key={p} onClick={() => { setProvider(p); setIsProviderDropdownOpen(false); }} className={`w-full text-center px-4 py-3 rounded-[10px] text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-150 ${isSelected ? 'bg-[color-mix(in_srgb,var(--aw-accent),transparent_85%)] text-[var(--aw-accent)]' : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`} style={{ fontFamily: 'var(--aw-font-display)' }}>
                                        {p}
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Sort Button */}
                    <button type="button" onClick={() => setEpisodeSortOrder((current) => current === 'desc' ? 'asc' : 'desc')} className="flex h-[42px] items-center gap-2 rounded-[14px] border border-[var(--aw-border)] bg-[var(--aw-s1)] backdrop-blur-md px-4 md:px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors duration-150 hover:bg-white/5 flex-shrink-0" style={{ fontFamily: 'var(--aw-font-display)' }}>
                      <ArrowDownUp size={12} className="transition-transform duration-150 text-[var(--aw-accent)]" />{episodeSortOrder === 'desc' ? 'Newest' : 'Oldest'}
                    </button>
                  </div>

                </motion.div>

                {/* Episode List */}
                <div className="max-h-[600px] md:max-h-[800px] overflow-y-auto overflow-x-hidden pr-2 aw-scrollbar pb-6 -mx-2 md:mx-0">
                  <div className="flex flex-col px-2 py-1 relative">
                    {providerEpisodes.length > 0 ? (
                      visibleEpisodes.length > 0 ? (
                        <div className="flex flex-col relative">
                          {visibleEpisodes.map((episode, index) => (
                            <div
                              key={episode.id}
                              onClick={() => provider && navigate(getEpisodeHref(resolvedSlug, provider, category, episode.id))}
                              className="episode-card animate-fade-up group flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-[14px] cursor-pointer border border-transparent mb-2"
                              style={{ animationDelay: `${(index % 20) * 0.03}s` }}
                            >
                              <div className="ep-number flex h-[56px] md:h-[72px] w-8 md:w-12 shrink-0 items-center justify-center text-lg md:text-2xl font-light text-zinc-500" style={{ fontFamily: 'var(--aw-font-display)' }}>
                                {episode.number || '-'}
                              </div>
                              <div className="relative h-[56px] md:h-[72px] w-[100px] md:w-[128px] shrink-0 overflow-hidden rounded-[8px] bg-[var(--aw-s2)]">
                                <img src={episode.image || data?.coverImage?.large || 'https://via.placeholder.com/128x72/181818/3f3f46?text=No+Image'} alt={`Episode ${episode.number}`} className="ep-thumb h-full w-full object-cover opacity-80" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/128x72/181818/3f3f46?text=No+Image'; }} />
                                {episode.filler && <div className="absolute bottom-1 right-1 rounded-[4px] bg-black/80 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white" style={{ fontFamily: 'var(--aw-font-display)' }}>Filler</div>}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col justify-center">
                                <h4 className="text-[13px] md:text-[15px] font-bold text-white/95 line-clamp-1 group-hover:text-white transition-colors" style={{ fontFamily: 'var(--aw-font-display)' }}>{episode.title || `Episode ${episode.number || '?'}`}</h4>
                                <p className="mt-1 md:mt-1.5 line-clamp-2 text-[11px] md:text-[13px] text-zinc-400 group-hover:text-zinc-300 transition-colors" style={{ fontFamily: 'var(--aw-font-body)' }}>{episode.description || `Episode ${episode.number} of ${displayTitle}.`}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (<div className="p-8 md:p-12 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-600" style={{ fontFamily: 'var(--aw-font-display)' }}>No episodes match this search</div>)
                    ) : (
                      <motion.div variants={itemVariants} className="p-8 md:p-12 text-center rounded-[16px] border border-[var(--aw-border)] bg-[var(--aw-s1)] mt-4 backdrop-blur-md">
                        <div className="aw-label">No Episodes found</div>
                        <div className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-white" style={{ fontFamily: 'var(--aw-font-display)' }}>We couldn't find available episodes for this anime</div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              <motion.div variants={itemVariants} className="mt-8 transition-colors duration-150">
                <CommentSection pageType="anime" pageId={urlSlug || ''} />
              </motion.div>
            </div>
          </div>

          {/* --- RIGHT SIDEBAR --- */}
          <div className="hidden lg:flex flex-col w-[340px] flex-shrink-0 space-y-8 pb-4">
            {/* Right Side: Recommended */}


            {/* RIGHT COL: Stats (Desktop Only) */}
            <motion.div variants={itemVariants} className="flex flex-col justify-start pb-2">
              {/* ... [Stats Section Remains Identical to Before] ... */}
              <div className="flex items-center justify-between mb-5 select-none cursor-pointer group" onClick={() => setTopStatsCollapsed(!topStatsCollapsed)}>
                <div className="aw-label flex items-center gap-2 group-hover:text-white transition-colors">
                  <Info size={14} className="text-[var(--aw-accent)]" /> <span>Statistics</span>
                </div>
                <ChevronDown size={14} className={`text-zinc-500 group-hover:text-white transition-all duration-300 ${topStatsCollapsed ? '-rotate-90' : 'rotate-0'}`} />
              </div>

              <div className="space-y-4">
                <AnimatePresence>
                  {!topStatsCollapsed && (
                    <motion.div initial={{ height: 0, opacity: 0, overflow: 'hidden' }} animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }} exit={{ height: 0, opacity: 0, overflow: 'hidden' }}>
                      <div className="grid grid-cols-2 gap-3 pb-2">

                        {/* Popular Stat Box */}
                        <div className="group/stat flex flex-col gap-1.5 rounded-[16px] border border-[var(--aw-border)] bg-[color-mix(in_srgb,var(--aw-s1),transparent_70%)] backdrop-blur-md p-4 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-[var(--aw-accent)]/10 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--aw-accent),transparent_50%)] hover:bg-[color-mix(in_srgb,var(--aw-accent),transparent_95%)] active:scale-95 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-zinc-400 group-hover/stat:text-zinc-300 transition-colors" style={{ fontFamily: 'var(--aw-font-display)' }}>
                            <TrendingUp size={12} className="text-[var(--aw-accent)] shrink-0 transition-transform group-hover/stat:scale-110" />
                            Popular
                          </span>
                          <span className="text-xl lg:text-2xl font-bold text-white truncate transition-transform origin-left group-hover/stat:scale-105" style={{ fontFamily: 'var(--aw-font-display)' }}>
                            #{data.popularity ? formatNumber(data.popularity) : '?'}
                          </span>
                        </div>

                        {/* Format Stat Box */}
                        <div className="group/stat flex flex-col gap-1.5 rounded-[16px] border border-[var(--aw-border)] bg-[color-mix(in_srgb,var(--aw-s1),transparent_70%)] backdrop-blur-md p-4 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-[var(--aw-accent)]/10 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--aw-accent),transparent_50%)] hover:bg-[color-mix(in_srgb,var(--aw-accent),transparent_95%)] active:scale-95 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-zinc-400 group-hover/stat:text-zinc-300 transition-colors" style={{ fontFamily: 'var(--aw-font-display)' }}>
                            <Users size={12} className="text-[var(--aw-accent)] shrink-0 transition-transform group-hover/stat:scale-110" />
                            Format
                          </span>
                          <span className="text-xl lg:text-2xl font-bold text-white truncate transition-transform origin-left group-hover/stat:scale-105" style={{ fontFamily: 'var(--aw-font-display)' }}>
                            {data.format || '?'}
                          </span>
                        </div>

                        {/* Favourites Stat Box */}
                        <div className="col-span-2 group/stat flex flex-col gap-1.5 rounded-[16px] border border-[var(--aw-border)] bg-[color-mix(in_srgb,var(--aw-s1),transparent_70%)] backdrop-blur-md p-4 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-[var(--aw-accent)]/10 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--aw-accent),transparent_50%)] hover:bg-[color-mix(in_srgb,var(--aw-accent),transparent_95%)] active:scale-[0.98] min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-zinc-400 group-hover/stat:text-zinc-300 transition-colors" style={{ fontFamily: 'var(--aw-font-display)' }}>
                            <Heart size={12} className="text-[var(--aw-accent)] shrink-0 transition-transform group-hover/stat:scale-110" />
                            Favourites
                          </span>
                          <span className="text-xl lg:text-2xl font-bold text-white truncate transition-transform origin-left group-hover/stat:scale-[1.02]" style={{ fontFamily: 'var(--aw-font-display)' }}>
                            {formatNumber(data.favourites)}
                          </span>
                        </div>

                        {/* General Info Box */}
                        <div className="group col-span-2 flex flex-col rounded-[16px] border border-[var(--aw-border)] bg-[color-mix(in_srgb,var(--aw-s1),transparent_70%)] backdrop-blur-md p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[var(--aw-accent)]/10 hover:border-[color-mix(in_srgb,var(--aw-accent),transparent_50%)] hover:bg-[color-mix(in_srgb,var(--aw-accent),transparent_95%)] active:scale-[0.98] cursor-pointer">
                          <div className="space-y-5">
                            <div className="flex items-start gap-4">
                              <Calendar size={14} className="flex-shrink-0 mt-0.5 text-[var(--aw-accent)] transition-transform group-hover:scale-110 group-hover:-rotate-3" />
                              <div>
                                <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-300 transition-colors" style={{ fontFamily: 'var(--aw-font-display)' }}>Season</span>
                                <span className="block text-[13px] font-bold text-white mt-1" style={{ fontFamily: 'var(--aw-font-display)' }}>{[data.season, data.seasonYear].filter(Boolean).join(' ') || '?'}</span>
                              </div>
                            </div>
                            <div className="flex items-start gap-4">
                              <Library size={14} className="flex-shrink-0 mt-0.5 text-[var(--aw-accent)] transition-transform group-hover:scale-110 group-hover:-rotate-3" />
                              <div>
                                <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-300 transition-colors" style={{ fontFamily: 'var(--aw-font-display)' }}>Episodes</span>
                                <span className="block text-[13px] font-bold text-white mt-1" style={{ fontFamily: 'var(--aw-font-display)' }}>{data.episodes || 'TBA'} {data.duration ? `(${data.duration}m)` : ''}</span>
                              </div>
                            </div>
                            {data.nextAiringEpisode && (
                              <div className="flex items-start gap-4">
                                <Clock size={14} className="flex-shrink-0 mt-0.5 text-[var(--aw-accent)] transition-transform group-hover:scale-110 group-hover:rotate-12" />
                                <div>
                                  <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-300 transition-colors" style={{ fontFamily: 'var(--aw-font-display)' }}>Next Episode</span>
                                  <span className="block text-[13px] font-bold mt-1 text-[var(--aw-accent)]" style={{ fontFamily: 'var(--aw-font-display)' }}><NextAiringTimer airingAt={data.nextAiringEpisode.airingAt} episode={data.nextAiringEpisode.episode} /></span>
                                </div>
                              </div>
                            )}
                            {data.title?.native && (
                              <div className="flex items-start gap-4 pt-5 mt-1 border-t border-[color-mix(in_srgb,var(--aw-border),transparent_50%)] transition-colors">
                                <Languages size={14} className="flex-shrink-0 mt-0.5 text-[var(--aw-accent)] transition-transform group-hover:scale-110" />
                                <div>
                                  <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-300 transition-colors" style={{ fontFamily: 'var(--aw-font-display)' }}>Alternative Title</span>
                                  <span className="block text-[14px] font-medium text-white mt-1">{data.title.native}</span>
                                </div>
                              </div>
                            )}
                            <div className="mt-2 flex gap-3 pt-5 border-t border-[color-mix(in_srgb,var(--aw-border),transparent_50%)] transition-colors">
                              {data?.id && <a href={`https://anilist.co/anime/${data.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-[12px] text-[10px] font-bold uppercase tracking-widest border border-[var(--aw-border)] bg-[color-mix(in_srgb,var(--aw-s1),transparent_50%)] text-zinc-300 hover:text-white hover:border-[color-mix(in_srgb,var(--aw-accent),transparent_60%)] hover:bg-[color-mix(in_srgb,var(--aw-accent),transparent_80%)] hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-200" style={{ fontFamily: 'var(--aw-font-display)' }}>AniList <ExternalLink size={10} /></a>}
                              {data?.idMal && <a href={`https://myanimelist.net/anime/${data.idMal}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-[12px] text-[10px] font-bold uppercase tracking-widest border border-[var(--aw-border)] bg-[color-mix(in_srgb,var(--aw-s1),transparent_50%)] text-zinc-300 hover:text-white hover:border-[color-mix(in_srgb,var(--aw-accent),transparent_60%)] hover:bg-[color-mix(in_srgb,var(--aw-accent),transparent_80%)] hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-200" style={{ fontFamily: 'var(--aw-font-display)' }}>MAL <ExternalLink size={10} /></a>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {recommendations.length > 0 && (
                  <motion.div variants={itemVariants} className="flex flex-col">
                    <div className="flex items-center justify-between mb-5 select-none cursor-pointer group" onClick={() => setRecommendationsCollapsed(!recommendationsCollapsed)}>
                      <div className="aw-label flex items-center gap-2 group-hover:text-white transition-colors">
                        <Sparkles size={14} className="text-[var(--aw-accent)]" /> <span>Recommended</span>
                      </div>
                      <ChevronDown size={14} className={`text-zinc-500 group-hover:text-white transition-all duration-300 ${recommendationsCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                    </div>

                    <AnimatePresence>
                      {!recommendationsCollapsed && (
                        <motion.div initial={{ height: 0, opacity: 0, overflow: 'hidden' }} animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }} exit={{ height: 0, opacity: 0, overflow: 'hidden' }}>
                          <div className="flex flex-col gap-2 pb-2">
                            {recommendations.filter(r => r.mediaRecommendation).slice(0, 5).map((rec, i) => {
                              const recAnime = rec.mediaRecommendation;
                              return (
                                <div
                                  key={i}
                                  onClick={() => navigate(`/watch/${recAnime.id}`)}
                                  className="group relative flex gap-0 items-stretch cursor-pointer rounded-[12px] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[var(--aw-accent)]/10 active:scale-[0.97] active:duration-75"
                                  style={{ animationDelay: `${i * 0.06}s` }}
                                >
                                  {/* Hover background layer */}
                                  <div className="absolute inset-0 bg-[var(--aw-s1)] border border-[var(--aw-border)] rounded-[12px] transition-all duration-300 group-hover:border-[color-mix(in_srgb,var(--aw-accent),transparent_50%)] group-hover:bg-[color-mix(in_srgb,var(--aw-accent),transparent_92%)]" />

                                  {/* Cover Art */}
                                  <div className="relative w-[64px] h-[88px] flex-shrink-0 overflow-hidden rounded-l-[12px]">
                                    <img
                                      src={recAnime.coverImage?.extraLarge || recAnime.coverImage?.large}
                                      alt={recAnime.title?.english || recAnime.title?.romaji}
                                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-110"
                                    />
                                  </div>

                                  {/* Info */}
                                  <div className="relative flex flex-col justify-center flex-1 min-w-0 px-3 py-2.5">
                                    <span className="text-white/80 text-[12.5px] font-bold line-clamp-2 leading-snug group-hover:text-white transition-colors duration-200" style={{ fontFamily: 'var(--aw-font-display)' }}>
                                      {recAnime.title?.english || recAnime.title?.romaji || recAnime.title?.native}
                                    </span>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white/60 transition-colors duration-200" style={{ fontFamily: 'var(--aw-font-display)' }}>{recAnime.format || 'TV'}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {(loadingReviews || reviews.length > 0) && (
                  <div className="group mt-8">
                    <div className="flex items-center justify-between mb-4 cursor-pointer select-none" onClick={() => setReviewsCollapsed(!reviewsCollapsed)}>
                      <div className="aw-label flex items-center gap-2 group-hover:text-white transition-colors"><Star size={14} className="text-[var(--aw-accent)]" /> AniList Reviews</div>
                      <ChevronDown size={14} className={`text-zinc-500 group-hover:text-white transition-all duration-300 ${reviewsCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                    </div>
                    <AnimatePresence>
                      {!reviewsCollapsed && (
                        <motion.div initial={{ height: 0, opacity: 0, overflow: 'hidden' }} animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }} exit={{ height: 0, opacity: 0, overflow: 'hidden' }}>
                          <div className="pb-2">
                            {loadingReviews ? (
                              <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[var(--aw-accent)]" size={20} /></div>
                            ) : (
                              <div className="space-y-3">
                                {reviews.slice(0, 5).map((review) => (
                                  <a key={review.id} href={review.siteUrl} target="_blank" rel="noopener noreferrer" className="group/review block p-5 rounded-[16px] border border-[var(--aw-border)] bg-[color-mix(in_srgb,var(--aw-s1),transparent_70%)] backdrop-blur-md overflow-hidden transition-all duration-150 hover:-translate-y-1 active:scale-[0.98] shadow-sm hover:shadow-lg hover:border-[color-mix(in_srgb,var(--aw-accent),transparent_50%)] hover:bg-[color-mix(in_srgb,var(--aw-accent),transparent_90%)]">
                                    <div className="flex items-center gap-3 mb-3">
                                      <img src={review.user.avatar.medium} alt={review.user.name} className="w-7 h-7 rounded-full object-cover" />
                                      <span className="text-[12px] font-bold text-white tracking-wide" style={{ fontFamily: 'var(--aw-font-display)' }}>{review.user.name}</span>
                                      <span className="ml-auto text-[11px] font-bold text-[var(--aw-accent)]">{review.rating}%</span>
                                    </div>
                                    <p className="text-[12px] leading-relaxed line-clamp-3 italic text-zinc-400 group-hover/review:text-zinc-300 transition-colors" style={{ fontFamily: 'var(--aw-font-body)' }}>"{review.summary}"</p>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {streamingLinks.length > 0 && (
                  <div className="group mt-8">
                    <div className="flex items-center justify-between mb-4 cursor-pointer select-none" onClick={() => setStreamingCollapsed(!streamingCollapsed)}>
                      <div className="aw-label flex items-center gap-2 group-hover:text-white transition-colors"><Play size={14} className="text-[var(--aw-accent)]" /> Available on</div>
                      <ChevronDown size={14} className={`text-zinc-500 group-hover:text-white transition-all duration-300 ${streamingCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                    </div>
                    <AnimatePresence>
                      {!streamingCollapsed && (
                        <motion.div initial={{ height: 0, opacity: 0, overflow: 'hidden' }} animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }} exit={{ height: 0, opacity: 0, overflow: 'hidden' }}>
                          <div className="space-y-3 pb-2">
                            {streamingLinks.map((link: any, idx: number) => (
                              <a key={`${link.site}-${idx}`} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-[14px] border border-[var(--aw-border)] bg-[color-mix(in_srgb,var(--aw-s1),transparent_70%)] backdrop-blur-md hover:border-[color-mix(in_srgb,var(--aw-accent),transparent_40%)] hover:bg-[color-mix(in_srgb,var(--aw-accent),transparent_90%)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-150 group/link shadow-sm hover:shadow-lg">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">{link.site.toLowerCase().includes('youtube') ? <Youtube size={16} className="text-white group-hover/link:text-[var(--aw-accent)] transition-colors duration-150" /> : <ExternalLink size={14} className="text-white group-hover/link:text-[var(--aw-accent)] transition-colors duration-150" />}</div>
                                <div className="flex flex-col"><span className="text-[11px] font-bold text-white tracking-wide" style={{ fontFamily: 'var(--aw-font-display)' }}>{link.site}</span> <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 group-hover/link:text-[var(--aw-accent)] transition-colors mt-0.5">Watch Now</span></div>
                              </a>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

      </motion.div>

      <AnimatePresence>
        {isTrailerOpen && trailerEmbedUrl && (
          <motion.div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsTrailerOpen(false)}
          >
            <motion.div
              className="trailer-modal-content w-full max-w-[960px]"
              initial={{ y: 24, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.96 }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="trailer-header">
                <div className="trailer-header-title">
                  <div className="aw-label flex items-center gap-2">
                    <Youtube size={14} />
                    Trailer
                  </div>
                  <h2 className="mt-1 truncate text-lg font-bold uppercase tracking-tight text-white md:text-xl" style={{ fontFamily: 'var(--aw-font-display)' }}>
                    {displayTitle}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTrailerOpen(false)}
                  className="trailer-close-btn"
                  aria-label="Close trailer"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="trailer-video-wrapper">
                <iframe
                  src={trailerEmbedUrl}
                  title={`${displayTitle} trailer`}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cover Image Lightbox */}
      <AnimatePresence>
        {isCoverOpen && (
          <motion.div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCoverOpen(false)}
          >
            <motion.div
              className="relative"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={data?.coverImage?.extraLarge || data?.coverImage?.large}
                alt={displayTitle}
                className="max-h-[88vh] max-w-[90vw] rounded-[20px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8)] border border-white/10 object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnimeDetail;
