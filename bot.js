import { Bot } from "grammy";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Set up Groq API client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function askGroq(prompt) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      model: "llama3-70b-8192",
    });

    return chatCompletion.choices[0]?.message?.content?.trim() || "⚠️ No response";
  } catch (err) {
    console.error("Groq error:", err);
    return "❌ Error from Groq";
  }
}

bot.on("message:text", async (ctx) => {
  const userInput = ctx.message.text;
  await ctx.reply("💬 Thinking...");

  const reply = await askGroq(userInput);
  await ctx.reply(reply);
});

bot.start();
console.log("🤖 Bot started with LLaMA3 from Groq...");
