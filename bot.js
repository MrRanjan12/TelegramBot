import express from "express";
import { Bot } from "grammy";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import cors from "cors";
import helmet from "helmet";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
  console.error("❌ Missing TELEGRAM_BOT_TOKEN or GROQ_API_KEY in environment variables.");
  process.exit(1);
}

app.use(express.json());
app.use(helmet()); // 🛡️ Secure HTTP headers

app.use(cors({
  origin: [
    "https://your-frontend-domain.com", // ✅ Replace with your frontend domain
    "http://localhost:5173",
  ],
  methods: ["GET", "POST"],
}));

const bot = new Bot(TELEGRAM_TOKEN);
const groq = new Groq({ apiKey: GROQ_API_KEY });

const summarizeMode = new Map();

/* ───────────── Bot Commands ───────────── */

bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 Welcome to *SmartChatTLDR AI*! I’m your smart assistant for summarizing long messages, articles, and videos.",
    { parse_mode: "Markdown" }
  );
});

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

bot.command("about", async (ctx) => {
  await ctx.reply("🤖 I'm *SmartChatTLDR AI*, built by *Ranjan Kumar Prajapati*.", {
    parse_mode: "Markdown",
  });
});

bot.command("founder", async (ctx) => {
  await ctx.reply("👨‍💻 The founder is *Ranjan Kumar Prajapati*.", { parse_mode: "Markdown" });
});

bot.command("summarize", async (ctx) => {
  summarizeMode.set(ctx.from.id, true);
  await ctx.reply("📩 Send me the message you want me to summarize.");
});

bot.command("summarize_url", async (ctx) => {
  await ctx.reply("🔗 Please send a link and I’ll summarize the article.");
});

bot.command("summarize_pdf", async (ctx) => {
  await ctx.reply("📄 Upload a PDF file and I’ll summarize its content. (Coming soon!)");
});

/* ───────────── Groq AI Integration ───────────── */

async function askGroq(prompt) {
  try {
    const result = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      model: "llama3-70b-8192",
    });
    return result.choices[0]?.message?.content?.trim() || "⚠️ No response.";
  } catch (err) {
    console.error("Groq API Error:", err.message);
    return "🚧 The AI server is currently down. Please try again shortly.";
  }
}

/* ───────────── Text Message Handler ───────────── */

function checkCustomReply(message) {
  const lower = message.toLowerCase();
  if (
    lower.includes("founder name") || lower.includes("who is the founder") ||
    lower.includes("creator") || lower.includes("developed by")
  ) {
    return "👨‍💻 The founder is *Ranjan Kumar Prajapati*.";
  }
  if (
    lower.includes("about you") || lower.includes("who are you") ||
    lower.includes("your name") || lower.includes("what is your name")
  ) {
    return `🤖 I'm *SmartChatTLDR AI*, built by *Ranjan Kumar Prajapati*.`;
  }
  return null;
}

bot.on("message:text", async (ctx) => {
  const userInput = ctx.message.text?.trim();
  const userId = ctx.from.id;

  const thinkingMessage = await ctx.reply("💬 Thinking...");

  try {
    if (summarizeMode.has(userId)) {
      summarizeMode.delete(userId);
      const prompt = `Summarize the following text:\n\n${userInput}`;
      const summary = await askGroq(prompt);
      await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
      await ctx.reply(summary);
      return;
    }

    const customReply = checkCustomReply(userInput);
    if (customReply) {
      await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
      await ctx.reply(customReply, { parse_mode: "Markdown" });
      return;
    }

    const reply = await askGroq(userInput);
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
    await ctx.reply(reply);
  } catch (error) {
    console.error("Bot error:", error.message);
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
    await ctx.reply("❌ Something went wrong.");
  }
});

/* ───────────── Express Route for Frontend ───────────── */

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const reply = await askGroq(message);
    res.json({ reply });
  } catch (error) {
    console.error("API error:", error.message);
    res.status(500).json({ error: "Failed to generate reply." });
  }
});

// Optional: Health check
app.get("/", (req, res) => {
  res.send("✅ SmartChatTLDR AI backend is running.");
});

/* ───────────── Start Server and Bot ───────────── */

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  bot.start(); // Start bot after server
  console.log("🤖 Telegram bot started.");
});
