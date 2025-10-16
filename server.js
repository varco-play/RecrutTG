import TelegramBot from "node-telegram-bot-api";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import nodemailer from "nodemailer";

dotenv.config();

const { BOT_TOKEN, MANAGER_CHAT_ID, MANAGER_EMAIL, GMAIL_USER, GMAIL_PASS, PORT } = process.env;

if (!BOT_TOKEN || !MANAGER_CHAT_ID || !GMAIL_USER || !GMAIL_PASS) {
  throw new Error("❌ BOT_TOKEN, MANAGER_CHAT_ID, GMAIL_USER, and GMAIL_PASS must be set in .env");
}

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
});

// Express server
const app = express();
app.use(express.json());
const SERVER_PORT = PORT || 10000;

// Load vacancies
let vacancies = [];
try {
  vacancies = JSON.parse(fs.readFileSync("./vacancies.json", "utf8"));
} catch (err) {
  console.warn("⚠️ vacancies.json not found, starting with empty list");
}

// Sessions
const sessions = {};

// Languages
const translations = {
  en: {
    chooseLang: "🌐 Choose your language:",
    mainMenu: "🏠 Main Menu",
    vacancies: "💼 Vacancies",
    changeLang: "🌐 Change Language",
    back: "⬅️ Back",
    mainMenuBtn: "🏠 Main Menu",
    askName: "✍️ Enter your full name:",
    askContact: "📱 Enter your contact (WhatsApp/Telegram with country code):",
    askExperience: "💼 Select your experience:",
    exp0: "0 years",
    exp1: "1–3 years",
    exp3: "3+ years",
    askState: "🏙️ Choose your state or type it:",
    askCityZip: "🏘️ Enter your city or ZIP code:",
    askDriver: "🚗 Do you have a driver’s license?",
    yes: "✅ Yes",
    no: "❌ No",
    confirm: "📋 Confirm your application:",
    confirmBtn: "✅ Confirm and Submit",
    applied: "🎉 Application sent! Check your Telegram for updates.",
    invalidOption: "⚠️ Please select a valid option.",
  },
  // Add 'ru' and 'es' similarly
};

const t = (lang, key) => (translations[lang] && translations[lang][key]) || key;

// Keyboards
const makeKeyboard = (buttons) => ({ keyboard: buttons, resize_keyboard: true, one_time_keyboard: true });
const langKeyboard = makeKeyboard([["English"], ["Русский"], ["Español"]]);

// Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Helper to send email
async function sendApplicationEmail(data) {
  const msg = `
New application:
🏢 Vacancy: ${data.vacancy}
✍️ Name: ${data.name}
📱 Contact: ${data.contact}
💼 Experience: ${data.experience}
🏙️ State: ${data.state}
🏘️ City/ZIP: ${data.cityOrZip}
🚗 Driver: ${data.driver}`;

  const mailOptions = {
    from: `"NoReply" <${GMAIL_USER}>`,
    to: MANAGER_EMAIL,
    subject: `New Application — ${data.name}`,
    text: msg,
    html: `<pre>${msg.replace(/</g, "&lt;")}</pre>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.response);
  } catch (err) {
    console.error("❌ Failed to send email:", err);
  }
}

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { step: "chooseLang" };
  bot.sendMessage(chatId, "🌐 Please choose your language:", langKeyboard);
});

// Message handler
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!sessions[chatId]) sessions[chatId] = { step: "chooseLang" };
  const s = sessions[chatId];

  // Language selection
  if (s.step === "chooseLang") {
    if (["English", "Русский", "Español"].includes(text)) s.lang = text === "English" ? "en" : text === "Русский" ? "ru" : "es";
    else return bot.sendMessage(chatId, "⚠️ Please select a language:", langKeyboard);

    s.step = "main";
    return bot.sendMessage(chatId, t(s.lang, "mainMenu"), makeKeyboard([[t(s.lang, "vacancies")], [t(s.lang, "changeLang")]]));
  }

  const lang = s.lang || "en";

  // Main menu
  if (s.step === "main") {
    if (text === t(lang, "changeLang")) { s.step = "chooseLang"; return bot.sendMessage(chatId, t(lang, "chooseLang"), langKeyboard); }
    if (text === t(lang, "vacancies")) {
      s.step = "chooseVacancy";
      const buttons = vacancies.map(v => [v[lang] || v.en || "Vacancy"]);
      buttons.push([t(lang, "back")]);
      return bot.sendMessage(chatId, "💼 Choose a vacancy:", makeKeyboard(buttons));
    }
  }

  // Vacancy selection
  if (s.step === "chooseVacancy") {
    const vac = vacancies.find(v => v[lang] === text || v.en === text);
    if (!vac) return bot.sendMessage(chatId, t(lang, "invalidOption"));
    s.vacancy = vac[lang] || vac.en;
    s.step = "askName";
    return bot.sendMessage(chatId, t(lang, "askName"), makeKeyboard([[t(lang, "back")]]));
  }

  // Collect info
  const nextStep = {
    askName: "askContact",
    askContact: "askExperience",
    askExperience: "askState",
    askState: "askCityZip",
    askCityZip: "askDriver",
    askDriver: "confirm"
  };

  if (s.step in nextStep) {
    const fieldMap = { askName: "name", askContact: "contact", askExperience: "experience", askState: "state", askCityZip: "cityOrZip", askDriver: "driver" };
    s[fieldMap[s.step]] = text;
    s.step = nextStep[s.step];

    if (s.step === "confirm") {
      const summary = `📋 ${t(lang, "confirm")}
🏢 Vacancy: ${s.vacancy}
✍️ Name: ${s.name}
📱 Contact: ${s.contact}
💼 Experience: ${s.experience}
🏙️ State: ${s.state}
🏘️ City/ZIP: ${s.cityOrZip}
🚗 Driver: ${s.driver}`;
      await bot.sendMessage(chatId, summary, makeKeyboard([[t(lang, "confirmBtn")], [t(lang, "back")]]));
    } else {
      const askKey = s.step;
      await bot.sendMessage(chatId, t(lang, askKey), makeKeyboard([[t(lang, "back")]]));
    }
    return;
  }

  // Confirm submission
  if (s.step === "confirm" && text === t(lang, "confirmBtn")) {
    // Send to Telegram manager
    await bot.sendMessage(MANAGER_CHAT_ID, `New application:\n${JSON.stringify(s, null, 2)}`);
    // Send email
    await sendApplicationEmail(s);
    await bot.sendMessage(chatId, t(lang, "applied"));
    s.step = "main";
    return;
  }

  // Back button
  if (text === t(lang, "back")) {
    s.step = "main";
    return bot.sendMessage(chatId, t(lang, "mainMenu"), makeKeyboard([[t(lang, "vacancies")], [t(lang, "changeLang")]]));
  }
});

// Express route
app.get("/", (req, res) => res.send("🤖 Bot is running..."));
app.listen(SERVER_PORT, () => console.log(`🌐 Server running on ${SERVER_PORT}`));
