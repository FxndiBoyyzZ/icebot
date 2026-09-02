"use client";

import { use, useEffect, useState } from "react";
import { Copy, Check, Link2, Users, Plus, Trash2 } from "lucide-react";
import { LANG_NAMES } from "@/lib/translate";

interface SourceStat {
  source: string | null;
  _count: { source: number };
}

interface SavedLink {
  label: string;
  source: string;
  lang: string;
}

const PLATFORM_PRESETS = [
  { label: "Twitter / X — Bio",      source: "tw_bio",     emoji: "𝕏" },
  { label: "Twitter / X — Post",     source: "tw_post",    emoji: "𝕏" },
  { label: "Instagram — Bio",        source: "ig_bio",     emoji: "📸" },
  { label: "Instagram — Stories",    source: "ig_story",   emoji: "📸" },
  { label: "YouTube — Descrição",    source: "yt_desc",    emoji: "▶" },
  { label: "TikTok — Bio",           source: "tt_bio",     emoji: "🎵" },
  { label: "WhatsApp — Grupo",       source: "wa_group",   emoji: "💬" },
  { label: "Facebook — Grupo",       source: "fb_group",   emoji: "👥" },
  { label: "Reddit",                 source: "reddit",     emoji: "🔺" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
        copied
          ? "bg-green-600 text-white"
          : "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function buildLink(username: string, source: string, lang: string): string {
  const parts = [];
  if (lang && lang !== "auto") parts.push(lang);
  if (source) parts.push(source);
  const param = parts.join("_");
  return param ? `https://t.me/${username}?start=${param}` : `https://t.me/${username}`;
}

export default function LinksPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const [username, setUsername] = useState<string | null>(null);
  const [stats, setStats] = useState<SourceStat[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);

  // Generator form
  const [source, setSource] = useState("");
  const [lang, setLang] = useState("auto");
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([]);
  const [linkLabel, setLinkLabel] = useState("");

  useEffect(() => {
    fetch(`/api/bots/${botId}`).then(r => r.json()).then(d => {
      if (d.username) setUsername(d.username);
    });
    fetch(`/api/bots/${botId}/customers?page=1`).then(r => r.json()).then(d => {
      setStats(d.sources ?? []);
      setTotalCustomers(d.total ?? 0);
    });
    // Load saved links from localStorage
    try {
      const stored = localStorage.getItem(`icebot_links_${botId}`);
      if (stored) setSavedLinks(JSON.parse(stored));
    } catch {}
  }, [botId]);

  function saveLinks(links: SavedLink[]) {
    setSavedLinks(links);
    localStorage.setItem(`icebot_links_${botId}`, JSON.stringify(links));
  }

  function addLink() {
    if (!source.trim()) return;
    const newLink: SavedLink = {
      label: linkLabel || source,
      source: source.trim().toLowerCase().replace(/\s+/g, "_"),
      lang,
    };
    saveLinks([newLink, ...savedLinks.filter(l => l.source !== newLink.source)]);
    setSource("");
    setLinkLabel("");
  }

  function removeLink(src: string) {
    saveLinks(savedLinks.filter(l => l.source !== src));
  }

  function applyPreset(preset: typeof PLATFORM_PRESETS[0]) {
    setSource(preset.source);
    setLinkLabel(preset.label);
  }

  const generatedLink = username && source.trim()
    ? buildLink(username, source.trim().toLowerCase().replace(/\s+/g, "_"), lang)
    : null;

  const statMap = Object.fromEntries(stats.filter(s => s.source).map(s => [s.source, s._count.source]));

  return (
    <div className="bg-zinc-950 min-h-full text-white">
      <div className="flex items-center gap-4 px-6 py-3 bg-zinc-900 border-b border-zinc-800 text-sm">
        <Link2 className="w-4 h-4 text-zinc-400" />
        <span className="text-zinc-400">{totalCustomers.toLocaleString()} clientes rastreados</span>
        {!username && (
          <span className="text-yellow-400 text-xs">⚠ Bot sem @username — configure no BotFather</span>
        )}
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* ── Left: generator ── */}
        <div className="space-y-5">

          {/* Presets */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 mb-3">Selecione uma plataforma ou crie seu próprio:</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_PRESETS.map(p => (
                <button
                  key={p.source}
                  onClick={() => applyPreset(p)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    source === p.source
                      ? "border-blue-500 bg-blue-600/20 text-blue-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {p.emoji} {p.label.split(" — ")[0]}
                  <span className="text-zinc-600 ml-1">— {p.label.split(" — ")[1]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-medium">Configurar link</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Nome da origem *</label>
                <input
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  placeholder="ex: tw_bio, ig_story"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <p className="text-[10px] text-zinc-600 mt-1">Só letras, números e _</p>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Label (opcional)</label>
                <input
                  value={linkLabel}
                  onChange={e => setLinkLabel(e.target.value)}
                  placeholder="Twitter Bio"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Idioma forçado</label>
              <select
                value={lang}
                onChange={e => setLang(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="auto">Automático (detecta pelo Telegram)</option>
                {Object.entries(LANG_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>{name} ({code})</option>
                ))}
              </select>
            </div>

            {/* Preview */}
            {generatedLink ? (
              <div className="bg-zinc-800 rounded-lg p-3">
                <p className="text-xs text-zinc-500 mb-2">Link gerado:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-blue-400 font-mono break-all">{generatedLink}</code>
                  <CopyButton text={generatedLink} />
                </div>
              </div>
            ) : (
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center text-xs text-zinc-600">
                {!username ? "Configure o @username do bot para gerar links" : "Preencha a origem para ver o link"}
              </div>
            )}

            <button
              onClick={addLink}
              disabled={!source.trim() || !username}
              className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Salvar link
            </button>
          </div>

          {/* Saved links */}
          {savedLinks.length > 0 && (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-medium">Links salvos</h3>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {savedLinks.map(link => {
                  const url = username ? buildLink(username, link.source, link.lang) : "";
                  const clicks = statMap[link.source] ?? 0;
                  return (
                    <div key={link.source} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-white truncate">{link.label}</span>
                          {link.lang !== "auto" && (
                            <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded font-mono">{link.lang}</span>
                          )}
                        </div>
                        <code className="text-[11px] text-zinc-500 font-mono truncate block">{url}</code>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {clicks > 0 && (
                          <div className="flex items-center gap-1 text-xs text-zinc-400">
                            <Users className="w-3 h-3" />
                            {clicks}
                          </div>
                        )}
                        {url && <CopyButton text={url} />}
                        <button
                          onClick={() => removeLink(link.source)}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: stats ── */}
        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-medium">Origens ativas</h3>
            </div>

            {stats.filter(s => s.source).length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-zinc-600">
                Nenhum cliente rastreado ainda.<br />
                Compartilhe os links acima para começar.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {stats
                  .filter(s => s.source)
                  .sort((a, b) => b._count.source - a._count.source)
                  .map(s => {
                    const pct = totalCustomers > 0 ? Math.round((s._count.source / totalCustomers) * 100) : 0;
                    return (
                      <div key={s.source} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <code className="text-xs font-mono text-zinc-200">{s.source}</code>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400">{s._count.source} clientes</span>
                            <span className="text-[10px] text-zinc-600">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                <div className="px-4 py-3 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Sem origem (direto)</span>
                    <span>{totalCustomers - stats.reduce((a, s) => a + s._count.source, 0)} clientes</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
