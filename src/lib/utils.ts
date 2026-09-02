import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export const PLAN_INTERVALS = {
  monthly: "Mensal",
  yearly: "Anual",
  one_time: "Avulso",
} as const;

export const MESSAGE_TRIGGERS = {
  welcome: "Boas-vindas",
  payment_success: "Pagamento aprovado",
  payment_failed: "Pagamento recusado",
  subscription_expired: "Assinatura expirada",
  custom: "Personalizada",
} as const;
