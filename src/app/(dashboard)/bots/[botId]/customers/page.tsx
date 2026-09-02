"use client";

import { use, useEffect, useState } from "react";
import { Loader2, Users, Globe, Link as LinkIcon, DollarSign } from "lucide-react";
import { LANG_NAMES } from "@/lib/translate";

interface Subscription {
  plan: { name: string } | null;
}

interface Customer {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  language: string | null;
  source: string | null;
  createdAt: string;
  subscriptions: Subscription[];
}

interface SourceCount {
  source: string | null;
  _count: { source: number };
}

interface LangCount {
  language: string | null;
  _count: { language: number };
}

interface CurrencyCount {
  currency: string;
  count: number;
}

const CURRENCY_SYMBOL: Record<string, string> = {
  BRL: "R$", USD: "$", EUR: "€", JPY: "¥", KRW: "₩",
  INR: "₹", TRY: "₺", PLN: "zł", IDR: "Rp", THB: "฿",
  SEK: "kr", NOK: "kr", DKK: "kr", CZK: "Kč", HUF: "Ft",
  RON: "lei", ILS: "₪",
};

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-zinc-600 text-xs">—</span>;

  const colors: Record<string, string> = {
    tw: "bg-sky-900 text-sky-300",
    twitter: "bg-sky-900 text-sky-300",
    ig: "bg-pink-900 text-pink-300",
    instagram: "bg-pink-900 text-pink-300",
    yt: "bg-red-900 text-red-300",
    youtube: "bg-red-900 text-red-300",
    tt: "bg-zinc-700 text-zinc-200",
    tiktok: "bg-zinc-700 text-zinc-200",
    wa: "bg-green-900 text-green-300",
    whatsapp: "bg-green-900 text-green-300",
    fb: "bg-blue-900 text-blue-300",
    facebook: "bg-blue-900 text-blue-300",
  };

  const prefix = source.split("_")[0];
  const colorClass = colors[prefix] ?? "bg-zinc-800 text-zinc-300";

  return (
    <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${colorClass}`}>
      {source}
    </span>
  );
}

function LangBadge({ lang }: { lang: string | null }) {
  if (!lang) return <span className="text-zinc-600 text-xs">—</span>;
  return (
    <span className="text-[11px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
      {lang}
    </span>
  );
}

function FilterChips<T extends string>({
  icon,
  label,
  items,
  active,
  onSelect,
  renderLabel,
}: {
  icon: React.ReactNode;
  label: string;
  items: { key: T; display: string }[];
  active: T | null;
  onSelect: (v: T | null) => void;
  renderLabel?: (item: { key: T; display: string }) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${!active ? "bg-white text-black border-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
        >
          Todos
        </button>
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors font-mono ${active === item.key ? "bg-white text-black border-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
          >
            {renderLabel ? renderLabel(item) : item.display}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CustomersPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sources, setSources] = useState<SourceCount[]>([]);
  const [langs, setLangs] = useState<LangCount[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyCount[]>([]);
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [filterLang, setFilterLang] = useState<string | null>(null);
  const [filterCurrency, setFilterCurrency] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page) });
    if (filterSource) qs.set("source", filterSource);
    if (filterLang) qs.set("lang", filterLang);
    else if (filterCurrency) qs.set("currency", filterCurrency);
    fetch(`/api/bots/${botId}/customers?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setCustomers(d.customers ?? []);
        setTotal(d.total ?? 0);
        setSources(d.sources ?? []);
        setLangs(d.langs ?? []);
        setCurrencies(d.currencies ?? []);
      })
      .finally(() => setLoading(false));
  }, [botId, page, filterSource, filterLang, filterCurrency]);

  const totalPages = Math.ceil(total / 50);
  const hasFilters = filterSource || filterLang || filterCurrency;

  return (
    <div className="bg-zinc-950 min-h-full text-white">
      <div className="flex items-center gap-4 px-6 py-3 bg-zinc-900 border-b border-zinc-800 text-sm">
        <Users className="w-4 h-4 text-zinc-400" />
        <span className="text-zinc-400">{total.toLocaleString()} clientes</span>
      </div>

      <div className="p-6 space-y-4">
        <FilterChips
          icon={<LinkIcon className="w-3.5 h-3.5" />}
          label="Origem"
          items={sources.flatMap((s) => s.source ? [{ key: s.source, display: `${s.source} (${s._count.source})` }] : [])}
          active={filterSource}
          onSelect={(v) => { setFilterSource(v); setPage(1); }}
        />

        <FilterChips
          icon={<Globe className="w-3.5 h-3.5" />}
          label="Idioma"
          items={langs.flatMap((l) => l.language ? [{ key: l.language, display: l.language }] : [])}
          active={filterLang}
          onSelect={(v) => { setFilterLang(v); setFilterCurrency(null); setPage(1); }}
          renderLabel={(item) => (
            <>{LANG_NAMES[item.key] ?? item.key} <span className="opacity-50 font-normal">({langs.find(l => l.language === item.key)?._count.language})</span></>
          )}
        />

        <FilterChips
          icon={<DollarSign className="w-3.5 h-3.5" />}
          label="Moeda (inferida)"
          items={currencies.map((c) => ({ key: c.currency, display: c.currency }))}
          active={filterLang ? null : filterCurrency}
          onSelect={(v) => { setFilterCurrency(v); setFilterLang(null); setPage(1); }}
          renderLabel={(item) => (
            <>{CURRENCY_SYMBOL[item.key] ?? ""} {item.key} <span className="opacity-50 font-normal">({currencies.find(c => c.currency === item.key)?.count})</span></>
          )}
        />

        {hasFilters && (
          <button
            onClick={() => { setFilterSource(null); setFilterLang(null); setFilterCurrency(null); setPage(1); }}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Limpar filtros
          </button>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-zinc-600">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum cliente ainda</p>
            <p className="text-xs mt-1 text-zinc-700">Os clientes aparecem aqui quando interagem com o bot</p>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="text-left px-4 py-3 font-medium">Usuário</th>
                  <th className="text-left px-4 py-3 font-medium">Origem</th>
                  <th className="text-left px-4 py-3 font-medium">Idioma</th>
                  <th className="text-left px-4 py-3 font-medium">Plano</th>
                  <th className="text-left px-4 py-3 font-medium">Entrou em</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "—";
                  const activeSub = c.subscriptions?.[0];
                  return (
                    <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white truncate max-w-[180px]">{name}</div>
                        {c.username && (
                          <div className="text-xs text-zinc-500">@{c.username}</div>
                        )}
                        <div className="text-[10px] text-zinc-700 font-mono">{c.telegramId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={c.source} />
                      </td>
                      <td className="px-4 py-3">
                        <LangBadge lang={c.language} />
                      </td>
                      <td className="px-4 py-3">
                        {activeSub?.plan ? (
                          <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded">
                            {activeSub.plan.name}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(c.createdAt).toLocaleDateString("pt-BR")}
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
