/* --- START OF FILE AnimeHome.tsx --- */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Star, MonitorPlay, ChevronRight, ChevronLeft, ChevronDown, Bookmark, BookmarkCheck, User, Users, X, Volume2, VolumeX, MoreVertical, Info, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AnimeResult,
  fetchAnimePopular,
  fetchAnimeSpotlight,
  fetchAnimeInfo,
  fetchAnimeEpisodes,
  fetchAnimeStreams,
  getEpisodeSlug,
  getAnimeCover,
  getAnimeDisplayTitle,
  getAnimeScore,
  getAnimeTypeLabel,
} from '../utils/animeApi';
import { MediaPlayer, MediaProvider, isHLSProvider, type MediaPlayerInstance } from '@vidstack/react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { handleRippleMouseDown } from '../utils/ripple';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { BookmarkEntry, readBookmarks, removeBookmark, writeBookmarks } from '../utils/bookmarks';
import FriendsModal from '../components/shared/FriendsModal';
import { canViewVisibility, fetchWatchActivity, getVisibility, isRecentlyOnline, type SocialProfile } from '../utils/social';

const TVDB_API_KEY = "8d5ef3e7-1b6c-4474-ab39-ad6610bd4b80";
let cachedTvdbToken = '';
let tvdbTokenPromise: Promise<string> | null = null;

const getTvdbToken = async () => {
  if (cachedTvdbToken) return cachedTvdbToken;
  if (tvdbTokenPromise) return tvdbTokenPromise;

  tvdbTokenPromise = fetch("https://api4.thetvdb.com/v4/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: TVDB_API_KEY })
  }).then(res => res.json()).then(data => {
    if (data && data.data && data.data.token) {
      cachedTvdbToken = data.data.token;
      return cachedTvdbToken;
    }
    return '';
  }).catch(() => {
    tvdbTokenPromise = null;
    return '';
  });

  return tvdbTokenPromise;
};

const trimmedLogoCache = new Map<string, string>();

const trimTransparentPixels = (src: string): Promise<string> => {
  if (trimmedLogoCache.has(src)) return Promise.resolve(trimmedLogoCache.get(src)!);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(src); return; }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;

        let top = height, left = width, right = 0, bottom = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 10) {
              if (y < top) top = y;
              if (y > bottom) bottom = y;
              if (x < left) left = x;
              if (x > right) right = x;
            }
          }
        }

        if (top >= bottom || left >= right) { resolve(src); return; }

        const pad = 2;
        top = Math.max(0, top - pad);
        left = Math.max(0, left - pad);
        right = Math.min(width - 1, right + pad);
        bottom = Math.min(height - 1, bottom + pad);

        const trimW = right - left + 1;
        const trimH = bottom - top + 1;
        const trimCanvas = document.createElement('canvas');
        trimCanvas.width = trimW;
        trimCanvas.height = trimH;
        const trimCtx = trimCanvas.getContext('2d');
        if (!trimCtx) { resolve(src); return; }

        trimCtx.drawImage(canvas, left, top, trimW, trimH, 0, 0, trimW, trimH);
        const trimmed = trimCanvas.toDataURL('image/png');
        trimmedLogoCache.set(src, trimmed);
        resolve(trimmed);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
};

const dominantColorCache = new Map<string, string>();

const extractDominantColor = (src: string): Promise<string> => {
  if (dominantColorCache.has(src)) return Promise.resolve(dominantColorCache.get(src)!);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map<string, { r: number; g: number; b: number; count: number; satSum: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 50) continue;
          const br = Math.floor(r / 32), bg = Math.floor(g / 32), bb = Math.floor(b / 32);
          const key = `${br},${bg},${bb}`;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const lum = (max + min) / 2;
          const sat = max === min ? 0 : (max - min) / (lum > 127 ? (510 - max - min) : (max + min));
          const entry = buckets.get(key);
          if (entry) { entry.r += r; entry.g += g; entry.b += b; entry.count++; entry.satSum += sat; }
          else { buckets.set(key, { r, g, b, count: 1, satSum: sat }); }
        }
        let bestColor = '', bestScore = -1;
        buckets.forEach((bucket) => {
          const avgR = Math.round(bucket.r / bucket.count);
          const avgG = Math.round(bucket.g / bucket.count);
          const avgB = Math.round(bucket.b / bucket.count);
          const avgSat = bucket.satSum / bucket.count;
          const lum = avgR * 0.299 + avgG * 0.587 + avgB * 0.114;
          if (lum < 40 || lum > 220) return;
          if (avgSat < 0.15) return;
          const score = bucket.count * (avgSat * 3 + 1) * (1 - Math.abs(lum - 140) / 140);
          if (score > bestScore) { bestScore = score; bestColor = `${avgR}, ${avgG}, ${avgB}`; }
        });
        dominantColorCache.set(src, bestColor);
        resolve(bestColor);
      } catch { resolve(''); }
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
};

