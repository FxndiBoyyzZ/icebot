import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const API_ID = Number(process.env.TELEGRAM_API_ID ?? "0");
const API_HASH = process.env.TELEGRAM_API_HASH ?? "";
const SESSION_STRING = process.env.TELEGRAM_SESSION ?? "";

let _client: TelegramClient | null = null;

export async function getMTProtoClient(): Promise<TelegramClient> {
  if (!API_ID || !API_HASH) {
    throw new Error("TELEGRAM_API_ID e TELEGRAM_API_HASH são obrigatórios no .env.local");
  }
  if (!SESSION_STRING) {
    throw new Error(
      "TELEGRAM_SESSION não configurada. Execute: npx dotenv -e .env.local tsx scripts/auth-telegram.ts"
    );
  }

  if (_client?.connected) return _client;

  const client = new TelegramClient(new StringSession(SESSION_STRING), API_ID, API_HASH, {
    connectionRetries: 3,
  });

  await client.connect();

  if (!(await client.isUserAuthorized())) {
    throw new Error("TELEGRAM_SESSION inválida ou expirada. Execute o script de autenticação novamente.");
  }

  _client = client;
  return client;
}

// Sends a message to BotFather and waits for the reply (up to ~8s).
export async function sendToBotFather(client: TelegramClient, message: string): Promise<string> {
  const sentAt = Math.floor(Date.now() / 1000) - 1;
  await client.sendMessage("BotFather", { message });

  for (let i = 0; i < 16; i++) {
    await new Promise<void>((r) => setTimeout(r, 500));
    const msgs = await client.getMessages("BotFather", { limit: 5 });
    for (const msg of msgs) {
      if (!msg.out && msg.date >= sentAt) {
        return msg.message;
      }
    }
  }
  throw new Error("BotFather não respondeu a tempo. Tente novamente.");
}
