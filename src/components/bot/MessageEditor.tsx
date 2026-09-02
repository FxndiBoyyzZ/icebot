"use client";

import React, { useState } from "react";
import { TelegramPreview } from "@/components/preview/TelegramPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MESSAGE_TRIGGERS } from "@/lib/utils";
import { Plus, Trash2, Bold, Italic, Code, Link, Sparkles, Globe, X, RefreshCw, Check } from "lucide-react";
import { SUPPORTED_LANGUAGES, getLanguage } from "@/data/languages";

interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
  style?: "primary" | "success" | "danger";
  icon_custom_emoji_id?: string;
  icon_emoji?: string;
  icon_thumb?: string;
}

export interface LangTranslation {
  content: string;
  buttons?: InlineButton[][];
  mode: "auto" | "manual";
}

export type TranslationsMap = Record<string, LangTranslation>;

interface MessageEditorProps {
  botName?: string;
  botUsername?: string;
  botId?: string;
  initialData?: {
    name?: string;
    trigger?: string;
    content?: string;
    parseMode?: string;
    buttons?: InlineButton[][];
    translations?: TranslationsMap;
  };
  onSave?: (data: {
    name: string;
    trigger: string;
    content: string;
    parseMode: string;
    buttons: InlineButton[][];
    translations: TranslationsMap;
  }) => Promise<void>;
  saving?: boolean;
}

