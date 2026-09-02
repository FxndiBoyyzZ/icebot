"use client";

import { Trophy } from "lucide-react";

export default function TopSubscribersPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h1 className="text-2xl font-bold">Top Assinantes</h1>
      </div>
      <p className="text-zinc-500 mb-8">Clientes com maior LTV, mais tempo ativo ou mais indicações.</p>
      <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center text-zinc-400">
        Em breve
      </div>
    </div>
  );
}
