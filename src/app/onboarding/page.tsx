"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, Building2 } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-zinc-900">IceBot</span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle>Qual é o nome do seu negócio?</CardTitle>
            <CardDescription>Você pode mudar isso depois</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="org">Nome da organização</Label>
                <Input
                  id="org"
                  placeholder="Ex: Minha Empresa, Canal VIP..."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={!orgName}>
                Continuar →
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
