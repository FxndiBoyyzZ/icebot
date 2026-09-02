"use client";

import { use } from "react";
import { RefreshCw, Users, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function SubscriptionPage({ params }: { params: Promise<{ botId: string }> }) {
  use(params);

  const stats = [
    { label: "Assinantes ativos", value: "—", icon: Users, color: "text-blue-600" },
    { label: "MRR", value: "—", icon: DollarSign, color: "text-green-600" },
    { label: "Churn mensal", value: "—", icon: TrendingUp, color: "text-orange-600" },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <RefreshCw className="w-6 h-6 text-blue-500" />
        <h1 className="text-2xl font-bold">Assinatura</h1>
      </div>
      <p className="text-zinc-500 mb-8">Visão geral das assinaturas ativas e métricas de retenção.</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color}`} />
              <div>
                <p className="text-2xl font-bold text-zinc-900">{value}</p>
                <p className="text-sm text-zinc-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center text-zinc-400">
        Tabela de assinantes em breve
      </div>
    </div>
  );
}