const DESIGN_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Onest:wght@300;400;500;600;700&display=swap');

  :root {
    --aw-bg:          var(--app-bg);
    --aw-s1:          var(--app-bg-2);
    --aw-s2:          var(--app-bg-3);
    --aw-card:        var(--app-card);
    --aw-border:      var(--app-border);
    --aw-border-hi:   var(--app-border-hover);
    --aw-accent:      var(--app-accent);
    --aw-accent-2:    var(--app-accent);
    --aw-accent-dim:  var(--app-accent-muted);
    --aw-accent-glow: var(--app-accent);
    --aw-muted:       #ffffffb7;
    --aw-text:        #ffffff;
    --aw-font-display: 'Syne', sans-serif;
    --aw-font-body:    'Onest', sans-serif;
  }

  .aw-root { font-family: var(--aw-font-body); background: transparent; color: var(--aw-text); }

  .aw-layout {
    max-width: 1540px;
    margin: 0 auto;
    width: 100%;
    padding: 28px 24px;
    gap: 24px;
    position: relative;
    z-index: 10;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  @media (min-width: 1180px) {
    .aw-layout {
      grid-template-columns: minmax(0, 1fr) 400px;
      align-items: start;
    }
  }

  @media (max-width: 1179px) {
    .aw-layout {
      padding: 24px 16px;
    }
  }

  /* Scrollbar */
  .aw-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
  .aw-scroll::-webkit-scrollbar-track { background: transparent; }
  .aw-scroll::-webkit-scrollbar-thumb { background: var(--aw-accent-dim); border-radius: 2px; }
  .aw-scroll::-webkit-scrollbar-thumb:hover { background: var(--aw-accent); }

  /* Premium Horizontal Card Styles */
  .aw-media-card {
    transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    transform-origin: center;
    will-change: transform;
  }
  
  .aw-media-card:hover {
    transform: translateY(-4px);
    border-color: rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
  }

  .aw-media-card:active {
    transform: scale(0.97);
    transition: all 0.12s ease;
  }

  /* Preview Timeline Input Overrides */
  .preview-timeline-input::-webkit-slider-thumb {
    appearance: none;
    width: 0;
    height: 0;
  }
`;

// Helper for formatting duration/current time
const formatTime = (secs: number) => {
  if (!secs || isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Time Ago Helper
const timeAgo = (dateStr: string) => {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

// Safe helper to extract nested object data without rendering [object Object]
const extractAnimeDetails = (anime: any) => {
  let year = anime.releaseDate || anime.year || '';
  if (typeof year === 'object' && year !== null) {
    year = year.year || year.start?.year || '';
  }

  const eps = anime.episodes != null ? anime.episodes : undefined;
  const epsStr = eps ? `${eps} EPS` : '';

  let studio = '';
  if (Array.isArray(anime.studios) && anime.studios.length > 0) {
    studio = typeof anime.studios[0] === 'object' ? anime.studios[0].name : anime.studios[0];
  } else if (typeof anime.studios === 'string') {
    studio = anime.studios;
  } else if (typeof anime.studios === 'object' && anime.studios !== null) {
    studio = anime.studios.name || '';
  }

  const seasonStr = anime.parsedSeason?.parsedString ? `${anime.parsedSeason.parsedString}${year && anime.parsedSeason.parsedString.indexOf(String(year)) === -1 ? ` (${year})` : ''}` : year;

  const parts = [seasonStr, studio, epsStr].filter(p => p && String(p).trim() !== '' && String(p) !== '[object Object]');
  return parts.join(' • ');
};

export interface ContinueWatchingEntry {
  kind: string;
  animeId: string;
  episodeId: string;
  animeTitle: string;
  animeCover?: string;
  episodeTitle: string;
  episodeNumber: number;
  href: string;
  duration?: number;
  currentTime?: number;
  updatedAt: number;
}

export interface FriendActivityData {
  id: string;
  display_name: string;
  avatar_url: string;
  isOnline: boolean;
  statusType: string;
  statusText: string;
  lastActivity?: {
    animeTitle: string;
    episodeNumber: number;
    timestamp: string;
    image?: string;
  };
}

type MyListFilter = 'all' | 'watching' | 'uncategorized' | 'completed' | 'on_hold' | 'dropped';

const MY_LIST_FILTERS: Array<{ value: MyListFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'watching', label: 'Watching' },
  { value: 'uncategorized', label: 'To Watch' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'dropped', label: 'Dropped' },
];

const getNormalizedBookmarkStatus = (status?: string) => {
  const normalized = (status || '').toLowerCase();
  if (['watching', 'completed', 'on_hold', 'dropped'].includes(normalized)) {
    return normalized as Exclude<MyListFilter, 'all'>;
  }
  return 'uncategorized';
};

// ─────────────────────────────────────────
// FRAMER MOTION VARIANTS
// ─────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: 'spring', damping: 25, stiffness: 200 },
  },
};

// ─────────────────────────────────────────
// SECTION HEADER (Fallback empty states)
// ─────────────────────────────────────────
const SectionHeader: React.FC<{ title: string; onTitleClick?: () => void }> = ({ title, onTitleClick }) => {
  const navigate = useNavigate();
  const handleTitleClick = () => {
    if (onTitleClick) {
      onTitleClick();
      return;
    }
    navigate('/browse');
  };

  return (
    <div className="flex w-full items-end justify-between mb-2 mt-2">
      <button
        type="button"
        onClick={handleTitleClick}
        className="group text-left focus-visible:outline-none cursor-pointer"
        aria-label={onTitleClick ? `Open ${title}` : `Browse from ${title}`}
        title="Click to view more"
      >
        <h2 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-white transition-colors group-hover:text-[var(--aw-accent)] inline-flex items-center gap-2" style={{ fontFamily: 'var(--aw-font-display)' }}>
          {title}
          <ChevronRight size={20} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-[var(--aw-accent)]" />
        </h2>
      </button>
    </div>
  );
};

// ─────────────────────────────────────────
// VERTICAL CINEMATIC POSTER CARD
// ─────────────────────────────────────────
interface MediaCardProps {
  title: string;
  image: string;
  subtitle?: string;
  badge?: string;
  onClick: () => void;
}

const MediaCard: React.FC<MediaCardProps> = ({ title, image, subtitle, onClick }) => {
  return (
    <div
      className="aw-media-card group relative flex flex-col w-[160px] sm:w-[175px] md:w-[190px] lg:w-[200px] flex-shrink-0 cursor-pointer select-none rounded-[16px] p-2 bg-transparent border border-transparent"
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[12px] bg-[var(--aw-s2)] border border-white/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.05] pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--aw-accent)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_0_8px_var(--aw-accent-glow)]" />
      </div>

      <div className="pt-2.5 px-0.5 h-[48px] flex flex-col justify-start gap-0.5">
        <h3 className="line-clamp-1 text-[13px] font-semibold leading-snug text-white/85 group-hover:text-white transition-colors" style={{ fontFamily: 'var(--aw-font-body)' }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-[10.5px] font-medium text-zinc-500 line-clamp-1 group-hover:text-zinc-400 transition-colors" style={{ fontFamily: 'var(--aw-font-body)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// TRUE STATUS: FRIENDS ACTIVITY CARD
// ─────────────────────────────────────────
const FriendCard: React.FC<{ friend: FriendActivityData; onClick: () => void }> = ({ friend, onClick }) => {
  const { display_name, avatar_url, isOnline, statusType, statusText, lastActivity } = friend;
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onClick}
      className="group relative flex w-[250px] sm:w-[270px] flex-shrink-0 cursor-pointer items-center gap-3.5 rounded-[16px] border border-transparent bg-white/[0.02] p-3.5 transition-all duration-300 hover:-translate-y-1 hover:bg-[color-mix(in_srgb,var(--app-accent)_5%,transparent)] hover:border-[var(--app-accent)] active:scale-[0.97]"
    >
      {/* Background image if active (faded heavily) */}
      {lastActivity?.image && (
        <div className="absolute inset-0 z-0 opacity-[0.02] group-hover:opacity-[0.06] transition-opacity duration-300 pointer-events-none rounded-[inherit] overflow-hidden">
          <img src={lastActivity.image} className="w-full h-full object-cover blur-sm" alt="" />
        </div>
      )}

      {/* Avatar Container */}
      <div className="relative z-10 w-[46px] h-[46px] flex-shrink-0">
        <div className="w-full h-full rounded-full border border-white/10 group-hover:border-[var(--app-accent)] transition-colors duration-300 bg-[#1a1a1c] overflow-hidden shadow-sm">
          {(!avatar_url || imgError) ? (
            <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-[#111]">
              <User size={18} strokeWidth={2} />
            </div>
          ) : (
            <img src={avatar_url} className="w-full h-full object-cover" alt={display_name} onError={() => setImgError(true)} />
          )}
        </div>
        {/* Status Dot positioned just outside the overflow-hidden avatar */}
        <div
          className={`absolute bottom-0 right-0 translate-x-[15%] translate-y-[15%] h-3.5 w-3.5 rounded-full border-[2.5px] border-[#0e0e11] group-hover:border-[#13151a] transition-colors duration-300 z-20 ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-600'}`}
        />
      </div>

      {/* True Status Info Container */}
      <div className="relative z-10 flex flex-col min-w-0 flex-1 justify-center leading-tight">
        <span className="text-[14px] font-bold text-white truncate group-hover:text-[var(--app-accent)] transition-colors" style={{ fontFamily: 'var(--aw-font-display)' }}>
          {display_name}
        </span>

        {isOnline ? (
          <div className="flex flex-col mt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              {statusType === 'watching' ? 'Watching' : 'Online'}
            </span>
            <span className="text-[12px] text-zinc-300 truncate font-medium mt-0.5">
              {statusText || 'Browsing Kotatsu'}
            </span>
          </div>
        ) : lastActivity ? (
          <div className="flex flex-col mt-0.5">
            <span className="text-[11px] text-zinc-400 truncate group-hover:text-zinc-300 transition-colors">Watched {lastActivity.animeTitle}</span>
            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide mt-0.5 group-hover:text-zinc-500 transition-colors">{timeAgo(lastActivity.timestamp)}</span>
          </div>
        ) : (
          <span className="text-[12px] text-zinc-500 mt-0.5 font-medium">Offline</span>
        )}
      </div>
    </div>
  );
};


