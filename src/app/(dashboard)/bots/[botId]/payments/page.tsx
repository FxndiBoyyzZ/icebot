"use client";

import { use, useEffect, useState } from "react";
import { DollarSign, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";

interface PaymentCustomer {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  telegramId: string;
  language: string | null;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  createdAt: string;
  customer: PaymentCustomer;
}

interface CurrencyBreakdown {
  currency: string;
  _count: { currency: number };
  _sum: { amount: number | null };
}

const CURRENCY_SYMBOL: Record<string, string> = {
  brl: "R$", usd: "$", eur: "€", jpy: "¥", krw: "₩",
  inr: "₹", try: "₺", pln: "zł", idr: "Rp", thb: "฿",
  sek: "kr", nok: "kr", dkk: "kr", czk: "Kč", huf: "Ft",
  ron: "lei", ils: "₪",
};

const ZERO_DECIMAL = new Set(["jpy", "krw", "bif", "clp", "gnf", "kmf", "mga", "pyg", "rwf", "ugx", "vnd"]);

function formatAmount(amount: number, currency: string) {
  const sym = CURRENCY_SYMBOL[currency] ?? currency.toUpperCase();
  if (ZERO_DECIMAL.has(currency)) return `${sym}${amount.toLocaleString()}`;
  return `${sym}${(amount / 100).toFixed(2).replace(".", ",")}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "succeeded") return <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3 h-3" /> Aprovado</span>;
  if (status === "pending") return <span className="flex items-center gap-1 text-xs text-yellow-400"><Clock className="w-3 h-3" /> Pendente</span>;
  return <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3 h-3" /> {status}</span>;
}

export default function PaymentsPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [currencyBreakdown, setCurrencyBreakdown] = useState<CurrencyBreakdown[]>([]);
  const [filterCurrency, setFilterCurrency] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page) });
    if (filterCurrency) qs.set("currency", filterCurrency);
    fetch(`/api/bots/${botId}/payments?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setPayments(d.payments ?? []);
        setTotal(d.total ?? 0);
        setCurrencyBreakdown(d.currencyBreakdown ?? []);
      })
      .finally(() => setLoading(false));
  }, [botId, page, filterCurrency]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="bg-zinc-950 min-h-full text-white">
      <div className="flex items-center gap-4 px-6 py-3 bg-zinc-900 border-b border-zinc-800 text-sm">
        <DollarSign className="w-4 h-4 text-zinc-400" />
        <span className="text-zinc-400">{total.toLocaleString()} pagamentos</span>
      </div>

      <div className="p-6 space-y-4">
        {/* Currency breakdown + filter */}
        {currencyBreakdown.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <DollarSign className="w-3.5 h-3.5" />
              Moeda
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setFilterCurrency(null); setPage(1); }}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${!filterCurrency ? "bg-white text-black border-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
              >
                Todas
              </button>
              {currencyBreakdown.map((c) => (
                <button
                  key={c.currency}
                  onClick={() => { setFilterCurrency(c.currency); setPage(1); }}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors font-mono ${filterCurrency === c.currency ? "bg-white text-black border-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                >
                  {(CURRENCY_SYMBOL[c.currency] ?? "")} {c.currency.toUpperCase()}
                  {c._sum.amount != null && (
                    <span className="opacity-50 font-normal ml-1">({formatAmount(c._sum.amount, c.currency)})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 text-zinc-600">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum pagamento ainda</p>
            <p className="text-xs mt-1 text-zinc-700">Os pagamentos aparecem aqui após confirmação do Stripe</p>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium">Valor</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Provedor</th>
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const name = [p.customer.firstName, p.customer.lastName].filter(Boolean).join(" ") || "—";
                  return (
                    <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white truncate max-w-[180px]">{name}</div>
                        {p.customer.username && <div className="text-xs text-zinc-500">@{p.customer.username}</div>}
                        <div className="text-[10px] text-zinc-700 font-mono">{p.customer.telegramId}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-green-400 font-medium">
                        {formatAmount(p.amount, p.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 font-mono">{p.provider}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 text-xs text-zinc-500">
                <span>Página {page} de {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
