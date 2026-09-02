"use client";

import { useState, useEffect, use } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Users, MessageSquare, AlertTriangle, Pencil,
  CheckCircle2, Loader2, ExternalLink, Hash, Radio, RefreshCw, Sparkles, X, Check, Camera, Megaphone, Send,
  ImageIcon, Video, FileText, Link as LinkIcon, PlusCircle, Minus,
} from "lucide-react";
import Link from "next/link";
import { SUPPORTED_LANGUAGES, getLanguage } from "@/data/languages";

interface Channel {
  id: string;
  chatId: string;
  title: string;
  username: string | null;
  type: string;
  language: string | null;
  photoUrl: string | null;
  memberCount: number | null;
  botIsAdmin: boolean;
  _count?: { posts: number };
}

interface EditForm {
  title: string;
  username: string;
  language: string;
  about: string;
}

const typeLabel: Record<string, string> = {
  channel: "Canal",
  supergroup: "Supergrupo",
  group: "Grupo",
};

const typeIcon: Record<string, React.ElementType> = {
  channel: Radio,
  supergroup: Hash,
  group: Hash,
};

export default function ChannelsPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ new: number; updated: number; warnings: string[] } | null>(null);

  // ── Criar canal via MTProto ─────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createLanguage, setCreateLanguage] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // ── Editar canal individual ─────────────────────────────────────────────
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: "", username: "", language: "", about: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // ── Edição em massa ─────────────────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLanguage, setBulkLanguage] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // ── Mensagem em massa ────────────────────────────────────────────────────
  const [showBlast, setShowBlast] = useState(false);
  const [blastContent, setBlastContent] = useState("");
  const [blastParseMode, setBlastParseMode] = useState("plain");
  const [blastSelected, setBlastSelected] = useState<Set<string>>(new Set());
  const [blastSelectAll, setBlastSelectAll] = useState(true);
  const [blasting, setBlasting] = useState(false);
  const [blastLog, setBlastLog] = useState<{ channelId: string; title: string; language: string | null; ok: boolean; translated?: boolean; error?: string }[]>([]);
  const [blastDone, setBlastDone] = useState(false);
  // mídia
  const [blastMedia, setBlastMedia] = useState<{ id: string; fileId: string; type: string; name: string; previewUrl?: string } | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState<{ id: string; name: string; type: string; fileId: string | null; url: string | null }[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [blastBotToken, setBlastBotToken] = useState<string | null>(null);
  // botões
  const [blastButtons, setBlastButtons] = useState<{ text: string; url: string }[]>([]);

  // ── Criação em massa ─────────────────────────────────────────────────────
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [bulkBaseName, setBulkBaseName] = useState("");
  const [bulkBaseUsername, setBulkBaseUsername] = useState("");
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkSelectedLangs, setBulkSelectedLangs] = useState<Set<string>>(new Set());
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkCreateLog, setBulkCreateLog] = useState<{ lang: string; status: "pending" | "ok" | "error"; msg: string }[]>([]);
  const [bulkCreateDone, setBulkCreateDone] = useState(false);

  useEffect(() => {
    fetch(`/api/bots/${botId}/channels`)
      .then((r) => r.json())
      .then(setChannels)
      .finally(() => setLoading(false));
  }, [botId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch(`/api/bots/${botId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannels((prev) => [data, ...prev.filter((c) => c.id !== data.id)]);
      setIdentifier("");
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Erro");
    } finally {
      setAdding(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/bots/${botId}/channels/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannels(data.channels);
      setSyncResult({ new: data.summary.new, updated: data.summary.updated, warnings: data.warnings ?? [] });
    } catch (err: unknown) {
      setSyncResult({ new: 0, updated: 0, warnings: [err instanceof Error ? err.message : "Erro"] });
    } finally {
      setSyncing(false);
    }
  }

  async function handleRemove(channelId: string) {
    setRemoving(channelId);
    await fetch(`/api/bots/${botId}/channels/${channelId}`, { method: "DELETE" });
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    setRemoving(null);
  }

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!createTitle.trim() || !createLanguage) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/telegram/create-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, title: createTitle.trim(), language: createLanguage, username: createUsername.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannels((prev) => [data, ...prev]);
      setShowCreateForm(false);
      setCreateTitle(""); setCreateLanguage(""); setCreateUsername("");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Erro");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(channel: Channel) {
    setEditingChannel(channel);
    setEditForm({ title: channel.title, username: channel.username ?? "", language: channel.language ?? "", about: "" });
    setSaveError("");
    setPhotoPreview(null);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editingChannel) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("photo", file, file.name);
      const res = await fetch(`/api/bots/${botId}/channels/${editingChannel.id}/photo`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Update in list
      setChannels((prev) => prev.map((c) => c.id === editingChannel.id ? { ...c, photoUrl: data.photoUrl } : c));
      setEditingChannel((prev) => prev ? { ...prev, photoUrl: data.photoUrl } : null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Erro ao fazer upload da foto");
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingChannel) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/bots/${botId}/channels/${editingChannel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim() !== editingChannel.title ? editForm.title.trim() : undefined,
          username: editForm.username !== (editingChannel.username ?? "") ? editForm.username : undefined,
          language: editForm.language || null,
          about: editForm.about.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannels((prev) => prev.map((c) => c.id === data.id ? { ...c, ...data } : c));
      setEditingChannel(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === channels.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(channels.map((c) => c.id)));
    }
  }

  async function handleBulkLanguage() {
    if (!bulkLanguage || selected.size === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        [...selected].map((id) =>
          fetch(`/api/bots/${botId}/channels/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language: bulkLanguage || null }),
          })
        )
      );
      setChannels((prev) =>
        prev.map((c) => selected.has(c.id) ? { ...c, language: bulkLanguage || null } : c)
      );
      setSelected(new Set());
      setBulkLanguage("");
    } finally {
      setBulkSaving(false);
    }
  }

  function openBlast() {
    setBlastContent(""); setBlastParseMode("plain");
    setBlastSelected(new Set()); setBlastSelectAll(true);
    setBlastLog([]); setBlastDone(false);
    setBlastMedia(null); setBlastButtons([]);
    setShowBlast(true);
    // Load media library and bot token in background
    if (mediaLibrary.length === 0) {
      setLoadingMedia(true);
      Promise.all([
        fetch(`/api/bots/${botId}/media`).then((r) => r.json()),
        fetch(`/api/bots/${botId}`).then((r) => r.json()).catch(() => null),
      ]).then(([med, bot]) => {
        if (Array.isArray(med)) setMediaLibrary(med);
        if (bot?.token) setBlastBotToken(bot.token);
      }).finally(() => setLoadingMedia(false));
    }
  }

  function toggleBlastChannel(id: string) {
    setBlastSelectAll(false);
    setBlastSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBlast() {
    if (!blastContent.trim() && !blastMedia) return;
    const adminChannels = channels.filter((c) => c.botIsAdmin);
    const targets = blastSelectAll ? adminChannels : adminChannels.filter((c) => blastSelected.has(c.id));
    if (targets.length === 0) return;

    setBlasting(true);
    setBlastDone(false);
    setBlastLog(targets.map((c) => ({ channelId: c.id, title: c.title, language: c.language, ok: false })));

    const res = await fetch(`/api/bots/${botId}/channels/blast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: blastContent,
        parseMode: blastParseMode,
        channelIds: blastSelectAll ? undefined : targets.map((c) => c.id),
        buttons: blastButtons.filter((b) => b.text.trim() && b.url.trim()),
        mediaFileId: blastMedia?.fileId ?? undefined,
        mediaType: blastMedia?.type ?? undefined,
      }),
    });
    const data = await res.json();

    if (res.ok && data.results) {
      setBlastLog(data.results.map((r: { channelId: string; title: string; language: string | null; ok: boolean; translated?: boolean; error?: string }) => ({
        channelId: r.channelId, title: r.title, language: r.language, ok: r.ok, translated: r.translated, error: r.error,
      })));
    } else {
      setBlastLog(targets.map((c) => ({ channelId: c.id, title: c.title, language: c.language, ok: false, error: data.error ?? "Erro" })));
    }
    setBlasting(false);
    setBlastDone(true);
  }

  function toggleBulkLang(code: string) {
    setBulkSelectedLangs((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function openBulkCreate() {
    setBulkBaseName(""); setBulkBaseUsername(""); setBulkDescription("");
    setBulkSelectedLangs(new Set()); setBulkCreateLog([]); setBulkCreateDone(false);
    setShowBulkCreate(true);
  }

  async function handleBulkCreate() {
    if (!bulkBaseName.trim() || bulkSelectedLangs.size === 0) return;
    setBulkCreating(true);
    setBulkCreateDone(false);
    const langs = SUPPORTED_LANGUAGES.filter((l) => bulkSelectedLangs.has(l.code));
    setBulkCreateLog(langs.map((l) => ({ lang: l.code, status: "pending", msg: `${l.flag} ${l.nativeName} — aguardando...` })));

    const created: Channel[] = [];
    for (const lang of langs) {
      const title = bulkBaseName.trim() + lang.code;
      const username = bulkBaseUsername.trim() ? bulkBaseUsername.trim().replace(/^@/, "") + lang.code : undefined;
      try {
        const res = await fetch("/api/telegram/create-channel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ botId, title, language: lang.code, username, description: bulkDescription.trim() || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        created.push(data);
        setBulkCreateLog((prev) => prev.map((e) => e.lang === lang.code ? { ...e, status: "ok", msg: `${lang.flag} ${title} — criado` } : e));
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Erro";
        setBulkCreateLog((prev) => prev.map((e) => e.lang === lang.code ? { ...e, status: "error", msg: `${lang.flag} ${title} — ${errMsg}` } : e));
      }
    }
    if (created.length > 0) setChannels((prev) => [...created, ...prev]);
    setBulkCreating(false);
    setBulkCreateDone(true);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Canais & Grupos</h1>
          <p className="text-zinc-500 mt-1">Canais onde o bot é administrador</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant={bulkMode ? "default" : "outline"}
            onClick={() => { setBulkMode((v) => !v); setSelected(new Set()); }}
          >
            {bulkMode ? <><X className="w-4 h-4" /> Cancelar</> : <><Pencil className="w-4 h-4" /> Editar em massa</>}
          </Button>
          <Button onClick={openBlast} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
            <Megaphone className="w-4 h-4" />
            Mensagem em massa
          </Button>
          <Button onClick={openBulkCreate} variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50">
            <Sparkles className="w-4 h-4" />
            Criar em massa
          </Button>
          <Button onClick={() => setShowCreateForm((v) => !v)} className="bg-violet-600 hover:bg-violet-700">
            <Sparkles className="w-4 h-4" />
            Criar Canal
          </Button>
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>
      </div>

      {/* Criar canal */}
      {showCreateForm && (
        <Card className="mb-6 border-violet-200 bg-violet-50/30">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-violet-600" /> Criar novo canal via Telegram
              </h3>
              <button onClick={() => setShowCreateForm(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateChannel} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Nome do canal *</label>
                  <Input placeholder="Vendas PT 🇧🇷" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} required autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Idioma *</label>
                  <select value={createLanguage} onChange={(e) => setCreateLanguage(e.target.value)} required
                    className="h-9 rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">Selecione...</option>
                    {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.nativeName}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Username (opcional)</label>
                <Input placeholder="meu_canal_pt" value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} />
                <p className="text-xs text-zinc-400">Deixe em branco para criar canal privado</p>
              </div>
              {createError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{createError}
                </p>
              )}
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={creating || !createTitle.trim() || !createLanguage}>
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando canal no Telegram...</> : <><Sparkles className="w-4 h-4" /> Criar canal</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm flex flex-col gap-1 ${
          syncResult.warnings.length > 0 && syncResult.new === 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-green-50 border-green-200 text-green-800"
        }`}>
          <p className="font-medium flex items-center gap-1.5">
            {syncResult.new > 0 || syncResult.updated > 0
              ? <><CheckCircle2 className="w-4 h-4" /> Sincronização concluída</>
              : <><RefreshCw className="w-4 h-4" /> Nenhum canal novo encontrado</>}
          </p>
          {(syncResult.new > 0 || syncResult.updated > 0) && (
            <p className="text-xs opacity-80">
              {syncResult.new > 0 && `${syncResult.new} novo(s) adicionado(s). `}
              {syncResult.updated > 0 && `${syncResult.updated} atualizado(s).`}
            </p>
          )}
          {syncResult.warnings.map((w, i) => (
            <p key={i} className="text-xs opacity-80 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{w}</p>
          ))}
        </div>
      )}

      {/* Add manual */}
      <Card className="mb-6">
        <CardContent className="pt-5">
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input placeholder="@meucanal ou -1001234567890" value={identifier}
                onChange={(e) => setIdentifier(e.target.value)} className="font-mono text-sm" disabled={adding} />
              <Button type="submit" disabled={adding || !identifier.trim()}>
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar
              </Button>
            </div>
            {addError && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{addError}</p>}
            <p className="text-xs text-zinc-400">
              Adicione pelo @username ou ID — ou use{" "}
              <button type="button" onClick={handleSync} className="underline hover:text-zinc-600">Sincronizar</button>{" "}
              para detectar automaticamente.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Bulk mode header row */}
      {bulkMode && channels.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-1">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900">
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selected.size === channels.length ? "bg-violet-600 border-violet-600" : "border-zinc-300"}`}>
              {selected.size === channels.length && <Check className="w-3 h-3 text-white" />}
            </div>
            Selecionar todos
          </button>
          <span className="text-sm text-zinc-400">{selected.size} selecionado(s)</span>
        </div>
      )}

      {/* Channel list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-zinc-200 rounded-2xl">
          <Radio className="w-8 h-8 text-zinc-300 mb-3" />
          <p className="font-medium text-zinc-600">Nenhum canal adicionado</p>
          <p className="text-sm text-zinc-400 mt-1 max-w-sm">Adicione o bot como admin e cole o @username acima</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((channel) => {
            const Icon = typeIcon[channel.type] ?? Hash;
            const isSelected = selected.has(channel.id);
            return (
              <div
                key={channel.id}
                onClick={bulkMode ? () => toggleSelect(channel.id) : undefined}
                className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 transition-all ${
                  bulkMode ? "cursor-pointer" : "hover:shadow-md"
                } ${isSelected ? "border-violet-400 ring-2 ring-violet-200" : "border-zinc-200"}`}
              >
                {/* Top row: avatar + info + badges + actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox (bulk mode) or avatar */}
                    {bulkMode ? (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all ${isSelected ? "bg-violet-600 border-violet-600" : "border-zinc-200 bg-zinc-50"}`}>
                        {isSelected ? <Check className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-zinc-400" />}
                      </div>
                    ) : channel.photoUrl ? (
                      <img
                        src={channel.photoUrl}
                        alt={channel.title}
                        className="w-10 h-10 rounded-xl object-cover shrink-0 bg-zinc-100"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 truncate">{channel.title}</p>
                      {channel.username ? (
                        <a href={`https://t.me/${channel.username}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}>
                          @{channel.username}<ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-400 font-mono">{channel.chatId}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={channel.botIsAdmin ? "success" : "warning"}>
                      {channel.botIsAdmin
                        ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Admin</span>
                        : <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sem permissão</span>}
                    </Badge>
                    <Badge variant="secondary">{typeLabel[channel.type] ?? channel.type}</Badge>
                    {!bulkMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(channel); }}
                        className="p-1 rounded-md text-zinc-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        title="Editar canal"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className={`flex items-center gap-1.5 font-medium ${channel.memberCount != null ? "text-zinc-700" : "text-zinc-400"}`}>
                    <Users className="w-3.5 h-3.5 text-violet-500" />
                    {channel.memberCount != null
                      ? channel.memberCount.toLocaleString("pt-BR") + (channel.memberCount === 1 ? " membro" : " membros")
                      : "— membros"}
                  </span>
                  <span className="text-zinc-300">·</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{channel._count?.posts ?? 0} posts</span>
                  {channel.language && (
                    <>
                      <span className="text-zinc-300">·</span>
                      <span className="flex items-center gap-1">
                        <span>{getLanguage(channel.language)?.flag}</span>
                        <span>{getLanguage(channel.language)?.nativeName}</span>
                      </span>
                    </>
                  )}
                </div>

                {!channel.botIsAdmin && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Bot sem permissão de admin — promova-o no Telegram para enviar mensagens.
                  </div>
                )}

                {!bulkMode && (
                  <div className="flex gap-2 pt-1 border-t border-zinc-100">
                    <Button asChild size="sm" className="flex-1" disabled={!channel.botIsAdmin}>
                      <Link href={`/bots/${botId}/channels/${channel.id}`}>
                        <MessageSquare className="w-3.5 h-3.5" /> Gerenciar mensagens
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); handleRemove(channel.id); }} disabled={removing === channel.id}>
                      {removing === channel.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bulk action bar (fixed bottom) ─────────────────────────────── */}
      {bulkMode && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 shadow-xl px-8 py-4 flex items-center gap-4 z-50">
          <span className="text-sm font-medium text-zinc-700 shrink-0">
            {selected.size} canal(is) selecionado(s)
          </span>
          <div className="flex items-center gap-2 flex-1">
            <select
              value={bulkLanguage}
              onChange={(e) => setBulkLanguage(e.target.value)}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Alterar idioma para...</option>
              <option value="">— remover idioma —</option>
              {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.nativeName}</option>)}
            </select>
            <Button onClick={handleBulkLanguage} disabled={bulkSaving || !bulkLanguage}
              className="bg-violet-600 hover:bg-violet-700">
              {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Aplicar
            </Button>
          </div>
          <Button variant="outline" onClick={() => { setBulkMode(false); setSelected(new Set()); }}>
            <X className="w-4 h-4" /> Cancelar
          </Button>
        </div>
      )}

      {/* ── Blast modal ────────────────────────────────────────────────── */}
      {showBlast && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !blasting && setShowBlast(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-zinc-900 flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-blue-600" /> Mensagem em massa
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Envia a mesma mensagem para todos os canais selecionados</p>
                </div>
                {!blasting && (
                  <button onClick={() => setShowBlast(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {!blasting && !blastDone ? (
                <div className="space-y-4">
                  {/* Message textarea */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-zinc-700">
                        Mensagem <span className="text-zinc-400 font-normal">(🇺🇸 inglês — será traduzida automaticamente)</span>
                      </label>
                      <select
                        value={blastParseMode}
                        onChange={(e) => setBlastParseMode(e.target.value)}
                        className="text-xs rounded border border-zinc-200 px-2 py-1 text-zinc-600 focus:outline-none"
                      >
                        <option value="plain">Texto simples</option>
                        <option value="Markdown">Markdown</option>
                        <option value="MarkdownV2">MarkdownV2</option>
                        <option value="HTML">HTML</option>
                      </select>
                    </div>
                    <textarea
                      value={blastContent}
                      onChange={(e) => setBlastContent(e.target.value)}
                      placeholder="Write your message in English..."
                      rows={5}
                      autoFocus
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                    />
                    <p className="text-xs text-zinc-400">{blastContent.length} caracteres</p>
                  </div>

                  {/* Media */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700">Mídia (opcional)</label>
                    {blastMedia ? (
                      <div className="flex items-center gap-3 p-2.5 border border-zinc-200 rounded-lg bg-zinc-50">
                        <div className="w-12 h-12 rounded-lg bg-zinc-200 flex items-center justify-center overflow-hidden shrink-0">
                          {blastMedia.previewUrl
                            ? <img src={blastMedia.previewUrl} alt="" className="w-full h-full object-cover" />
                            : blastMedia.type === "video" ? <Video className="w-5 h-5 text-zinc-400" />
                            : <ImageIcon className="w-5 h-5 text-zinc-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-700 truncate">{blastMedia.name}</p>
                          <p className="text-xs text-zinc-400 capitalize">{blastMedia.type}</p>
                        </div>
                        <button onClick={() => setBlastMedia(null)} className="text-zinc-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowMediaPicker(true)}
                        className="flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-zinc-200 rounded-lg text-sm text-zinc-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-all"
                      >
                        <ImageIcon className="w-4 h-4" /> Anexar foto ou vídeo da biblioteca
                      </button>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-zinc-700">Botões com link (opcional)</label>
                      <button
                        type="button"
                        onClick={() => setBlastButtons((prev) => [...prev, { text: "", url: "" }])}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Adicionar botão
                      </button>
                    </div>
                    {blastButtons.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {blastButtons.map((btn, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              value={btn.text}
                              onChange={(e) => setBlastButtons((prev) => prev.map((b, j) => j === i ? { ...b, text: e.target.value } : b))}
                              placeholder="Texto do botão"
                              className="flex-1 h-8 text-sm rounded-md border border-zinc-200 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <div className="relative flex-1">
                              <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                              <input
                                value={btn.url}
                                onChange={(e) => setBlastButtons((prev) => prev.map((b, j) => j === i ? { ...b, url: e.target.value } : b))}
                                placeholder="https://..."
                                className="w-full h-8 text-sm rounded-md border border-zinc-200 pl-7 pr-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </div>
                            <button
                              onClick={() => setBlastButtons((prev) => prev.filter((_, j) => j !== i))}
                              className="text-zinc-400 hover:text-red-500 shrink-0"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Channel selector */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-zinc-700">Canais de destino</label>
                      <button
                        type="button"
                        onClick={() => { setBlastSelectAll((v) => !v); setBlastSelected(new Set()); }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        {blastSelectAll ? "Selecionar individualmente" : "Selecionar todos"}
                      </button>
                    </div>

                    {blastSelectAll ? (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Todos os {channels.filter((c) => c.botIsAdmin).length} canais com permissão de admin
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-44 overflow-y-auto border border-zinc-200 rounded-lg p-2">
                        {channels.filter((c) => c.botIsAdmin).length === 0 ? (
                          <p className="text-xs text-zinc-400 p-2">Nenhum canal com permissão de admin</p>
                        ) : (
                          channels.filter((c) => c.botIsAdmin).map((ch) => (
                            <label key={ch.id} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                              blastSelected.has(ch.id) ? "bg-blue-50 text-blue-900" : "hover:bg-zinc-50 text-zinc-700"
                            }`}>
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                blastSelected.has(ch.id) ? "bg-blue-600 border-blue-600" : "border-zinc-300"
                              }`}>
                                {blastSelected.has(ch.id) && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <input type="checkbox" className="hidden" checked={blastSelected.has(ch.id)} onChange={() => toggleBlastChannel(ch.id)} />
                              {ch.photoUrl ? (
                                <img src={ch.photoUrl} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                              ) : (
                                <Radio className="w-4 h-4 text-zinc-400 shrink-0" />
                              )}
                              <span className="truncate">{ch.title}</span>
                              {ch.language && <span className="ml-auto shrink-0 text-xs">{ch.language}</span>}
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={handleBlast}
                      disabled={(!blastContent.trim() && !blastMedia) || (!blastSelectAll && blastSelected.size === 0)}
                    >
                      <Send className="w-4 h-4" />
                      Enviar para {blastSelectAll
                        ? `${channels.filter((c) => c.botIsAdmin).length} canais`
                        : `${blastSelected.size} canal(is)`}
                    </Button>
                    <Button variant="outline" onClick={() => setShowBlast(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                /* Progress / result log */
                <div className="space-y-3">
                  <div className="bg-zinc-900 rounded-xl p-4 font-mono text-sm space-y-1.5 max-h-72 overflow-y-auto">
                    {blasting && blastLog.every((e) => !e.ok && !e.error) && (
                      <div className="flex items-center gap-2 text-zinc-400 mb-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Traduzindo e enviando...</span>
                      </div>
                    )}
                    {blastLog.map((entry) => {
                      const lang = entry.language ? getLanguage(entry.language) : null;
                      return (
                        <div key={entry.channelId} className={`flex items-center gap-2 ${entry.ok ? "text-green-400" : blastDone ? "text-red-400" : "text-zinc-400"}`}>
                          <span className="shrink-0 w-3">
                            {!blastDone && !entry.ok && !entry.error ? "·" : entry.ok ? "✓" : "✗"}
                          </span>
                          {lang && <span className="shrink-0">{lang.flag}</span>}
                          <span className="truncate flex-1">{entry.title}</span>
                          {entry.translated && <span className="text-xs text-blue-400 shrink-0">traduzido</span>}
                          {entry.error && <span className="text-xs text-red-400 opacity-80 shrink-0 truncate max-w-32">— {entry.error}</span>}
                        </div>
                      );
                    })}
                  </div>

                  {blastDone && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-zinc-600">
                        <span className="text-green-600 font-medium">{blastLog.filter((e) => e.ok).length} enviados</span>
                        {blastLog.filter((e) => !e.ok).length > 0 && (
                          <span className="text-red-500 font-medium"> · {blastLog.filter((e) => !e.ok).length} falharam</span>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={openBlast}>Nova mensagem</Button>
                        <Button size="sm" onClick={() => setShowBlast(false)}>
                          <Check className="w-4 h-4" /> Fechar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Media picker (inside blast) ─────────────────────────────────── */}
      {showMediaPicker && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={() => setShowMediaPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-900">Selecionar mídia</h3>
              <button onClick={() => setShowMediaPicker(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {loadingMedia ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : mediaLibrary.filter((m) => m.type === "photo" || m.type === "video").length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-sm">
                  Nenhuma foto ou vídeo na biblioteca. Vá em Mídias para fazer upload.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {mediaLibrary.filter((m) => m.type === "photo" || m.type === "video").map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setBlastMedia({ id: item.id, fileId: item.fileId!, type: item.type, name: item.name });
                        setShowMediaPicker(false);
                      }}
                      className="aspect-square rounded-xl bg-zinc-100 overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all relative group"
                    >
                      {item.type === "photo" && blastBotToken && item.fileId ? (
                        <TgThumb fileId={item.fileId} token={blastBotToken} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {item.type === "video" ? <Video className="w-8 h-8 text-zinc-300" /> : <ImageIcon className="w-8 h-8 text-zinc-300" />}
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white rounded px-1 capitalize">{item.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk create modal ──────────────────────────────────────────── */}
      {showBulkCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !bulkCreating && setShowBulkCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-bold text-zinc-900">Criar canais em massa</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Um canal por idioma, com sufixo automático</p>
                </div>
                {!bulkCreating && (
                  <button onClick={() => setShowBulkCreate(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {!bulkCreating && !bulkCreateDone ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700">Nome base *</label>
                    <Input
                      value={bulkBaseName}
                      onChange={(e) => setBulkBaseName(e.target.value)}
                      placeholder="grupovip1"
                      autoFocus
                    />
                    <p className="text-xs text-zinc-400">
                      Será criado ex: <span className="font-mono">{(bulkBaseName || "grupovip1") + "es"}</span>, <span className="font-mono">{(bulkBaseName || "grupovip1") + "pt"}</span>...
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700">Username base (opcional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">@</span>
                      <Input
                        value={bulkBaseUsername}
                        onChange={(e) => setBulkBaseUsername(e.target.value.replace(/^@/, ""))}
                        placeholder="grupovip1"
                        className="pl-7"
                      />
                    </div>
                    {bulkBaseUsername && (
                      <p className="text-xs text-zinc-400 font-mono">
                        @{bulkBaseUsername}es, @{bulkBaseUsername}pt...
                      </p>
                    )}
                    <p className="text-xs text-zinc-400">Deixe vazio para canais privados</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700">Descrição (opcional)</label>
                    <textarea
                      value={bulkDescription}
                      onChange={(e) => setBulkDescription(e.target.value)}
                      placeholder="Descrição aplicada em todos os canais criados..."
                      rows={2}
                      maxLength={255}
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-zinc-700">Idiomas *</label>
                      <button
                        type="button"
                        onClick={() => setBulkSelectedLangs(
                          bulkSelectedLangs.size === SUPPORTED_LANGUAGES.length
                            ? new Set()
                            : new Set(SUPPORTED_LANGUAGES.map((l) => l.code))
                        )}
                        className="text-xs text-violet-600 hover:text-violet-800"
                      >
                        {bulkSelectedLangs.size === SUPPORTED_LANGUAGES.length ? "Desmarcar todos" : "Selecionar todos"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <label
                          key={lang.code}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all ${
                            bulkSelectedLangs.has(lang.code)
                              ? "border-violet-400 bg-violet-50 text-violet-900"
                              : "border-zinc-200 hover:border-zinc-300 text-zinc-700"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                            bulkSelectedLangs.has(lang.code) ? "bg-violet-600 border-violet-600" : "border-zinc-300"
                          }`}>
                            {bulkSelectedLangs.has(lang.code) && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <input type="checkbox" className="hidden" checked={bulkSelectedLangs.has(lang.code)} onChange={() => toggleBulkLang(lang.code)} />
                          <span>{lang.flag}</span>
                          <span className="truncate">{lang.nativeName}</span>
                          {bulkBaseName && (
                            <span className="ml-auto text-xs text-zinc-400 font-mono shrink-0">{bulkBaseName}{lang.code}</span>
                          )}
                        </label>
                      ))}
                    </div>
                    {bulkSelectedLangs.size > 0 && (
                      <p className="text-xs text-zinc-500">{bulkSelectedLangs.size} canal(is) serão criados</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      className="flex-1 bg-violet-600 hover:bg-violet-700"
                      onClick={handleBulkCreate}
                      disabled={!bulkBaseName.trim() || bulkSelectedLangs.size === 0}
                    >
                      <Sparkles className="w-4 h-4" /> Criar {bulkSelectedLangs.size > 0 ? `${bulkSelectedLangs.size} ` : ""}canal(is)
                    </Button>
                    <Button variant="outline" onClick={() => setShowBulkCreate(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                // Progress log
                <div className="space-y-3">
                  <div className="bg-zinc-900 rounded-xl p-4 font-mono text-sm space-y-1.5 max-h-72 overflow-y-auto">
                    {bulkCreateLog.map((entry) => (
                      <div key={entry.lang} className={`flex items-start gap-2 ${
                        entry.status === "ok" ? "text-green-400" : entry.status === "error" ? "text-red-400" : "text-zinc-400"
                      }`}>
                        <span className="shrink-0 mt-0.5">
                          {entry.status === "pending" ? (bulkCreating ? "⟳" : "○") : entry.status === "ok" ? "✓" : "✗"}
                        </span>
                        <span>{entry.msg}</span>
                      </div>
                    ))}
                    {bulkCreating && (
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Criando no Telegram...</span>
                      </div>
                    )}
                  </div>

                  {bulkCreateDone && (
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => setShowBulkCreate(false)}>
                        <Check className="w-4 h-4" /> Concluído
                      </Button>
                      <Button variant="outline" onClick={openBulkCreate}>Criar mais</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────── */}
      {editingChannel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !saving && !uploadingPhoto && setEditingChannel(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal header with photo */}
            <div className="relative">
              {/* Photo area */}
              <div className="relative w-full h-32 bg-gradient-to-br from-blue-100 to-violet-100 rounded-t-2xl overflow-hidden">
                {(photoPreview || editingChannel.photoUrl) && (
                  <img
                    src={photoPreview ?? editingChannel.photoUrl!}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
                <label className={`absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  uploadingPhoto ? "bg-black/40" : "bg-black/0 hover:bg-black/30"
                } group`}>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploadingPhoto} />
                  {uploadingPhoto ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      <span className="text-xs text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity drop-shadow">
                        {editingChannel.photoUrl ? "Alterar foto" : "Adicionar foto"}
                      </span>
                    </>
                  )}
                </label>
              </div>

              {/* Close button */}
              <button
                onClick={() => setEditingChannel(null)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 flex items-center justify-center text-white hover:bg-black/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-5">
                <h2 className="font-bold text-zinc-900">Editar canal</h2>
                <p className="text-xs text-zinc-400 font-mono">{editingChannel.chatId}</p>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Nome do canal</label>
                  <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="Nome do canal" required />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">@</span>
                    <Input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value.replace(/^@/, "") })}
                      placeholder="meu_canal" className="pl-7" />
                  </div>
                  <p className="text-xs text-zinc-400">Deixe em branco para canal privado</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Descrição</label>
                  <textarea
                    value={editForm.about}
                    onChange={(e) => setEditForm({ ...editForm, about: e.target.value })}
                    placeholder="Descrição do canal no Telegram..."
                    rows={3}
                    maxLength={255}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  />
                  <p className="text-xs text-zinc-400">{editForm.about.length}/255</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Idioma</label>
                  <select value={editForm.language} onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                    className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">— nenhum —</option>
                    {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.nativeName}</option>)}
                  </select>
                </div>

                {saveError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{saveError}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <Button type="submit" className="flex-1" disabled={saving || uploadingPhoto || !editForm.title.trim()}>
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><Check className="w-4 h-4" /> Salvar alterações</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingChannel(null)} disabled={saving || uploadingPhoto}>
                    Cancelar
                  </Button>
                </div>
              </form>
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
  if (!src) return <Loader2 className="w-5 h-5 text-zinc-300 animate-spin m-auto" />;
  return <img src={src} alt="" className="w-full h-full object-cover" />;
}
