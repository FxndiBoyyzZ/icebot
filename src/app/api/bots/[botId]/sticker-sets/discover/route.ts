import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Candidate pack names — server tests all in parallel and returns only the ones that exist
const CANDIDATES = [
  // Telegram official / well-known sets
  "AnimatedEmojies",
  "EmojiAnimations",
  "TelegramEmoji",
  // Fire / energy
  "FireEmoji", "FlameEmoji", "FlamesEmoji", "BurningEmoji",
  // Hearts / love
  "HeartEmoji", "HeartsEmoji", "LoveEmoji", "RedHearts",
  // Stars / shine
  "StarEmoji", "StarsEmoji", "GoldStarEmoji", "ShineEmoji", "SparkleEmoji",
  // Money / business
  "MoneyEmoji", "CashEmoji", "GoldEmoji", "CoinEmoji",
  // Faces
  "CoolEmoji", "FunnyEmoji", "CuteEmoji", "HappyEmoji", "SadEmoji",
  // Misc popular patterns
  "NeonEmoji", "GlowEmoji", "RainbowEmoji", "CrystalEmoji",
  "PeachEmoji", "MilkEmoji", "BlueEmoji", "PurpleEmoji",
  "SnowflakeEmoji", "MoonEmoji", "SunEmoji", "CloudEmoji",
  // Common creator patterns
  "EeveeEmoji", "KittyEmoji", "BunnyEmoji",
  "DiamondEmoji", "CrownEmoji", "TrophyEmoji",
  "RocketEmoji", "LightningEmoji", "ThunderEmoji",
];

interface TGSticker {
  file_id: string;
  custom_emoji_id?: string;
  emoji?: string;
  thumbnail?: { file_id: string };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

  const results = await Promise.allSettled(
    CANDIDATES.map(async (name) => {
      const res = await fetch(
        `https://api.telegram.org/bot${bot.token}/getStickerSet?name=${encodeURIComponent(name)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      if (!data.ok) throw new Error("not found");
      const set = data.result;
      return {
        name: set.name as string,
        title: set.title as string,
        sticker_type: (set.sticker_type as string) ?? "regular",
        stickers: (set.stickers as TGSticker[]).slice(0, 100).map((s) => ({
          custom_emoji_id: s.custom_emoji_id ?? s.file_id,
          emoji: s.emoji ?? "⭐",
          file_id: s.file_id,
          thumb_file_id: s.thumbnail?.file_id ?? null,
        })),
      };
    })
  );

  const found = results
    .filter((r) => r.status === "fulfilled")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r) => (r as any).value);

  return NextResponse.json({ packs: found });
}