// ─────────────────────────────────────────
// NETFLIX/YOUTUBE-STYLE CONTINUE WATCHING CARD
// ─────────────────────────────────────────
const ContinueWatchingCard: React.FC<{ entry: any; onClick: () => void; onClear: () => void; onNavigateDetails: () => void; isBookmarked: boolean; onToggleBookmark: () => void; }> = ({ entry, onClick, onClear, onNavigateDetails, isBookmarked, onToggleBookmark }) => {
  const progressNum = entry.currentTime && entry.duration ? (entry.currentTime / entry.duration) * 100 : Math.floor(Math.random() * 60) + 20;

  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Custom Preview Video State
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDur, setPreviewDur] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const playerRef = useRef<MediaPlayerInstance>(null);


  useEffect(() => {
    if (!isHovered) {
      setIsVideoReady(false);
      setIsMuted(true);
      setPreviewTime(entry.currentTime || 0);
    }
  }, [isHovered, entry.currentTime]);

  useEffect(() => {
    let mounted = true;
    let timer: NodeJS.Timeout;

    if (isHovered && !streamUrl) {
      timer = setTimeout(async () => {
        try {
          const epsRes = await fetchAnimeEpisodes(Number(entry.animeId));
          if (!mounted) return;

          let foundProvider = null;
          let foundCategory = null;
          let slug = '';

          if (epsRes?.providers) {
            const PREFERRED_SERVERS = ['kiwi', 'animepahe', 'hd-1', 'vidstreaming', 'megacloud', 'hd-2', 'zoro', 'gogoanime', 'kai'];
            const sortedProviders = Object.keys(epsRes.providers).sort((a, b) => {
              const aIdx = PREFERRED_SERVERS.findIndex(p => a.toLowerCase().includes(p));
              const bIdx = PREFERRED_SERVERS.findIndex(p => b.toLowerCase().includes(p));
              if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
              if (aIdx !== -1) return -1;
              if (bIdx !== -1) return 1;
              return 0;
            });

            for (const pName of sortedProviders) {
              const pData = epsRes.providers[pName];
              for (const cat of ['sub', 'dub'] as const) {
                const eps = (pData as any).episodes?.[cat] || [];
                const match = eps.find((e: any) => e.number === entry.episodeNumber || String(e.id) === String(entry.episodeId));
                if (match) {
                  foundProvider = pName;
                  foundCategory = cat;
                  slug = getEpisodeSlug(match.id);
                  break;
                }
              }
              if (foundProvider) break;
            }
          }

          if (foundProvider && foundCategory && slug) {
            const streamsRes = await fetchAnimeStreams(foundProvider.toLowerCase(), entry.animeId, foundCategory, slug);
            if (mounted && streamsRes?.streams?.length > 0) {
              const hlsStreams = streamsRes.streams.filter((s: any) => s.type === 'hls' || s.url?.includes('.m3u8'));

              if (hlsStreams.length > 0) {
                const getQualityScore = (q: string) => {
                  const lq = (q || '').toLowerCase();
                  if (lq.includes('auto')) return 9999;
                  if (lq.includes('default')) return 9000;
                  if (lq.includes('1080')) return 1080;
                  if (lq.includes('720')) return 720;
                  if (lq.includes('480')) return 480;
                  if (lq.includes('360')) return 360;
                  return parseInt(lq) || 0;
                };

                const bestStream = [...hlsStreams].sort((a, b) => getQualityScore(b.quality) - getQualityScore(a.quality))[0];

                const b64 = btoa(bestStream.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                const proxied = `https://proxypipe-production.up.railway.app/proxy/${b64}`;
                setDirectUrl(bestStream.url);
                setStreamUrl(proxied);
              }
            }
          }
        } catch (e) { console.error("Failed to fetch preview stream", e); }
      }, 600);
    }

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [isHovered, entry.animeId, entry.episodeId, entry.episodeNumber, streamUrl]);

  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || thumbnail || !entry.animeId) return;

    let mounted = true;
    const fetchThumb = async () => {
      try {
        const epsRes = await fetchAnimeEpisodes(Number(entry.animeId));
        if (!mounted || !epsRes?.providers) return;

        const PREFERRED_SERVERS = ['kiwi', 'animepahe', 'hd-1', 'vidstreaming', 'megacloud', 'hd-2', 'zoro', 'gogoanime', 'kai'];
        const sortedProviders = Object.keys(epsRes.providers).sort((a, b) => {
          const aIdx = PREFERRED_SERVERS.findIndex(p => a.toLowerCase().includes(p));
          const bIdx = PREFERRED_SERVERS.findIndex(p => b.toLowerCase().includes(p));
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
          return 0;
        });

        for (const pName of sortedProviders) {
          const pData = epsRes.providers[pName];
          for (const cat of ['sub', 'dub'] as const) {
            const eps = (pData as any).episodes?.[cat] || [];
            const match = eps.find((e: any) => e.number === entry.episodeNumber || String(e.id) === String(entry.episodeId));
            if (match?.image) {
              if (mounted) setThumbnail(match.image);
              return;
            }
          }
        }
      } catch (e) {
        // fail silently
      }
    };

    fetchThumb();
    return () => { mounted = false; };
  }, [isVisible, thumbnail, entry.animeId, entry.episodeId, entry.episodeNumber]);

  const imageSrc = thumbnail || entry.episodeImage || entry.animeBanner || entry.animeCover;
  const staticTimestampStr = entry.currentTime && entry.duration ? `${formatTime(entry.currentTime)} / ${formatTime(entry.duration)}` : '';

  return (
    <div
      ref={cardRef}
      className="group relative flex flex-col w-[260px] sm:w-[280px] md:w-[320px] lg:w-[340px] xl:w-[360px] flex-shrink-0 cursor-pointer gap-0 rounded-[20px] p-2.5 bg-transparent border border-transparent transition-all duration-300 hover:bg-white/[0.03] hover:border-white/[0.05] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative w-full aspect-[16/9] overflow-hidden rounded-[14px] border border-white/10 bg-[var(--aw-s2)] shadow-md transition-transform duration-300 group-hover:scale-[1.02]">

        <img
          src={imageSrc}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 pointer-events-none"
          alt={entry.animeTitle}
        />

        <AnimatePresence>
          {streamUrl && isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isVideoReady ? 1 : 0 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="absolute inset-0 z-10 w-full h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <MediaPlayer
                ref={playerRef}
                src={{ src: streamUrl, type: 'application/vnd.apple.mpegurl' }}
                muted={isMuted}
                autoPlay
                loop
                playsInline
                onProviderChange={(provider) => {
                  if (isHLSProvider(provider)) {
                    provider.config = {
                      enableWorker: true, backBufferLength: 0, maxBufferLength: 30, maxMaxBufferLength: 60,
                      manifestLoadingMaxRetry: 3, levelLoadingMaxRetry: 3, fragLoadingMaxRetry: 6,
                      appendErrorMaxRetry: 3, testBandwidth: false
                    };
                  }
                }}
                onCanPlay={() => {
                  if (!playerRef.current || !entry.currentTime) return;
                  const duration = playerRef.current.state?.duration || 0;
                  const parsedTime = entry.currentTime;
                  const currentTime = playerRef.current.currentTime || 0;

                  if (parsedTime > 10 && currentTime < 5 && duration > 0) {
                    const timeDiff = Math.abs(parsedTime - currentTime);
                    if (parsedTime < duration - 10 && timeDiff > 10) {
                      playerRef.current.currentTime = parsedTime;
                    }
                  }
                }}
                onTimeUpdate={() => {
                  if (!isScrubbing && playerRef.current) {
                    setPreviewTime(playerRef.current.currentTime);
                  }
                }}
                onDurationChange={() => {
                  if (playerRef.current) {
                    setPreviewDur(playerRef.current.state.duration || 0);
                  }
                }}
                onPlaying={() => setIsVideoReady(true)}
                onError={(err) => {
                  if (streamUrl && streamUrl.includes('proxypipe') && directUrl) {
                    setStreamUrl(directUrl);
                  }
                }}
                className="w-full h-full object-cover [&_video]:object-cover transition-transform duration-500 group-hover:scale-105"
              >
                <MediaProvider />
              </MediaPlayer>
            </motion.div>
          )}
        </AnimatePresence>

        {/* YouTube Style Overlay UI - Visible only when preview is playing */}
        {isVideoReady && (
          <>
            {/* Audio Toggle Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              className="absolute top-2.5 right-2.5 z-40 flex h-7 w-7 items-center justify-center rounded-[8px] bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/80 hover:scale-110 shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10 opacity-0 group-hover:opacity-100"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            {/* Dynamic Timestamp */}
            <div className="absolute bottom-2.5 right-2 z-40 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-extrabold tracking-wide backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/5 shadow-sm">
              {formatTime(previewTime)} / {formatTime(previewDur || entry.duration)}
            </div>
            {/* Floating Interactive Timeline */}
            <div
              className="absolute bottom-0 left-0 w-full z-40 h-3.5 group/timeline flex items-end cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {/* Custom Visual Bar */}
              <div className="absolute bottom-0 left-0 w-full bg-white/20 transition-all duration-200 pointer-events-none h-[3px] group-hover/timeline:h-[5px] group-hover/timeline:bg-white/30">
                <div
                  className="h-full bg-[var(--aw-accent)] relative shadow-[0_0_8px_var(--aw-accent-glow)]"
                  style={{ width: `${Math.max(0, Math.min(100, (previewTime / (previewDur || 1)) * 100))}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-[var(--aw-accent)] rounded-full opacity-0 group-hover/timeline:opacity-100 scale-0 group-hover/timeline:scale-100 transition-all duration-200 shadow-[0_0_8px_var(--aw-accent-glow)]" />
                </div>
              </div>

              {/* Invisible Native Input for Scrubbing */}
              <input
                type="range"
                min={0}
                max={previewDur || 100}
                value={previewTime}
                step="any"
                onMouseDown={() => setIsScrubbing(true)}
                onMouseUp={(e) => {
                  setIsScrubbing(false);
                  if (playerRef.current) playerRef.current.currentTime = parseFloat(e.currentTarget.value);
                }}
                onTouchStart={() => setIsScrubbing(true)}
                onTouchEnd={(e) => {
                  setIsScrubbing(false);
                  if (playerRef.current) playerRef.current.currentTime = parseFloat(e.currentTarget.value);
                }}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setPreviewTime(val);
                  if (playerRef.current) playerRef.current.currentTime = val;
                }}
                className="preview-timeline-input absolute bottom-0 left-0 w-full h-full opacity-0 cursor-pointer m-0 p-0"
              />
            </div>
          </>
        )}

        {/* Static State (when not hovering or video not ready) */}
        {!isVideoReady && staticTimestampStr && (
          <div className="absolute bottom-2.5 right-2 z-20 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white shadow-lg backdrop-blur-md pointer-events-none border border-white/5">
            {staticTimestampStr}
          </div>
        )}

        {!isVideoReady && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20 z-10 transition-opacity duration-300 group-hover:opacity-0">
            <div className="h-full bg-[var(--aw-accent)] shadow-[0_0_10px_var(--aw-accent-glow)]" style={{ width: `${Math.max(2, Math.min(100, progressNum))}%` }} />
          </div>
        )}
      </div>

      <div className="flex items-start pt-3 pb-1 px-1 gap-1">
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="line-clamp-1 text-[15px] font-bold text-white/95 group-hover:text-[var(--aw-accent)] transition-colors" style={{ fontFamily: 'var(--aw-font-display)' }}>
            {entry.animeTitle}
          </h3>
          <p className="text-[13px] font-medium text-zinc-400 mt-0.5" style={{ fontFamily: 'var(--aw-font-body)' }}>
            <span className="text-white/80 font-bold mr-1">Ep {entry.episodeNumber || '?'}</span>
            {entry.episodeTitle && entry.episodeTitle !== `Episode ${entry.episodeNumber}` ? (
              <><span className="opacity-50">•</span> <span className="line-clamp-1 inline">{entry.episodeTitle}</span></>
            ) : null}
          </p>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="group flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 flex-shrink-0 mt-1 text-zinc-500 hover:text-[var(--aw-accent)] hover:bg-[var(--aw-accent)]/10 hover:scale-110 active:scale-90 focus-visible:outline-none"
            title="More options"
          >
            <MoreVertical
              size={17}
              strokeWidth={2.5}
              className="transition-transform group-hover:scale-110 duration-300"
            />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full right-0 mb-2 w-48 rounded-[12px] border border-white/10 bg-[#0d0f12]/95 p-1.5 shadow-2xl backdrop-blur-md z-50 flex flex-col gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onNavigateDetails(); }}
                  className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[12px] font-medium text-white hover:bg-white/10 transition-colors"
                >
                  <Info size={15} />
                  <span>View Details</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onToggleBookmark(); }}
                  className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[12px] font-medium text-white hover:bg-white/10 transition-colors"
                >
                  {isBookmarked ? <BookmarkCheck size={15} className="text-[var(--aw-accent)]" /> : <Bookmark size={15} />}
                  <span className={isBookmarked ? 'text-[var(--aw-accent)]' : ''}>{isBookmarked ? 'In My List' : 'Add to List'}</span>
                </button>
                <div className="my-0.5 h-px w-full bg-white/10" />
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onClear(); }}
                  className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[12px] font-medium text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 size={15} />
                  <span>Remove from History</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
};


// ─────────────────────────────────────────
// CAROUSEL COMPONENT (Replaces HorizontalCarousel & integrates Pagination)
// ─────────────────────────────────────────
interface CarouselProps {
  title?: string;
  children: React.ReactNode;
  onTitleClick?: () => void;
  onPageChange?: (page: number) => void; // 👈 add this
}

const Carousel: React.FC<CarouselProps> = ({ title, children, onPageChange, onTitleClick }) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const handleTitleClick = () => {
    if (onTitleClick) {
      onTitleClick();
      return;
    }
    navigate('/browse');
  };

  // Track scroll direction alongside currentPage in your Carousel component:
  const [scrollDir, setScrollDir] = useState<'left' | 'right'>('right');

  const scroll = (direction: 'left' | 'right') => {
    setScrollDir(direction);
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };


  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      if (clientWidth === 0) return;

      const total = Math.max(1, Math.ceil(scrollWidth / clientWidth));

      // Check if we're at the very end (with a small 5px buffer for rounding errors)
      const isAtEnd = scrollWidth - clientWidth - scrollLeft <= 5;

      let current = Math.round(scrollLeft / clientWidth) + 1;
      if (isAtEnd) {
        current = total;
      }

      // Ensure within bounds
      current = Math.min(total, Math.max(1, current));

      setCurrentPage(current);
      setTotalPages(total);
      onPageChange?.(current);
    }
  }, [onPageChange]);

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [handleScroll, children]);

  // Debounced scroll layout check to handle image load shifts accurately
  useEffect(() => {
    const timer = setTimeout(handleScroll, 150);
    return () => clearTimeout(timer);
  }, [handleScroll, children]);

  return (
    <div className="flex flex-col w-full relative">
      {/* Integrated Header and Pagination */}
      {title && (
        <div className="flex w-full items-end justify-between mb-2 mt-2 px-1">
          <button
            type="button"
            onClick={handleTitleClick}
            className="group text-left focus-visible:outline-none cursor-pointer"
            aria-label={onTitleClick ? `Open ${title}` : `Browse from ${title}`}
            title="Click to view more"
          >
            <h2 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-white transition-colors group-hover:text-[var(--aw-accent)] inline-flex items-center gap-2" style={{ fontFamily: 'var(--aw-font-display)' }}>
              {title}
              <ChevronRight size={20} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-[var(--aw-accent)]" />
            </h2>
          </button>

          {totalPages > 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="flex items-center gap-0.5 rounded-[14px] border border-white/[0.06] bg-[var(--aw-s2)]/80 backdrop-blur-sm p-1"
            >
              {/* Left Button */}
              <motion.button
                onClick={() => scroll('left')}
                disabled={currentPage <= 1}
                whileTap={{ scale: 0.82 }}
                whileHover={{ scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="flex h-7 w-7 items-center justify-center rounded-[10px] text-zinc-500 hover:bg-[color-mix(in_srgb,var(--aw-accent)_12%,transparent)] hover:text-[var(--aw-accent)] disabled:opacity-20 disabled:pointer-events-none"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
              </motion.button>

              {/* Page Counter */}
              <div
                className="flex items-center gap-[3px] px-1.5 select-none pointer-events-none"
                style={{ fontFamily: 'var(--aw-font-body)' }}
              >
                <div className="relative h-[16px] w-4 overflow-hidden flex items-center justify-center">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={currentPage}
                      initial={{ y: scrollDir === 'right' ? 14 : -14, opacity: 0, filter: 'blur(4px)' }}
                      animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                      exit={{ y: scrollDir === 'right' ? -14 : 14, opacity: 0, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      className="absolute text-[12px] font-bold tabular-nums leading-none text-white/90"
                    >
                      {currentPage}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <span className="text-[12px] font-medium leading-none text-zinc-600">/</span>

                <span className="text-[12px] font-medium tabular-nums leading-none text-zinc-500">
                  {totalPages}
                </span>
              </div>

              {/* Right Button */}
              <motion.button
                onClick={() => scroll('right')}
                disabled={currentPage >= totalPages}
                whileTap={{ scale: 0.82 }}
                whileHover={{ scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="flex h-7 w-7 items-center justify-center rounded-[10px] text-zinc-500 hover:bg-[color-mix(in_srgb,var(--aw-accent)_12%,transparent)] hover:text-[var(--aw-accent)] disabled:opacity-20 disabled:pointer-events-none"
                aria-label="Next page"
              >
                <ChevronRight size={14} strokeWidth={2.5} />
              </motion.button>
            </motion.div>
          )}
        </div>
      )}

      {/* Scrollable Container */}
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto overflow-y-visible py-2 px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`
            .flex::-webkit-scrollbar { display: none; }
          `}</style>
          {children}
        </div>
      </div>
    </div>
  );
};


const AnimeHome: React.FC = () => {

  // Dynamically Set Document Title for SPA
  useEffect(() => {
    document.title = 'Home';
  }, []);

  // ─────────────────────────────────────────
  // CRUCIAL HLS.JS CODEC FIX 
  // ─────────────────────────────────────────
  useEffect(() => {
    const original = MediaSource.prototype.addSourceBuffer;
    MediaSource.prototype.addSourceBuffer = function (mimeType: string) {
      const fixed = mimeType.replace('mp4a.40.1', 'mp4a.40.2');
      if (fixed !== mimeType) console.log('[codec-fix] Remapped:', mimeType, '->', fixed);
      return original.call(this, fixed);
    };
    return () => { MediaSource.prototype.addSourceBuffer = original; };
  }, []);

  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [spotlight, setSpotlight] = useState<AnimeResult[]>([]);
  const [popularAnime, setPopularAnime] = useState<AnimeResult[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingEntry[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<FriendActivityData[]>([]);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);

  const [internalIndex, setInternalIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [anilistDescriptions, setAnilistDescriptions] = useState<Record<string, string>>({});
  const [heroLogos, setHeroLogos] = useState<Record<string, string>>({});
  const [heroBgs, setHeroBgs] = useState<Record<string, string>>({});
  const [heroAccents, setHeroAccents] = useState<Record<string, string>>({});
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [myListEntries, setMyListEntries] = useState<BookmarkEntry[]>([]);
  const [myListFilter, setMyListFilter] = useState<MyListFilter>('all');
  const [isMyListFilterOpen, setIsMyListFilterOpen] = useState(false);
  const [myListPage, setMyListPage] = useState(1);
  const [myListTotalPages, setMyListTotalPages] = useState(1);
  const [myListScrollDir, setMyListScrollDir] = useState<'left' | 'right'>('right');
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const myListScrollRef = useRef<HTMLDivElement>(null);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDistance, setDragDistance] = useState(0);

  useEffect(() => {
    const id = 'aw-design-styles';
    if (!document.getElementById(id)) {
      const tag = document.createElement('style');
      tag.id = id; tag.textContent = DESIGN_STYLES; document.head.appendChild(tag);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  // Sync Watch History
  useEffect(() => {
    const syncContinue = async () => {
      try {
        if (user) {
          const { data, error } = await supabase.from('anime_watch_history').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(10);
          if (!error && data) {
            setContinueWatching(data.map((d: any) => ({
              kind: 'anime', animeId: d.anime_id, episodeId: d.episode_id, animeTitle: d.anime_title, animeCover: d.anime_cover, episodeTitle: d.episode_title,
              episodeNumber: d.episode_number, href: d.href, duration: d.duration, currentTime: d.progress_time, updatedAt: new Date(d.updated_at).getTime()
            })));
            return;
          }
        }
        const raw = localStorage.getItem('anime-continue-watching');
        if (raw) {
          const parsed = JSON.parse(raw);
          const validEntries = (Array.isArray(parsed) ? parsed : []).filter((e: any) => e.kind === 'anime');
          setContinueWatching(validEntries);
        } else {
          setContinueWatching([]);
        }
      } catch (e) { console.error("Failed to parse continue watching state", e); }
    };
    syncContinue();
    window.addEventListener('storage', syncContinue);
    window.addEventListener('focus', syncContinue);
    return () => { window.removeEventListener('storage', syncContinue); window.removeEventListener('focus', syncContinue); };
  }, [user]);

  // Sync Friends True Activity Status (using explicit DB columns)
  useEffect(() => {
    if (!user) {
      setFriendsActivity([]);
      return;
    }

    const fetchFriends = async () => {
      try {
        const { data: fData } = await supabase.from('friendships').select('user_id, friend_id').eq('status', 'accepted').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
        if (!fData || fData.length === 0) {
          setFriendsActivity([]);
          return;
        }

        const friendIds = fData.map(f => f.user_id === user.id ? f.friend_id : f.user_id);

        const { data: pData } = await supabase.from('profiles').select('*').in('id', friendIds);
        if (!pData) return;

        const watchRows = (await Promise.all(friendIds.map(id => fetchWatchActivity(id, 1)))).flat();

        const friendsMap = (pData as SocialProfile[]).map(p => {
          const canViewActivity = canViewVisibility(p.id, user.id, 'accepted', getVisibility(p, 'activity_visibility'));
          const canViewWatching = canViewVisibility(p.id, user.id, 'accepted', getVisibility(p, 'watching_status_visibility'));
          const latestWatch = canViewActivity ? watchRows.find(w => w.user_id === p.id) : undefined;

          const isOnline = canViewWatching && isRecentlyOnline(p);

          return {
            id: p.id,
            display_name: p.display_name || 'Anonymous User',
            avatar_url: p.avatar_url || '',
            isOnline,
            statusType: isOnline ? p.status_state : 'offline',
            statusText: canViewWatching ? p.status_text || '' : '',
            lastActivity: latestWatch ? {
              animeTitle: latestWatch.anime_title,
              episodeNumber: latestWatch.episode_number || 0,
              timestamp: latestWatch.created_at,
              image: latestWatch.episode_image || latestWatch.anime_cover
            } : undefined
          };
        });

        friendsMap.sort((a, b) => {
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          const aTime = a.lastActivity ? new Date(a.lastActivity.timestamp).getTime() : 0;
          const bTime = b.lastActivity ? new Date(b.lastActivity.timestamp).getTime() : 0;
          return bTime - aTime;
        });

        setFriendsActivity(friendsMap);
      } catch (err) {
        console.error("Error fetching friends activity", err);
      }
    };

    fetchFriends();
    const intervalId = setInterval(fetchFriends, 60000);
    return () => clearInterval(intervalId);
  }, [user?.id]);

  // Sync Bookmarks
  useEffect(() => {
    const syncBookmarks = async () => {
      try {
        if (user) {
          const { data, error } = await supabase.from('anime_bookmarks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
          if (!error && data) {
            const entries = data.map((d: any) => ({
              malId: parseInt(d.mal_id, 10),
              title: d.title,
              cover: d.cover,
              type: d.type,
              status: d.status,
              score: d.score,
              episodes: d.episodes,
              author: d.author,
              updatedAt: new Date(d.created_at).getTime()
            })).filter((entry: BookmarkEntry) => Number.isFinite(entry.malId) && entry.title);

            setMyListEntries(entries);
            setBookmarkedIds(new Set(entries.map((entry: BookmarkEntry) => entry.malId)));
            return;
          }
        }
        const local = readBookmarks();
        setMyListEntries(local);
        setBookmarkedIds(new Set(local.map((b: BookmarkEntry) => b.malId)));
      } catch (e) { }
    };
    syncBookmarks();
    const onStorage = () => syncBookmarks();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user?.id]);

  const toggleBookmark = useCallback(async (anime: AnimeResult) => {
    if (bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      const malId = Number(anime.id);
      const isBookmarked = bookmarkedIds.has(malId);
      const title = getAnimeDisplayTitle(anime.title);
      const cover = getAnimeCover(anime);
      const typeLabel = getAnimeTypeLabel(anime) || 'TV';
      const episodes = anime.episodes;

      if (user) {
        if (isBookmarked) {
          const { error } = await supabase.from('anime_bookmarks').delete().eq('user_id', user.id).eq('mal_id', String(malId));
          if (error) throw error;
        } else {
          const { error } = await supabase.from('anime_bookmarks').upsert({
            user_id: user.id,
            mal_id: String(malId),
            title,
            cover: cover || null,
            type: typeLabel,
            status: 'uncategorized',
            score: getAnimeScore(anime) ?? null,
            created_at: new Date().toISOString(),
          }, { onConflict: 'user_id, mal_id' });
          if (error) throw error;
        }
        const { data, error: selectError } = await supabase.from('anime_bookmarks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (selectError) throw selectError;
        const entries = (data || []).map((d: any) => ({
          malId: parseInt(d.mal_id, 10),
          title: d.title,
          cover: d.cover,
          type: d.type,
          status: d.status,
          score: d.score,
          episodes: d.episodes,
          author: d.author,
          updatedAt: new Date(d.created_at).getTime()
        })).filter((entry: BookmarkEntry) => Number.isFinite(entry.malId) && entry.title);
        setMyListEntries(entries);
        setBookmarkedIds(new Set(entries.map((entry: BookmarkEntry) => entry.malId)));
      } else {
        if (isBookmarked) { removeBookmark(malId); }
        else {
          const current = readBookmarks();
          const entry: BookmarkEntry = { malId, title, cover, type: typeLabel, status: 'uncategorized', score: getAnimeScore(anime), episodes, updatedAt: Date.now() };
          writeBookmarks([entry, ...current.filter(b => b.malId !== malId)]);
        }
        const nextLocal = readBookmarks();
        setMyListEntries(nextLocal);
        setBookmarkedIds(new Set(nextLocal.map((b: BookmarkEntry) => b.malId)));
      }
    } catch (e) {
      console.error('Failed to toggle bookmark:', e);
    } finally { setBookmarkLoading(false); }
  }, [bookmarkedIds, bookmarkLoading, user]);

  const clearContinueWatching = useCallback(async (animeId: string) => {
    try {
      if (user) {
        await supabase.from('anime_watch_history').delete().eq('user_id', user.id).eq('anime_id', animeId);
        setContinueWatching(prev => prev.filter(e => String(e.animeId) !== String(animeId)));
        return;
      }
      const raw = localStorage.getItem('anime-continue-watching');
      if (raw) {
        const parsed = JSON.parse(raw);
        const filtered = parsed.filter((entry: ContinueWatchingEntry) => String(entry.animeId) !== String(animeId));
        localStorage.setItem('anime-continue-watching', JSON.stringify(filtered));
        setContinueWatching(filtered);
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) { }
  }, [user]);

  const filteredMyListEntries = useMemo(() => {
    const filtered = myListFilter === 'all'
      ? myListEntries
      : myListEntries.filter(entry => getNormalizedBookmarkStatus(entry.status) === myListFilter);
    return filtered.slice(0, 16);
  }, [myListEntries, myListFilter]);

  const activeMyListFilterLabel = MY_LIST_FILTERS.find(filter => filter.value === myListFilter)?.label || 'All';

  const handleMyListScroll = useCallback(() => {
    const el = myListScrollRef.current;
    if (!el || el.clientWidth === 0) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const total = Math.max(1, Math.ceil(scrollWidth / clientWidth));
    const isAtEnd = scrollWidth - clientWidth - scrollLeft <= 5;
    const current = isAtEnd ? total : Math.min(total, Math.max(1, Math.round(scrollLeft / clientWidth) + 1));

    setMyListPage(current);
    setMyListTotalPages(total);
  }, []);

  const scrollMyList = useCallback((direction: 'left' | 'right') => {
    const el = myListScrollRef.current;
    if (!el) return;

    setMyListScrollDir(direction);
    el.scrollBy({
      left: direction === 'left' ? -el.clientWidth * 0.8 : el.clientWidth * 0.8,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    const el = myListScrollRef.current;
    if (el) el.scrollTo({ left: 0 });
    setMyListPage(1);
    requestAnimationFrame(handleMyListScroll);
  }, [filteredMyListEntries, handleMyListScroll]);

  useEffect(() => {
    window.addEventListener('resize', handleMyListScroll);
    return () => window.removeEventListener('resize', handleMyListScroll);
  }, [handleMyListScroll]);

  const handleOpenProfile = (userId: string) => {
    window.dispatchEvent(new CustomEvent('openProfile', { detail: { userId } }));
  };

  useEffect(() => {
    const fetchHome = async () => {
      try {
        setLoading(true);
        const [spotlightData, popularData] = await Promise.all([fetchAnimeSpotlight(), fetchAnimePopular(1, 24)]);
        setSpotlight(Array.isArray(spotlightData.results) ? spotlightData.results : []);
        setPopularAnime(Array.isArray(popularData.results) ? popularData.results : []);
      } finally { setLoading(false); }
    };
    fetchHome();
  }, []);

  const heroItems = useMemo(() => {
    const items = spotlight.length > 0 ? spotlight : popularAnime;
    return items.slice(0, 6);
  }, [spotlight, popularAnime]);

  const carouselItems = useMemo(() => {
    if (heroItems.length <= 1) return heroItems;
    return [heroItems[heroItems.length - 1], ...heroItems, heroItems[0]];
  }, [heroItems]);

  const activeHeroIndex = useMemo(() => {
    if (heroItems.length <= 1) return 0;
    if (internalIndex === 0) return heroItems.length - 1;
    if (internalIndex === heroItems.length + 1) return 0;
    return internalIndex - 1;
  }, [internalIndex, heroItems.length]);

  useEffect(() => {
    if (heroItems.length === 0 || activeHeroIndex === undefined) return;
    const currentItem = heroItems[activeHeroIndex];
    if (!currentItem) return;

    if (anilistDescriptions[currentItem.id]) return;

    let mounted = true;
    const fetchDesc = async () => {
      try {
        const info = await fetchAnimeInfo(Number(currentItem.id));
        let cleanDesc = info?.description || info?.synopsis || 'No description available for this series.';
        cleanDesc = cleanDesc.replace(/<[^>]*>?/gm, '');
        if (mounted) setAnilistDescriptions(prev => ({ ...prev, [currentItem.id]: cleanDesc }));
      } catch (e) {
        if (mounted) setAnilistDescriptions(prev => ({ ...prev, [currentItem.id]: 'No description available for this series.' }));
      }
    };
    fetchDesc();

    return () => { mounted = false; };
  }, [heroItems, activeHeroIndex]);

  useEffect(() => {
    if (heroItems.length === 0 || activeHeroIndex === undefined) return;
    const currentItem = heroItems[activeHeroIndex];
    if (!currentItem) return;

    // Prevent fetching if we already have it (even if empty string to indicate not found)
    if (heroLogos[currentItem.id] !== undefined) return;

    let mounted = true;
    const fetchArtwork = async () => {
      try {
        const mappingRes = await fetch(`https://api.ani.zip/mappings?anilist_id=${currentItem.id}`);
        if (!mappingRes.ok) {
          if (mounted) {
            setHeroLogos(prev => ({ ...prev, [currentItem.id]: '' }));
            setHeroBgs(prev => ({ ...prev, [currentItem.id]: '' }));
          }
          return;
        }
        const mappingData = await mappingRes.json();

        let logoUrl = '';
        let bgUrl = '';

        // Try ani.zip cached images first
        if (mappingData.images && Array.isArray(mappingData.images)) {
          const logoArt = mappingData.images.find((img: any) => img.coverType === 'Clearlogo');
          if (logoArt) logoUrl = logoArt.url;
          const fanart = mappingData.images.find((img: any) => img.coverType === 'Fanart');
          if (fanart) bgUrl = fanart.url;
        }

        // Fallback to TVDB extended if missing
        if ((!logoUrl || !bgUrl) && mappingData.mappings && mappingData.mappings.thetvdb_id) {
          const tvdbId = mappingData.mappings.thetvdb_id;
          const token = await getTvdbToken();
          if (token) {
            const tvdbRes = await fetch(`https://api4.thetvdb.com/v4/series/${tvdbId}/extended`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (tvdbRes.ok) {
              const tvdbData = await tvdbRes.json();
              if (tvdbData.data && Array.isArray(tvdbData.data.artworks)) {
                if (!logoUrl) {
                  const logoArt = tvdbData.data.artworks.find((art: any) => art.type === 23 || art.type === 24);
                  if (logoArt) logoUrl = logoArt.image;
                }
                if (!bgUrl) {
                  // Type 3 = Background/Fanart in TVDB
                  const bgArt = tvdbData.data.artworks.find((art: any) => art.type === 3);
                  if (bgArt) bgUrl = bgArt.image;
                }
              }
            }
          }
        }

        if (logoUrl) {
          const trimmed = await trimTransparentPixels(logoUrl);
          if (mounted) setHeroLogos(prev => ({ ...prev, [currentItem.id]: trimmed }));
          // Extract dominant color from the original (not trimmed data URL, to avoid CORS)
          const accent = await extractDominantColor(logoUrl);
          if (mounted) setHeroAccents(prev => ({ ...prev, [currentItem.id]: accent }));
        } else {
          if (mounted) setHeroLogos(prev => ({ ...prev, [currentItem.id]: '' }));
        }
        if (mounted) setHeroBgs(prev => ({ ...prev, [currentItem.id]: bgUrl || '' }));
      } catch (e) {
        if (mounted) {
          setHeroLogos(prev => ({ ...prev, [currentItem.id]: '' }));
          setHeroBgs(prev => ({ ...prev, [currentItem.id]: '' }));
        }
      }
    };
    fetchArtwork();

    return () => { mounted = false; };
  }, [heroItems, activeHeroIndex]);

  useEffect(() => {
    if (heroItems.length <= 1 || isDragging || !isTransitioning) return;
    const intervalId = setInterval(() => {
      if (document.hidden) return;
      setInternalIndex((current) => {
        if (current >= heroItems.length + 1) return current;
        return current + 1;
      });
    }, 7000);
    return () => clearInterval(intervalId);
  }, [heroItems.length, isDragging, isTransitioning, internalIndex]);

  useEffect(() => {
    if (!isTransitioning) return;
    let fallback: ReturnType<typeof setTimeout>;
    if (internalIndex <= 0) {
      fallback = setTimeout(() => { setIsTransitioning(false); setInternalIndex(heroItems.length); }, 1000);
    } else if (internalIndex >= heroItems.length + 1) {
      fallback = setTimeout(() => { setIsTransitioning(false); setInternalIndex(1); }, 1000);
    }
    return () => { if (fallback) clearTimeout(fallback); };
  }, [internalIndex, heroItems.length, isTransitioning]);

  useEffect(() => {
    if (!isTransitioning) {
      if (sliderRef.current) void sliderRef.current.offsetHeight;
      const timer = setTimeout(() => { setIsTransitioning(true); }, 40);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  const handleDragStart = (clientX: number) => { setTouchStart(clientX); setIsDragging(true); setDragOffset(0); setDragDistance(0); };
  const handleDragMove = (clientX: number) => { if (!isDragging || touchStart === null) return; const offset = clientX - touchStart; setDragOffset(offset); };
  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false); setDragDistance(Math.abs(dragOffset));
    if (dragOffset > 75) {
      setInternalIndex((prev) => Math.max(0, prev - 1));
    } else if (dragOffset < -75) {
      setInternalIndex((prev) => Math.min(heroItems.length + 1, prev + 1));
    }
    setDragOffset(0); setTouchStart(null);
  };

  const handleNavigation = (e: React.MouseEvent, path: string) => {
    if (dragDistance > 10) { e.preventDefault(); e.stopPropagation(); return; }
    navigate(path);
  };

  return (
    <div className="aw-root relative min-h-screen overflow-x-hidden text-white selection:bg-[var(--app-accent-muted)]">

      <div style={{ position: 'sticky', top: 0, zIndex: 60, borderBottom: '1px solid var(--aw-border)', background: 'transparent', backdropFilter: 'blur(20px)' }}></div>

      <motion.main variants={containerVariants} initial="hidden" animate="visible" className="relative z-10 mx-auto w-full max-w-[1540px] space-y-10 px-4 md:px-6 lg:px-8 py-8">

        {/* ── HERO SECTION ── */}
        <motion.section variants={itemVariants} className="w-full relative">
          {loading || heroItems.length === 0 ? (
            <div className="h-[320px] sm:h-[400px] md:h-[480px] w-full rounded-[24px] bg-[var(--app-surface-1)] animate-pulse border border-white/5 shadow-2xl" />
          ) : (
            <div
              className="relative w-full rounded-[24px] bg-[var(--app-surface-1)] border border-white/5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] overflow-hidden min-h-[320px] sm:min-h-[400px] md:min-h-[480px] cursor-grab active:cursor-grabbing select-none group/hero"
              onMouseDown={(e) => handleDragStart(e.clientX)}
              onMouseMove={(e) => handleDragMove(e.clientX)}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
              onTouchEnd={handleDragEnd}
            >
              <div
                ref={sliderRef}
                className={`flex w-full h-full ${isDragging || !isTransitioning ? '' : 'transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]'}`}
                style={{ transform: `translateX(calc(-${(heroItems.length <= 1 ? 0 : internalIndex) * 100}% + ${dragOffset}px))` }}
                onTransitionEnd={(e) => {
                  if (e.target !== sliderRef.current) return;
                  if (heroItems.length <= 1) return;
                  if (internalIndex <= 0) { setIsTransitioning(false); setInternalIndex(heroItems.length); }
                  else if (internalIndex >= carouselItems.length - 1) { setIsTransitioning(false); setInternalIndex(1); }
                }}
              >
                {carouselItems.map((anime, index) => {
                  const key = heroItems.length > 1 ? (index === 0 ? `${anime.id}-clone-start` : index === carouselItems.length - 1 ? `${anime.id}-clone-end` : anime.id) : anime.id;
                  const title = getAnimeDisplayTitle(anime.title);
                  const score = getAnimeScore(anime);
                  const desc = anilistDescriptions[anime.id] || anime.description || (anime as any).synopsis || 'Loading synopsis...';

                  let realIndex = index - 1;
                  if (heroItems.length > 1) {
                    if (index === 0) realIndex = heroItems.length - 1;
                    else if (index === carouselItems.length - 1) realIndex = 0;
                  } else {
                    realIndex = 0;
                  }

                  const isActiveSlide = realIndex === activeHeroIndex;
                  const trailerUrl = anime.trailer?.site === 'youtube' && anime.trailer?.id ? `youtube/${anime.trailer.id}` : null;
                  const logoUrl = heroLogos[anime.id];
                  const heroBgUrl = heroBgs[anime.id];

                  return (
                    <div key={key} className="w-full h-full flex-shrink-0 relative flex flex-col md:flex-row items-end md:items-center justify-end md:justify-between gap-4 md:gap-8 lg:gap-12 p-5 pb-14 sm:p-8 sm:pb-14 md:p-12 md:pb-12 lg:p-16 lg:pb-16 min-h-[320px] sm:min-h-[400px] md:min-h-[480px]">

                      {/* ── Background Layer ── */}
                      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden bg-[var(--app-surface-1)]">
                        {isActiveSlide && trailerUrl ? (
                          <div className="absolute inset-0 scale-[1.35] opacity-60 md:opacity-[0.85] transition-opacity duration-1000">
                            <MediaPlayer src={trailerUrl} autoPlay loop muted playsInline className="w-full h-full object-cover">
                              <MediaProvider />
                            </MediaPlayer>
                          </div>
                        ) : (
                          <img
                            src={heroBgUrl || (anime as any).bannerImage || getAnimeCover(anime)}
                            draggable="false"
                            className={`w-full h-full object-cover scale-105 pointer-events-none transition-opacity duration-1000 ${heroBgUrl ? 'opacity-50' : 'opacity-40'}`}
                            alt=""
                          />
                        )}
                        {/* Left cinematic fade */}
                        <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(to right, var(--app-surface-1) 0%, var(--app-surface-1) 15%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 70%, transparent 100%)' }} />
                        {/* Bottom fade */}
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--app-surface-1) 0%, rgba(0,0,0,0.6) 35%, transparent 65%)' }} />
                        {/* Mobile: stronger overall darken */}
                        <div className="absolute inset-0 bg-black/30 md:bg-black/10" />
                      </div>

                      {/* ── Content Left ── */}
                      <div className="w-full md:w-[58%] lg:w-[60%] flex flex-col gap-3 md:gap-4 z-10 justify-end md:justify-center">
                        {logoUrl ? (
                          <img src={logoUrl} alt={title} className="max-w-[280px] sm:max-w-[340px] md:max-w-[420px] lg:max-w-[480px] max-h-[100px] sm:max-h-[120px] md:max-h-[150px] w-auto h-auto object-contain object-left mb-1" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.95)) drop-shadow(0 10px 30px rgba(0,0,0,0.4)) contrast(1.15) brightness(0.95)' }} draggable="false" />
                        ) : (
                          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.8rem] font-bold leading-[1.1] tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] line-clamp-2 md:line-clamp-3" style={{ fontFamily: 'var(--aw-font-display)' }}>
                            {title}
                          </h1>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                          <span className="text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider" style={{ backgroundColor: 'var(--aw-accent)', color: '#04110d', fontFamily: 'var(--aw-font-display)' }}>
                            #{realIndex + 1} Spotlight
                          </span>
                          <span className="border border-white/10 text-zinc-300 text-[8px] sm:text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.05] uppercase tracking-wider backdrop-blur-sm" style={{ fontFamily: 'var(--aw-font-display)' }}>
                            {getAnimeTypeLabel(anime) || 'TV'}
                          </span>
                          {score ? (
                            <span className="flex items-center gap-1 border border-white/10 text-zinc-300 text-[8px] sm:text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.05] backdrop-blur-sm" style={{ fontFamily: 'var(--aw-font-display)' }}>
                              <Star size={10} className="text-amber-400 fill-amber-400" />
                              {score.toFixed(1)}
                            </span>
                          ) : null}
                          <span className="border border-white/10 text-zinc-300 text-[8px] sm:text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.05] uppercase tracking-wider backdrop-blur-sm" style={{ fontFamily: 'var(--aw-font-display)' }}>HD</span>
                        </div>

                        <p className={`text-[11px] sm:text-[13px] md:text-sm leading-relaxed line-clamp-2 md:line-clamp-3 lg:line-clamp-4 ${desc.includes('No description') ? 'text-white/40 italic' : 'text-zinc-400'}`} style={{ fontFamily: 'var(--aw-font-body)' }}>
                          {desc}
                        </p>

                        <div className="mt-1 flex flex-row items-center gap-2 md:gap-3 w-full md:w-auto">
                          <button onClick={(e) => handleNavigation(e, `/watch/${anime.id}`)} onMouseDown={handleRippleMouseDown} className="flex-1 md:flex-none aw-btn-primary group relative overflow-hidden press-squish flex h-[38px] sm:h-[42px] md:h-[46px] items-center justify-center gap-2 rounded-xl px-4 md:px-6 text-[10px] sm:text-[11px] md:text-sm font-bold hover:scale-[1.03] active:scale-[0.97] transition-all duration-300" style={{ backgroundColor: 'var(--aw-accent)', color: '#04110d', fontFamily: 'var(--aw-font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <div className="absolute inset-0 bg-white/20 translate-x-[-120%] skew-x-[-20deg] transition-transform duration-500 group-hover:translate-x-[120%]" />
                            <MonitorPlay size={15} fill="currentColor" className="relative z-10 hidden sm:block" />
                            <span className="relative z-10">Open Series</span>
                          </button>

                          <button onClick={(e) => handleNavigation(e, '/browse')} onMouseDown={handleRippleMouseDown} className="flex-1 md:flex-none aw-btn-ghost group relative overflow-hidden press-squish flex h-[38px] sm:h-[42px] md:h-[46px] items-center justify-center gap-2 rounded-xl border px-4 md:px-6 text-[10px] sm:text-[11px] md:text-sm font-bold hover:scale-[1.03] active:scale-[0.97] transition-all duration-300" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', borderColor: 'rgba(255,255,255,0.1)', fontFamily: 'var(--aw-font-display)', textTransform: 'uppercase', letterSpacing: '0.05em' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--aw-accent), transparent 85%)'; e.currentTarget.style.borderColor = 'var(--aw-accent)'; e.currentTarget.style.color = 'var(--aw-accent)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}>
                            <div className="absolute inset-0 bg-white/20 translate-x-[-120%] skew-x-[-20deg] transition-transform duration-500 group-hover:translate-x-[120%]" />
                            <span className="relative z-10">Browse Catalog</span>
                          </button>

                          {heroItems[activeHeroIndex] && (() => {
                            const currentAnime = heroItems[activeHeroIndex];
                            const isBookmarked = bookmarkedIds.has(Number(currentAnime.id));
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleBookmark(currentAnime); }}
                                disabled={bookmarkLoading}
                                className={`flex-shrink-0 group flex h-[38px] w-[38px] sm:h-[42px] sm:w-[42px] md:h-[46px] md:w-[46px] items-center justify-center rounded-xl border hover:scale-[1.05] active:scale-[0.97] ${bookmarkLoading ? 'opacity-50 cursor-wait' : ''}`}
                                style={{ background: 'rgba(255,255,255,0.05)', borderColor: isBookmarked ? 'var(--aw-accent)' : 'rgba(255,255,255,0.1)', color: isBookmarked ? 'var(--aw-accent)' : 'white', transition: 'all 0.3s ease' }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--aw-accent), transparent 85%)'; e.currentTarget.style.borderColor = 'var(--aw-accent)'; e.currentTarget.style.color = 'var(--aw-accent)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = isBookmarked ? 'var(--aw-accent)' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = isBookmarked ? 'var(--aw-accent)' : 'white'; }}
                              >
                                {isBookmarked ? <BookmarkCheck size={16} className="md:w-5 md:h-5" /> : <Bookmark size={16} className="md:w-5 md:h-5" />}
                              </button>
                            );
                          })()}
                        </div>
                      </div>



                    </div>
                  );
                })}
              </div>

              <div className="absolute bottom-3 md:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 items-center z-20 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                {heroItems.map((item, index) => {
                  const isActive = index === activeHeroIndex;
                  return (
                    <button
                      key={`dot-${index}`}
                      onClick={() => { if (heroItems.length <= 1) return; setIsTransitioning(true); setInternalIndex(index + 1); }}
                      aria-label={`View slide ${index + 1}`}
                      className={`h-1.5 md:h-2 rounded-full transition-all duration-500 ease-out ${isActive ? 'w-6 md:w-8' : 'w-1.5 md:w-2 bg-white/20 hover:bg-white/50 cursor-pointer'}`}
                      style={isActive ? { backgroundColor: 'var(--app-accent)' } : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </motion.section>

        {/* ── FRIENDS ACTIVITY SECTION ── */}
        {user && (
          <motion.section variants={itemVariants} className="flex flex-col w-full mt-4">
            {friendsActivity.length > 0 ? (
              <Carousel title="Friends" onTitleClick={() => setIsFriendsOpen(true)}>
                {friendsActivity.map(friend => (
                  <FriendCard key={friend.id} friend={friend} onClick={() => handleOpenProfile(friend.id)} />
                ))}
              </Carousel>
            ) : (
              <>
                <SectionHeader title="Friends Activity" onTitleClick={() => setIsFriendsOpen(true)} />
                <div className="w-full rounded-[16px] border border-white/5 bg-[var(--aw-s1)] p-8 text-center flex flex-col items-center justify-center gap-3">
                  <Users size={24} className="text-zinc-600" />
                  <p className="text-[13px] text-zinc-400 font-medium max-w-sm">
                    No friends activity yet. Connect with other users to build your network and see what they are watching!
                  </p>
                </div>
              </>
            )}
          </motion.section>
        )}

        {/* ── CONTINUE WATCHING SECTION ── */}
        {continueWatching.length > 0 && (
          <motion.section variants={itemVariants} className="flex flex-col w-full mt-4">
            <Carousel title="Continue Watching" onTitleClick={() => navigate('/continuewatching')}>
              {continueWatching.slice(0, 12).map((entry) => (
                <ContinueWatchingCard
                  key={`${entry.animeId}-${entry.episodeId}`}
                  entry={entry}
                  onClick={() => navigate(entry.href || `/watch/${entry.animeId}`)}
                  onClear={() => clearContinueWatching(entry.animeId)}
                  onNavigateDetails={() => navigate(`/watch/${entry.animeId}`)}
                  isBookmarked={bookmarkedIds.has(Number(entry.animeId))}
                  onToggleBookmark={() => toggleBookmark({
                    id: entry.animeId,
                    title: entry.animeTitle,
                    image: entry.animeCover || entry.episodeImage,
                  } as any)}
                />
              ))}
            </Carousel>
          </motion.section>
        )}

        {myListEntries.length > 0 && (
          <motion.section variants={itemVariants} className="flex flex-col w-full mt-4">
            <div className="flex w-full items-start justify-between gap-4 mb-2 mt-2 px-1">
              <button type="button" onClick={() => navigate('/bookmarks')} className="group text-left focus-visible:outline-none cursor-pointer flex-shrink-0">
                <h2 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-white transition-colors group-hover:text-[var(--aw-accent)] inline-flex items-center gap-2" style={{ fontFamily: 'var(--aw-font-display)' }}>
                  Your List
                  <ChevronRight size={20} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-[var(--aw-accent)]" />
                </h2>
              </button>

              <div className="flex flex-shrink-0 items-center gap-2">
                <div className="relative z-30">
                  <motion.button
                    type="button"
                    onClick={() => setIsMyListFilterOpen(open => !open)}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    className="flex min-w-[168px] items-center gap-0.5 rounded-[14px] border border-white/[0.06] bg-[var(--aw-s2)]/80 p-1 text-left backdrop-blur-sm transition-colors hover:border-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15"
                    style={{ fontFamily: 'var(--aw-font-display)' }}
                    aria-expanded={isMyListFilterOpen}
                  >
                    <span className="flex h-7 min-w-0 flex-1 items-center overflow-hidden rounded-[10px] px-3 text-[10px] font-bold uppercase tracking-[0.11em] text-white/90">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={myListFilter}
                          initial={{ y: 12, opacity: 0, filter: 'blur(4px)' }}
                          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                          exit={{ y: -12, opacity: 0, filter: 'blur(4px)' }}
                          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                          className="block truncate"
                        >
                          {activeMyListFilterLabel}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <motion.span
                      animate={{ rotate: isMyListFilterOpen ? 180 : 0 }}
                      whileHover={{ scale: 1.15 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className="flex h-7 w-7 items-center justify-center rounded-[10px] text-zinc-500 hover:bg-[color-mix(in_srgb,var(--aw-accent)_12%,transparent)] hover:text-[var(--aw-accent)]"
                    >
                      <ChevronDown size={13} strokeWidth={2.5} />
                    </motion.span>
                  </motion.button>

                  <AnimatePresence>
                    {isMyListFilterOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-[16px] border border-white/[0.1] bg-[#111214]/95 shadow-xl shadow-black/40 backdrop-blur-md"
                      >
                        <div className="p-2">
                          {MY_LIST_FILTERS.map((filter) => {
                            const active = myListFilter === filter.value;
                            const count = filter.value === 'all'
                              ? myListEntries.length
                              : myListEntries.filter(e => getNormalizedBookmarkStatus(e.status) === filter.value).length;

                            return (
                              <motion.button
                                key={filter.value}
                                type="button"
                                onClick={() => {
                                  setMyListFilter(filter.value);
                                  setIsMyListFilterOpen(false);
                                }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`relative flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 transition-all duration-200 ${active ? 'bg-[color-mix(in_srgb,var(--aw-accent)_30%,transparent)] text-white shadow-sm' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}
                              >
                                <span className={`flex items-center gap-2.5 text-sm font-semibold whitespace-nowrap ${active ? 'text-white' : ''}`} style={{ fontFamily: 'var(--aw-font-display)' }}>
                                  {filter.label}
                                </span>
                                <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-[var(--aw-accent)]/20 text-[var(--aw-accent)]' : 'bg-white/[0.06] text-zinc-500'}`}>
                                  {count}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  className="hidden items-center gap-0.5 rounded-[14px] border border-white/[0.06] bg-[var(--aw-s2)]/80 p-1 backdrop-blur-sm sm:flex"
                >
                  <motion.button
                    onClick={() => scrollMyList('left')}
                    disabled={myListPage <= 1}
                    whileTap={{ scale: 0.82 }}
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="flex h-7 w-7 items-center justify-center rounded-[10px] text-zinc-500 hover:bg-[color-mix(in_srgb,var(--aw-accent)_12%,transparent)] hover:text-[var(--aw-accent)] disabled:pointer-events-none disabled:opacity-20"
                    aria-label="Previous My List page"
                  >
                    <ChevronLeft size={14} strokeWidth={2.5} />
                  </motion.button>

                  <div className="flex items-center gap-[3px] px-1.5 select-none pointer-events-none" style={{ fontFamily: 'var(--aw-font-body)' }}>
                    <div className="relative flex h-[16px] w-4 items-center justify-center overflow-hidden">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={myListPage}
                          initial={{ y: myListScrollDir === 'right' ? 14 : -14, opacity: 0, filter: 'blur(4px)' }}
                          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                          exit={{ y: myListScrollDir === 'right' ? -14 : 14, opacity: 0, filter: 'blur(4px)' }}
                          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                          className="absolute text-[12px] font-bold tabular-nums leading-none text-white/90"
                        >
                          {myListPage}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                    <span className="text-[12px] font-medium leading-none text-zinc-600">/</span>
                    <span className="text-[12px] font-medium tabular-nums leading-none text-zinc-500">{myListTotalPages}</span>
                  </div>

                  <motion.button
                    onClick={() => scrollMyList('right')}
                    disabled={myListPage >= myListTotalPages}
                    whileTap={{ scale: 0.82 }}
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="flex h-7 w-7 items-center justify-center rounded-[10px] text-zinc-500 hover:bg-[color-mix(in_srgb,var(--aw-accent)_12%,transparent)] hover:text-[var(--aw-accent)] disabled:pointer-events-none disabled:opacity-20"
                    aria-label="Next My List page"
                  >
                    <ChevronRight size={14} strokeWidth={2.5} />
                  </motion.button>
                </motion.div>
              </div>
            </div>
            <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
              <div ref={myListScrollRef} onScroll={handleMyListScroll} className="flex gap-3 overflow-x-auto overflow-y-visible py-2 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <AnimatePresence mode="popLayout">
                  {filteredMyListEntries.length > 0 ? filteredMyListEntries.map((entry) => (
                    <motion.div
                      key={entry.malId}
                      layout
                      initial={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    >
                      <MediaCard
                        title={entry.title}
                        image={entry.cover || ''}
                        subtitle={entry.episodes != null ? `${entry.episodes} ep${entry.episodes !== 1 ? 's' : ''}` : 'Unavailable'}
                        onClick={() => navigate(`/watch/${(entry.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || entry.malId}`)}
                      />
                    </motion.div>
                  )) : (
                    <motion.div
                      key="empty-state"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                      className="w-full"
                    >
                      <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.025] px-5 py-8 text-sm text-zinc-500">
                        No titles in this list yet.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── TRENDING NOW ── */}
        {(() => {
          const CARDS_PER_PAGE = 8;
          const [page, setPage] = useState(1);
          const visibleCount = Math.min((page + 2) * CARDS_PER_PAGE, popularAnime.length);

          return (
            <motion.section variants={itemVariants} className="flex flex-col w-full mt-4">
              <Carousel title="Trending Now" onPageChange={setPage}>
                {loading
                  ? Array.from({ length: CARDS_PER_PAGE }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] w-[160px] sm:w-[175px] md:w-[190px] lg:w-[200px] flex-shrink-0 rounded-[12px] bg-white/[0.02] border border-white/5 animate-pulse" />
                  ))
                  : popularAnime.slice(0, 50).map((anime, i) => (
                    i < visibleCount
                      ? <MediaCard
                        key={anime.id}
                        title={getAnimeDisplayTitle(anime.title)}
                        image={getAnimeCover(anime)}
                        badge={getAnimeTypeLabel(anime) || 'TV'}
                        subtitle={extractAnimeDetails(anime)}
                        onClick={() => navigate(`/watch/${anime.id}`)}
                      />
                      : <div
                        key={anime.id}
                        className="aspect-[2/3] w-[160px] sm:w-[175px] md:w-[190px] lg:w-[200px] flex-shrink-0 rounded-[12px] bg-white/[0.02]"
                      />
                  ))}
              </Carousel>
            </motion.section>
          );
        })()}

        {(() => {
          const CARDS_PER_PAGE = 8;
          const [page, setPage] = useState(1);
          const visibleCount = Math.min((page + 2) * CARDS_PER_PAGE, spotlight.length);

          return (
            <motion.section variants={itemVariants} className="flex flex-col w-full mt-4">
              <Carousel title="Recommended For You" onPageChange={setPage}>
                {loading
                  ? Array.from({ length: CARDS_PER_PAGE }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] w-[160px] sm:w-[175px] md:w-[190px] lg:w-[200px] flex-shrink-0 rounded-[12px] bg-white/[0.02] border border-white/5 animate-pulse" />
                  ))
                  : spotlight.slice(0, 50).map((anime, i) => (
                    i < visibleCount
                      ? <MediaCard
                        key={anime.id}
                        title={getAnimeDisplayTitle(anime.title)}
                        image={getAnimeCover(anime)}
                        badge={getAnimeTypeLabel(anime) || 'TV'}
                        subtitle={extractAnimeDetails(anime)}
                        onClick={() => navigate(`/watch/${anime.id}`)}
                      />
                      : <div
                        key={anime.id}
                        className="aspect-[2/3] w-[160px] sm:w-[175px] md:w-[190px] lg:w-[200px] flex-shrink-0 rounded-[12px] bg-white/[0.02]"
                      />
                  ))}
              </Carousel>
            </motion.section>
          );
        })()}

      </motion.main>
      <FriendsModal open={isFriendsOpen} onClose={() => setIsFriendsOpen(false)} />
    </div>
  );
};

export default AnimeHome;
/* --- END OF FILE AnimeHome.tsx --- */
