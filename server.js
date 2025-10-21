import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const {
  BOT_TOKEN,
  MANAGER_CHAT_ID,
  SENDPULSE_USER,
  SENDPULSE_PASS,
  MANAGER_EMAIL,
  FROM_EMAIL,
} = process.env;

if (!BOT_TOKEN || !MANAGER_CHAT_ID || !SENDPULSE_USER || !SENDPULSE_PASS) {
  throw new Error("❌ Missing environment variables in .env file");
}

// --- Telegram bot setup ---
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Simple application storage
let userApplications = {};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome! Please fill out your job application.\n\nWhat's your full name?"
  );
  userApplications[msg.chat.id] = { step: "name" };
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userData = userApplications[chatId];

  if (!userData) return;

  if (userData.step === "name") {
    userData.name = text;
    userData.step = "position";
    bot.sendMessage(chatId, "What position are you applying for?");
  } else if (userData.step === "position") {
    userData.position = text;
    userData.step = "experience";
    bot.sendMessage(chatId, "How many years of experience do you have?");
  } else if (userData.step === "experience") {
    userData.experience = text;
    userData.step = "done";

    const summary = `
📝 New Application Received!

👤 Name: ${userData.name}
💼 Position: ${userData.position}
📅 Experience: ${userData.experience}
📨 Telegram Username: @${msg.from.username || "N/A"}
`;

    bot.sendMessage(chatId, "✅ Thank you! Your application has been submitted.");
    bot.sendMessage(MANAGER_CHAT_ID, summary);

    // Send via SendPulse API
    await sendEmailNotification(userData, msg.from);
  }
});

async function sendEmailNotification(data, user) {
  try {
    // Step 1: Get OAuth token
    const tokenRes = await fetch("https://api.sendpulse.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: SENDPULSE_USER,
        client_secret: SENDPULSE_PASS,
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Step 2: Send email
    const emailBody = {
      email: {
        subject: "New Application Received ✅",
        html: `
          <h2>New Application Received</h2>
          <p><b>Name:</b> ${data.name}</p>
          <p><b>Position:</b> ${data.position}</p>
          <p><b>Experience:</b> ${data.experience}</p>
          <p><b>Telegram:</b> @${user.username || "N/A"}</p>
        `,
        from: { name: "Job Bot", email: FROM_EMAIL },
        to: [{ email: MANAGER_EMAIL }],
      },
    };

    const sendRes = await fetch("https://api.sendpulse.com/smtp/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailBody),
    });

    const sendData = await sendRes.json();
    console.log("✅ Email send response:", sendData);
  } catch (err) {
    console.error("❌ Failed to send email:", err);
  }
}

// Express setup (Render needs it)
app.get("/", (req, res) => res.send("Bot is running."));
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
