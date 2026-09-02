"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TelegramPreview } from "@/components/preview/TelegramPreview";
import {
  ArrowLeft, Send, Save, Pencil, Trash2, Plus, Bold, Italic, Code,
  Link2, Loader2, Clock, ExternalLink, ImageIcon, Video, X, Upload, Globe, Sparkles, RefreshCw,
  EyeOff, Smile, Check,
} from "lucide-react";
import Link from "next/link";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
import { SUPPORTED_LANGUAGES, getLanguage } from "@/data/languages";

interface InlineButton {
  text: string;
  url: string;
  style?: "primary" | "success" | "danger";
  icon_custom_emoji_id?: string;
  icon_emoji?: string;
  icon_thumb?: string;
}
interface ChannelPost {
  id: string;
  content: string;
  parseMode: string;
  buttons: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  status: string;
  telegramMsgId: number | null;
  sentAt: string | null;
  createdAt: string;
}
interface Channel {
  id: string;
  title: string;
  username: string | null;
  chatId: string;
  language: string | null;
  botIsAdmin: boolean;
}

const statusBadge: Record<string, { label: string; variant: "default" | "success" | "secondary" | "warning" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  sent: { label: "Enviado", variant: "success" },
  edited: { label: "Editado", variant: "default" },
  received: { label: "Do Telegram", variant: "warning" },
};

