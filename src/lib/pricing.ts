// [currency, rate from USD, display symbol]
export const LANG_PRICING: Record<string, [string, number, string]> = {
  pt: ["brl", 5.50, "R$"],
  en: ["usd", 1.00, "$"],
  es: ["usd", 1.00, "$"],
  fr: ["eur", 0.93, "€"],
  de: ["eur", 0.93, "€"],
  it: ["eur", 0.93, "€"],
  nl: ["eur", 0.93, "€"],
  fi: ["eur", 0.93, "€"],
  pl: ["pln", 4.00, "zł"],
  tr: ["try", 32.0, "₺"],
  ja: ["jpy", 155,  "¥"],
  ko: ["krw", 1350, "₩"],
  hi: ["inr", 83.0, "₹"],
  id: ["idr", 16000,"Rp"],
  th: ["thb", 35.0, "฿"],
  sv: ["sek", 10.5, "kr"],
  no: ["nok", 10.7, "kr"],
  da: ["dkk", 6.90, "kr"],
  cs: ["czk", 23.0, "Kč"],
  hu: ["huf", 360,  "Ft"],
  ro: ["ron", 4.60, "lei"],
  he: ["ils", 3.70, "₪"],
  ru: ["usd", 1.00, "$"],
  zh: ["usd", 1.00, "$"],
  ar: ["usd", 1.00, "$"],
  uk: ["usd", 1.00, "$"],
  vi: ["usd", 1.00, "$"],
};

export const ZERO_DECIMAL = new Set([
  "jpy","krw","bif","clp","gnf","kmf","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf",
]);

// Returns Stripe amount (cents or whole units for zero-decimal), rounded to X.90
export function charmPrice(usdCents: number, rate: number, isZeroDecimal: boolean): number {
  const usdUnits = usdCents / 100;
  const targetUnits = usdUnits * rate;
  if (isZeroDecimal) return Math.round(targetUnits / 10) * 10;
  const charm = Math.ceil(targetUnits - 0.90) + 0.90;
  return Math.round(charm * 100);
}

// Returns a human-readable price string for the user's language
export function displayPrice(usdCents: number, lang: string): string {
  const [currency, rate, symbol] = LANG_PRICING[lang] ?? ["usd", 1.00, "$"];
  const isZeroDecimal = ZERO_DECIMAL.has(currency);
  const amount = charmPrice(usdCents, rate, isZeroDecimal);
  if (isZeroDecimal) return `${symbol}${amount.toLocaleString()}`;
  return `${symbol}${(amount / 100).toFixed(2).replace(".", ",")}`;
}
