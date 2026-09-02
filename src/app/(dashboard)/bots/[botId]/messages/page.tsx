"use client";

import { use, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline, Strikethrough, Code, Smile,
  Plus, Trash2, Loader2, Check, X, Link as LinkIcon,
  ImageIcon, Video, Upload, Globe, RefreshCw, Pencil,
} from "lucide-react";
import { LANG_NAMES } from "@/lib/translate";

interface MediaItem {
  id: string;
  name: string;
  type: string;
  fileId: string | null;
  url: string | null;
}

interface RedirectButton {
  text: string;
  url: string;
  enabled: boolean;
}

interface WelcomeMessage {
  id: string;
  trigger: string | null;
  content: string;
  parseMode: string;
  buttons: string | null;
  translations: string | null;
  mediaIds: string | null;
  secondaryContent: string | null;
  secondaryEnabled: boolean;
  ctaEnabled: boolean;
  dynamicMedia: boolean;
  miniAppEnabled: boolean;
}

interface TranslationEntry {
  content: string;
  auto?: boolean;
  updatedAt?: string;
}

const VARIABLES = [
  { key: "{nome}", label: "{nome}" },
  { key: "{email}", label: "{email}" },
  { key: "{telefone}", label: "{telefone}" },
  { key: "{estado}", label: "{estado}" },
  { key: "{uf}", label: "{uf}" },
  { key: "{cidade}", label: "{cidade}" },
  { key: "{localizacao}", label: "{localizacao}" },
  { key: "{saudacao}", label: "{saudacao}" },
  { key: "{bot.nome}", label: "{bot.nome}" },
  { key: "{bot.username}", label: "{bot.username}" },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex w-10 h-5 rounded-full transition-colors shrink-0 ${enabled ? "bg-blue-500" : "bg-zinc-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
    </button>
  );
}

function SideCard({ title, description, enabled, onToggle, badge, children }: {
  title: string; description: string; enabled: boolean; onToggle: (v: boolean) => void;
  badge?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-white truncate">{title}</span>
          {badge}
        </div>
        <Toggle enabled={enabled} onChange={onToggle} />
      </div>
      <p className="text-xs text-zinc-500 mb-3">{description}</p>
      {enabled && children}
    </div>
  );
}

