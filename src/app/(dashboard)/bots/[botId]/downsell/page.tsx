"use client";

import { TrendingDown } from "lucide-react";

export default function DownsellPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <TrendingDown className="w-6 h-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Downsell</h1>
      </div>
      <p className="text-zinc-500 mb-8">Oferta alternativa enviada quando o cliente recusa o plano principal.</p>
      <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center text-zinc-400">
        Em breve
      </div>
    </div>
  );
}
