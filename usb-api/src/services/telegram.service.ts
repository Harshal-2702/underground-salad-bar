import axios from "axios";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

console.log("BOT TOKEN:", BOT_TOKEN ? "Loaded ✅" : "Missing ❌");
console.log("CHAT ID:", CHAT_ID);

export async function sendTelegramMessage(message: string) {
  try {
    console.log("Sending Telegram message...");

    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }
    );

    console.log("✅ Telegram notification sent.");
    console.log(response.data);
  } catch (err: any) {
    console.error("❌ Telegram Error");

    if (err.response) {
      console.error(err.response.status);
      console.error(err.response.data);
    } else {
      console.error(err.message);
    }
  }
}