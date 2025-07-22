import express from "express";
import { Bot } from "grammy";
import dotenv from "dotenv";
import Groq from "groq-sdk";

const app = express();

dotenv.config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Set up Groq API client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Track which users are in summarize mode
const summarizeMode = new Map();

/* ───────────── Command Handlers ───────────── */

// /start
bot.command("start", async (ctx) => {
  await ctx.reply("👋 Welcome to *SmartChatTLDR AI*! I’m your smart assistant for summarizing long messages, articles, and videos.", { parse_mode: "Markdown" });
});

// /help
bot.command("help", async (ctx) => {
  await ctx.reply(
    `🛠 *How to use SmartChatTLDR AI*\n\n` +
    `Just type your question or request, and I'll try my best to help!\n\n` +
    `Available commands:\n` +
    `/about - Learn about this bot\n` +
    `/founder - Know who created me\n` +
    `/summarize - Paste long text to summarize\n` +
    `/summarize_url - Send a link to summarize\n` +
    `/summarize_pdf - Upload a PDF to summarize`,
    { parse_mode: "Markdown" }
  );
});

// /about
bot.command("about", async (ctx) => {
  await ctx.reply("🤖 I'm *SmartChatTLDR AI*, built by *Ranjan Kumar Prajapati*. I'm an AI-powered chat assistant designed to instantly summarize long messages, articles, and videos.", { parse_mode: "Markdown" });
});

// /founder
bot.command("founder", async (ctx) => {
  await ctx.reply("👨‍💻 The founder is *Ranjan Kumar Prajapati*.", { parse_mode: "Markdown" });
});

// /summarize
bot.command("summarize", async (ctx) => {
  summarizeMode.set(ctx.from.id, true);
  await ctx.reply("📩 Send me the message you want me to summarize.");
});

// Placeholder commands
bot.command("summarize_url", async (ctx) => {
  await ctx.reply("🔗 Please send a link (starting with http/https) and I’ll summarize the article.");
});
bot.command("summarize_pdf", async (ctx) => {
  await ctx.reply("📄 Upload a PDF file and I’ll summarize its content. (Coming soon!)");
});

/* ───────────── Custom Replies ───────────── */

function checkCustomReply(message) {
  const lower = message.toLowerCase();
  if (
    lower.includes("founder name") ||
    lower.includes("who is the founder") ||
    lower.includes("creator") ||
    lower.includes("developed by")
  ) {
    return "👨‍💻 The founder is *Ranjan Kumar Prajapati*.";
  }
  if (
    lower.includes("about you") ||
    lower.includes("who are you") ||
    lower.includes("your name") ||
    lower.includes("what is your name")
  ) {
    return `🤖 I'm *SmartChatTLDR AI*, built by *Ranjan Kumar Prajapati*. I'm an AI-powered chat assistant designed to instantly summarize long messages, articles, and videos.`;
  }
  return null;
}

/* ───────────── Groq Integration ───────────── */

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

/* ───────────── Message Handler ───────────── */

bot.on("message:text", async (ctx) => {
  const userInput = ctx.message.text.trim();
  const userId = ctx.from.id;

  // Send thinking message and save the message reference
  const thinkingMessage = await ctx.reply("💬 Thinking...");

  try {
    // If user is in summarize mode
    if (summarizeMode.has(userId)) {
      summarizeMode.delete(userId); // Exit summarize mode
      const prompt = `Summarize the following text:\n\n${userInput}`;
      const summary = await askGroq(prompt);

      // Delete thinking message and reply
      await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
      await ctx.reply(summary);
      return;
    }

    // Check for custom reply
    const customReply = checkCustomReply(userInput);
    if (customReply) {
      await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
      await ctx.reply(customReply, { parse_mode: "Markdown" });
      return;
    }

    // Default response from Groq
    const reply = await askGroq(userInput);
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
    await ctx.reply(reply);
  } catch (err) {
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
    await ctx.reply("❌ Something went wrong.");
  }
});

/* ───────────── Start Bot ───────────── */

bot.start();
console.log("🤖 Bot started with LLaMA3 from Groq...");

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});