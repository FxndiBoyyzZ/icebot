"use client";

import { BarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ConversionsPage() {
  const metrics = [
    { label: "Cliques no link", value: "—" },
    { label: "Iniciaram bot", value: "—" },
    { label: "Viram oferta", value: "—" },
    { label: "Compraram", value: "—" },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <BarChart2 className="w-6 h-6 text-indigo-500" />
        <h1 className="text-2xl font-bold">Conversões</h1>
      </div>
      <p className="text-zinc-500 mb-8">Funil de conversão do tráfego até a compra.</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {metrics.map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-5 text-center">
              <p className="text-3xl font-bold text-zinc-900">{value}</p>
              <p className="text-xs text-zinc-500 mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center text-zinc-400">
        Gráfico de conversão em breve
      </div>
    </div>
  );
}
