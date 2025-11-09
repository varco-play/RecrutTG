// index.js
import TelegramBot from "node-telegram-bot-api";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import nodemailer from "nodemailer";

dotenv.config();

const {
  BOT_TOKEN,
  MANAGER_CHAT_ID,
  MANAGER_EMAIL,
  GMAIL_USER,
  GMAIL_PASS,
  PORT,
} = process.env;

if (!BOT_TOKEN || !MANAGER_CHAT_ID) {
  throw new Error("❌ BOT_TOKEN and MANAGER_CHAT_ID must be set in env");
}

// --- EMAIL SETUP ---
const emailEnabled = !!(MANAGER_EMAIL && GMAIL_USER && GMAIL_PASS);
let transporter = null;

if (emailEnabled) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS, // Gmail App Password (no spaces!)
    },
  });

  transporter
    .verify()
    .then(() => console.log("✅ Gmail email transporter ready"))
    .catch((err) =>
      console.error("⚠️ Gmail transporter verification failed:", err)
    );
} else {
  console.log("ℹ️ Email sending disabled (missing Gmail credentials).");
}

const MANAGER_ID = MANAGER_CHAT_ID;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
const SERVER_PORT = PORT || 10000;

// Load vacancies from JSON
let vacancies = [];
try {
  vacancies = JSON.parse(fs.readFileSync("./vacancies.json", "utf8"));
} catch (err) {
  console.warn("⚠️ No vacancies.json found — continuing with empty list.");
}

// In-memory sessions
const sessions = {};

// Translations (unchanged)
const translations = {
  en: {
    chooseLang: "🌐 Please choose your language:",
    mainMenu: "🏠 Main Menu",
    vacancies: "💼 Vacancies",
    changeLang: "🌐 Change Language",
    back: "⬅️ Back",
    mainMenuBtn: "🏠 Main Menu",
    askName: "✍️ Please enter your full name:",
    askContact:
      "📱 Please enter your contact (WhatsApp/Telegram with country code):",
    askExperience: "💼 Please select your experience:",
    exp0: "0 years",
    exp1: "1–3 years",
    exp3: "3+ years",
    askState: "🏙️ Please choose your state or type it:",
    askCityZip: "🏘️ Enter your city or ZIP code (either is fine):",
    askDriver: "🚗 Do you have a driver’s license?",
    yes: "✅ Yes",
    no: "❌ No",
    confirm: "📋 Please confirm your application:",
    confirmBtn: "✅ Confirm and Submit",
    applied: "🎉 Your application has been sent!\n\nFollow our channel: https://t.me/GIGINVESTR",
    invalidOption: "⚠️ Please select an option from the menu.",
    driverOptions: ["✅ Yes", "❌ No"],
    NY: "New York",
    NJ: "New Jersey",
    PA: "Pennsylvania",
    DC: "District of Columbia",
  },
  ru: {
    chooseLang: "🌐 Пожалуйста, выберите язык:",
    mainMenu: "🏠 Главное меню",
    vacancies: "💼 Вакансии",
    changeLang: "🌐 Сменить язык",
    back: "⬅️ Назад",
    mainMenuBtn: "🏠 Главное меню",
    askName: "✍️ Введите ваше полное имя:",
    askContact: "📱 Введите ваш контакт (WhatsApp/Telegram с кодом страны):",
    askExperience: "💼 Выберите ваш опыт:",
    exp0: "0 лет",
    exp1: "1–3 года",
    exp3: "3+ лет",
    askState: "🏙️ Пожалуйста, выберите штат или введите его:",
    askCityZip: "🏘️ Введите ваш город или ZIP код:",
    askDriver: "🚗 У вас есть водительское удостоверение?",
    yes: "✅ Да",
    no: "❌ Нет",
    confirm: "📋 Пожалуйста, подтвердите вашу заявку:",
    confirmBtn: "✅ Подтвердить и отправить",
    applied: "🎉 Ваша заявка была отправлена!\n\nПодпишитесь на наш канал: https://t.me/GIGINVESTR",
    invalidOption: "⚠️ Пожалуйста, выберите вариант из меню.",
    driverOptions: ["✅ Да", "❌ Нет"],
    NY: "Нью-Йорк",
    NJ: "Нью-Джерси",
    PA: "Пенсильвания",
    DC: "Округ Колумбия",
  },
  es: {
    chooseLang: "🌐 Por favor, elige tu idioma:",
    mainMenu: "🏠 Menú Principal",
    vacancies: "💼 Vacantes",
    changeLang: "🌐 Cambiar idioma",
    back: "⬅️ Atrás",
    mainMenuBtn: "🏠 Menú Principal",
    askName: "✍️ Por favor, escribe tu nombre completo:",
    askContact:
      "📱 Escribe tu contacto (WhatsApp/Telegram con código de país):",
    askExperience: "💼 Por favor selecciona tu experiencia:",
    exp0: "0 años",
    exp1: "1–3 años",
    exp3: "3+ años",
    askState: "🏙️ Elige tu estado o escríbelo:",
    askCityZip: "🏘️ Escribe tu ciudad o código postal:",
    askDriver: "🚗 ¿Tienes licencia de conducir?",
    yes: "✅ Sí",
    no: "❌ No",
    confirm: "📋 Por favor confirma tu aplicación:",
    confirmBtn: "✅ Confirmar y Enviar",
    applied: "🎉 ¡Tu aplicación ha sido enviada!\n\nSigue nuestro canal: https://t.me/GIGINVESTR",
    invalidOption: "⚠️ Por favor selecciona una opción válida.",
    driverOptions: ["✅ Sí", "❌ No"],
    NY: "Nueva York",
    NJ: "Nueva Jersey",
    PA: "Pensilvania",
    DC: "Distrito de Columbia",
  },
};

