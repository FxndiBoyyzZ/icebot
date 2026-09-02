"use client";

import { LayoutGrid } from "lucide-react";

export default function ButtonsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <LayoutGrid className="w-6 h-6 text-zinc-600" />
        <h1 className="text-2xl font-bold">Botões</h1>
      </div>
      <p className="text-zinc-500 mb-8">Biblioteca de botões inline reutilizáveis para mensagens e canais.</p>
      <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center text-zinc-400">
        Em breve
      </div>
    </div>
  );
}
