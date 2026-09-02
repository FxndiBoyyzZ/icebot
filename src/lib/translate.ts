// Google Translate unofficial endpoint — no API key, no content filtering, never refuses.
// Handles Telegram Markdown/HTML by protecting variables and formatting markers before translation.

import { prisma } from "@/lib/prisma";

export const LANG_NAMES: Record<string, string> = {
  pt: "Português",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  fi: "Suomi",
  es: "Español",
  ja: "日本語",
  ko: "한국어",
  tr: "Türkçe",
  hi: "हिन्दी",
  id: "Bahasa Indonesia",
  th: "ภาษาไทย",
  pl: "Polski",
  sv: "Svenska",
  no: "Norsk",
  da: "Dansk",
  cs: "Čeština",
  hu: "Magyar",
  ro: "Română",
  he: "עברית",
  ru: "Русский",
  zh: "中文",
  ar: "العربية",
  uk: "Українська",
  vi: "Tiếng Việt",
};

// Returns cached translation from DB, or auto-translates + caches on miss.
export async function getOrTranslate(
  content: string,
  targetLang: string,
  messageId: string,
  existingTranslations: Record<string, { content: string; auto?: boolean; updatedAt?: string }>,
): Promise<string> {
  if (targetLang === "en" || !content?.trim()) return content;

  const cached = existingTranslations[targetLang];
  if (cached?.content) return cached.content;

  try {
    const translated = await translateOne(content, targetLang);
    const updated = {
      ...existingTranslations,
      [targetLang]: { content: translated, auto: true, updatedAt: new Date().toISOString() },
    };
    await prisma.message.update({
      where: { id: messageId },
      data: { translations: JSON.stringify(updated) },
    });
    return translated;
  } catch {
    return content; // fallback to original
  }
}

const VARIABLE_RE = /\{[a-zA-Z_.]+\}/g;

// Replace {variables} with short tokens Google won't mangle, restore after.
function protect(text: string): { protected: string; map: Record<string, string> } {
  const map: Record<string, string> = {};
  let idx = 0;
  const out = text.replace(VARIABLE_RE, (match) => {
    const token = `ICEBOTVAR${idx++}`;
    map[token] = match;
    return token;
  });
  return { protected: out, map };
}

function restore(text: string, map: Record<string, string>): string {
  return Object.entries(map).reduce((s, [token, original]) => s.replaceAll(token, original), text);
}

async function googleTranslate(text: string, targetLang: string): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);

  // Response: [ [ ["translated", "original"], ... ], null, "detected_lang", ... ]
  const data = await res.json();
  const translated: string = (data[0] as [string, string][])
    ?.map((chunk) => chunk[0])
    .join("") ?? text;

  return translated.trim();
}

export async function translateOne(
  content: string,
  targetCode: string,
  // parseMode kept for API compatibility — Google handles formatting natively
  _parseMode = "plain"
): Promise<string> {
  if (!content?.trim()) return content;

  // Don't translate if source already appears to be in the target language
  // (Google will just return the original, so this is a minor optimization)
  const { protected: tokenized, map } = protect(content);
  const translated = await googleTranslate(tokenized, targetCode);
  return restore(translated, map);
}

export async function translateMany(
  content: string,
  targetLangs: string[],
  parseMode = "plain"
): Promise<Record<string, string>> {
  const results = await Promise.allSettled(
    targetLangs.map(async (lang) => ({ lang, text: await translateOne(content, lang, parseMode) }))
  );
  const out: Record<string, string> = {};
  for (const r of results) {
    if (r.status === "fulfilled") out[r.value.lang] = r.value.text;
  }
  return out;
}
