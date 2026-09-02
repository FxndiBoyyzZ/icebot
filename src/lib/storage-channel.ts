import { prisma } from "@/lib/prisma";
import { getMTProtoClient } from "@/lib/telegram-mtproto";
import { Api } from "telegram";

export async function getOrCreateStorageChannel(botId: string) {
  const existing = await prisma.channel.findFirst({ where: { botId, isStorage: true } });
  if (existing) return existing;

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) throw new Error("Bot não encontrado");

  const client = await getMTProtoClient();

  const result = await client.invoke(
    new Api.channels.CreateChannel({
      title: `📦 Storage — ${bot.name}`,
      about: "Canal de armazenamento de mídias. Não remova.",
      broadcast: true,
    })
  ) as Api.Updates;

  const tgChannel = result.chats?.[0] as Api.Channel | undefined;
  if (!tgChannel) throw new Error("Falha ao criar canal de storage");

  const chatId = `-100${tgChannel.id.toString()}`;

  // Add bot as admin
  const meRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`).then((r) => r.json());
  if (meRes.ok && meRes.result.username) {
    const botEntity = await client.getEntity(`@${meRes.result.username}`);
    try { await client.invoke(new Api.channels.InviteToChannel({ channel: tgChannel, users: [botEntity] })); } catch {}
    await client.invoke(new Api.channels.EditAdmin({
      channel: tgChannel, userId: botEntity,
      adminRights: new Api.ChatAdminRights({
        changeInfo: true, postMessages: true, editMessages: true,
        deleteMessages: true, banUsers: false, inviteUsers: true,
        pinMessages: true, addAdmins: false, anonymous: false,
        manageCall: false, other: true, manageTopics: false,
      }),
      rank: "Storage Bot",
    }));
  }

  // Add @ghdowin (Telegram Premium account) as full admin
  try {
    const ghdowinEntity = await client.getEntity("@ghdowin");
    try { await client.invoke(new Api.channels.InviteToChannel({ channel: tgChannel, users: [ghdowinEntity] })); } catch {}
    await client.invoke(new Api.channels.EditAdmin({
      channel: tgChannel, userId: ghdowinEntity,
      adminRights: new Api.ChatAdminRights({
        changeInfo: true, postMessages: true, editMessages: true,
        deleteMessages: true, banUsers: true, inviteUsers: true,
        pinMessages: true, addAdmins: true, anonymous: false,
        manageCall: true, other: true, manageTopics: false,
      }),
      rank: "Admin",
    }));
  } catch {}

  // upsert (não create) — o webhook my_chat_member pode ter criado a linha
  // primeiro, ao ver o bot ser promovido a admin. Forçamos isStorage: true.
  return prisma.channel.upsert({
    where: { chatId_botId: { chatId, botId } },
    update: { title: `📦 Storage — ${bot.name}`, type: "channel", isStorage: true, botIsAdmin: true },
    create: { chatId, title: `📦 Storage — ${bot.name}`, type: "channel", isStorage: true, botIsAdmin: true, botId },
  });
}
