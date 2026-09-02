"use client";

import { use, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Webhook, Key, AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, XCircle, RefreshCw } from "lucide-react";
import { appUrl } from "@/lib/utils";

interface WebhookInfo {
  url: string;
  pendingUpdateCount: number;
  lastErrorMessage: string | null;
  lastErrorDate: number | null;
  expectedUrl: string | null;
  matches: boolean;
}

export default function BotSettingsPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const [showToken, setShowToken] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<"idle" | "setting" | "removing" | "ok" | "error">("idle");
  const [webhookError, setWebhookError] = useState("");
  const [info, setInfo] = useState<WebhookInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  const loadInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/bots/${botId}/webhook`);
      const data = await res.json();
      if (res.ok) setInfo(data);
    } catch {
      /* ignore */
    } finally {
      setLoadingInfo(false);
    }
  }, [botId]);

  useEffect(() => {
    fetch(`/api/bots/${botId}/webhook`)
      .then((r) => r.json())
      .then((data) => setInfo((prev) => (data?.url !== undefined ? data : prev)))
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, [botId]);

  async function setWebhook() {
    setWebhookStatus("setting");
    setWebhookError("");
    try {
      const res = await fetch(`/api/bots/${botId}/webhook`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao registrar webhook");
      setWebhookStatus("ok");
      await loadInfo();
    } catch (e) {
      setWebhookError(e instanceof Error ? e.message : "Erro");
      setWebhookStatus("error");
    }
  }

  async function removeWebhook() {
    setWebhookStatus("removing");
    setWebhookError("");
    try {
      const res = await fetch(`/api/bots/${botId}/webhook`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao remover");
      setWebhookStatus("idle");
      await loadInfo();
    } catch (e) {
      setWebhookError(e instanceof Error ? e.message : "Erro");
      setWebhookStatus("error");
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações do Bot</h1>
        <p className="text-zinc-500 mt-1">Gerencie token, webhook e integrações</p>
      </div>

      {/* Token */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-zinc-500" />
            <CardTitle className="text-base">Token do Telegram</CardTitle>
          </div>
          <CardDescription>Nunca compartilhe seu token — trate como senha</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showToken ? "text" : "password"}
                value="••••••••••••••••••••••••••••••••••••••"
                readOnly
                className="font-mono text-sm pr-10"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button variant="outline">Atualizar token</Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-zinc-500" />
            <CardTitle className="text-base">Webhook do Telegram</CardTitle>
          </div>
          <CardDescription>
            O webhook recebe mensagens dos usuários em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label>URL do webhook</Label>
            <Input
              value={`${appUrl() || "https://seu-dominio.com"}/api/webhooks/telegram/${botId}`}
              readOnly
              className="font-mono text-xs text-zinc-500"
            />
          </div>

          {/* Status atual (getWebhookInfo) */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
            {loadingInfo ? (
              <span className="flex items-center gap-2 text-zinc-400 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando no Telegram...
              </span>
            ) : !info ? (
              <span className="text-zinc-400 text-xs">Não foi possível ler o status.</span>
            ) : !info.url ? (
              <span className="flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="w-4 h-4" /> Nenhum webhook registrado
              </span>
            ) : (
              <div className="space-y-1.5">
                <span className={`flex items-center gap-1.5 ${info.matches ? "text-green-600" : "text-amber-600"}`}>
                  {info.matches ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {info.matches ? "Webhook ativo e correto" : "Webhook aponta para outra URL"}
                </span>
                <p className="font-mono text-[11px] text-zinc-500 break-all">{info.url}</p>
                <p className="text-xs text-zinc-500">
                  {info.pendingUpdateCount} update(s) na fila
                  {info.lastErrorMessage && (
                    <span className="text-red-500"> · último erro: {info.lastErrorMessage}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={setWebhook} disabled={webhookStatus === "setting" || webhookStatus === "removing"}>
              {webhookStatus === "setting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {info?.url ? "Re-registrar webhook" : "Registrar webhook"}
            </Button>
            {info?.url && (
              <Button
                variant="outline"
                onClick={removeWebhook}
                disabled={webhookStatus === "setting" || webhookStatus === "removing"}
              >
                {webhookStatus === "removing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Remover
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={loadInfo} title="Atualizar status">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {webhookStatus === "ok" && !webhookError && (
            <p className="flex items-center gap-1.5 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Webhook registrado com sucesso
            </p>
          )}
          {webhookError && (
            <p className="flex items-center gap-1.5 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" /> {webhookError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stripe */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#635BFF">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
            </svg>
            <CardTitle className="text-base">Stripe</CardTitle>
            <Badge variant="secondary">Configurado globalmente</Badge>
          </div>
          <CardDescription>
            Pagamentos internacionais via cartão de crédito
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Stripe conectado via variáveis de ambiente
          </div>
        </CardContent>
      </Card>

      {/* PIX (placeholder) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">₽</span>
            </div>
            <CardTitle className="text-base">PIX</CardTitle>
            <Badge variant="outline">Em breve</Badge>
          </div>
          <CardDescription>
            Pagamentos via PIX instantâneo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Selecione e configure um provedor PIX (OpenPix, Mercado Pago, Asaas) nas configurações da organização.
          </p>
          <Button variant="outline" className="mt-4" disabled>
            Configurar PIX
          </Button>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <CardTitle className="text-base text-red-600">Zona de perigo</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500 mb-4">
            Excluir o bot remove permanentemente todos os planos, mensagens, mídias e dados de clientes.
          </p>
          <Button variant="destructive">Excluir este bot</Button>
        </CardContent>
      </Card>
    </div>
  );
}
