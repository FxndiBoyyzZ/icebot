"use client"

import { motion, useInView, type Variants } from "framer-motion"
import { useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Bot, MessageSquare, CreditCard, Zap, ArrowRight,
  BarChart3, Users, Layers,
} from "lucide-react"

const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
}

const stagger: Variants = {
  animate: { transition: { staggerChildren: 0.07 } },
}

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div ref={ref} initial="initial" animate={inView ? "animate" : "initial"} variants={stagger} className={className}>
      {children}
    </motion.div>
  )
}

function FadeItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={fadeInUp} className={className}>{children}</motion.div>
}

const features = [
  {
    icon: MessageSquare,
    title: "Editor com live preview",
    description: "Escreva mensagens em Telegram MarkdownV2 e veja exatamente como seus assinantes vão receber — botões inline inclusos.",
  },
  {
    icon: CreditCard,
    title: "Stripe + PIX nativo",
    description: "Cobrança automática, assinaturas recorrentes e recuperação de pagamentos. Funciona em reais sem configuração extra.",
  },
  {
    icon: Layers,
    title: "Upsell & Order Bump",
    description: "Aumente o ticket médio com ofertas automáticas de upsell, downsell e order bumps configurados por plano.",
  },
  {
    icon: Bot,
    title: "Multi-bot",
    description: "Gerencie quantos bots quiser na mesma conta, cada um com planos, mídias e assinantes independentes.",
  },
  {
    icon: Users,
    title: "Multi-tenant",
    description: "Cada conta fica completamente isolada. Ideal para agências que gerenciam bots de múltiplos clientes.",
  },
  {
    icon: BarChart3,
    title: "Métricas em tempo real",
    description: "Acompanhe assinaturas, receita e conversões com dashboards atualizados em tempo real via Pusher.",
  },
]

const steps = [
  {
    number: "01",
    title: "Conecte seu bot",
    description: "Cole o token do BotFather e seu bot estará online em minutos. Nenhuma configuração de servidor necessária.",
  },
  {
    number: "02",
    title: "Configure seus planos",
    description: "Crie planos de venda com preços, mídias exclusivas, mensagens de boas-vindas e sequências automatizadas.",
  },
  {
    number: "03",
    title: "Receba automaticamente",
    description: "Seus clientes assinam via Stripe ou PIX e têm o acesso liberado imediatamente, sem intervenção manual.",
  },
]