export default function ChannelPage({ params }: { params: Promise<{ botId: string; channelId: string }> }) {
  const { botId, channelId } = use(params);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Editor
  const [content, setContent] = useState("");
  const [parseMode, setParseMode] = useState("MarkdownV2");
  const [buttons, setButtons] = useState<InlineButton[][]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingIsPhoto, setEditingIsPhoto] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [customEmojiMap, setCustomEmojiMap] = useState<Record<string, { id: string; thumb: string | null }>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [emojiPickerForBtn, setEmojiPickerForBtn] = useState<{ ri: number; bi: number } | null>(null);

  // ── Translations ─────────────────────────────────────────────────────────
  const [activeLang, setActiveLang] = useState("default");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [channelTranslations, setChannelTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Set<string>>(new Set());
  const [previewLang, setPreviewLang] = useState("default");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: { language: string | null }[] } | null>(null);
  const [allChannels, setAllChannels] = useState<{ id: string; language: string | null; title: string }[]>([]);

  // Imagem
  const [imageMode, setImageMode] = useState<"none" | "upload" | "url">("none");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFilePreview, setImageFilePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [fileMediaType, setFileMediaType] = useState<"photo" | "video">("photo");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const previewMediaUrl = imageMode === "upload" ? imageFilePreview : imageMode === "url" ? imageUrl : null;
  const previewMediaType: "photo" | "video" = imageMode === "upload" ? fileMediaType : "photo";
  const hasMedia = imageMode !== "none" && (imageFile !== null || imageUrl.trim() !== "");

  const parsedButtons = useCallback(
    () => buttons.map((row) => row.filter((b) => b.text && b.url)).filter((r) => r.length > 0),
    [buttons]
  );

  const activeLangs = Object.keys(channelTranslations);
  const currentContent = activeLang === "default" ? content : (channelTranslations[activeLang] ?? "");
  const previewContent = previewLang === "default" ? content : (channelTranslations[previewLang] ?? content);

  function setCurrentContent(val: string) {
    if (activeLang === "default") {
      setContent(val);
    } else {
      setChannelTranslations((prev) => ({ ...prev, [activeLang]: val }));
    }
  }

  async function translateLangs(langs: string[]) {
    if (!content.trim() || langs.length === 0) return;
    setTranslating(new Set(langs));
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targetLangs: langs, parseMode }),
      });
      const data = await res.json();
      if (data.translations) {
        setChannelTranslations((prev) => ({
          ...prev,
          ...(data.translations as Record<string, string>),
        }));
      }
    } catch (e) {
      console.error("Translation error:", e);
    } finally {
      setTranslating(new Set());
    }
  }

  function addLanguage(code: string) {
    setChannelTranslations((prev) => ({ ...prev, [code]: "" }));
    setActiveLang(code);
    setShowLangPicker(false);
  }

  function removeLanguage(code: string) {
    setChannelTranslations((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    if (activeLang === code) setActiveLang("default");
    if (previewLang === code) setPreviewLang("default");
  }

  const availableToAdd = SUPPORTED_LANGUAGES.filter((l) => !channelTranslations[l.code]);
  const isTranslatingAny = translating.size > 0;

  useEffect(() => {
    Promise.all([
      fetch(`/api/bots/${botId}/channels`).then((r) => r.json()),
      fetch(`/api/bots/${botId}/channels/${channelId}/posts`).then((r) => r.json()),
    ]).then(([channels, postsData]) => {
      setChannel(channels.find((c: Channel) => c.id === channelId) ?? null);
      setAllChannels(channels);
      setPosts(postsData);
      setLoadingPosts(false);
    });
  }, [botId, channelId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setFileMediaType(file.type.startsWith("video/") ? "video" : "photo");
    setImageFilePreview(URL.createObjectURL(file));
    setImageMode("upload");
  }

  function clearImage() {
    setImageFile(null);
    setImageFilePreview(null);
    setImageUrl("");
    setImageMode("none");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function buildEntities(text: string, emojiMap: Record<string, { id: string; thumb: string | null }>) {
    const entities: { type: string; offset: number; length: number; custom_emoji_id: string }[] = [];
    for (const [emoji, { id }] of Object.entries(emojiMap)) {
      let pos = 0;
      while (true) {
        const idx = text.indexOf(emoji, pos);
        if (idx === -1) break;
        entities.push({ type: "custom_emoji", offset: idx, length: emoji.length, custom_emoji_id: id });
        pos = idx + emoji.length;
      }
    }
    return entities.sort((a, b) => a.offset - b.offset);
  }

  function insertEmoji(emoji: string, customEmojiId?: string, thumbFileId?: string | null) {
    const ta = textareaRef.current;
    const start = ta ? (ta.selectionStart ?? content.length) : content.length;
    const end = ta ? (ta.selectionEnd ?? content.length) : content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    if (customEmojiId) {
      setCustomEmojiMap((prev) => ({ ...prev, [emoji]: { id: customEmojiId, thumb: thumbFileId ?? null } }));
    }
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function insertFormat(before: string, after = before) {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = content.slice(s, e);
    setContent(content.slice(0, s) + before + sel + after + content.slice(e));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + before.length, e + before.length); }, 0);
  }

  function addButtonRow() { setButtons((p) => [...p, [{ text: "", url: "" }]]); }
  function addButtonToRow(ri: number) {
    setButtons((p) => p.map((row, i) => i === ri ? [...row, { text: "", url: "" }] : row));
  }
  function updateBtn(ri: number, bi: number, field: keyof InlineButton, value: string) {
    setButtons((p) => p.map((row, i) => i === ri ? row.map((b, j) => j === bi ? { ...b, [field]: value } : b) : row));
  }
  function setButtonStyle(ri: number, bi: number, style: InlineButton["style"]) {
    setButtons((p) => p.map((row, i) => i === ri ? row.map((b, j) => j === bi ? { ...b, style } : b) : row));
  }
  function setBtnEmoji(ri: number, bi: number, id: string, emoji: string, thumb: string | null) {
    setButtons((p) => p.map((row, i) => i === ri ? row.map((b, j) => j === bi ? { ...b, icon_custom_emoji_id: id, icon_emoji: emoji, icon_thumb: thumb ?? undefined } : b) : row));
  }
  function clearBtnEmoji(ri: number, bi: number) {
    setButtons((p) => p.map((row, i) => i === ri ? row.map((b, j) => j === bi ? { ...b, icon_custom_emoji_id: undefined, icon_emoji: undefined, icon_thumb: undefined } : b) : row));
  }
  function removeBtn(ri: number, bi: number) {
    setButtons((p) => p.map((row, i) => i === ri ? row.filter((_, j) => j !== bi) : row).filter(r => r.length > 0));
  }

  function loadPostForEdit(post: ChannelPost) {
    setContent(post.content);
    setParseMode(post.parseMode === "plain" ? "MarkdownV2" : post.parseMode);
    setButtons(post.buttons ? JSON.parse(post.buttons) : []);
    setEditingPostId(post.id);
    setEditingIsPhoto(post.mediaType === "photo" || post.mediaType === "video");
    if (post.mediaUrl) {
      setImageMode("url");
      setImageUrl(post.mediaUrl);
    } else {
      clearImage();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetEditor() {
    setContent("");
    setButtons([]);
    setEditingPostId(null);
    setEditingIsPhoto(false);
    clearImage();
    setSendError("");
    setCustomEmojiMap({});
    setShowEmojiPicker(false);
    setActiveLang("default");
    setChannelTranslations({});
    setPreviewLang("default");
  }

  async function handleBroadcast() {
    if (!content.trim()) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    setSendError("");
    try {
      const validButtons = parsedButtons();
      const res = await fetch(`/api/bots/${botId}/channels/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          parseMode: parseMode === "plain" ? undefined : parseMode,
          buttons: validButtons.flat().length > 0 ? validButtons : [],
          translations: channelTranslations,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBroadcastResult(data);
      resetEditor();
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Erro ao enviar broadcast");
    } finally {
      setBroadcasting(false);
    }
  }

  async function handleSend(sendNow: boolean) {
    if (!currentContent.trim() && !hasMedia) return;
    setSending(true);
    setSendError("");

    const validButtons = parsedButtons();
    const buttonsJson = validButtons.flat().length > 0 ? JSON.stringify(validButtons) : undefined;
    const entities = buildEntities(currentContent, customEmojiMap);
    const entitiesJson = entities.length > 0 ? JSON.stringify(entities) : undefined;
    // Telegram doesn't allow parse_mode + entities simultaneously
    const effectiveParseMode = entitiesJson ? undefined : parseMode;

    try {
      let body: BodyInit;
      let headers: HeadersInit | undefined;

      const useFormData = imageFile !== null || (imageMode === "url" && imageUrl);

      if (useFormData || (editingIsPhoto && (imageFile || imageUrl))) {
        const fd = new FormData();
        fd.append("content", currentContent);
        if (effectiveParseMode) fd.append("parseMode", effectiveParseMode);
        if (entitiesJson) fd.append("entities", entitiesJson);
        if (buttonsJson) fd.append("buttons", buttonsJson);
        fd.append("sendNow", String(sendNow));
        if (imageFile) {
          fd.append("image", imageFile, imageFile.name);
          fd.append("fileMediaType", fileMediaType);
        }
        if (imageMode === "url" && imageUrl) fd.append("imageUrl", imageUrl);
        body = fd;
      } else {
        body = JSON.stringify({
          content: currentContent,
          parseMode: effectiveParseMode,
          entities: entitiesJson ? entities : undefined,
          buttons: buttonsJson,
          sendNow,
          imageUrl: imageMode === "url" ? imageUrl : undefined,
        });
        headers = { "Content-Type": "application/json" };
      }

      if (editingPostId) {
        const res = await fetch(`/api/bots/${botId}/channels/${channelId}/posts/${editingPostId}`, {
          method: "PUT", body, headers,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPosts((prev) => prev.map((p) => (p.id === editingPostId ? data : p)));
        resetEditor();
      } else {
        const res = await fetch(`/api/bots/${botId}/channels/${channelId}/posts`, {
          method: "POST", body, headers,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPosts((prev) => [data, ...prev]);
        resetEditor();
      }
    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleSyncPosts() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`/api/bots/${botId}/channels/${channelId}/posts/sync`, { method: "POST" });
      const data = await res.json();
      if (res.status === 409) { setSyncMsg(data.error); return; }
      if (!res.ok) throw new Error(data.error);
      if (data.posts) setPosts(data.posts);
      setSyncMsg(data.imported > 0 ? `${data.imported} post(s) importado(s)` : "Nenhum post novo encontrado");
    } catch (err: unknown) {
      setSyncMsg(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeletePost(postId: string) {
    await fetch(`/api/bots/${botId}/channels/${channelId}/posts/${postId}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/bots/${botId}/channels`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate">{channel?.title ?? "Canal"}</h1>
            {channel?.username && (
              <a href={`https://t.me/${channel.username}`} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline flex items-center gap-0.5">
                @{channel.username}<ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <p className="text-zinc-500 text-sm">{editingPostId ? "Editando mensagem enviada" : "Nova mensagem"}</p>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Editor */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex flex-col gap-4">

          {/* Imagem */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-zinc-500 uppercase tracking-wide">Imagem (opcional)</Label>
              {imageMode !== "none" && (
                <button onClick={clearImage} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
                  <X className="w-3 h-3" /> Remover
                </button>
              )}
            </div>

            {imageMode === "none" && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setImageMode("upload"); setTimeout(() => fileInputRef.current?.click(), 50); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-zinc-200 rounded-xl text-sm text-zinc-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Upload className="w-4 h-4" /> Upload
                </button>
                <button
                  onClick={() => setImageMode("url")}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-zinc-200 rounded-xl text-sm text-zinc-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Globe className="w-4 h-4" /> URL
                </button>
              </div>
            )}

            {imageMode === "upload" && (
              <div className="relative">
                {imageFilePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100">
                    {fileMediaType === "video" ? (
                      <video src={imageFilePreview} className="w-full max-h-48 object-cover" controls={false} muted />
                    ) : (
                      <img src={imageFilePreview} alt="" className="w-full max-h-48 object-cover" />
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      {fileMediaType === "video" ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                      {imageFile?.name}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-8 border-2 border-dashed border-blue-300 rounded-xl text-sm text-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center gap-2"
                  >
                    <ImageIcon className="w-5 h-5" />
                    Clique para selecionar imagem ou vídeo
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/*" className="hidden" onChange={handleFileChange} />
              </div>
            )}

            {imageMode === "url" && (
              <Input
                placeholder="https://exemplo.com/imagem.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="font-mono text-sm"
                autoFocus
              />
            )}
          </div>

          {/* Toolbar texto */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
              {[
                { icon: Bold, fn: () => insertFormat("*", "*"), title: "Negrito" },
                { icon: Italic, fn: () => insertFormat("_", "_"), title: "Itálico" },
                { icon: Code, fn: () => insertFormat("`", "`"), title: "Código" },
                { icon: Link2, fn: () => { const u = prompt("URL:"); const t = prompt("Texto:") ?? "link"; if (u) insertFormat(`[${t}](`, ")"); }, title: "Link" },
              { icon: EyeOff, fn: () => insertFormat("||", "||"), title: "Spoiler" },
              ].map(({ icon: Icon, fn, title }) => (
                <button key={title} onClick={fn} title={title}
                  className="p-1.5 rounded-md hover:bg-white hover:shadow-sm transition-all text-zinc-600">
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
              <div className="w-px h-4 bg-zinc-300 mx-0.5" />
              <button
                onClick={() => setShowEmojiPicker((v) => !v)}
                title="Emojis Premium"
                className={`p-1.5 rounded-md transition-all ${showEmojiPicker ? "bg-violet-100 text-violet-600" : "hover:bg-white hover:shadow-sm text-zinc-600"}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
            <Select
              value={parseMode}
              onValueChange={setParseMode}
              disabled={Object.keys(customEmojiMap).length > 0}
            >
              <SelectTrigger className="w-32 h-8 text-xs" title={Object.keys(customEmojiMap).length > 0 ? "Desativado ao usar emojis premium" : undefined}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
                <SelectItem value="HTML">HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {Object.keys(customEmojiMap).length > 0 && (
            <p className="text-xs text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Usando {Object.keys(customEmojiMap).length} emoji(s) premium — formatação Markdown desativada
              <button
                onClick={() => setCustomEmojiMap({})}
                className="ml-auto text-violet-400 hover:text-violet-700 underline"
              >
                Limpar
              </button>
            </p>
          )}

          {/* ── Language tabs ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Idiomas</span>
              {activeLangs.length > 0 && (
                <button
                  onClick={() => translateLangs(activeLangs)}
                  disabled={isTranslatingAny || !content.trim()}
                  className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-40"
                >
                  {isTranslatingAny
                    ? <><RefreshCw className="w-3 h-3 animate-spin" /> Traduzindo...</>
                    : <><Sparkles className="w-3 h-3" /> Traduzir todos</>}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Default */}
              <button
                onClick={() => setActiveLang("default")}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  activeLang === "default"
                    ? "bg-zinc-800 text-white border-zinc-800"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                }`}
              >
                🇺🇸 Padrão
              </button>

              {activeLangs.map((code) => {
                const lang = getLanguage(code);
                const isLoading = translating.has(code);
                const hasContent = !!channelTranslations[code];
                return (
                  <div key={code} className="relative group">
                    <button
                      onClick={() => setActiveLang(code)}
                      className={`flex items-center gap-1.5 pl-2.5 pr-6 py-1 rounded-full text-xs font-medium transition-colors border ${
                        activeLang === code
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-zinc-600 border-zinc-200 hover:border-violet-300"
                      }`}
                    >
                      {isLoading
                        ? <RefreshCw className="w-3 h-3 animate-spin" />
                        : hasContent
                          ? <Check className="w-3 h-3 opacity-70" />
                          : <Globe className="w-3 h-3 opacity-50" />}
                      {lang?.flag} {lang?.label ?? code.toUpperCase()}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeLanguage(code); }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}

              {/* Add language picker */}
              <div className="relative">
                <button
                  onClick={() => setShowLangPicker((v) => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-zinc-300 text-zinc-500 hover:border-violet-400 hover:text-violet-600 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Idioma
                </button>
                {showLangPicker && availableToAdd.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg p-2 w-48 max-h-56 overflow-y-auto">
                    {availableToAdd.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => addLanguage(lang.code)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm hover:bg-zinc-50 transition-colors text-left"
                      >
                        <span className="text-base">{lang.flag}</span>
                        <span>{lang.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {activeLang !== "default" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => translateLangs([activeLang])}
                  disabled={translating.has(activeLang) || !content.trim()}
                  className="text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-1 disabled:opacity-40"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${translating.has(activeLang) ? "animate-spin" : ""}`} />
                  {translating.has(activeLang) ? "Traduzindo..." : "Regenerar tradução"}
                </button>
              </div>
            )}
          </div>

          {showEmojiPicker && (
            <EmojiPickerPanel
              botId={botId}
              onSelect={insertEmoji}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}

          <Textarea
            ref={textareaRef}
            placeholder={activeLang === "default"
              ? (hasMedia
                  ? "Legenda (opcional)...\n\n*Negrito*, _itálico_\n[texto](https://...)"
                  : "Escreva a mensagem...\n\n*Negrito*, _itálico_, `código`\n[texto](https://url.com)")
              : `Tradução em ${getLanguage(activeLang)?.label ?? activeLang}...`}
            value={currentContent}
            onChange={(e) => setCurrentContent(e.target.value)}
            className="min-h-[160px] font-mono text-sm resize-none"
          />

          {/* Botões inline */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-zinc-500 uppercase tracking-wide">Botões inline</Label>
              <Button variant="ghost" size="sm" onClick={addButtonRow} className="h-7 text-xs">
                <Plus className="w-3 h-3" /> Nova linha
              </Button>
            </div>

            {buttons.map((row, ri) => (
              <div key={ri} className="flex flex-col gap-1.5 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Linha {ri + 1}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addButtonToRow(ri)}>
                    <Plus className="w-3 h-3" /> botão
                  </Button>
                </div>
                {row.map((btn, bi) => (
                  <div key={bi} className="flex flex-col gap-1">
                    <div className="flex gap-2 items-center">
                      <button
                        title={btn.icon_custom_emoji_id ? "Trocar emoji" : "Adicionar emoji premium"}
                        onClick={() => setEmojiPickerForBtn(
                          emojiPickerForBtn?.ri === ri && emojiPickerForBtn?.bi === bi ? null : { ri, bi }
                        )}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                          btn.icon_custom_emoji_id
                            ? "border-violet-300 bg-violet-50"
                            : "border-zinc-200 text-zinc-400 hover:border-zinc-300"
                        }`}
                      >
                        {btn.icon_custom_emoji_id ? (
                          btn.icon_thumb
                            ? <img src={`/api/bots/${botId}/tg-file?file_id=${btn.icon_thumb}`} className="w-5 h-5 object-contain" alt="" />
                            : <span className="text-base leading-none">{btn.icon_emoji}</span>
                        ) : (
                          <Smile className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <Input
                        placeholder="Texto do botão"
                        value={btn.text}
                        onChange={(e) => updateBtn(ri, bi, "text", e.target.value)}
                        className="w-28 h-8 text-sm shrink-0"
                      />
                      <Input
                        placeholder="https://... ou t.me/bot?start=..."
                        value={btn.url}
                        onChange={(e) => updateBtn(ri, bi, "url", e.target.value)}
                        className="flex-1 h-8 text-xs font-mono"
                      />
                      <button onClick={() => removeBtn(ri, bi)} className="text-red-400 hover:text-red-600 p-1 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 pl-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-400">Cor:</span>
                        {([
                          { value: undefined,   bg: "bg-zinc-400",   label: "Padrão (cinza)" },
                          { value: "primary",   bg: "bg-[#2B5EAD]", label: "Azul" },
                          { value: "success",   bg: "bg-[#2ECC71]", label: "Verde" },
                          { value: "danger",    bg: "bg-[#E74C3C]", label: "Vermelho" },
                        ] as const).map(({ value, bg, label }) => (
                          <button
                            key={label}
                            title={label}
                            onClick={() => setButtonStyle(ri, bi, value)}
                            className={`w-4 h-4 rounded-full ${bg} transition-all ${
                              btn.style === value
                                ? "ring-2 ring-offset-1 ring-zinc-400 scale-110"
                                : "opacity-50 hover:opacity-80"
                            }`}
                          />
                        ))}
                      </div>
                      {btn.icon_custom_emoji_id && (
                        <button
                          onClick={() => clearBtnEmoji(ri, bi)}
                          className="text-[10px] text-violet-500 hover:text-red-500 flex items-center gap-0.5"
                        >
                          <X className="w-2.5 h-2.5" /> remover emoji
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {buttons.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-1">
                Adicione botões — links para bots, pagamentos, sites
              </p>
            )}

            {emojiPickerForBtn && (
              <EmojiPickerPanel
                botId={botId}
                onSelect={(emoji, customEmojiId, thumbFileId) => {
                  const { ri, bi } = emojiPickerForBtn;
                  if (customEmojiId) {
                    setBtnEmoji(ri, bi, customEmojiId, emoji, thumbFileId ?? null);
                  } else {
                    const cur = buttons[ri]?.[bi]?.text ?? "";
                    updateBtn(ri, bi, "text", emoji + (cur ? " " + cur : ""));
                  }
                  setEmojiPickerForBtn(null);
                }}
                onClose={() => setEmojiPickerForBtn(null)}
              />
            )}
          </div>

          {sendError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {sendError}
            </p>
          )}

          {broadcastResult && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Check className="w-4 h-4 shrink-0" />
              Enviado para {broadcastResult.sent.length} canal(is) com links cruzados
            </p>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-1 border-t border-zinc-100">
            {editingPostId ? (
              <>
                <Button className="flex-1" onClick={() => handleSend(false)}
                  disabled={sending || (!currentContent.trim() && !hasMedia)}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                  Salvar edição no Telegram
                  {activeLang !== "default" && (
                    <span className="ml-1 opacity-70 text-xs">({getLanguage(activeLang)?.flag})</span>
                  )}
                </Button>
                <Button variant="outline" onClick={resetEditor} disabled={sending}>Cancelar</Button>
              </>
            ) : (
              <>
                {/* Multi-language broadcast button — shown when there are translations + language channels */}
                {Object.keys(channelTranslations).length > 0 && allChannels.some((c) => c.language) && (
                  <Button
                    onClick={handleBroadcast}
                    disabled={broadcasting || sending || !content.trim() || !channel?.botIsAdmin}
                    className="flex-1 bg-violet-600 hover:bg-violet-700"
                  >
                    {broadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                    Enviar em todos os idiomas
                  </Button>
                )}
                <Button className="flex-1" onClick={() => handleSend(true)}
                  disabled={sending || broadcasting || (!currentContent.trim() && !hasMedia) || !channel?.botIsAdmin}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar agora
                  {activeLang !== "default" && (
                    <span className="ml-1 opacity-70 text-xs">({getLanguage(activeLang)?.flag})</span>
                  )}
                </Button>
                <Button variant="outline" onClick={() => handleSend(false)}
                  disabled={sending || broadcasting || (!currentContent.trim() && !hasMedia)} title="Salvar rascunho">
                  <Save className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          {!channel?.botIsAdmin && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
              Bot sem permissão de admin — promova-o no Telegram para enviar
            </p>
          )}
        </div>

        {/* Live Preview */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-zinc-500 text-sm">Preview em tempo real</Label>
            <span className="text-xs text-green-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Ao vivo
            </span>
          </div>

          {/* Flag switcher */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setPreviewLang("default")}
              title="Padrão"
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all border ${
                previewLang === "default"
                  ? "bg-zinc-800 text-white border-zinc-800 shadow-sm"
                  : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
              }`}
            >
              🇺🇸 Padrão
            </button>
            {activeLangs.map((code) => {
              const lang = getLanguage(code);
              const hasContent = !!channelTranslations[code];
              return (
                <button
                  key={code}
                  onClick={() => setPreviewLang(code)}
                  title={lang?.label ?? code}
                  disabled={!hasContent}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all border ${
                    previewLang === code
                      ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                      : hasContent
                        ? "bg-white text-zinc-600 border-zinc-200 hover:border-violet-300"
                        : "bg-white text-zinc-300 border-zinc-100 opacity-50 cursor-not-allowed"
                  }`}
                >
                  {lang?.flag ?? code.toUpperCase()}
                </button>
              );
            })}
            {activeLangs.length === 0 && (
              <span className="text-[11px] text-zinc-400 italic">Adicione idiomas para ver traduções</span>
            )}
          </div>

          <TelegramPreview
            botName={channel?.title ?? "Canal"}
            botUsername={channel?.username ?? "canal"}
            content={previewContent}
            parseMode={parseMode as "MarkdownV2" | "HTML" | "plain"}
            buttons={parsedButtons()}
            mediaUrl={previewMediaUrl ?? undefined}
            mediaType={hasMedia ? previewMediaType : undefined}
            className="min-h-[480px]"
            botId={botId}
            customEmojiMap={previewLang === "default" ? customEmojiMap : {}}
          />
        </div>
      </div>

      {/* Histórico */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Histórico de posts</h2>
          <div className="flex items-center gap-2">
            {syncMsg && (
              <span className="text-xs text-zinc-500 max-w-xs truncate">{syncMsg}</span>
            )}
            <Button variant="outline" size="sm" onClick={handleSyncPosts} disabled={syncing}>
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </div>
        </div>
        {loadingPosts ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-zinc-400 text-sm py-8">Nenhuma mensagem ainda</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const sb = statusBadge[post.status] ?? statusBadge.draft;
              const postButtons = post.buttons ? JSON.parse(post.buttons) as InlineButton[][] : [];
              return (
                <div key={post.id} className="bg-white rounded-2xl border border-zinc-200 p-4 flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-48 shrink-0 hidden md:block">
                    <TelegramPreview
                      botName={channel?.title ?? "Canal"}
                      botUsername={channel?.username ?? "canal"}
                      content={post.content}
                      parseMode={post.parseMode as "MarkdownV2" | "HTML" | "plain"}
                      buttons={postButtons}
                      mediaUrl={post.mediaUrl ?? undefined}
                      mediaType={post.mediaType as "photo" | undefined}
                      className="h-40 pointer-events-none"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {post.mediaType === "photo" && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Foto
                        </Badge>
                      )}
                      {post.mediaType === "video" && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Video className="w-3 h-3" /> Vídeo
                        </Badge>
                      )}
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                      {post.telegramMsgId && (
                        <span className="text-xs text-zinc-400 font-mono">msg #{post.telegramMsgId}</span>
                      )}
                      <span className="text-xs text-zinc-400 ml-auto flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(post.sentAt ?? post.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>

                    {post.content && (
                      <p className="text-sm text-zinc-600 line-clamp-3 font-mono whitespace-pre-wrap">
                        {post.content}
                      </p>
                    )}

                    {postButtons.flat().length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {postButtons.flat().map((btn, i) => (
                          <span key={i}
                            className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                            <Link2 className="w-2.5 h-2.5" />{btn.text}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-zinc-100">
                      {post.telegramMsgId && (
                        <Button size="sm" variant="outline" onClick={() => loadPostForEdit(post)} className="h-7 text-xs">
                          <Pencil className="w-3 h-3" /> Editar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => {
                          setContent(post.content);
                          setParseMode(post.parseMode);
                          setButtons(post.buttons ? JSON.parse(post.buttons) : []);
                          setEditingPostId(null);
                          if (post.mediaUrl) { setImageMode("url"); setImageUrl(post.mediaUrl); }
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}>
                        <Save className="w-3 h-3" /> Usar como base
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
                        onClick={() => handleDeletePost(post.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
