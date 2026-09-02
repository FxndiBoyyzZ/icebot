"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
  style?: "primary" | "success" | "danger";
  icon_custom_emoji_id?: string;
  icon_emoji?: string;
  icon_thumb?: string;
}

interface CustomEmojiEntry { id: string; thumb: string | null }

interface TelegramPreviewProps {
  botName?: string;
  botUsername?: string;
  content: string;
  parseMode?: "MarkdownV2" | "HTML" | "plain";
  buttons?: InlineButton[][];
  mediaUrl?: string;
  mediaType?: "photo" | "video" | "document";
  className?: string;
  botId?: string;
  customEmojiMap?: Record<string, CustomEmojiEntry>;
}

const SPOILER_HTML = `<span onclick="this.style.filter='none';this.style.background='transparent'" style="filter:blur(5px);background:rgba(255,255,255,0.18);border-radius:3px;padding:1px 3px;cursor:pointer;transition:filter 0.2s">$1</span>`;

function parseMarkdownV2(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\([_*[\]()~`>#+\-=|{}.!])/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\|\|(.+?)\|\|/g, SPOILER_HTML)
    .replace(/`(.+?)`/g, '<code class="bg-black/20 rounded px-0.5 text-xs font-mono">$1</code>')
    .replace(/\n/g, "<br/>");
}

function parseHTML(text: string): string {
  if (!text) return "";
  return text
    .replace(/<tg-spoiler>([\s\S]*?)<\/tg-spoiler>/g, SPOILER_HTML)
    // tg-emoji: show the fallback emoji with a premium sparkle badge
    .replace(
      /<tg-emoji emoji-id="([^"]+)">([\s\S]*?)<\/tg-emoji>/g,
      `<span style="position:relative;display:inline-block" title="Emoji premium (id: $1)">$2<sup style="font-size:0.55em;vertical-align:super;opacity:0.7">✨</sup></span>`
    )
    .replace(/\n/g, "<br/>");
}

function applyCustomEmoji(
  html: string,
  map: Record<string, CustomEmojiEntry>,
  botId: string
): string {
  let result = html;
  for (const [emoji, { thumb }] of Object.entries(map)) {
    const src = thumb
      ? `/api/bots/${botId}/tg-file?file_id=${thumb}`
      : null;
    const replacement = src
      ? `<img src="${src}" alt="${emoji}" style="display:inline-block;width:1.3em;height:1.3em;vertical-align:middle;object-fit:contain;" />`
      : emoji;
    // Split/join is safer than regex for emoji strings
    result = result.split(emoji).join(replacement);
  }
  return result;
}

export function TelegramPreview({
  botName = "Meu Bot",
  botUsername = "meubot",
  content,
  parseMode = "MarkdownV2",
  buttons = [],
  mediaUrl,
  mediaType,
  className,
  botId,
  customEmojiMap,
}: TelegramPreviewProps) {
  const parsedContent = useMemo(() => {
    if (!content) return "";
    let html = "";
    if (parseMode === "MarkdownV2") html = parseMarkdownV2(content);
    else if (parseMode === "HTML") html = parseHTML(content);
    else html = content.replace(/\n/g, "<br/>");
    if (botId && customEmojiMap && Object.keys(customEmojiMap).length > 0) {
      html = applyCustomEmoji(html, customEmojiMap, botId);
    }
    return html;
  }, [content, parseMode, customEmojiMap, botId]);

  return (
    <div className={cn("flex flex-col h-full bg-[#17212b] rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1c2733] border-b border-white/5">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {botName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-white text-sm font-semibold">{botName}</div>
          <div className="text-zinc-400 text-xs">@{botUsername} · bot</div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Date chip */}
        <div className="flex justify-center">
          <span className="text-xs text-zinc-400 bg-[#1c2733] px-3 py-1 rounded-full">Hoje</span>
        </div>

        {/* Message bubble */}
        <div className="flex justify-start">
          <div className="max-w-[85%]">
            <div className="bg-[#1c2733] rounded-2xl rounded-tl-sm overflow-hidden">
              {/* Media */}
              {mediaUrl && mediaType === "photo" && (
                <div className="w-full aspect-video bg-zinc-800 overflow-hidden">
                  <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              {mediaUrl && mediaType === "video" && (
                <div className="w-full aspect-video bg-zinc-800 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Text content */}
              {content && (
                <div className="p-3">
                  <p
                    className="text-white text-sm leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: parsedContent }}
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-zinc-500 text-[10px]">
                      {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              )}

              {/* Inline buttons */}
              {buttons.length > 0 && (
                <div className="border-t border-white/5 divide-y divide-white/5">
                  {buttons.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex divide-x divide-white/5">
                      {row.map((btn, btnIdx) => {
                        const styleMap: Record<string, string> = {
                          primary: "text-[#5B9CF6]",
                          success: "text-[#2ECC71]",
                          danger:  "text-[#E74C3C]",
                        };
                        const colorClass = btn.style ? styleMap[btn.style] : "text-zinc-300";
                        return (
                          <button
                            key={btnIdx}
                            className={`flex-1 py-2.5 px-3 text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5 ${colorClass}`}
                          >
                            {btn.icon_custom_emoji_id && (
                              btn.icon_thumb && botId
                                ? <img src={`/api/bots/${botId}/tg-file?file_id=${btn.icon_thumb}`} className="w-4 h-4 object-contain shrink-0" alt="" />
                                : <span className="text-base leading-none shrink-0">{btn.icon_emoji}</span>
                            )}
                            {btn.text}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Empty state */}
        {!content && !mediaUrl && (
          <div className="flex items-center justify-center h-32">
            <p className="text-zinc-500 text-sm">Digite uma mensagem para ver o preview</p>
          </div>
        )}
      </div>

      {/* Input bar (decorative) */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1c2733] border-t border-white/5">
        <div className="flex-1 bg-[#17212b] rounded-full px-4 py-2 text-zinc-500 text-sm">
          Mensagem
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