const stats = [
  { value: "500+", label: "Bots ativos" },
  { value: "1,2M+", label: "Mensagens enviadas" },
  { value: "R$ 2M+", label: "Em vendas processadas" },
  { value: "99,9%", label: "Uptime garantido" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50">

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">IceBot</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#features" className="hover:text-zinc-100 transition-colors">Funcionalidades</a>
            <a href="#how-it-works" className="hover:text-zinc-100 transition-colors">Como funciona</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
              <Link href="/sign-in">Entrar</Link>
            </Button>
            <Button size="sm" asChild className="bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20">
              <Link href="/sign-up">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-12 px-6">
        {/* Background radial glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/8 rounded-full blur-[140px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <FadeItem>
              <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-medium px-3.5 py-1.5 rounded-full mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Plataforma de bots de vendas para Telegram
              </div>
            </FadeItem>

            <FadeItem>
              <h1 className="text-5xl sm:text-6xl md:text-[72px] font-bold tracking-[-0.03em] leading-[1.04] mb-6">
                Venda no Telegram{" "}
                <span className="bg-gradient-to-br from-blue-400 to-blue-600 bg-clip-text text-transparent">
                  com automação real
                </span>
              </h1>
            </FadeItem>

            <FadeItem>
              <p className="text-lg text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                Configure bots, planos, mensagens com live preview e pagamentos via Stripe ou PIX. Tudo centralizado — sem código, sem servidor.
              </p>
            </FadeItem>

            <FadeItem>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Button size="lg" asChild className="bg-blue-600 hover:bg-blue-500 text-white h-12 px-7 text-[15px] shadow-lg shadow-blue-600/25">
                  <Link href="/sign-up">
                    Criar conta grátis
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 px-7 text-[15px] border-zinc-700 bg-transparent hover:bg-zinc-800/60 text-zinc-300">
                  <Link href="/dashboard">Ver dashboard demo</Link>
                </Button>
              </div>
              <p className="text-xs text-zinc-600 mt-4">Sem cartão de crédito · Cancele quando quiser</p>
            </FadeItem>
          </AnimatedSection>
        </div>

        {/* Product mockup */}
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-4xl mx-auto mt-16"
        >
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.5)]">
            {/* Window bar */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800 bg-zinc-900/90">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="mx-auto text-[11px] text-zinc-500 font-mono">icebot.app/dashboard</span>
            </div>

            <div className="p-5 space-y-4">
              {/* Top stat cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Assinantes ativos", value: "1.247", change: "+12%" },
                  { label: "Receita (mês)", value: "R$ 8.920", change: "+23%" },
                  { label: "Conversão", value: "34,2%", change: "+4,1pp" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-3">
                    <p className="text-zinc-500 text-[10px] mb-1">{s.label}</p>
                    <p className="text-zinc-100 font-semibold text-sm">{s.value}</p>
                    <p className="text-emerald-400 text-[10px] mt-0.5 font-medium">{s.change}</p>
                  </div>
                ))}
              </div>

              {/* Editor + preview side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-3">
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-2">Editor de mensagem</p>
                  <div className="space-y-1.5">
                    <div className="h-1.5 bg-zinc-700 rounded-full w-4/5" />
                    <div className="h-1.5 bg-blue-600/50 rounded-full w-1/2" />
                    <div className="h-1.5 bg-zinc-700 rounded-full w-full" />
                    <div className="h-1.5 bg-zinc-700 rounded-full w-3/4" />
                    <div className="h-1.5 bg-zinc-700 rounded-full w-2/3" />
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-3">
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium mb-2">Preview Telegram</p>
                  <div className="rounded-lg bg-[#1c2730] p-2">
                    <div className="rounded-lg bg-[#2b5278] p-2 space-y-1">
                      <div className="h-1.5 bg-zinc-300/30 rounded-full w-4/5" />
                      <div className="h-1.5 bg-zinc-300/30 rounded-full w-3/5" />
                      <div className="h-1.5 bg-zinc-300/30 rounded-full w-full" />
                      <div className="mt-2 rounded bg-[#5288c1] h-5 w-full flex items-center justify-center">
                        <div className="h-1 bg-white/70 rounded-full w-2/5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Subtle glow below card */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-blue-600/10 blur-2xl rounded-full pointer-events-none" />
        </motion.div>
      </section>

      {/* Stats bar */}
      <section className="py-14 border-y border-zinc-800/50 mt-10">
        <div className="max-w-5xl mx-auto px-6">
          <AnimatedSection className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s) => (
              <FadeItem key={s.label}>
                <p className="text-3xl font-bold text-zinc-100 tabular-nums mb-1">{s.value}</p>
                <p className="text-sm text-zinc-500">{s.label}</p>
              </FadeItem>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <FadeItem className="text-center mb-16">
              <p className="text-blue-400 text-xs font-semibold mb-3 tracking-[0.12em] uppercase">Funcionalidades</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] mb-4">
                Tudo para vender no Telegram
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto leading-relaxed">
                Da criação do bot ao recebimento do pagamento, o IceBot cobre o ciclo completo de vendas.
              </p>
            </FadeItem>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f) => (
                <FadeItem key={f.title}>
                  <div className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mb-4">
                      <f.icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="font-semibold text-zinc-100 mb-2">{f.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{f.description}</p>
                  </div>
                </FadeItem>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <FadeItem className="text-center mb-16">
              <p className="text-blue-400 text-xs font-semibold mb-3 tracking-[0.12em] uppercase">Como funciona</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em]">
                Do zero ao bot funcionando em 3 passos
              </h2>
            </FadeItem>

            <div className="space-y-3">
              {steps.map((step) => (
                <FadeItem key={step.number}>
                  <div className="flex gap-5 items-start rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 hover:border-zinc-700 transition-colors duration-200">
                    <span className="text-4xl font-bold text-zinc-800 tabular-nums shrink-0 leading-none pt-0.5 select-none">
                      {step.number}
                    </span>
                    <div>
                      <h3 className="font-semibold text-zinc-100 text-lg mb-1.5">{step.title}</h3>
                      <p className="text-zinc-500 leading-relaxed text-[15px]">{step.description}</p>
                    </div>
                  </div>
                </FadeItem>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <FadeItem>
              <div className="relative rounded-3xl border border-zinc-800 bg-zinc-900/60 p-12 sm:p-16 text-center overflow-hidden">
                {/* Inner glow */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-40 bg-blue-600/8 blur-3xl" />
                </div>

                <h2 className="relative text-3xl sm:text-4xl font-bold tracking-[-0.02em] mb-4">
                  Pronto para automatizar suas vendas?
                </h2>
                <p className="relative text-zinc-400 mb-8 max-w-md mx-auto leading-relaxed">
                  Junte-se a centenas de criadores que usam o IceBot para vender assinaturas e produtos digitais no Telegram.
                </p>
                <Button size="lg" asChild className="relative bg-blue-600 hover:bg-blue-500 text-white h-12 px-8 text-[15px] shadow-lg shadow-blue-600/25">
                  <Link href="/sign-up">
                    Criar conta grátis
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <p className="relative text-xs text-zinc-600 mt-4">Sem cartão de crédito · 14 dias grátis</p>
              </div>
            </FadeItem>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">IceBot</span>
          </div>
          <p className="text-xs text-zinc-600">© 2026 IceBot. Todos os direitos reservados.</p>
          <div className="flex items-center gap-5 text-xs text-zinc-500">
            <Link href="#" className="hover:text-zinc-300 transition-colors">Privacidade</Link>
            <Link href="#" className="hover:text-zinc-300 transition-colors">Termos</Link>
            <Link href="/sign-in" className="hover:text-zinc-300 transition-colors">Entrar</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
