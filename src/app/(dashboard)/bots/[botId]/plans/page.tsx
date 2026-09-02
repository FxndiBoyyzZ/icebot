"use client";

import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatCurrency, PLAN_INTERVALS } from "@/lib/utils";
import {
  Plus, Trash2, Loader2, ChevronDown, GripVertical,
  CreditCard, Package, RefreshCw, Pencil, Check, ArrowUpDown,
} from "lucide-react";

interface Feature { id: string; text: string }
interface Plan {
  id: string; name: string; description: string;
  price: number;       // Stripe USD cents
  priceBRL: number | null; // PIX BRL cents (null = desabilitado)
  currency: string;
  interval: string; trialDays: number; active: boolean; features: Feature[];
  _count?: { subscriptions: number };
}

const BLANK_PLAN = (): Omit<Plan, "id"> => ({
  name: "", description: "", price: 0, priceBRL: null, currency: "USD",
  interval: "monthly", trialDays: 0, active: true, features: [],
});

let localId = 0;

function intervalLabel(interval: string) {
  return (PLAN_INTERVALS as Record<string, string>)[interval] ?? interval;
}

function PriceLabel(plan: Plan) {
  const stripe = plan.price > 0 ? `$${(plan.price / 100).toFixed(2)}` : "Grátis";
  const pix = plan.priceBRL != null ? ` · R$${(plan.priceBRL / 100).toFixed(2).replace(".", ",")} PIX` : "";
  return stripe + pix;
}

// ── Inline plan row ──────────────────────────────────────────────────────────

