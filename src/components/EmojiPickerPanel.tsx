"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Search, Sparkles, X, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { EMOJI_CATEGORIES } from "@/data/emoji-categories";

interface EmojiSticker {
  custom_emoji_id: string;
  emoji: string;
  file_id: string;
  thumb_file_id: string | null;
}
interface StickerSet {
  name: string;
  title: string;
  sticker_type: string;
  stickers: EmojiSticker[];
}

interface Props {
  botId: string;
  onSelect: (emoji: string, customEmojiId?: string, thumbFileId?: string | null) => void;
  onClose: () => void;
}

const PREMIUM_TAB = "__premium__";

function storageKey(botId: string) { return `icebot_packs_${botId}`; }
function loadPacks(botId: string): StickerSet[] {
  try { return JSON.parse(localStorage.getItem(storageKey(botId)) ?? "[]"); } catch { return []; }
}
function savePacks(botId: string, packs: StickerSet[]) {
  localStorage.setItem(storageKey(botId), JSON.stringify(packs));
}

export function EmojiPickerPanel({ botId, onSelect, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(EMOJI_CATEGORIES[0].id);
  const [search, setSearch] = useState("");

  // Premium packs
  const [packs, setPacks] = useState<StickerSet[]>([]);
  const [activePack, setActivePack] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState(false);
  const [showAddPack, setShowAddPack] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const tabsRef = useRef<HTMLDivElement>(null);

  // Load persisted packs on mount
  useEffect(() => {
    const stored = loadPacks(botId);
    if (stored.length > 0) {
      setPacks(stored);
      setActivePack(stored[0].name);
      setDiscovered(true);
    }
  }, [botId]);

  // Auto-discover when premium tab first opened and no packs loaded
  useEffect(() => {
    if (activeTab !== PREMIUM_TAB || discovered || discovering) return;
    discover();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function discover() {
    setDiscovering(true);
    try {
      const res = await fetch(`/api/bots/${botId}/sticker-sets/discover`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.packs) && data.packs.length > 0) {
        const merged = mergePacks(packs, data.packs);
        setPacks(merged);
        savePacks(botId, merged);
        setActivePack(merged[0].name);
      }
    } catch {
      // silently fail — user can add manually
    } finally {
      setDiscovering(false);
      setDiscovered(true);
    }
  }

  function mergePacks(existing: StickerSet[], incoming: StickerSet[]): StickerSet[] {
    const names = new Set(existing.map((p) => p.name));
    return [...existing, ...incoming.filter((p) => !names.has(p.name))];
  }

  const isSearching = search.trim().length > 0;
  const isPremium = activeTab === PREMIUM_TAB;
  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeTab);
  const currentPack = packs.find((p) => p.name === activePack) ?? null;

  const searchResults = isSearching
    ? EMOJI_CATEGORIES.flatMap((c) => c.emoji).filter((e) => e.includes(search.trim())).slice(0, 80)
    : [];

  useEffect(() => {
    const el = tabsRef.current?.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement | null;
    el?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [activeTab]);

  const navigateCategory = useCallback((dir: 1 | -1) => {
    const ids = EMOJI_CATEGORIES.map((c) => c.id);
    const idx = ids.indexOf(activeTab);
    const next = ids[idx + dir];
    if (next) setActiveTab(next);
  }, [activeTab]);

  const navigatePack = useCallback((dir: 1 | -1) => {
    const idx = packs.findIndex((p) => p.name === activePack);
    const next = packs[idx + dir];
    if (next) setActivePack(next.name);
  }, [packs, activePack]);

  async function addPack() {
    const raw = addQuery.trim();
    if (!raw) return;
    const match = raw.match(/(?:t\.me\/addemoji\/|t\.me\/addstickers\/)([^\s/?]+)/i);
    const name = match ? match[1] : raw;
    if (packs.find((p) => p.name === name)) {
      setActivePack(name); setShowAddPack(false); setAddQuery(""); return;
    }
    setAddLoading(true); setAddError("");
    try {
      const res = await fetch(`/api/bots/${botId}/sticker-sets?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const next = [...packs, data as StickerSet];
      setPacks(next); savePacks(botId, next);
      setActivePack(data.name); setShowAddPack(false); setAddQuery("");
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Pack não encontrado");
    } finally {
      setAddLoading(false);
    }
  }

  function removePack(name: string) {
    const next = packs.filter((p) => p.name !== name);
    setPacks(next); savePacks(botId, next);
    setActivePack(next[0]?.name ?? null);
  }

  return (
    <div className="border border-zinc-200 rounded-xl bg-white shadow-lg overflow-hidden select-none">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 bg-zinc-50">
        <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <input
          type="text"
          placeholder="Pesquisar emoji..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value && activeTab === PREMIUM_TAB) setActiveTab(EMOJI_CATEGORIES[0].id);
          }}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category tabs */}
      <div ref={tabsRef} className="flex items-center gap-0.5 px-2 py-1.5 border-b border-zinc-100 overflow-x-auto scrollbar-hide">
        {EMOJI_CATEGORIES.map((cat) => (
          <button key={cat.id} data-tab={cat.id}
            onClick={() => { setActiveTab(cat.id); setSearch(""); }}
            className={`shrink-0 w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors ${
              activeTab === cat.id && !isSearching ? "bg-blue-100" : "hover:bg-zinc-100"
            }`}
          >{cat.icon}</button>
        ))}
        <div className="w-px h-5 bg-zinc-200 mx-1 shrink-0" />
        <button data-tab={PREMIUM_TAB}
          onClick={() => { setActiveTab(PREMIUM_TAB); setSearch(""); }}
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative ${
            activeTab === PREMIUM_TAB && !isSearching ? "bg-violet-100 text-violet-600" : "hover:bg-zinc-100 text-violet-500"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          {discovering && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-violet-500 rounded-full animate-ping" />}
        </button>
      </div>

      {/* Content */}
      <div className="h-52 overflow-y-auto overflow-x-hidden p-1.5">

        {/* Search */}
        {isSearching && (
          searchResults.length > 0
            ? <div className="grid grid-cols-8 gap-0.5">{searchResults.map((e, i) => <EmojiBtn key={i} emoji={e} onSelect={() => onSelect(e)} />)}</div>
            : <EmptyMsg>Nenhum resultado</EmptyMsg>
        )}

        {/* Standard category */}
        {!isSearching && !isPremium && currentCategory && (
          <>
            <p className="text-xs text-zinc-400 font-medium px-1 mb-1">{currentCategory.label}</p>
            <div className="grid grid-cols-8 gap-0.5">
              {currentCategory.emoji.map((e, i) => <EmojiBtn key={i} emoji={e} onSelect={() => onSelect(e)} />)}
            </div>
          </>
        )}

        {/* Premium */}
        {!isSearching && isPremium && (
          <div className="space-y-2">
            {/* Pack tabs row */}
            {packs.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
                {packs.map((pack) => (
                  <button key={pack.name} onClick={() => setActivePack(pack.name)}
                    className={`shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      activePack === pack.name ? "bg-violet-100 text-violet-700" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    <span className="truncate max-w-[80px]">{pack.title}</span>
                    <span onClick={(e) => { e.stopPropagation(); removePack(pack.name); }}
                      className="text-zinc-400 hover:text-red-500 ml-0.5 text-base leading-none">×</span>
                  </button>
                ))}
                <button onClick={() => setShowAddPack(true)}
                  className="shrink-0 w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500">
                  <Plus className="w-3 h-3" />
                </button>
                <button onClick={discover} disabled={discovering}
                  className="shrink-0 w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500"
                  title="Re-descobrir packs">
                  <RefreshCw className={`w-3 h-3 ${discovering ? "animate-spin" : ""}`} />
                </button>
              </div>
            )}

            {/* Loading state */}
            {discovering && packs.length === 0 && (
              <EmptyMsg>
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                  <span className="text-xs text-zinc-400">Buscando emojis premium...</span>
                </div>
              </EmptyMsg>
            )}

            {/* Add pack form */}
            {(showAddPack || (discovered && packs.length === 0)) && !discovering && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <input autoFocus type="text"
                    placeholder="Nome do pack ou t.me/addemoji/..."
                    value={addQuery}
                    onChange={(e) => setAddQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPack()}
                    className="flex-1 h-8 px-2.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-violet-400"
                  />
                  <button onClick={addPack} disabled={addLoading || !addQuery.trim()}
                    className="h-8 px-3 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded-lg disabled:opacity-40 flex items-center gap-1 transition-colors shrink-0">
                    {addLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Adicionar
                  </button>
                  {showAddPack && packs.length > 0 && (
                    <button onClick={() => { setShowAddPack(false); setAddError(""); setAddQuery(""); }}
                      className="h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {addError
                  ? <p className="text-xs text-red-600">Pack não encontrado — tente o link <code className="bg-zinc-100 px-1 rounded">t.me/addemoji/NomeDoPack</code></p>
                  : packs.length === 0 && (
                    <p className="text-xs text-zinc-400">
                      Busca automática não encontrou packs. Cole o nome ou link de um pack do Telegram.<br />
                      Dica: abra <strong>@Stickers</strong> no Telegram e copie o link de um pack de emoji.
                    </p>
                  )
                }
              </div>
            )}

            {/* Pack emoji grid */}
            {currentPack && !showAddPack && (
              <div className="grid grid-cols-8 gap-0.5">
                {currentPack.stickers.map((s) => (
                  <button key={s.custom_emoji_id}
                    onClick={() => onSelect(s.emoji, s.custom_emoji_id, s.thumb_file_id)}
                    title={s.emoji}
                    className="w-9 h-9 rounded-md hover:bg-violet-50 flex items-center justify-center transition-colors"
                  >
                    {s.thumb_file_id
                      ? <img src={`/api/bots/${botId}/tg-file?file_id=${s.thumb_file_id}`}
                          alt={s.emoji} className="w-7 h-7 object-contain" loading="lazy" />
                      : <span className="text-xl leading-none">{s.emoji}</span>
                    }
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-100 bg-zinc-50">
        <button
          onClick={() => isPremium ? navigatePack(-1) : navigateCategory(-1)}
          disabled={isPremium
            ? packs.findIndex((p) => p.name === activePack) <= 0
            : activeTab === EMOJI_CATEGORIES[0].id || isSearching}
          className="p-1 rounded-md hover:bg-zinc-200 text-zinc-400 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-zinc-400 font-medium">
          {isPremium ? (currentPack?.title ?? "Emojis Premium") : isSearching ? "Resultados" : currentCategory?.label}
        </span>
        <button
          onClick={() => isPremium ? navigatePack(1) : navigateCategory(1)}
          disabled={isPremium
            ? packs.findIndex((p) => p.name === activePack) >= packs.length - 1 || packs.length === 0
            : activeTab === EMOJI_CATEGORIES[EMOJI_CATEGORIES.length - 1].id || isSearching}
          className="p-1 rounded-md hover:bg-zinc-200 text-zinc-400 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function EmojiBtn({ emoji, onSelect }: { emoji: string; onSelect: () => void }) {
  return (
    <button onClick={onSelect}
      className="w-9 h-9 rounded-md hover:bg-zinc-100 flex items-center justify-center text-xl leading-none transition-colors">
      {emoji}
    </button>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center h-full text-sm text-zinc-400">{children}</div>;
}
