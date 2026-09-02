import { NextRequest, NextResponse } from "next/server";
import { getMTProtoClient } from "@/lib/telegram-mtproto";
import { prisma } from "@/lib/prisma";
import { Api } from "telegram";

// Cria canal via MTProto — runtime Node + tempo extra
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { botId, title, language, username: requestedUsername, description } = await req.json();

    if (!botId || !title?.trim() || !language) {
      return NextResponse.json(
        { error: "botId, título e idioma são obrigatórios" },
        { status: 400 }
      );
    }

    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

    const client = await getMTProtoClient();

    // Create the channel
    const result = await client.invoke(
      new Api.channels.CreateChannel({
        title: title.trim(),
        about: description?.trim() ?? "",
        broadcast: true,
      })
    ) as Api.Updates;

    const tgChannel = result.chats?.[0] as Api.Channel | undefined;
    if (!tgChannel) throw new Error("Canal criado mas não foi possível obter dados do Telegram");

    const channelNumericId = tgChannel.id.toString();
    const chatId = `-100${channelNumericId}`;

    // Set username if provided (ignore errors — username may be taken)
    if (requestedUsername?.trim()) {
      const uname = requestedUsername.trim().replace(/^@/, "");
      try {
        await client.invoke(
          new Api.channels.UpdateUsername({ channel: tgChannel, username: uname })
        );
      } catch {
        // silently continue
      }
    }

    // Resolve bot entity by @username (getEntity by numeric ID fails without a cached access hash)
    const meRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`).then((r) => r.json());
    if (!meRes.ok) throw new Error("Não foi possível obter informações do bot via Bot API");

    const botUsername = meRes.result.username as string;
    if (!botUsername) throw new Error("Bot não tem username — não é possível adicioná-lo como admin");

    const botEntity = await client.getEntity(`@${botUsername}`);

    // Invite bot to the channel first (required before EditAdmin in some cases)
    try {
      await client.invoke(
        new Api.channels.InviteToChannel({ channel: tgChannel, users: [botEntity] })
      );
    } catch {
      // Bot may already be a participant — ignore PEER_FLOOD / USER_ALREADY_PARTICIPANT
    }

    // Promote bot to admin
    await client.invoke(
      new Api.channels.EditAdmin({
        channel: tgChannel,
        userId: botEntity,
        adminRights: new Api.ChatAdminRights({
          changeInfo: true,
          postMessages: true,
          editMessages: true,
          deleteMessages: true,
          banUsers: false,
          inviteUsers: true,
          pinMessages: true,
          addAdmins: false,
          anonymous: false,
          manageCall: false,
          other: true,
          manageTopics: false,
        }),
        rank: "Bot",
      })
    );

    // Add @ghdowin (Telegram Premium account) as full admin
    try {
      const ghdowinEntity = await client.getEntity("@ghdowin");
      try {
        await client.invoke(new Api.channels.InviteToChannel({ channel: tgChannel, users: [ghdowinEntity] }));
      } catch {}
      await client.invoke(
        new Api.channels.EditAdmin({
          channel: tgChannel,
          userId: ghdowinEntity,
          adminRights: new Api.ChatAdminRights({
            changeInfo: true, postMessages: true, editMessages: true,
            deleteMessages: true, banUsers: true, inviteUsers: true,
            pinMessages: true, addAdmins: true, anonymous: false,
            manageCall: true, other: true, manageTopics: false,
          }),
          rank: "Admin",
        })
      );
    } catch {
      // silently continue — @ghdowin may already be admin or temporarily unavailable
    }

    // Persist in DB
    const resolvedUsername = requestedUsername?.trim().replace(/^@/, "") || null;
    const channel = await prisma.channel.upsert({
      where: { chatId_botId: { chatId, botId } },
      update: { title: title.trim(), language, botIsAdmin: true, updatedAt: new Date() },
      create: {
        chatId,
        title: title.trim(),
        username: resolvedUsername,
        type: "channel",
        language,
        botIsAdmin: true,
        botId,
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao criar canal";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
