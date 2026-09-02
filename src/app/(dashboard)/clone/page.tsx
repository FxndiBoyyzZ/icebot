"use client";

import { useState } from "react";
import {
  Copy, Loader2, Save, Trash2, CheckCircle2, MessageSquare,
  CreditCard, ArrowUpCircle, LayoutGrid, Image as ImageIcon,
  Video, FileText, ChevronRight, ExternalLink,
} from "lucide-react";
import type { BotAnalysis, DetectedPlan, DetectedOrderBump } from "@/lib/bot-cloner";

interface SavedTemplate {
  id: string;
  sourceBot: string;
  name: string;
  steps: unknown[];
  createdAt: string;
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, count, color }: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <span className="text-sm font-semibold text-white">{title}</span>
      {count !== undefined && (
        <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

function MediaPreview({ url, type }: { url?: string; type?: string }) {
  if (!type) return null;

  const Icon = type === "photo" ? ImageIcon : type === "video" ? Video : FileText;
  const label = type === "photo" ? "Foto" : type === "video" ? "Vídeo" : "Documento";

  // O clone não baixa arquivos de mídia — só registra que o passo tinha mídia.
  // A mídia real é adicionada depois na biblioteca de Mídias (storage channel).
  if (!url) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1">
        <Icon className="w-3.5 h-3.5" /> {label} neste passo — adicione depois na biblioteca de Mídias
      </span>
    );
  }

  if (type === "photo") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="rounded-xl max-h-52 object-cover border border-zinc-800" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="flex items-center gap-2 text-xs text-blue-400 hover:underline">
      <Icon className="w-3.5 h-3.5" /> Ver {type}
    </a>
  );
}

function CopyBlock({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed bg-zinc-800/60 rounded-xl p-3 border border-zinc-700/50">
      {content}
    </pre>
  );
}

