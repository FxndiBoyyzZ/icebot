"use client";

import { TrendingUp } from "lucide-react";

export default function UpsellPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp className="w-6 h-6 text-violet-500" />
        <h1 className="text-2xl font-bold">Upsell</h1>
      </div>
      <p className="text-zinc-500 mb-8">Configure ofertas de upsell enviadas automaticamente após a compra.</p>
      <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center text-zinc-400">
        Em breve
      </div>
    </div>
  );
}
