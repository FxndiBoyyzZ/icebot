"use client";

import { useState, useEffect, use, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload, ImageIcon, Video, FileText, Music, Trash2, Copy, Check,
  Loader2, CheckCircle2,
} from "lucide-react";
import { StorageChannelPanel } from "@/components/bot/StorageChannelPanel";

interface MediaItem {
  id: string;
  name: string;
  type: string;
  mimeType: string | null;
  fileSize: number | null;
  fileId: string | null;
  fileUniqueId: string | null;
  storageMessageId: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnailFileId: string | null;
  storageChannelId: string | null;
  url: string | null;
  createdAt: string;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  photo: ImageIcon, video: Video, audio: Music, document: FileText,
};
const TYPE_LABEL: Record<string, string> = {
  photo: "Foto", video: "Vídeo", audio: "Áudio", document: "Documento",
};
const TYPE_FILTER = ["todos", "photo", "video", "audio", "document"] as const;

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; status: "pending" | "ok" | "error"; msg?: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [botToken, setBotToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/bots/${botId}/media`).then((r) => r.json()),
      fetch(`/api/bots/${botId}`).then((r) => r.json()).catch(() => null),
    ]).then(([mediaData, botData]) => {
      if (Array.isArray(mediaData)) setMedia(mediaData);
      if (botData?.token) setBotToken(botData.token);
    }).finally(() => setLoading(false));
  }, [botId]);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setUploadProgress(files.map((f) => ({ name: f.name, status: "pending" })));

    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(`/api/bots/${botId}/media`, { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok) {
          setMedia((prev) => [data, ...prev]);
          setUploadProgress((prev) => prev.map((p) => p.name === file.name ? { ...p, status: "ok" } : p));
        } else {
          setUploadProgress((prev) => prev.map((p) => p.name === file.name ? { ...p, status: "error", msg: data.error } : p));
        }
      } catch {
        setUploadProgress((prev) => prev.map((p) => p.name === file.name ? { ...p, status: "error", msg: "Erro de rede" } : p));
      }
    }
    setUploading(false);
    setTimeout(() => setUploadProgress([]), 3000);
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    await fetch(`/api/bots/${botId}/media/${id}`, { method: "DELETE" });
    setMedia((prev) => prev.filter((m) => m.id !== id));
    setRemoving(null);
  }

  function copyFileId(fileId: string) {
    navigator.clipboard.writeText(fileId);
    setCopied(fileId);
    setTimeout(() => setCopied(null), 2000);
  }

  const filtered = filter === "todos" ? media : media.filter((m) => m.type === filter);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mídias</h1>
        <p className="text-zinc-500 mt-1">Armazenadas no Telegram — file_id permanente, sem re-upload</p>
      </div>

      <StorageChannelPanel botId={botId} />

      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer mb-6 ${
          dragging ? "border-violet-500 bg-violet-50" : "border-zinc-200 hover:border-violet-300 hover:bg-violet-50/30"
        }`}
      >
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
          className="hidden" onChange={(e) => uploadFiles(Array.from(e.target.files ?? []))} disabled={uploading} />

        {uploading || uploadProgress.length > 0 ? (
          <div className="space-y-1.5">
            {uploading && <Loader2 className="w-5 h-5 text-violet-500 animate-spin mx-auto mb-2" />}
            {uploadProgress.map((p, i) => (
              <p key={i} className={`text-xs font-mono ${p.status === "ok" ? "text-green-600" : p.status === "error" ? "text-red-500" : "text-zinc-400"}`}>
                {p.status === "ok" ? "✓" : p.status === "error" ? "✗" : "⟳"} {p.name}{p.msg ? ` — ${p.msg}` : ""}
              </p>
            ))}
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
            <p className="text-zinc-600 font-medium text-sm">Arraste arquivos ou clique para selecionar</p>
            <p className="text-zinc-400 text-xs mt-1">Imagens, vídeos, áudios, documentos — enviados direto ao Telegram</p>
          </>
        )}
      </div>

      {/* Filters */}
      {media.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {TYPE_FILTER.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}>
              {f === "todos" ? `Todos (${media.length})` : `${TYPE_LABEL[f]} (${media.filter((m) => m.type === f).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">
          {filter === "todos" ? "Nenhuma mídia ainda. Arraste arquivos acima." : `Nenhum ${TYPE_LABEL[filter]?.toLowerCase()} encontrado.`}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((item) => {
            const Icon = TYPE_ICON[item.type] ?? FileText;
            const isRemoving = removing === item.id;
            const isCopied = copied === item.fileId;
            return (
              <div key={item.id} className="group relative bg-white border border-zinc-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-square bg-zinc-100 flex items-center justify-center relative overflow-hidden">
                  {item.type === "photo" && item.fileId && botToken ? (
                    <TelegramPhoto fileId={item.fileId} token={botToken} alt={item.name} />
                  ) : item.type === "video" && item.thumbnailFileId && botToken ? (
                    <TelegramPhoto fileId={item.thumbnailFileId} token={botToken} alt={item.name} />
                  ) : (
                    <Icon className="w-8 h-8 text-zinc-300" />
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {item.fileId && (
                      <button onClick={() => copyFileId(item.fileId!)}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white" title="Copiar file_id">
                        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                    <button onClick={() => handleRemove(item.id)} disabled={isRemoving}
                      className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 text-white" title="Remover">
                      {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>

                  <span className="absolute top-1.5 left-1.5 text-xs bg-black/50 text-white rounded px-1.5 py-0.5 font-medium">
                    {TYPE_LABEL[item.type] ?? item.type}
                  </span>
                  {item.fileId && (
                    <span className="absolute bottom-1.5 right-1.5 text-xs bg-green-500/80 text-white rounded px-1.5 py-0.5 flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> ID
                    </span>
                  )}
                </div>

                <div className="p-2.5">
                  <p className="text-xs font-medium text-zinc-700 truncate" title={item.name}>{item.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {formatSize(item.fileSize)}
                    {item.width && item.height && <span className="ml-1">{item.width}×{item.height}</span>}
                    {item.duration && <span className="ml-1">{Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TelegramPhoto({ fileId, token, alt }: { fileId: string; token: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSrc(`https://api.telegram.org/file/bot${token}/${d.result.file_path}`); })
      .catch(() => {});
  }, [fileId, token]);

  if (!src) return <Loader2 className="w-5 h-5 text-zinc-300 animate-spin" />;
  return <img src={src} alt={alt} className="w-full h-full object-cover" />;
}
