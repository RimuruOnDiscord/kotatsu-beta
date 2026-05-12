/* --- START OF FILE BookmarksPage.tsx --- */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Bookmark, Trash2, Search, CheckSquare, PlayCircle, CheckCircle2, PauseCircle, XCircle, Library, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BookmarkEntry, readBookmarks, removeBookmark, writeBookmarks } from '../utils/bookmarks';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────
// REDESIGNED STYLES
// ─────────────────────────────────────────
const DESIGN_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Onest:wght@300;400;500;600;700&display=swap');

  @keyframes spring-in {
    0% { transform: scale(0.9) translateY(20px); opacity: 0; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }

  @keyframes popIn {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.3); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes fade-up-stagger {
    0% { opacity: 0; transform: translateY(15px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  @keyframes tab-ready-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); border-color: rgba(255,255,255,0.1); }
    50% { box-shadow: 0 0 10px rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
  }

  /* ── Dock label pop ── */
  @keyframes label-rise {
    0%  { opacity: 0; transform: translateY(6px) scale(0.85); }
    100%{ opacity: 1; transform: translateY(0)   scale(1); }
  }

  .bm-root {
    font-family: 'Onest', system-ui, sans-serif !important;
    color: #fff;
    min-height: 100vh;
    padding-bottom: 140px; 
    background: transparent;
  }
  
  .bm-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px 16px;
  }
  @media (min-width: 768px) {
    .bm-container { padding: 40px 32px; }
  }

  .bm-header-title {
    font-family: 'Syne', sans-serif !important;
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
    background: linear-gradient(to right, #fff, rgba(255,255,255,0.7));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: fade-up-stagger 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  }
  
  .bm-header-subtitle {
    opacity: 0;
    animation: fade-up-stagger 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s forwards;
  }

  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  /* ─── Glass Panel (shared between search and tabs) ─── */
  .bm-glass-panel {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(30px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 24px;
    padding: 6px;
    box-shadow: 
      0 20px 40px rgba(0,0,0,0.25),
      inset 0 1px 0 rgba(255,255,255,0.06),
      inset 0 -1px 0 rgba(0,0,0,0.15);
    height: 58px;
    display: flex;
    align-items: center;
  }

  /* ─── Search Bar ─── */
  .bm-search-wrap {
    opacity: 0;
    animation: fade-up-stagger 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s forwards;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
    cursor: text;
  }
  .bm-search-wrap:focus-within {
    border-color: rgba(255,255,255,0.15) !important;
  }
  .bm-search-inner {
    position: relative;
    width: 100%;
    height: 44px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    transition: background 0.25s ease;
  }
  .bm-search-wrap:focus-within .bm-search-inner {
  }
  .bm-search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255,255,255,0.35);
    transition: color 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    pointer-events: none;
  }
  .bm-search-wrap:focus-within .bm-search-icon {
    color: var(--app-accent);
    transform: translateY(-50%) scale(1.1);
  }
  .bm-search-clear {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%) scale(0.8);
    opacity: 0;
    color: rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.08);
    border: none;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
    pointer-events: none;
  }
  .bm-search-wrap.has-value .bm-search-clear {
    opacity: 1;
    transform: translateY(-50%) scale(1);
    pointer-events: auto;
  }
  .bm-search-clear:hover {
    background: rgba(255,255,255,0.14);
    color: #fff;
  }
  .bm-search-input {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    padding: 0 40px 0 44px;
    color: #fff;
    font-size: 0.93rem;
    font-weight: 500;
    font-family: 'Onest', system-ui, sans-serif;
    outline: none !important;
    letter-spacing: 0.01em;
  }
  .bm-search-input::placeholder {
    color: rgba(255,255,255,0.28);
    font-weight: 400;
  }

  /* ─── Liquid Glass Tabs ─── */
  .bm-tabs-wrapper {
    display: inline-flex;
    gap: 4px;
    flex-nowrap: nowrap;
    opacity: 0;
    animation: fade-up-stagger 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 0.3s forwards;
  }
  
  .bm-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 20px;
    border-radius: 18px;
    font-weight: 600;
    font-size: 0.9rem;
    white-space: nowrap;
    background: transparent;
    border: none;
    outline: none !important;
    -webkit-tap-highlight-color: transparent;
    color: rgba(255,255,255,0.5);
    transition: color 0.3s, background 0.3s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: center;
    cursor: pointer;
    will-change: transform;
    position: relative;
  }
  
  .bm-tab:hover {
    color: #fff;
    background: rgba(255,255,255,0.06);
  }
  .bm-tab:active {
    transform: scale(0.96);
  }
  .bm-tab.active {
    color: #fff;
  }
  .bm-tab.drag-over {
    transform: scale(1.1) translateY(-2px);
    background: color-mix(in srgb, var(--app-accent), transparent 85%);
    border: 1px solid var(--app-accent);
    color: #fff;
    box-shadow: 0 10px 30px color-mix(in srgb, var(--app-accent), transparent 70%);
    z-index: 10;
  }
  .is-dragging-active .bm-tab {
    transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .is-dragging-active .bm-tab:not(.active):not(.drag-over) {
    animation: tab-ready-pulse 2s infinite;
  }
  .bm-badge {
    background: rgba(0,0,0,0.3);
    padding: 2px 8px;
    border-radius: 99px;
    font-size: 0.75rem;
  }

  /* Grid Layout */
  .bm-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-top: 24px;
  }
  @media (min-width: 640px) { .bm-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 32px; } }
  @media (min-width: 1024px) { .bm-grid { grid-template-columns: repeat(4, 1fr); gap: 24px; } }
  @media (min-width: 1280px) { .bm-grid { grid-template-columns: repeat(5, 1fr); gap: 24px; } }

  /* Card Styles */
  .bm-card {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    cursor: pointer;
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease, border-color 0.3s ease, filter 0.2s;
    aspect-ratio: 2/3;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: pan-y; 
  }
  @media (min-width: 640px) { .bm-card { border-radius: 20px; } }
  
  .bm-card:hover {
    border-color: rgba(255,255,255,0.25);
    z-index: 5;
  }
  @media (hover: hover) {
    .bm-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
  }
  
  .bm-card:active {
    transform: scale(0.96) !important;
    transition: transform 0.1s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .bm-card.pressing {
    transform: scale(0.96) !important;
    filter: brightness(0.8);
  }
  .bm-card.selected {
    transform: scale(0.96) !important;
    border-color: transparent !important;
    box-shadow: 0 0 0 3px var(--app-accent) !important;
    background: transparent;
  }
  .bm-card.dragging {
    opacity: 0.6; 
    filter: brightness(0.5) saturate(0.5); 
    transition: opacity 0.3s ease, filter 0.3s ease;
  }

  .bm-card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.3s ease, border-radius 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @media (hover: hover) {
    .bm-card:hover .bm-card-img {
      transform: scale(1.08);
      filter: brightness(1.1);
    }
  }
  .bm-card.selected .bm-card-img {
    transform: scale(1.05);
  }

  .bm-card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.1) 100%);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 12px;
    pointer-events: none;
    transition: all 0.3s ease;
  }
  @media (min-width: 640px) { .bm-card-overlay { padding: 16px; } }
  
  .bm-card.selected .bm-card-overlay {
    background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.2) 100%);
  }

  .bm-card-title {
    font-weight: 700;
    font-size: 0.9rem;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 4px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  }
  @media (min-width: 640px) { .bm-card-title { font-size: 1rem; } }

  .bm-card-meta {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.6);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  @media (min-width: 640px) { .bm-card-meta { font-size: 0.8rem; } }

  /* Selection check */
  .bm-check {
    position: absolute;
    top: 10px;
    left: 10px;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    background: rgba(0,0,0,0.5);
    border: 2px solid rgba(255,255,255,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 10;
    backdrop-filter: blur(4px);
  }
  @media (min-width: 640px) { 
    .bm-check { top: 12px; left: 12px; width: 28px; height: 28px; }
  }
  
  @media (hover: hover) {
    .bm-card:hover .bm-check {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  .selection-mode .bm-check {
    opacity: 1;
    transform: scale(1);
  }
  
  .bm-card.selected .bm-check {
    background: var(--app-accent);
    border-color: var(--app-accent);
    color: #000;
    opacity: 1;
    transform: scale(1);
    animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* ─── Bottom Action Dock ─── */
  .bm-dock-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    background: none;
    border: none;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }
  .bm-dock-action-icon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  .bm-dock-action:active .bm-dock-action-icon {
    transform: scale(0.88);
  }
  @media (hover: hover) {
    .bm-dock-action:hover .bm-dock-action-icon {
      transform: scale(1.1) translateY(-2px);
    }
  }
  .bm-dock-action-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
    white-space: nowrap;
    transition: color 0.2s ease;
    animation: label-rise 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @media (hover: hover) {
    .bm-dock-action:hover .bm-dock-action-label { color: rgba(255,255,255,0.8); }
  }

  /* Delete action variant */
  .bm-dock-delete .bm-dock-action-icon {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.2);
  }
  @media (hover: hover) {
    .bm-dock-delete:hover .bm-dock-action-icon {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.45);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.25);
    }
    .bm-dock-delete:hover .bm-dock-action-label {
      color: rgba(248, 113, 113, 0.9);
    }
  }

  /* Divider in dock */
  .bm-dock-divider {
    width: 1px;
    height: 36px;
    background: rgba(255,255,255,0.08);
    flex-shrink: 0;
    align-self: center;
  }