function InlineKeyboard({ rows }: { rows: Array<Array<{ text: string; url?: string }>> }) {
  return (
    <div className="space-y-1.5">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1.5 flex-wrap">
          {row.map((btn, bi) => (
            <span key={bi}
              className="flex items-center gap-1 text-xs border border-zinc-700 text-zinc-300 px-2.5 py-1 rounded-lg">
              {btn.text}
              {btn.url && <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function WelcomeSection({ msg }: { msg: BotAnalysis["welcomeMessage"] }) {
  if (!msg) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <SectionHeader
        icon={<MessageSquare className="w-3.5 h-3.5 text-blue-400" />}
        title="Mensagem de Boas-vindas"
        color="bg-blue-500/15"
      />
      <div className="pl-1 space-y-3">
        {msg.mediaType && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {msg.mediaType === "photo" && <ImageIcon className="w-3.5 h-3.5 text-blue-400" />}
            {msg.mediaType === "video" && <Video className="w-3.5 h-3.5 text-purple-400" />}
            <span className="capitalize">{msg.mediaType} detectado</span>
          </div>
        )}
        <MediaPreview url={msg.mediaUrl} type={msg.mediaType} />
        <CopyBlock content={msg.content} />
        {msg.inlineButtons && msg.inlineButtons.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Inline keyboard</p>
            <InlineKeyboard rows={msg.inlineButtons} />
          </div>
        )}
        {msg.replyButtons && msg.replyButtons.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Reply keyboard</p>
            <div className="space-y-1">
              {msg.replyButtons.map((row, ri) => (
                <div key={ri} className="flex gap-1.5 flex-wrap">
                  {row.map((text, bi) => (
                    <span key={bi} className="text-xs bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-lg">{text}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: DetectedPlan }) {
  const intervalLabel: Record<string, string> = {
    monthly: "/mês", yearly: "/ano", lifetime: "vitalício",
  };
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white leading-tight">{plan.buttonText}</p>
        {plan.price && (
          <div className="text-right shrink-0">
            <span className="text-sm font-bold text-emerald-400">{plan.price}</span>
            {plan.interval && (
              <span className="text-xs text-zinc-500 ml-1">{intervalLabel[plan.interval] ?? ""}</span>
            )}
          </div>
        )}
      </div>
      {plan.currency && (
        <span className="text-[10px] font-mono bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
          {plan.currency}
        </span>
      )}
      {plan.responseContent && (
        <CopyBlock content={plan.responseContent.slice(0, 300) + (plan.responseContent.length > 300 ? "…" : "")} />
      )}
      {plan.checkoutUrl && (
        <a href={plan.checkoutUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
          <ExternalLink className="w-3 h-3" /> Link de checkout detectado
        </a>
      )}
      {plan.responseMediaType && (
        <MediaPreview url={plan.responseMediaUrl} type={plan.responseMediaType} />
      )}
    </div>
  );
}

function PlansSection({ plans }: { plans: DetectedPlan[] }) {
  if (!plans.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <SectionHeader
        icon={<CreditCard className="w-3.5 h-3.5 text-emerald-400" />}
        title="Planos Detectados"
        count={plans.length}
        color="bg-emerald-500/15"
      />
      <div className="space-y-2.5 pl-1">
        {plans.map((p, i) => <PlanCard key={i} plan={p} />)}
      </div>
    </div>
  );
}

function OrderBumpSection({ bumps }: { bumps: DetectedOrderBump[] }) {
  if (!bumps.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <SectionHeader
        icon={<ArrowUpCircle className="w-3.5 h-3.5 text-amber-400" />}
        title="Order Bumps / Upsells"
        count={bumps.length}
        color="bg-amber-500/15"
      />
      <div className="space-y-3 pl-1">
        {bumps.map((b, i) => (
          <div key={i} className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-mono text-zinc-400">{b.trigger}</span>
            </div>
            <MediaPreview url={b.mediaUrl} type={b.mediaType} />
            <CopyBlock content={b.content.slice(0, 300) + (b.content.length > 300 ? "…" : "")} />
            {b.buttons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {b.buttons.map((btn, bi) => (
                  <span key={bi} className="text-xs border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded-lg">
                    {btn.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OtherFlowsSection({ flows }: { flows: BotAnalysis["otherFlows"] }) {
  if (!flows.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <SectionHeader
        icon={<LayoutGrid className="w-3.5 h-3.5 text-violet-400" />}
        title="Outros Fluxos"
        count={flows.length}
        color="bg-violet-500/15"
      />
      <div className="space-y-2.5 pl-1">
        {flows.map((f, i) => (
          <div key={i} className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-3 space-y-2">
            <span className="text-[11px] font-mono bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
              {f.trigger}
            </span>
            <MediaPreview url={f.mediaUrl} type={f.mediaType} />
            <CopyBlock content={f.content.slice(0, 200) + (f.content.length > 200 ? "…" : "")} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Saved templates list ──────────────────────────────────────────────────────

function TemplatesList() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.templates ?? []);
    setLoading(false);
  }

  async function del(id: string) {
    await fetch("/api/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="border-t border-zinc-800 pt-4">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {open ? "Ocultar templates salvos" : "Ver templates salvos"}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-6">Nenhum template salvo</p>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{t.name}</p>
                  <p className="text-xs text-zinc-500">
                    @{t.sourceBot} · {t.steps.length} steps · {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button onClick={() => del(t.id)} className="text-zinc-700 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClonePage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [analysis, setAnalysis] = useState<BotAnalysis | null>(null);
  const [error, setError] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleClone() {
    const target = username.trim().replace(/^@/, "");
    if (!target) return;
    setError("");
    setAnalysis(null);
    setSaved(false);
    setLoading(true);
    setStatus("Conectando ao Telegram...");

    const t1 = setTimeout(() => setStatus("Enviando /start e aguardando resposta..."), 1500);
    const t2 = setTimeout(() => setStatus("Navegando pelos botões..."), 6000);
    const t3 = setTimeout(() => setStatus("Analisando estrutura do bot..."), 12000);

    try {
      const res = await fetch("/api/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido");
      setAnalysis(data.analysis);
      setTemplateName(`@${target}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao clonar");
    } finally {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setLoading(false);
      setStatus("");
    }
  }

  async function handleSave() {
    if (!analysis || !templateName.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceBot: username.trim().replace(/^@/, ""),
          name: templateName.trim(),
          steps: analysis.rawSteps,
        }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? `Erro HTTP ${res.status}`);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const hasContent = analysis && (
    analysis.welcomeMessage ||
    analysis.plans.length > 0 ||
    analysis.orderBumps.length > 0 ||
    analysis.otherFlows.length > 0
  );

  return (
    <div className="bg-zinc-950 min-h-full text-white">
      <div className="flex items-center gap-3 px-6 py-3 bg-zinc-900 border-b border-zinc-800 text-sm">
        <Copy className="w-4 h-4 text-zinc-400" />
        <span className="text-zinc-400">Clone de Bots</span>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-5">
        {/* Input card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Analisar bot concorrente</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Entra como usuário real, navega o bot e mapeia a estrutura: copy, planos, order bumps e mídias
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleClone()}
                placeholder="username_do_bot"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <button
              onClick={handleClone}
              disabled={loading || !username.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Copy className="w-4 h-4" />}
              {loading ? "Analisando..." : "Analisar"}
            </button>
          </div>

          {status && (
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> {status}
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Analysis result */}
        {hasContent && (
          <>
            {/* Save bar */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Nome do template"
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                />
                {saved ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Template salvo
                  </span>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={saving || !templateName.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors shrink-0"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar template
                  </button>
                )}
              </div>
              {saveError && <p className="text-xs text-red-400 px-1">{saveError}</p>}
            </div>

            {/* Sections */}
            <WelcomeSection msg={analysis.welcomeMessage} />
            <PlansSection plans={analysis.plans} />
            <OrderBumpSection bumps={analysis.orderBumps} />
            <OtherFlowsSection flows={analysis.otherFlows} />
          </>
        )}

        {analysis && !hasContent && (
          <p className="text-sm text-zinc-500 text-center py-8">
            Nenhum conteúdo identificado. O bot pode não ter respondido ao /start.
          </p>
        )}

        <TemplatesList />
      </div>
    </div>
  );
}