const t = (lang, key) => (translations[lang] && translations[lang][key]) || key;

// --- Keyboards ---
const langKeyboard = {
  reply_markup: {
    keyboard: [["English"], ["Русский"], ["Español"]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};
const mainMenuKeyboard = (lang) => ({
  keyboard: [[t(lang, "vacancies")], [t(lang, "changeLang")]],
  resize_keyboard: true,
});
const backMainKeyboard = (lang) => ({
  keyboard: [[t(lang, "back"), t(lang, "mainMenuBtn")]],
  resize_keyboard: true,
});
const experienceKeyboard = (lang) => ({
  keyboard: [
    [t(lang, "exp0")],
    [t(lang, "exp1")],
    [t(lang, "exp3")],
    [t(lang, "back"), t(lang, "mainMenuBtn")],
  ],
  resize_keyboard: true,
});
const driverKeyboard = (lang) => ({
  keyboard: [
    [t(lang, "yes"), t(lang, "no")],
    [t(lang, "back"), t(lang, "mainMenuBtn")],
  ],
  resize_keyboard: true,
});
const stateKeyboard = (lang) => ({
  keyboard: [
    [t(lang, "NY"), t(lang, "NJ")],
    [t(lang, "PA"), t(lang, "DC")],
    [t(lang, "back"), t(lang, "mainMenuBtn")],
  ],
  resize_keyboard: true,
});
const vacanciesKeyboard = (lang) => {
  const keys = (vacancies || []).map((v) => v[lang] || v.en || "Vacancy");
  const buttons = [];
  for (let i = 0; i < keys.length; i += 2) buttons.push(keys.slice(i, i + 2));
  buttons.push([t(lang, "back"), t(lang, "mainMenuBtn")]);
  return { keyboard: buttons, resize_keyboard: true };
};

// --- Bot flow ---
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { step: "chooseLang" };
  bot.sendMessage(
    chatId,
    "🌐 Please choose your language / Пожалуйста, выберите язык / Por favor, elige tu idioma:",
    langKeyboard
  );
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const raw = msg.text;
  let s = sessions[chatId];
  if (!s) s = sessions[chatId] = { step: "chooseLang" };

  // Language selection
  if (s.step === "chooseLang") {
    if (raw === "English") s.lang = "en";
    else if (raw === "Русский") s.lang = "ru";
    else if (raw === "Español") s.lang = "es";
    else
      return bot.sendMessage(
        chatId,
        "⚠️ Please select a valid language:",
        langKeyboard
      );

    s.step = "main";
    return bot.sendMessage(chatId, t(s.lang, "mainMenu"), {
      reply_markup: mainMenuKeyboard(s.lang),
    });
  }

  const lang = s.lang || "en";

  // Navigation buttons
  if (raw === t(lang, "mainMenuBtn")) {
    s.step = "main";
    return bot.sendMessage(chatId, t(lang, "mainMenu"), {
      reply_markup: mainMenuKeyboard(lang),
    });
  }
  if (raw === t(lang, "back")) {
    if (s.previousStep) {
      s.step = s.previousStep;
      s.previousStep = null;
      return bot.sendMessage(chatId, t(lang, s.step), {
        reply_markup: backMainKeyboard(lang),
      });
    }
  }

  // Main menu
  if (s.step === "main") {
    if (raw === t(lang, "changeLang")) {
      s.step = "chooseLang";
      return bot.sendMessage(chatId, t(lang, "chooseLang"), langKeyboard);
    }
    if (raw === t(lang, "vacancies")) {
      s.step = "chooseVacancy";
      return bot.sendMessage(chatId, "💼 Choose a vacancy:", {
        reply_markup: vacanciesKeyboard(lang),
      });
    }
  }

  // Application logic
  switch (s.step) {
    case "chooseVacancy": {
      const validVac = (vacancies || []).find(
        (v) => v[lang] === raw || v.en === raw
      );
      if (!validVac)
        return bot.sendMessage(chatId, t(lang, "invalidOption"), {
          reply_markup: vacanciesKeyboard(lang),
        });
      s.vacancy = validVac;
      s.step = "askName";
      return bot.sendMessage(chatId, t(lang, "askName"), {
        reply_markup: backMainKeyboard(lang),
      });
    }

    case "askName":
      s.name = raw;
      s.step = "askContact";
      return bot.sendMessage(chatId, t(lang, "askContact"), {
        reply_markup: backMainKeyboard(lang),
      });

    case "askContact":
      s.contact = raw;
      s.step = "askExperience";
      return bot.sendMessage(chatId, t(lang, "askExperience"), {
        reply_markup: experienceKeyboard(lang),
      });

    case "askExperience":
      if (![t(lang, "exp0"), t(lang, "exp1"), t(lang, "exp3")].includes(raw))
        return bot.sendMessage(chatId, t(lang, "invalidOption"));
      s.experience = raw;
      s.step = "askState";
      return bot.sendMessage(chatId, t(lang, "askState"), {
        reply_markup: stateKeyboard(lang),
      });

    case "askState":
      s.state = raw;
      s.step = "askCityZip";
      return bot.sendMessage(chatId, t(lang, "askCityZip"), {
        reply_markup: backMainKeyboard(lang),
      });

    case "askCityZip":
      s.cityOrZip = raw;
      s.step = "askDriver";
      return bot.sendMessage(chatId, t(lang, "askDriver"), {
        reply_markup: driverKeyboard(lang),
      });

    case "askDriver": {
      if (!t(lang, "driverOptions").includes(raw))
        return bot.sendMessage(chatId, t(lang, "invalidOption"));
      s.driver = raw;
      s.step = "confirm";
      const v = s.vacancy?.[lang] || s.vacancy?.en || "Vacancy";
      const summary = `${t(lang, "confirm")}
🏢 Vacancy: ${v}
✍️ Name: ${s.name}
📱 Contact: ${s.contact}
💼 Experience: ${s.experience}
🏙️ State: ${s.state}
🏘️ City/ZIP: ${s.cityOrZip}
🚗 Driver: ${s.driver}`;
      return bot.sendMessage(chatId, summary, {
        reply_markup: {
          keyboard: [
            [t(lang, "confirmBtn")],
            [t(lang, "back"), t(lang, "mainMenuBtn")],
          ],
          resize_keyboard: true,
        },
      });
    }

    case "confirm": {
      if (raw !== t(lang, "confirmBtn"))
        return bot.sendMessage(chatId, t(lang, "invalidOption"));

      const v = s.vacancy?.[lang] || s.vacancy?.en || "Vacancy";
      const managerMsg = `New application:
🏢 Vacancy: ${v}
✍️ Name: ${s.name}
📱 Contact: ${s.contact}
💼 Experience: ${s.experience}
🏙️ State: ${s.state}
🏘️ City/ZIP: ${s.cityOrZip}
🚗 Driver: ${s.driver}`;

      // Send Telegram message
      await bot.sendMessage(MANAGER_ID, managerMsg);

      // Send Email
      if (emailEnabled && transporter) {
        try {
          await transporter.sendMail({
            from: `"Recruit Bot" <${GMAIL_USER}>`,
            to: MANAGER_EMAIL,
            subject: `New Application — ${s.name}`,
            text: managerMsg,
          });
          console.log("📧 Email sent successfully!");
        } catch (err) {
          console.error("❌ Failed to send email:", err);
        }
      }

      await bot.sendMessage(chatId, t(lang, "applied"), {
        reply_markup: mainMenuKeyboard(lang),
      });

      sessions[chatId] = { step: "main", lang };
      return;
    }
  }
});

app.get("/", (req, res) => res.send("🤖 Bot is running..."));
app.listen(SERVER_PORT, () =>
  console.log(`🌐 Server running on port ${SERVER_PORT}`)
);

process.on("uncaughtException", (err) =>
  console.error("Uncaught Exception:", err)
);
process.on("unhandledRejection", (err) =>
  console.error("Unhandled Rejection:", err)
);
  