function PlanRow({
  plan, expanded, onToggle, onSave, onDelete, saving,
}: {
  plan: Plan; expanded: boolean; onToggle: () => void;
  onSave: (data: Omit<Plan, "id">) => Promise<void>; onDelete: () => void; saving: boolean;
}) {
  const [form, setForm] = useState<Omit<Plan, "id">>({
    name: plan.name, description: plan.description,
    price: plan.price, priceBRL: plan.priceBRL,
    currency: plan.currency, interval: plan.interval, trialDays: plan.trialDays,
    active: plan.active, features: plan.features,
  });

  function addFeature() {
    setForm((f) => ({ ...f, features: [...f.features, { id: `local-${++localId}`, text: "" }] }));
  }
  function updateFeature(id: string, text: string) {
    setForm((f) => ({ ...f, features: f.features.map((ft) => ft.id === id ? { ...ft, text } : ft) }));
  }
  function removeFeature(id: string) {
    setForm((f) => ({ ...f, features: f.features.filter((ft) => ft.id !== id) }));
  }

  const sales = plan._count?.subscriptions ?? 0;

  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 select-none"
        onClick={onToggle}
      >
        <GripVertical className="w-4 h-4 text-zinc-300 cursor-grab shrink-0" />
        <div className="w-7 h-7 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0">
          <Package className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zinc-900 truncate">{plan.name || "Sem nome"}</span>
            <span className="text-xs text-zinc-400">
              {PriceLabel(plan)} · {intervalLabel(plan.interval)}
            </span>
            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Entrega padrão</span>
            {sales > 0 && (
              <span className="text-xs text-teal-600 font-medium">
                {sales} venda{sales !== 1 ? "s" : ""} · {formatCurrency(plan.price * 100 * sales, plan.currency)}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-zinc-50 border-t border-zinc-100 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label className="text-xs">Nome do plano</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: VIP, Pro..." />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descreva o que está incluso..." className="min-h-[50px] text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Preço Stripe — USD (centavos)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                <Input type="number" min="0" value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                  placeholder="890" className="pl-6" />
              </div>
              <p className="text-xs text-zinc-400">{form.price > 0 ? `$${(form.price / 100).toFixed(2)} USD` : "Grátis"}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Preço PIX — BRL (centavos)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">R$</span>
                <Input type="number" min="0" value={form.priceBRL ?? ""}
                  onChange={(e) => setForm({ ...form, priceBRL: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Desabilitado" className="pl-8" />
              </div>
              <p className="text-xs text-zinc-400">
                {form.priceBRL != null && form.priceBRL > 0
                  ? `R$${(form.priceBRL / 100).toFixed(2).replace(".", ",")} BRL`
                  : "Deixe vazio para desabilitar PIX"}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Intervalo</Label>
              <Select value={form.interval} onValueChange={(v) => setForm({ ...form, interval: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAN_INTERVALS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Dias grátis</Label>
              <Input type="number" min="0" value={form.trialDays || ""}
                onChange={(e) => setForm({ ...form, trialDays: parseInt(e.target.value) || 0 })} placeholder="0" />
            </div>
          </div>

          {/* Features */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Funcionalidades</Label>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addFeature}>
                <Plus className="w-3 h-3" /> Adicionar
              </Button>
            </div>
            {form.features.map((f) => (
              <div key={f.id} className="flex gap-2">
                <div className="flex items-center gap-1.5 flex-1 bg-white border border-zinc-200 rounded-lg px-2">
                  <Check className="w-3 h-3 text-zinc-300 shrink-0" />
                  <input className="flex-1 text-sm py-1.5 outline-none bg-transparent" placeholder="Ex: Acesso ao canal VIP"
                    value={f.text} onChange={(e) => updateFeature(f.id, e.target.value)} />
                </div>
                <button className="text-red-400 hover:text-red-600 p-1" onClick={() => removeFeature(f.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between py-1">
            <Label className="text-xs">Plano ativo</Label>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => onSave(form)} disabled={!form.name || saving} className="flex-1">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Salvar
            </Button>
            <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New plan form row ────────────────────────────────────────────────────────

function NewPlanRow({ onSave, saving, onCancel }: {
  onSave: (data: Omit<Plan, "id">) => Promise<void>; saving: boolean; onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Plan, "id">>(BLANK_PLAN());

  function addFeature() {
    setForm((f) => ({ ...f, features: [...f.features, { id: `local-${++localId}`, text: "" }] }));
  }
  function updateFeature(id: string, text: string) {
    setForm((f) => ({ ...f, features: f.features.map((ft) => ft.id === id ? { ...ft, text } : ft) }));
  }
  function removeFeature(id: string) {
    setForm((f) => ({ ...f, features: f.features.filter((ft) => ft.id !== id) }));
  }

  return (
    <div className="border-t border-blue-100 bg-blue-50/40 px-4 py-4 space-y-4">
      <p className="text-xs font-semibold text-blue-700">Novo Plano</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 col-span-2">
          <Label className="text-xs">Nome do plano</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: VIP, Pro..." autoFocus />
        </div>
        <div className="flex flex-col gap-1.5 col-span-2">
          <Label className="text-xs">Descrição (opcional)</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descreva o que está incluso..." className="min-h-[50px] text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Preço (centavos)</Label>
          <Input type="number" min="0" value={form.price || ""}
            onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })} placeholder="0" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Moeda</Label>
          <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BRL">BRL (R$)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Intervalo</Label>
          <Select value={form.interval} onValueChange={(v) => setForm({ ...form, interval: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PLAN_INTERVALS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Dias grátis</Label>
          <Input type="number" min="0" value={form.trialDays || ""}
            onChange={(e) => setForm({ ...form, trialDays: parseInt(e.target.value) || 0 })} placeholder="0" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Funcionalidades</Label>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addFeature}>
            <Plus className="w-3 h-3" /> Adicionar
          </Button>
        </div>
        {form.features.map((f) => (
          <div key={f.id} className="flex gap-2">
            <div className="flex items-center gap-1.5 flex-1 bg-white border border-zinc-200 rounded-lg px-2">
              <Check className="w-3 h-3 text-zinc-300 shrink-0" />
              <input className="flex-1 text-sm py-1.5 outline-none bg-transparent" placeholder="Ex: Acesso ao canal VIP"
                value={f.text} onChange={(e) => updateFeature(f.id, e.target.value)} />
            </div>
            <button className="text-red-400 hover:text-red-600 p-1" onClick={() => removeFeature(f.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(form)} disabled={!form.name || saving} className="flex-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Criar plano
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PlansPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [priceVariation, setPriceVariation] = useState(false);

  // Entrega padrão state
  const [deliveryDest, setDeliveryDest] = useState("message");
  const [deliveryContent, setDeliveryContent] = useState("");
  const [deliveryMsgId, setDeliveryMsgId] = useState<string | null>(null);
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);

  useEffect(() => {
    fetch(`/api/bots/${botId}/plans`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPlans(data); })
      .finally(() => setLoading(false));

    // Load delivery message (trigger: "delivery")
    fetch(`/api/bots/${botId}/messages`)
      .then((r) => r.json())
      .then((msgs: Array<{ id: string; trigger: string; content: string }>) => {
        if (!Array.isArray(msgs)) return;
        const dm = msgs.find((m) => m.trigger === "delivery");
        if (dm) { setDeliveryMsgId(dm.id); setDeliveryContent(dm.content); }
      });
  }, [botId]);

  async function handleSavePlan(planId: string, data: Omit<Plan, "id">) {
    setSaving(true);
    try {
      const res = await fetch(`/api/bots/${botId}/plans/${planId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${res.status}`); }
      const updated: Plan = await res.json();
      setPlans((prev) => prev.map((p) => p.id === planId ? { ...updated, _count: p._count } : p));
      setExpandedId(null);
    } catch (e) {
      alert((e as Error).message);
    } finally { setSaving(false); }
  }

  async function handleCreatePlan(data: Omit<Plan, "id">) {
    setSaving(true);
    try {
      const res = await fetch(`/api/bots/${botId}/plans`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${res.status}`); }
      const created: Plan = await res.json();
      setPlans((prev) => [...prev, created]);
      setAddingNew(false);
    } finally { setSaving(false); }
  }

  async function handleDelete(planId: string) {
    await fetch(`/api/bots/${botId}/plans/${planId}`, { method: "DELETE" });
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    setExpandedId(null);
  }

  async function saveDelivery() {
    setSavingDelivery(true);
    try {
      if (deliveryMsgId) {
        await fetch(`/api/bots/${botId}/messages/${deliveryMsgId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: deliveryContent, parseMode: "plain", trigger: "delivery", name: "Entrega Padrão" }),
        });
      } else {
        const res = await fetch(`/api/bots/${botId}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: deliveryContent, parseMode: "plain", trigger: "delivery", name: "Entrega Padrão" }),
        });
        const msg = await res.json();
        setDeliveryMsgId(msg.id);
      }
      setEditingDelivery(false);
    } finally { setSavingDelivery(false); }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">

        {/* ── Left: Plans list ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Planos de Pagamento</h2>
                <p className="text-xs text-zinc-500">Configure até 10 planos com entregas personalizadas</p>
              </div>
            </div>
            <span className="text-xs text-zinc-400 font-medium tabular-nums">{plans.length}/10</span>
          </div>

          {/* Plan rows */}
          <div className="flex-1">
            {plans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                expanded={expandedId === plan.id}
                onToggle={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
                onSave={(data) => handleSavePlan(plan.id, data)}
                onDelete={() => handleDelete(plan.id)}
                saving={saving}
              />
            ))}

            {plans.length === 0 && !addingNew && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-7 h-7 text-zinc-200 mb-2" />
                <p className="text-sm text-zinc-400">Nenhum plano criado ainda</p>
              </div>
            )}

            {addingNew && (
              <NewPlanRow
                onSave={handleCreatePlan}
                saving={saving}
                onCancel={() => setAddingNew(false)}
              />
            )}
          </div>

          {/* Add plan button */}
          {!addingNew && plans.length < 10 && (
            <button
              onClick={() => { setAddingNew(true); setExpandedId(null); }}
              className="flex items-center justify-center gap-2 px-5 py-3.5 text-sm text-zinc-500 hover:bg-zinc-50 border-t border-dashed border-zinc-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Plano
            </button>
          )}

          {/* Variação de Preço */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <ArrowUpDown className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Variação de Preço</p>
                <p className="text-xs text-zinc-500">Preço único por cliente (anti-fraude)</p>
              </div>
            </div>
            <Switch checked={priceVariation} onCheckedChange={setPriceVariation} />
          </div>
        </div>

        {/* ── Right: Entrega Padrão ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col gap-5 p-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Entrega Padrão (Fallback)</h2>
              <p className="text-xs text-zinc-500">Usada quando o plano está em &apos;Usar plano padrão&apos;</p>
            </div>
          </div>

          {/* Destino da Entrega */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">
              Destino da Entrega <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Select value={deliveryDest} onValueChange={setDeliveryDest}>
                <SelectTrigger className="flex-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">💬 Mensagem no Bot</SelectItem>
                  <SelectItem value="channel">📢 Canal</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" variant="outline" className="shrink-0">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Mensagem de Entrega */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Mensagem de Entrega</Label>
            {editingDelivery ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  value={deliveryContent}
                  onChange={(e) => setDeliveryContent(e.target.value)}
                  placeholder="Ex: ✅ Pagamento confirmado! Aqui está seu acesso..."
                  className="min-h-[120px] text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveDelivery} disabled={savingDelivery} className="flex-1">
                    {savingDelivery ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingDelivery(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="relative border border-zinc-200 rounded-xl px-3 py-2.5 min-h-[70px] bg-zinc-50/50">
                {deliveryContent ? (
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap">{deliveryContent}</p>
                ) : (
                  <p className="text-sm text-zinc-400 italic">Sem mensagem configurada...</p>
                )}
                <button
                  onClick={() => setEditingDelivery(true)}
                  className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-600"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Tip */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
            <span className="font-medium">💡 Dica:</span> Esta configuração será usada quando um plano estiver
            marcado como &apos;Usar entrega padrão&apos;. Cada plano pode ter sua própria entrega personalizada.
          </div>
        </div>
      </div>
    </div>
  );
}
