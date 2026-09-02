"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bot, ArrowLeft, Eye, EyeOff, Loader2, CheckCircle2, XCircle, Sparkles, KeyRound } from "lucide-react";
import Link from "next/link";

type TokenStatus = "idle" | "checking" | "valid" | "invalid";
type Mode = "manual" | "botfather";
type BotFatherStep = "idle" | "creating" | "done" | "error";

export default function NewBotPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("manual");

  // ── Manual token mode ───────────────────────────────────────────────────
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("idle");
  const [form, setForm] = useState({ name: "", username: "", description: "" });
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── BotFather creation mode ─────────────────────────────────────────────
  const [bfName, setBfName] = useState("");
  const [bfUsername, setBfUsername] = useState("");
  const [bfStep, setBfStep] = useState<BotFatherStep>("idle");
  const [bfError, setBfError] = useState("");
  const [bfLog, setBfLog] = useState<string[]>([]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = token.trim();

    // Token format: digits:alphanumeric (at least 30 chars)
    if (!trimmed || trimmed.length < 30 || !trimmed.includes(":")) {
      setTokenStatus("idle");
      return;
    }

    setTokenStatus("checking");

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/bots/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          setTokenStatus("invalid");
          setForm({ name: "", username: "", description: "" });
          return;
        }

        setTokenStatus("valid");
        setForm({
          name: data.name ?? "",
          username: data.username ?? "",
          description: data.description ?? "",
        });
      } catch {
        setTokenStatus("invalid");
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [token]);

  async function handleBotFatherCreate(e: React.FormEvent) {
    e.preventDefault();
    setBfStep("creating");
    setBfError("");
    setBfLog(["Conectando à conta de serviço no Telegram..."]);
    try {
      setBfLog((p) => [...p, `Enviando /newbot para o @BotFather com o nome "${bfName}"...`]);
      const res = await fetch("/api/telegram/create-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botName: bfName, botUsername: bfUsername }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBfLog((p) => [...p, `Bot criado: @${data.username}`, "Salvando no sistema..."]);
      const saveRes = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.token, name: data.name, username: data.username, description: data.description }),
      });
      if (!saveRes.ok) { const d = await saveRes.json(); throw new Error(d.error ?? "Erro ao salvar bot"); }
      const bot = await saveRes.json();
      setBfStep("done");
      setBfLog((p) => [...p, "Pronto!"]);
      setTimeout(() => router.push(`/bots/${bot.id}/plans`), 1200);
    } catch (err: unknown) {
      setBfError(err instanceof Error ? err.message : "Erro desconhecido");
      setBfStep("error");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tokenStatus !== "valid") return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, token: token.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao criar bot");
      }

      const bot = await res.json();
      router.push(`/bots/${bot.id}/plans`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const tokenIcon = {
    idle: null,
    checking: <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />,
    valid: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    invalid: <XCircle className="w-4 h-4 text-red-500" />,
  }[tokenStatus];

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/bots"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Novo Bot</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Configure seu bot de vendas no Telegram</p>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-1 mb-6 p-1 bg-zinc-100 rounded-xl">
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            mode === "manual" ? "bg-white shadow text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Usar token existente
        </button>
        <button
          onClick={() => setMode("botfather")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            mode === "botfather" ? "bg-white shadow text-violet-700" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Criar via BotFather
        </button>
      </div>

      {mode === "manual" ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Token do Bot</CardTitle>
                  <CardDescription>
                    Obtenha o token no{" "}
                    <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      @BotFather
                    </a>{" "}
                    — nome e descrição são preenchidos automaticamente
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="token">Token do Bot</Label>
                  <div className="relative">
                    <Input
                      id="token"
                      type={showToken ? "text" : "password"}
                      placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="pr-16 font-mono text-sm"
                      autoFocus
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {tokenIcon}
                      <button type="button" onClick={() => setShowToken(!showToken)} className="text-zinc-400 hover:text-zinc-600">
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {tokenStatus === "invalid" && <p className="text-xs text-red-500">Token inválido. Verifique e tente novamente.</p>}
                  {tokenStatus === "checking" && <p className="text-xs text-zinc-400">Verificando token no Telegram...</p>}
                </div>

                {tokenStatus === "valid" && (
                  <div className="space-y-4 border border-green-100 bg-green-50/50 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Bot encontrado — dados preenchidos automaticamente
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="name">Nome</Label>
                        <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" value={form.username ? `@${form.username}` : ""} readOnly className="bg-zinc-50 text-zinc-500" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Sem descrição configurada no BotFather"
                        className="min-h-[70px] bg-white"
                      />
                    </div>
                  </div>
                )}

                {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

                <Button type="submit" className="w-full" disabled={saving || tokenStatus !== "valid"}>
                  {saving ? "Criando bot..." : "Criar bot e configurar planos →"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Como obter o token:</h3>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Abra o Telegram e busque por @BotFather</li>
              <li>Envie /newbot e siga as instruções</li>
              <li>Copie o token fornecido e cole acima</li>
            </ol>
          </div>
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Criar Bot Automaticamente</CardTitle>
                  <CardDescription>
                    O sistema conversa com o @BotFather pela sua conta de serviço e cria o bot sem precisar sair daqui
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {bfStep === "idle" || bfStep === "error" ? (
                <form onSubmit={handleBotFatherCreate} className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bf-name">Nome do bot (exibição)</Label>
                    <Input
                      id="bf-name"
                      placeholder="Meu Bot de Vendas"
                      value={bfName}
                      onChange={(e) => setBfName(e.target.value)}
                      required
                      autoFocus
                    />
                    <p className="text-xs text-zinc-400">Nome que aparece para os usuários no Telegram</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bf-username">Username do bot</Label>
                    <Input
                      id="bf-username"
                      placeholder="meu_vendas_bot"
                      value={bfUsername}
                      onChange={(e) => setBfUsername(e.target.value.replace(/^@/, ""))}
                      required
                    />
                    <p className="text-xs text-zinc-400">
                      Deve terminar em <code className="bg-zinc-100 px-1 rounded">bot</code> — ex: vendas_bot, minhas_vendas_bot
                    </p>
                  </div>
                  {bfError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{bfError}</div>}
                  <Button
                    type="submit"
                    className="w-full bg-violet-600 hover:bg-violet-700"
                    disabled={!bfName.trim() || !bfUsername.trim()}
                  >
                    <Sparkles className="w-4 h-4" />
                    Criar bot via BotFather
                  </Button>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="bg-zinc-900 rounded-xl p-4 font-mono text-sm text-zinc-100 space-y-1.5 min-h-[120px]">
                    {bfLog.map((line, i) => (
                      <p key={i} className="flex items-start gap-2">
                        <span className="text-green-400 shrink-0">›</span>
                        {line}
                      </p>
                    ))}
                    {bfStep === "creating" && (
                      <p className="flex items-center gap-2 text-zinc-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        Aguardando resposta do BotFather...
                      </p>
                    )}
                    {bfStep === "done" && (
                      <p className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Redirecionando...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-4 p-4 bg-violet-50 rounded-lg border border-violet-100">
            <h3 className="text-sm font-medium text-violet-900 mb-1">Pré-requisito: conta de serviço</h3>
            <p className="text-sm text-violet-700 mb-2">
              Precisa de uma conta Telegram autenticada como serviço. Se ainda não fez isso, rode no terminal:
            </p>
            <code className="block text-xs bg-violet-100 text-violet-800 px-3 py-2 rounded-lg">
              npx dotenv -e .env.local tsx scripts/auth-telegram.ts
            </code>
          </div>
        </>
      )}
    </div>
  );
}
