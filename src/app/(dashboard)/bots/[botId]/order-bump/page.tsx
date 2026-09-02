"use client";

import { ShoppingCart } from "lucide-react";

export default function OrderBumpPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <ShoppingCart className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold">Order Bump</h1>
      </div>
      <p className="text-zinc-500 mb-8">Produto adicional oferecido no momento do checkout para aumentar o ticket médio.</p>
      <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center text-zinc-400">
        Em breve
      </div>
    </div>
  );
}