export function MessageEditor({
  botName = "Meu Bot",
  botUsername = "meubot",
  botId,
  initialData,
  onSave,
  saving,
}: MessageEditorProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [trigger, setTrigger] = useState(initialData?.trigger ?? "custom");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [parseMode, setParseMode] = useState(initialData?.parseMode ?? "MarkdownV2");
  const [buttons, setButtons] = useState<InlineButton[][]>(initialData?.buttons ?? []);
  const [translations, setTranslations] = useState<TranslationsMap>(initialData?.translations ?? {});

  // which language tab is active in editor ("default" or lang code like "en")
  const [activeLang, setActiveLang] = useState("default");
  // which language is shown in the preview (independent from editor)
  const [previewLang, setPreviewLang] = useState("default");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [translating, setTranslating] = useState<Set<string>>(new Set());

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const activeLangs = Object.keys(translations);

  // ── current content being shown in editor ──────────────────────────────────
  const currentContent = activeLang === "default" ? content : (translations[activeLang]?.content ?? "");
  const currentButtons = activeLang === "default" ? buttons : (translations[activeLang]?.buttons ?? buttons);

  // ── content shown in preview (based on previewLang) ───────────────────────
  const previewContent = previewLang === "default" ? content : (translations[previewLang]?.content ?? content);
  const previewButtons = previewLang === "default" ? buttons : (translations[previewLang]?.buttons ?? buttons);

  function setCurrentContent(val: string) {
    if (activeLang === "default") {
      setContent(val);
    } else {
      setTranslations((prev) => ({
        ...prev,
        [activeLang]: { ...prev[activeLang], content: val, mode: "manual" },
      }));
    }
  }

  // ── formatting toolbar ─────────────────────────────────────────────────────
  function insertFormat(before: string, after = before) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = currentContent.slice(start, end);
    const next = currentContent.slice(0, start) + before + selected + after + currentContent.slice(end);
    setCurrentContent(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }

  // ── buttons ────────────────────────────────────────────────────────────────
  function addButtonRow() { setButtons((p) => [...p, [{ text: "", url: "" }]]); }
  function addButtonToRow(ri: number) {
    setButtons((p) => p.map((row, i) => i === ri ? [...row, { text: "", url: "" }] : row));
  }
  function updateButton(ri: number, bi: number, field: keyof InlineButton, value: string) {
    setButtons((p) => p.map((row, i) => i === ri ? row.map((b, j) => j === bi ? { ...b, [field]: value } : b) : row));
  }
  function setButtonStyle(ri: number, bi: number, style: InlineButton["style"]) {
    setButtons((p) => p.map((row, i) => i === ri ? row.map((b, j) => j === bi ? { ...b, style } : b) : row));
  }
  function removeButton(ri: number, bi: number) {
    setButtons((p) => p.map((row, i) => i === ri ? row.filter((_, j) => j !== bi) : row).filter((r) => r.length > 0));
  }

  // ── language management ────────────────────────────────────────────────────
  function addLanguage(code: string) {
    setTranslations((prev) => ({
      ...prev,
      [code]: { content: "", buttons: undefined, mode: "manual" },
    }));
    setActiveLang(code);
    setShowLangPicker(false);
  }

  function removeLanguage(code: string) {
    setTranslations((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    if (activeLang === code) setActiveLang("default");
  }

  // ── translation ────────────────────────────────────────────────────────────
  const [translateError, setTranslateError] = useState<string | null>(null);

  async function translateLangs(langs: string[]) {
    if (!content.trim() || langs.length === 0) return;
    setTranslating(new Set(langs));
    setTranslateError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targetLangs: langs, parseMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTranslateError(data.error ?? "Erro ao traduzir");
        return;
      }
      if (data.translations) {
        setTranslations((prev) => {
          const next = { ...prev };
          for (const [lang, translated] of Object.entries(data.translations as Record<string, string>)) {
            next[lang] = { content: translated, buttons: prev[lang]?.buttons, mode: "auto" };
          }
          return next;
        });
      }
      if (data.errors && Object.keys(data.errors).length > 0) {
        const failed = Object.keys(data.errors).map((c) => getLanguage(c)?.label ?? c).join(", ");
        setTranslateError(`Falhou para: ${failed}`);
      }
    } catch (e) {
      console.error("Translation error:", e);
      setTranslateError("Erro de conexão ao traduzir");
    } finally {
      setTranslating(new Set());
    }
  }

  // ── save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!onSave) return;
    await onSave({ name, trigger, content, parseMode, buttons, translations });
  }

  const availableToAdd = SUPPORTED_LANGUAGES.filter((l) => !translations[l.code]);
  const isTranslatingAny = translating.size > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* ── Editor ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 overflow-y-auto pr-1">
        {/* Name + Trigger */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Nome interno</Label>
            <Input
              placeholder="Ex: Boas-vindas plano Pro"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Gatilho</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MESSAGE_TRIGGERS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Format */}
        <div className="flex flex-col gap-1.5">
          <Label>Formato</Label>
          <Select value={parseMode} onValueChange={setParseMode}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
              <SelectItem value="HTML">HTML</SelectItem>
              <SelectItem value="plain">Sem formatação</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Language tabs ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Idiomas</Label>
            {activeLangs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                onClick={() => translateLangs(activeLangs)}
                disabled={isTranslatingAny || !content.trim()}
              >
                {isTranslatingAny
                  ? <><RefreshCw className="h-3 w-3 animate-spin" /> Traduzindo...</>
                  : <><Sparkles className="h-3 w-3" /> Traduzir todos</>}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Default tab */}
            <button
              onClick={() => setActiveLang("default")}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                activeLang === "default"
                  ? "bg-zinc-800 text-white border-zinc-800"
                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
              }`}
            >
              🇺🇸 Padrão
            </button>

            {/* Added language tabs */}
            {activeLangs.map((code) => {
              const lang = getLanguage(code);
              const trans = translations[code];
              const isLoading = translating.has(code);
              return (
                <div key={code} className="relative group">
                  <button
                    onClick={() => setActiveLang(code)}
                    className={`flex items-center gap-1.5 pl-2.5 pr-6 py-1 rounded-full text-xs font-medium transition-colors border ${
                      activeLang === code
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-violet-300"
                    }`}
                  >
                    {isLoading
                      ? <RefreshCw className="h-3 w-3 animate-spin" />
                      : trans.mode === "auto"
                        ? <Sparkles className="h-3 w-3 opacity-70" />
                        : trans.content
                          ? <Check className="h-3 w-3 opacity-70" />
                          : <Globe className="h-3 w-3 opacity-50" />}
                    {lang?.flag} {lang?.label ?? code.toUpperCase()}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeLanguage(code); }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}

            {/* Add language */}
            <div className="relative">
              <button
                onClick={() => setShowLangPicker((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-zinc-300 text-zinc-500 hover:border-violet-400 hover:text-violet-600 transition-colors"
              >
                <Plus className="h-3 w-3" /> Idioma
              </button>
              {showLangPicker && availableToAdd.length > 0 && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg p-2 w-48 max-h-56 overflow-y-auto">
                  {availableToAdd.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => addLanguage(lang.code)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm hover:bg-zinc-50 transition-colors text-left"
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Per-language actions when not on default */}
          {activeLang !== "default" && (
            <div className="flex items-center gap-2 px-0.5">
              {translations[activeLang]?.mode === "auto" && (
                <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> Auto-traduzido
                </span>
              )}
              {translations[activeLang]?.mode === "manual" && translations[activeLang]?.content && (
                <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                  ✏️ Manual
                </span>
              )}
              <button
                onClick={() => translateLangs([activeLang])}
                disabled={translating.has(activeLang) || !content.trim()}
                className="text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-1 disabled:opacity-40"
              >
                <RefreshCw className={`h-2.5 w-2.5 ${translating.has(activeLang) ? "animate-spin" : ""}`} />
                {translating.has(activeLang) ? "Traduzindo..." : "Regenerar tradução"}
              </button>
            </div>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>
              Mensagem
              {activeLang !== "default" && (
                <span className="ml-1.5 text-violet-600 text-xs font-normal">
                  — {getLanguage(activeLang)?.flag} {getLanguage(activeLang)?.label}
                </span>
              )}
            </Label>
            <div className="flex items-center gap-1">
              {[
                { icon: Bold,   fn: () => insertFormat("*", "*"),   title: "Negrito" },
                { icon: Italic, fn: () => insertFormat("_", "_"),   title: "Itálico" },
                { icon: Code,   fn: () => insertFormat("`", "`"),   title: "Código" },
                { icon: Link,   fn: () => { const u = prompt("URL:"); const t = prompt("Texto:") ?? "link"; if (u) insertFormat(`[${t}](`, ")"); }, title: "Link" },
              ].map(({ icon: Icon, fn, title }) => (
                <Button key={title} variant="ghost" size="icon" className="h-7 w-7" title={title} onClick={fn}>
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>
          </div>
          <Textarea
            ref={textareaRef}
            placeholder={activeLang === "default"
              ? "Olá, *{nome}*! 👋\n\nBem-vindo ao nosso serviço."
              : `Tradução em ${getLanguage(activeLang)?.label ?? activeLang}...`}
            value={currentContent}
            onChange={(e) => setCurrentContent(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          {activeLang === "default" && (
            <p className="text-xs text-zinc-500">
              Variáveis:{" "}
              {["{nome}", "{plano}", "{valor}", "{username}"].map((v) => (
                <code key={v} className="bg-zinc-100 px-1 rounded mr-1">{v}</code>
              ))}
            </p>
          )}
        </div>

        {/* ── Buttons (default only) ─────────────────────────────────────────── */}
        {activeLang === "default" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Botões inline</Label>
              <Button variant="outline" size="sm" onClick={addButtonRow}>
                <Plus className="h-3.5 w-3.5" /> Nova linha
              </Button>
            </div>
            {buttons.map((row, ri) => (
              <div key={ri} className="flex flex-col gap-2 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Linha {ri + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => addButtonToRow(ri)}>
                    <Plus className="h-3 w-3" /> Botão
                  </Button>
                </div>
                {row.map((btn, bi) => (
                  <div key={bi} className="flex flex-col gap-1">
                    <div className="flex gap-2 items-center">
                      <Input
                        placeholder="Texto"
                        value={btn.text}
                        onChange={(e) => updateButton(ri, bi, "text", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="URL ou callback"
                        value={btn.url ?? btn.callback_data ?? ""}
                        onChange={(e) => updateButton(ri, bi, "url", e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 h-8 w-8" onClick={() => removeButton(ri, bi)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 pl-0.5">
                      <span className="text-[10px] text-zinc-400 mr-0.5">Cor:</span>
                      {([
                        { value: undefined,  bg: "bg-zinc-400",   label: "Padrão" },
                        { value: "primary",  bg: "bg-[#2B5EAD]", label: "Azul" },
                        { value: "success",  bg: "bg-[#2ECC71]", label: "Verde" },
                        { value: "danger",   bg: "bg-[#E74C3C]", label: "Vermelho" },
                      ] as const).map(({ value, bg, label }) => (
                        <button
                          key={label}
                          title={label}
                          type="button"
                          onClick={() => setButtonStyle(ri, bi, value)}
                          className={`w-4 h-4 rounded-full ${bg} transition-all ${
                            btn.style === value ? "ring-2 ring-offset-1 ring-zinc-400 scale-110" : "opacity-50 hover:opacity-80"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {buttons.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-2">Nenhum botão adicionado</p>
            )}
          </div>
        )}

        {translateError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <span>⚠️</span> {translateError}
          </p>
        )}

        {onSave && (
          <Button
            onClick={handleSave}
            disabled={saving || isTranslatingAny || !name || !content}
            className="w-full"
          >
            {saving ? "Salvando..." : isTranslatingAny ? "Aguarde a tradução..." : "Salvar mensagem"}
          </Button>
        )}
      </div>

      {/* ── Live Preview ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-zinc-500">Preview</Label>
          <span className="text-xs text-green-500 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Ao vivo
          </span>
        </div>

        {/* Flag switcher */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Default (🇺🇸) */}
          <button
            onClick={() => setPreviewLang("default")}
            title="Padrão (EN)"
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all border ${
              previewLang === "default"
                ? "bg-zinc-800 text-white border-zinc-800 shadow-sm"
                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            🇺🇸 Padrão
          </button>

          {activeLangs.map((code) => {
            const lang = getLanguage(code);
            const hasContent = !!translations[code]?.content;
            const isAuto = translations[code]?.mode === "auto";
            return (
              <button
                key={code}
                onClick={() => setPreviewLang(code)}
                title={`${lang?.label ?? code}${isAuto ? " (auto)" : ""}${!hasContent ? " — sem tradução" : ""}`}
                className={`relative flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all border ${
                  previewLang === code
                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                    : hasContent
                      ? "bg-white text-zinc-600 border-zinc-200 hover:border-violet-300"
                      : "bg-white text-zinc-300 border-zinc-100 opacity-50 cursor-not-allowed"
                }`}
                disabled={!hasContent}
              >
                {lang?.flag ?? code.toUpperCase()}
                {isAuto && hasContent && (
                  <Sparkles className="h-2 w-2 opacity-60" />
                )}
              </button>
            );
          })}

          {activeLangs.length === 0 && (
            <span className="text-[11px] text-zinc-400 italic">Adicione idiomas para ver as traduções aqui</span>
          )}
        </div>

        <TelegramPreview
          botName={botName}
          botUsername={botUsername}
          botId={botId}
          content={previewContent}
          parseMode={parseMode as "MarkdownV2" | "HTML" | "plain"}
          buttons={previewButtons}
          className="flex-1 min-h-[500px]"
        />
      </div>
    </div>
  );
}