`;

// Helper Functions
const getNormalizedStatus = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (['watching', 'completed', 'on_hold', 'dropped'].includes(s)) return s;
  return 'uncategorized';
};

const createSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

const TABS = [
  { id: 'uncategorized', label: 'To Watch', icon: Library, color: 'text-[var(--app-accent)]', accent: 'var(--app-accent)', glow: '0 6px 20px color-mix(in srgb, var(--app-accent) 40%, transparent)' },
  { id: 'watching', label: 'Watching', icon: PlayCircle, color: 'text-emerald-400', accent: 'rgb(52,211,153)', glow: '0 6px 20px rgba(52,211,153,0.3)' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-purple-400', accent: 'rgb(192,132,252)', glow: '0 6px 20px rgba(192,132,252,0.3)' },
  { id: 'on_hold', label: 'On Hold', icon: PauseCircle, color: 'text-amber-400', accent: 'rgb(251,191,36)', glow: '0 6px 20px rgba(251,191,36,0.3)' },
  { id: 'dropped', label: 'Dropped', icon: XCircle, color: 'text-red-400', accent: 'rgb(248,113,113)', glow: '0 6px 20px rgba(248,113,113,0.3)' },
];

const BookmarkCard: React.FC<{
  entry: BookmarkEntry;
  navigate: (path: string) => void;
  isSelected: boolean;
  selectionMode: boolean;
  onLongPress: (id: number) => void;
  onToggleSelect: (id: number) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDrag: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  index: number;
  isDragging: boolean;
}> = ({ entry, navigate, isSelected, selectionMode, onToggleSelect, onLongPress, onDragStart, onDrag, onDragEnd, index, isDragging }) => {
  const isManga = !entry.type || entry.type.toLowerCase() === 'manga' || entry.type.toLowerCase() === 'manhwa';
  const [isPressing, setIsPressing] = useState(false);
  const holdTimeout = useRef<NodeJS.Timeout | null>(null);
  const wasLongPressed = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const startHold = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    if (selectionMode) return;
    wasLongPressed.current = false;
    setIsPressing(true);
    startPos.current = { x: e.clientX, y: e.clientY };

    holdTimeout.current = setTimeout(() => {
      wasLongPressed.current = true;
      onLongPress(entry.malId);
      setIsPressing(false);
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 400);
  };

  const checkMoveCancel = (e: React.PointerEvent) => {
    if (!isPressing) return;
    if (Math.abs(e.clientX - startPos.current.x) > 10 || Math.abs(e.clientY - startPos.current.y) > 10) {
      cancelHold();
    }
  }

  const cancelHold = () => {
    setIsPressing(false);
    if (holdTimeout.current) clearTimeout(holdTimeout.current);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (wasLongPressed.current) {
      wasLongPressed.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (selectionMode) {
      e.preventDefault();
      onToggleSelect(entry.malId);
    } else {
      navigate(isManga ? `/read/${createSlug(entry.title)}` : `/watch/${createSlug(entry.title)}`);
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => { setIsPressing(false); onDragStart(e, entry.malId); }}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      onPointerDown={startHold}
      onPointerMove={checkMoveCancel}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); }}
      style={{ animationDelay: `${index * 0.03}s`, animation: 'spring-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both' }}
      className={`bm-card ${isSelected ? 'selected' : ''} ${isPressing ? 'pressing' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      <div className="bm-check">
        <CheckSquare size={14} strokeWidth={isSelected ? 3 : 2} className={isSelected ? 'text-[#000]' : 'text-white/50'} />
      </div>

      {entry.cover ? (
        <img src={entry.cover} alt={entry.title} className="bm-card-img" draggable={false} loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/5 text-xs text-white/50">No Cover</div>
      )}

      <div className="bm-card-overlay">
        <div className="mb-1">
          <span className="px-1.5 py-[2px] rounded border border-white/20 bg-black/40 backdrop-blur-md text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">
            {entry.type || 'Anime'}
          </span>
        </div>
        <h3 className="bm-card-title">{entry.title}</h3>
        <div className="bm-card-meta">
          <span>{entry.year || new Date(entry.updatedAt).getFullYear()}</span>
        </div>
      </div>
    </div>
  );
};

const BookmarksPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Bookmarks';
  }, []);

  const { user } = useAuth();
  const navigate = useNavigate();

  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [activeTab, setActiveTab] = useState('uncategorized');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const ghostRef = useRef<HTMLDivElement>(null);

  const selectionMode = selectedIds.length > 0;

  const emptyImg = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    return img;
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return;
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${e.clientX + 15}px, ${e.clientY + 15}px)`;
    }
  }, []);

  useEffect(() => {
    const syncBookmarks = async () => {
      if (user) {
        const { data, error } = await supabase.from('anime_bookmarks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (!error && data) {
          setBookmarks(data.map((d: any) => ({
            malId: parseInt(d.mal_id, 10), title: d.title, cover: d.cover, type: d.type, status: d.status, score: d.score, author: d.author, updatedAt: new Date(d.created_at).getTime()
          })));
          return;
        }
      }
      setBookmarks(readBookmarks().filter(b => !b.type || b.type.toLowerCase().includes('anime') || b.type.toLowerCase() === 'tv' || b.type.toLowerCase() === 'movie'));
    };
    syncBookmarks();
  }, [user]);

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setBookmarks(prev => prev.map(b => selectedIds.includes(b.malId) ? { ...b, status: newStatus } : b));

    if (user) {
      await supabase.from('anime_bookmarks').update({ status: newStatus }).in('mal_id', selectedIds.map(String)).eq('user_id', user.id);
    } else {
      const updatedLocal = readBookmarks().map(b => selectedIds.includes(b.malId) ? { ...b, status: newStatus } : b);
      writeBookmarks(updatedLocal);
    }
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBookmarks(prev => prev.filter(b => !selectedIds.includes(b.malId)));

    if (user) {
      await supabase.from('anime_bookmarks').delete().in('mal_id', selectedIds.map(String)).eq('user_id', user.id);
    } else {
      selectedIds.forEach(id => removeBookmark(id));
    }
    setSelectedIds([]);
  };

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleLongPress = useCallback((id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setIsDragActive(true);
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${e.clientX + 15}px, ${e.clientY + 15}px)`;
      ghostRef.current.style.opacity = '1';
    }

    let idsToMove = selectedIds;
    if (!selectedIds.includes(id)) {
      idsToMove = selectedIds.length > 0 ? [...selectedIds, id] : [id];
      setSelectedIds(idsToMove);
    }

    if (emptyImg) {
      e.dataTransfer.setDragImage(emptyImg, 0, 0);
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(idsToMove));
  };

  const handleDragEnd = () => {
    setIsDragActive(false);
    setDragOverTab(null);
    if (ghostRef.current) {
      ghostRef.current.style.opacity = '0';
    }
  };

  const handleDrop = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    setIsDragActive(false);
    setDragOverTab(null);
    try {
      const ids = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (Array.isArray(ids) && ids.length > 0) {
        setSelectedIds(ids);
        handleBulkStatusChange(tabId);
      }
    } catch (err) { }
  };

  const displayedBookmarks = useMemo(() => {
    let result = [...bookmarks].filter(b => getNormalizedStatus(b.status) === activeTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b => b.title.toLowerCase().includes(q));
    }
    result.sort((a, b) => b.updatedAt - a.updatedAt);
    return result;
  }, [bookmarks, activeTab, searchQuery]);

  useEffect(() => {
    const id = 'bm-design-styles';
    if (!document.getElementById(id)) {
      const tag = document.createElement('style');
      tag.id = id; tag.textContent = DESIGN_STYLES; document.head.appendChild(tag);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  // Tabs to show in dock = all except current active
  const dockTabs = TABS.filter(t => t.id !== activeTab);

  return (
    <div className={`bm-root ${selectionMode ? 'selection-mode' : ''}`}>
      <div className="bm-container">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
          <div>
            <h1 className="bm-header-title">My List</h1>
            <p className="bm-header-subtitle text-white/50 mt-2 text-sm md:text-base">
              Hold a card to select.
              <span className="hidden md:inline"> Drag cards to organize.</span>
            </p>
          </div>
        </div>

        {/* ── Unified Search & Tabs Row ── */}
        <div className="flex items-center gap-3 mb-6 relative z-20 w-full overflow-x-auto no-scrollbar pb-3 pt-1" style={{ WebkitOverflowScrolling: 'touch' }}>

          {/* Search — same glass panel as tabs */}
          <div className={`bm-glass-panel bm-search-wrap shrink-0 w-[220px] md:w-[490px] ${searchQuery ? 'has-value' : ''}`}>
            <div className="bm-search-inner w-full">
              <Search className="bm-search-icon" size={17} />
              <input
                type="text"
                placeholder="Search collection…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bm-search-input"
              />
              <button
                className="bm-search-clear"
                onClick={() => setSearchQuery('')}
                tabIndex={-1}
                aria-label="Clear search"
              >
                <X size={11} strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className={`bm-glass-panel bm-tabs-wrapper flex-nowrap shrink-0 ${isDragActive ? 'is-dragging-active' : ''}`}>
            {TABS.map(tab => {
              const count = bookmarks.filter(b => getNormalizedStatus(b.status) === tab.id).length;
              const isDragOver = dragOverTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  onDragOver={(e) => { e.preventDefault(); if (tab.id !== activeTab) setDragOverTab(tab.id); }}
                  onDragEnter={(e) => { e.preventDefault(); if (tab.id !== activeTab) setDragOverTab(tab.id); }}
                  onDragLeave={() => setDragOverTab(null)}
                  onDrop={(e) => handleDrop(e, tab.id)}
                  className={`bm-tab ${activeTab === tab.id ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
                >
                  <tab.icon size={16} className="text-current relative z-10 pointer-events-none hidden sm:block" />
                  <span className="relative z-10 pointer-events-none">{tab.label}</span>
                  <span className="bm-badge relative z-10 pointer-events-none">{count}</span>
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="bmTabIndicator"
                      className="absolute inset-0 rounded-[18px] bg-[color-mix(in_srgb,var(--app-accent),transparent_80%)] shadow-[0_8px_20px_rgba(0,0,0,0.2),inset_0_0_0_1px_color-mix(in_srgb,var(--app-accent),transparent_50%)] -z-10 pointer-events-none"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        {displayedBookmarks.length > 0 ? (
          <div className="bm-grid">
            {displayedBookmarks.map((entry, index) => (
              <BookmarkCard
                key={entry.malId}
                entry={entry}
                navigate={navigate}
                index={index}
                isSelected={selectedIds.includes(entry.malId)}
                selectionMode={selectionMode}
                onToggleSelect={toggleSelect}
                onLongPress={handleLongPress}
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                isDragging={isDragActive && selectedIds.includes(entry.malId)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center opacity-60">
            <Library size={48} className="mb-4 text-white/40" />
            <h3 className="text-xl font-bold mb-2">No series found</h3>
            <p className="text-sm text-white/60">Try exploring and adding some to your library.</p>
          </div>
        )}
      </div>



      {/* Custom Delayed Drag Ghost Stack (Desktop only) */}
      <div
        ref={ghostRef}
        className="bm-drag-ghost pointer-events-none fixed z-[99999]"
        style={{
          transform: 'translate(-1000px, -1000px)',
          opacity: 0,
          transition: 'transform 0.08s linear'
        }}
      >
        <div className="relative w-24 h-36">
          {bookmarks.filter(b => selectedIds.includes(b.malId)).slice(0, 3).map((item, idx) => (
            <img
              key={item.malId}
              src={item.cover}
              className="absolute inset-0 w-full h-full object-cover rounded-[10px] shadow-2xl"
              style={{
                transform: `rotate(${idx * 6 - 6}deg) translate(${idx * 6}px, ${idx * 6}px)`,
                zIndex: 3 - idx
              }}
            />
          ))}
          {selectedIds.length > 3 && (
            <div className="absolute -top-3 -right-3 z-10 bg-[var(--app-accent)] text-black font-black text-xs px-2.5 py-1 rounded-full shadow-lg">
              +{selectedIds.length - 3}
            </div>
          )}
        </div>
      </div>

      {/* Premium Full-width Bottom Drag-to-Delete Zone (Desktop only) */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragOverTab('trash'); }}
        onDragOver={(e) => { e.preventDefault(); setDragOverTab('trash'); }}
        onDragLeave={() => setDragOverTab(null)}
        onDrop={(e) => {
          e.preventDefault();
          if (selectedIds.length > 0) handleBulkDelete();
          setIsDragActive(false);
          setDragOverTab(null);
        }}
        className={`hidden md:flex fixed bottom-0 left-0 right-0 h-56 z-[100] items-end justify-center transition-all duration-300
          ${isDragActive ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}
        `}
      >
        <div className={`relative w-full max-w-2xl h-32 rounded-t-[40px] border-t border-x flex flex-col items-center justify-center transition-all duration-300 overflow-hidden pointer-events-none
          ${dragOverTab === 'trash' ? 'bg-red-950/90 border-red-500/50 shadow-[0_-15px_40px_rgba(239,68,68,0.2)] scale-[1.02] origin-bottom' : 'bg-black/90 border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl'}
        `}>
          <div className={`absolute inset-0 opacity-50 transition-opacity duration-300 ${dragOverTab === 'trash' ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-500/20 via-transparent to-transparent' : 'hidden'}`}></div>
          <Trash2 size={36} className={`mb-2 z-10 transition-all duration-300 ${dragOverTab === 'trash' ? 'scale-110 text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.5)]' : 'text-white/30'}`} />
          <span className={`z-10 font-black tracking-[0.25em] uppercase text-sm transition-colors duration-300 ${dragOverTab === 'trash' ? 'text-red-100' : 'text-white/30'}`}>Drop Here to Delete</span>
        </div>
      </div>
    </div>
  );
};

export default BookmarksPage;
/* --- END OF FILE BookmarksPage.tsx --- */
