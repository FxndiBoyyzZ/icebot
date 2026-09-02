"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw, Check, Loader2, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StorageChannel {
  id: string;
  title: string;
  username: string | null;
  type: string;
  memberCount?: number | null;
}

const TYPE_LABEL: Record<string, string> = {
  channel: "Canal",
  supergroup: "Supergrupo",
  group: "Grupo",
};

export function StorageChannelPanel({ botId }: { botId: string }) {
  const [current, setCurrent] = useState<StorageChannel | null>(null);
  const [candidates, setCandidates] = useState<StorageChannel[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/bots/${botId}/storage`);
    const data = await res.json();
    setCurrent(data.current ?? null);
    setCandidates(data.candidates ?? []);
    return data;
  }, [botId]);

  useEffect(() => {
    fetch(`/api/bots/${botId}/storage`)
      .then((r) => r.json())
      .then((data) => {
        setCurrent(data.current ?? null);
        setCandidates(data.candidates ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [botId]);

  async function scan() {
    setScanning(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/bots/${botId}/channels/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao procurar grupos");
      await load();
      const warn = (data.warnings ?? []).join(" ");
      setNotice(
        warn ||
          "Busca concluída. Se o grupo não apareceu, confirme que o bot foi adicionado como administrador e tente de novo.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setScanning(false);
    }
  }

  async function setStorage() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/bots/${botId}/storage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao definir o grupo");
      setSelected("");
      await load();
      setNotice("Grupo de armazenamento definido. Novos uploads vão para ele.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function createDedicated() {
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/bots/${botId}/storage`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar canal");
      await load();
      setNotice("Canal dedicado criado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-5 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          <Database className="w-4 h-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-zinc-900">Grupo de armazenamento</h2>
          <p className="text-xs text-zinc-500">
            As mídias são enviadas para este grupo/canal do Telegram. O banco guarda só o <code className="bg-zinc-100 px-1 rounded">file_id</code>.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {/* Atual */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 text-xs">Atual:</span>
                {current ? (
                  <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100 rounded-lg px-2 py-1 text-xs font-medium">
                    <Check className="w-3.5 h-3.5" />
                    {current.title}
                    <span className="text-green-600/70">· {TYPE_LABEL[current.type] ?? current.type}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-2 py-1 text-xs font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> Nenhum configurado
                  </span>
                )}
              </div>

              {/* Seletor */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger className="flex-1 text-sm">
                    <SelectValue placeholder={candidates.length ? "Escolha um grupo onde o bot é admin" : "Nenhum grupo encontrado"} />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title} · {TYPE_LABEL[c.type] ?? c.type}
                        {c.memberCount ? ` · ${c.memberCount} membros` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={setStorage} disabled={!selected || saving} className="shrink-0">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Definir
                </Button>
                <Button variant="outline" onClick={scan} disabled={scanning} className="shrink-0">
                  {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Procurar grupos
                </Button>
              </div>

              <p className="text-xs text-zinc-400">
                Não achou? Adicione o bot como <strong>administrador</strong> no grupo (com permissão de enviar mensagens) e clique em “Procurar grupos”.
              </p>

              {/* Fallback: canal dedicado */}
              <button
                onClick={createDedicated}
                disabled={creating}
                className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                ou criar um canal dedicado automaticamente
              </button>

              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">{error}</p>}
              {notice && <p className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5">{notice}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
