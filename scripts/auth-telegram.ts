/**
 * Roda UMA VEZ para autenticar a conta de serviço no Telegram.
 * Gera uma SESSION STRING para colocar no .env.local
 *
 * Como rodar:
 *   npx tsx scripts/auth-telegram.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as readline from "readline";

const API_ID = Number(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH ?? "";

if (!API_ID || !API_HASH) {
  console.error("❌ Defina TELEGRAM_API_ID e TELEGRAM_API_HASH no .env.local antes de rodar.");
  process.exit(1);
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("\n🔐 Autenticação da conta de serviço Telegram\n");

  const client = new TelegramClient(new StringSession(""), API_ID, API_HASH, {
    connectionRetries: 3,
  });

  await client.start({
    phoneNumber: async () => {
      const phone = await ask("📱 Número de telefone (com código do país, ex: +5511999999999): ");
      return phone;
    },
    password: async () => {
      const pw = await ask("🔑 Senha de dois fatores (deixe em branco se não tiver): ");
      return pw;
    },
    phoneCode: async () => {
      const code = await ask("📩 Código recebido no Telegram: ");
      return code;
    },
    onError: (err) => {
      console.error("❌ Erro:", err.message);
    },
  });

  const session = client.session.save() as unknown as string;

  console.log("\n✅ Autenticado com sucesso!\n");
  console.log("Cole esta linha no seu .env.local:\n");
  console.log(`TELEGRAM_SESSION=${session}`);
  console.log("\n⚠️  Guarde essa string com segurança — ela dá acesso total à conta de serviço.\n");

  await client.disconnect();
}

main().catch(console.error);