export default function WelcomePage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const secondaryRef = useRef<HTMLTextAreaElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msgId, setMsgId] = useState<string | null>(null);

  // Content
  const [content, setContent] = useState("");
  const [parseMode, setParseMode] = useState("MarkdownV2");

  // Media
  const [mediaSlots, setMediaSlots] = useState<(MediaItem | null)[]>([null, null, null]);
  const [dynamicMedia, setDynamicMedia] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [pickingSlot, setPickingSlot] = useState<number>(0);
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [botToken, setBotToken] = useState<string | null>(null);

  // Translations
  const [translations, setTranslations] = useState<Record<string, TranslationEntry>>({});
  const [editingLang, setEditingLang] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [translatingLang, setTranslatingLang] = useState<string | null>(null);
  const [addLangOpen, setAddLangOpen] = useState(false);

  // Right panel
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  const [secondaryContent, setSecondaryContent] = useState("");
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [redirectButtons, setRedirectButtons] = useState<RedirectButton[]>([
    { text: "", url: "", enabled: true },
  ]);
  const [miniAppEnabled, setMiniAppEnabled] = useState(false);

  useEffect(() => {
    setLoadError(null);
    Promise.all([
      fetch(`/api/bots/${botId}/messages`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        return data;
      }),
      fetch(`/api/bots/${botId}/media`).then((r) => r.json()).catch(() => []),
      fetch(`/api/bots/${botId}`).then((r) => r.json()).catch(() => null),
    ]).then(([msgs, med, bot]) => {
      const welcome: WelcomeMessage | undefined = Array.isArray(msgs)
        ? msgs.find((m: WelcomeMessage) => m.trigger === "welcome" || m.trigger === "start")
        : undefined;

      if (welcome) {
        setMsgId(welcome.id);
        setContent(welcome.content ?? "");
        setParseMode(welcome.parseMode ?? "MarkdownV2");
        setSecondaryEnabled(welcome.secondaryEnabled ?? false);
        setSecondaryContent(welcome.secondaryContent ?? "");
        setCtaEnabled(welcome.ctaEnabled ?? false);
        setDynamicMedia(welcome.dynamicMedia ?? false);
        setMiniAppEnabled(welcome.miniAppEnabled ?? false);
        if (welcome.translations) {
          try { setTranslations(JSON.parse(welcome.translations)); } catch {}
        }

        if (welcome.buttons) {
          try { setRedirectButtons(JSON.parse(welcome.buttons)); } catch {}
        }
        if (welcome.mediaIds) {
          try {
            const ids: string[] = JSON.parse(welcome.mediaIds);
            const slots: (MediaItem | null)[] = [null, null, null];
            ids.forEach((fid, i) => {
              const found = Array.isArray(med) ? med.find((m: MediaItem) => m.fileId === fid || m.id === fid) : null;
              if (i < 3) slots[i] = found ?? null;
            });
            setMediaSlots(slots);
          } catch {}
        }
      }

      if (Array.isArray(med)) setMediaLibrary(med.filter((m: MediaItem) => m.type === "photo" || m.type === "video"));
      if (bot?.token) setBotToken(bot.token);
    }).catch((err: Error) => {
      setLoadError(err.message);
    }).finally(() => setLoading(false));
  }, [botId]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const mediaIds = mediaSlots.filter(Boolean).map((m) => m!.fileId ?? m!.id);
    const body = {
      name: "Boas-vindas",
      trigger: "welcome",
      content,
      parseMode,
      buttons: JSON.stringify(redirectButtons),
      mediaIds,
      secondaryContent,
      secondaryEnabled,
      ctaEnabled,
      dynamicMedia,
      miniAppEnabled,
    };

    try {
      if (msgId) {
        const res = await fetch(`/api/bots/${botId}/messages/${msgId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error ?? "Erro ao salvar");
        }
      } else {
        const res = await fetch(`/api/bots/${botId}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error ?? "Erro ao criar mensagem");
        }
        const data = await res.json();
        if (data.id) setMsgId(data.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/bots/${botId}/media`, { method: "POST", body: fd });
      const data: MediaItem = await res.json();
      if (data.id) {
        setMediaLibrary((prev) => [data, ...prev]);
        setMediaSlots((prev) => prev.map((s, j) => j === pickingSlot ? data : s));
        setShowMediaPicker(false);
      }
    } finally {
      setUploading(false);
    }
  }

  function insertFormat(ref: React.RefObject<HTMLTextAreaElement | null>, setter: (v: string) => void, before: string, after: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const selected = val.slice(start, end);
    const newVal = val.slice(0, start) + before + selected + after + val.slice(end);
    setter(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }

  function insertVariable(key: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const val = el.value;
    const newVal = val.slice(0, start) + key + val.slice(start);
    setContent(newVal);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + key.length, start + key.length); }, 0);
  }

  async function handleTranslateLang(lang: string) {
    if (!msgId) return;
    setTranslatingLang(lang);
    try {
      const res = await fetch(`/api/bots/${botId}/messages/${msgId}/translations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, auto: true }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTranslations(updated);
      }
    } finally {
      setTranslatingLang(null);
    }
  }

  async function handleSaveTranslation(lang: string) {
    if (!msgId) return;
    const res = await fetch(`/api/bots/${botId}/messages/${msgId}/translations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, content: editingContent }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTranslations(updated);
    }
    setEditingLang(null);
  }

  async function handleDeleteTranslation(lang: string) {
    if (!msgId) return;
    const res = await fetch(`/api/bots/${botId}/messages/${msgId}/translations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang }),
    });
    if (res.ok) setTranslations((prev) => { const n = { ...prev }; delete n[lang]; return n; });
  }

  function updateRedirectButton(i: number, field: keyof RedirectButton, value: string | boolean) {
    setRedirectButtons((prev) => prev.map((b, j) => j === i ? { ...b, [field]: value } : b));
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>;
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-400 text-sm font-mono bg-red-950/50 px-4 py-2 rounded-lg">{loadError}</p>
        <button onClick={() => window.location.reload()} className="text-xs text-zinc-500 hover:text-white underline">
          Recarregar página
        </button>
      </div>
    );
  }

  const filledSlots = mediaSlots.filter(Boolean).length;

  return (
    <div className="bg-zinc-950 min-h-full text-white">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-6 py-3 bg-zinc-900 border-b border-zinc-800 text-sm">
        <span className="text-zinc-400">0 PIX gerados</span>
        <span className="text-zinc-700">·</span>
        <span className="text-zinc-400">0 pagos</span>
        <span className="text-zinc-700">·</span>
        <span className="text-green-400 font-semibold">0% conversão</span>
        <span className="text-zinc-700">·</span>
        <span className="text-green-400 font-semibold">R$ 0,00</span>
        <div className="ml-auto flex items-center gap-3">
          {saveError && (
            <span className="text-xs text-red-400 bg-red-950/50 px-2 py-1 rounded max-w-xs truncate" title={saveError}>
              ⚠ {saveError}
            </span>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}
            className={saved ? "bg-green-600 hover:bg-green-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="flex gap-0 h-full">
        {/* ── Left panel ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 p-6 space-y-5 overflow-y-auto">

          {/* Media slots */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium">Mídias</span>
                <span className="text-xs text-zinc-500">Adicione até 3 mídias</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => {
                const slot = mediaSlots[i];
                return (
                  <div key={i} className="aspect-video bg-zinc-800 rounded-lg relative overflow-hidden border border-zinc-700">
                    {slot ? (
                      <>
                        {slot.type === "photo" && botToken && slot.fileId ? (
                          <TgThumb fileId={slot.fileId} token={botToken} />
                        ) : slot.type === "video" ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-8 h-8 text-zinc-500" />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-zinc-500" />
                          </div>
                        )}
                        <button
                          onClick={() => setMediaSlots((prev) => prev.map((s, j) => j === i ? null : s))}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                        <button className="absolute top-1.5 left-1.5 w-6 h-6 rounded bg-black/40 flex items-center justify-center text-zinc-400 cursor-grab">
                          ⠿
                        </button>
                        <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded capitalize">
                          {slot.type === "video" ? <><Video className="w-2.5 h-2.5 inline mr-0.5" />vídeo</> : "foto"}
                        </span>
                      </>
                    ) : i < filledSlots + 1 ? (
                      <button
                        onClick={() => { setPickingSlot(i); setShowMediaPicker(true); }}
                        className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-xs">Adicionar mídia</span>
                        <span className="text-[10px] text-zinc-600">({i + 1}/3)</span>
                      </button>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <Plus className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <Toggle enabled={dynamicMedia} onChange={setDynamicMedia} />
              <span className="text-sm text-zinc-300">Mídia Dinâmica</span>
              <span className="text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded font-medium">NOVO</span>
            </div>
          </div>

          {/* Message editor */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-sm font-medium">Mensagem de Boas-vindas <span className="text-red-400">*</span></span>
              <select
                value={parseMode}
                onChange={(e) => setParseMode(e.target.value)}
                className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none"
              >
                <option value="MarkdownV2">MarkdownV2</option>
                <option value="Markdown">Markdown</option>
                <option value="HTML">HTML</option>
                <option value="plain">Texto simples</option>
              </select>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-3 pb-2 border-b border-zinc-800">
              {[
                { icon: Bold, before: "*", after: "*", title: "Negrito" },
                { icon: Italic, before: "_", after: "_", title: "Itálico" },
                { icon: Underline, before: "__", after: "__", title: "Sublinhado" },
                { icon: Strikethrough, before: "~", after: "~", title: "Tachado" },
                { icon: Code, before: "`", after: "`", title: "Código" },
              ].map(({ icon: Icon, before, after, title }) => (
                <button
                  key={title}
                  title={title}
                  onClick={() => insertFormat(textareaRef, setContent, before, after)}
                  className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
              <div className="w-px h-4 bg-zinc-700 mx-1" />
              <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors" title="Emoji">
                <Smile className="w-3.5 h-3.5" />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva sua mensagem de boas-vindas..."
              rows={12}
              maxLength={4000}
              className="w-full bg-transparent px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none font-mono leading-relaxed"
            />

            <div className="px-4 pb-2 flex items-center justify-between">
              <span className="text-xs text-zinc-600">{content.length}/4000 caracteres</span>
            </div>
          </div>

          {/* Variables */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 mb-2">Variáveis Disponíveis (clique para inserir)</p>
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => insertVariable(key)}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-2.5 py-1 rounded-md border border-zinc-700 transition-colors font-mono"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────────────────── */}
        <div className="w-80 shrink-0 p-4 space-y-3 overflow-y-auto border-l border-zinc-800 bg-zinc-950">

          {/* Secondary message */}
          <SideCard
            title="Mensagem Secundária"
            description="Mensagem separada onde os botões serão enviados"
            enabled={secondaryEnabled}
            onToggle={setSecondaryEnabled}
          >
            <textarea
              ref={secondaryRef}
              value={secondaryContent}
              onChange={(e) => setSecondaryContent(e.target.value)}
              placeholder="Mensagem secundária..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
            />
          </SideCard>

          {/* CTA button */}
          <SideCard
            title="Botão CTA"
            description="Botão de chamada para ação"
            enabled={ctaEnabled}
            onToggle={setCtaEnabled}
          >
            <input
              placeholder="Texto do botão"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
            />
            <div className="relative">
              <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                placeholder="https://..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </SideCard>

          {/* Redirect buttons */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-start justify-between mb-1">
              <div>
                <span className="text-sm font-medium text-white">Botões Redirect </span>
                <span className="text-xs text-zinc-500">{redirectButtons.length}/3</span>
              </div>
              {redirectButtons.length < 3 && (
                <button
                  onClick={() => setRedirectButtons((prev) => [...prev, { text: "", url: "", enabled: true }])}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  + Adicionar
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500 mb-3">Botões que redirecionam para links externos (até 3)</p>

            <div className="space-y-3">
              {redirectButtons.map((btn, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Botão {i + 1}</span>
                    <div className="flex items-center gap-2">
                      <Toggle enabled={btn.enabled} onChange={(v) => updateRedirectButton(i, "enabled", v)} />
                      {redirectButtons.length > 1 && (
                        <button onClick={() => setRedirectButtons((prev) => prev.filter((_, j) => j !== i))}
                          className="text-zinc-600 hover:text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    value={btn.text}
                    onChange={(e) => updateRedirectButton(i, "text", e.target.value)}
                    placeholder="Texto do botão"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="relative">
                    <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      value={btn.url}
                      onChange={(e) => updateRedirectButton(i, "url", e.target.value)}
                      placeholder="https://t.me/+xxx"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Translations */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-white">Traduções</span>
              </div>
              <button
                onClick={() => setAddLangOpen((v) => !v)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Adicionar
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Automáticas ao detectar o idioma. Edite para sobrescrever.
            </p>

            {addLangOpen && (
              <div className="mb-3">
                <select
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  defaultValue=""
                  onChange={(e) => {
                    const lang = e.target.value;
                    if (!lang) return;
                    setAddLangOpen(false);
                    handleTranslateLang(lang);
                  }}
                >
                  <option value="">Selecionar idioma…</option>
                  {Object.entries(LANG_NAMES)
                    .filter(([code]) => code !== "en" && !translations[code])
                    .map(([code, name]) => (
                      <option key={code} value={code}>{name} ({code})</option>
                    ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              {Object.entries(translations).map(([lang, entry]) => (
                <div key={lang} className="bg-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-white uppercase">{lang}</span>
                      <span className="text-xs text-zinc-400">{LANG_NAMES[lang] ?? lang}</span>
                      {entry.auto && (
                        <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">Auto</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        title="Retraduzir"
                        onClick={() => handleTranslateLang(lang)}
                        disabled={translatingLang === lang}
                        className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                      >
                        {translatingLang === lang
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <RefreshCw className="w-3 h-3" />}
                      </button>
                      <button
                        title="Editar"
                        onClick={() => { setEditingLang(lang); setEditingContent(entry.content); }}
                        className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        title="Remover"
                        onClick={() => handleDeleteTranslation(lang)}
                        className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {editingLang === lang ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={5}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveTranslation(lang)}
                          className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1.5"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingLang(null)}
                          className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 line-clamp-2 font-mono leading-relaxed">
                      {entry.content}
                    </p>
                  )}
                </div>
              ))}

              {Object.keys(translations).length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-2">
                  As traduções aparecem aqui quando usuários interagem com o bot.
                </p>
              )}
            </div>
          </div>

          {/* Mini App */}
          <SideCard
            title="Mini App"
            description="Abre uma experiência interativa dentro do Telegram. Aparece abaixo do CTA (se houver) ou antes dos planos."
            enabled={miniAppEnabled}
            onToggle={setMiniAppEnabled}
            badge={<span className="text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded font-medium">NOVO</span>}
          />
        </div>
      </div>

      {/* Hidden file input for direct upload */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />

      {/* Media picker modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowMediaPicker(false)}>
          <div className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[70vh] flex flex-col border border-zinc-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="font-semibold text-white">Mídia — slot {pickingSlot + 1}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? "Enviando..." : "Upload"}
                </button>
                <button onClick={() => setShowMediaPicker(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {mediaLibrary.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <ImageIcon className="w-10 h-10 text-zinc-700" />
                  <p className="text-zinc-500 text-sm text-center">Nenhuma mídia ainda.<br />Clique em Upload para enviar.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {mediaLibrary.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMediaSlots((prev) => prev.map((s, j) => j === pickingSlot ? item : s));
                        setShowMediaPicker(false);
                      }}
                      className="aspect-video rounded-lg bg-zinc-800 overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all relative"
                    >
                      {item.type === "photo" && botToken && item.fileId ? (
                        <TgThumb fileId={item.fileId} token={botToken} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-8 h-8 text-zinc-600" />
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded capitalize">{item.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TgThumb({ fileId, token }: { fileId: string; token: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSrc(`https://api.telegram.org/file/bot${token}/${d.result.file_path}`); })
      .catch(() => {});
  }, [fileId, token]);
  if (!src) return <Loader2 className="w-4 h-4 animate-spin text-zinc-600 m-auto" />;
  return <img src={src} alt="" className="w-full h-full object-cover" />;
}
