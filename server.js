import TelegramBot from "node-telegram-bot-api";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const { BOT_TOKEN, MANAGER_CHAT_ID } = process.env;
if (!BOT_TOKEN || !MANAGER_CHAT_ID) {
  throw new Error("❌ BOT_TOKEN and MANAGER_CHAT_ID must be set in env");
}

const MANAGER_ID = MANAGER_CHAT_ID;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 10000;

// Load vacancies from JSON
const vacancies = JSON.parse(fs.readFileSync("./vacancies.json", "utf8"));

// In-memory sessions
const sessions = {};

// Translations
const translations = {
  en: {
    chooseLang: "🌐 Please choose your language:",
    mainMenu: "🏠 Main Menu",
    about: "ℹ️ About Us",
    contacts: "📞 Contacts",
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
    askState: "🏙️ Please enter your state:",
    askCity: "🏘️ Please enter your city:",
    askZip: "🏷️ Please enter your ZIP code (numbers only):",
    askDriver: "🚗 Do you have a driver’s license?",
    yes: "✅ Yes",
    no: "❌ No",
    confirm: "📋 Please confirm your application:",
    confirmBtn: "✅ Confirm and Submit",
    applied: "🎉 Your application has been sent!",
    invalidOption: "⚠️ Please select an option from the menu.",
    driverOptions: ["✅ Yes", "❌ No"],
  },
  ru: {
    chooseLang: "🌐 Пожалуйста, выберите язык:",
    mainMenu: "🏠 Главное меню",
    about: "ℹ️ О нас",
    contacts: "📞 Контакты",
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
    askState: "🏙️ Введите ваш штат/область:",
    askCity: "🏘️ Введите ваш город:",
    askZip: "🏷️ Введите ваш ZIP код (только цифры):",
    askDriver: "🚗 У вас есть водительское удостоверение?",
    yes: "✅ Да",
    no: "❌ Нет",
    confirm: "📋 Пожалуйста, подтвердите вашу заявку:",
    confirmBtn: "✅ Подтвердить и отправить",
    applied: "🎉 Ваша заявка была отправлена!",
    invalidOption: "⚠️ Пожалуйста, выберите вариант из меню.",
    driverOptions: ["✅ Да", "❌ Нет"],
  },
  es: {
    chooseLang: "🌐 Por favor, elige tu idioma:",
    mainMenu: "🏠 Menú Principal",
    about: "ℹ️ Sobre Nosotros",
    contacts: "📞 Contactos",
    vacancies: "💼 Vacantes",
    changeLang: "🌐 Cambiar idioma",
    back: "⬅️ Atrás",
    mainMenuBtn: "🏠 Menú Principal",
    askName: "✍️ Por favor, escribe tu nombre completo:",
    askContact:
      "📱 Por favor, escribe tu contacto (WhatsApp/Telegram con código de país):",
    askExperience: "💼 Por favor selecciona tu experiencia:",
    exp0: "0 años",
    exp1: "1–3 años",
    exp3: "3+ años",
    askState: "🏙️ Por favor escribe tu estado:",
    askCity: "🏘️ Por favor escribe tu ciudad:",
    askZip: "🏷️ Por favor escribe tu código postal (solo números):",
    askDriver: "🚗 ¿Tienes licencia de conducir?",
    yes: "✅ Sí",
    no: "❌ No",
    confirm: "📋 Por favor confirma tu aplicación:",
    confirmBtn: "✅ Confirmar y Enviar",
    applied: "🎉 ¡Tu aplicación ha sido enviada!",
    invalidOption: "⚠️ Por favor selecciona una opción del menú.",
    driverOptions: ["✅ Sí", "❌ No"],
  },
};

const t = (lang, key) => translations[lang][key] || key;

// Keyboards
const langKeyboard = {
  reply_markup: {
    keyboard: [["English"], ["Русский"], ["Español"]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

const mainMenuKeyboard = (lang) => ({
  keyboard: [
    [t(lang, "about"), t(lang, "contacts")],
    [t(lang, "vacancies")],
    [t(lang, "changeLang")],
  ],
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

// Build vacancies keyboard from JSON
const vacanciesKeyboard = (lang) => {
  const keys = vacancies.map((v) => v[lang]);
  const buttons = [];
  for (let i = 0; i < keys.length; i += 2) {
    buttons.push(keys.slice(i, i + 2));
  }
  buttons.push([t(lang, "back"), t(lang, "mainMenuBtn")]);
  return { keyboard: buttons, resize_keyboard: true };
};

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { step: "chooseLang" };
  bot.sendMessage(
    chatId,
    "🌐 Please choose your language / Пожалуйста, выберите язык / Por favor, elige tu idioma:",
    langKeyboard
  );
});

// Message handler
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const raw = msg.text;
  let s = sessions[chatId];
  console.log(raw);

  if (!s) {
    sessions[chatId] = { step: "chooseLang" };
    s = sessions[chatId];
  }

  // Language selection
  if (s.step === "chooseLang") {
    if (raw === "English") s.lang = "en";
    else if (raw === "Русский") s.lang = "ru";
    else if (raw === "Español") s.lang = "es";
    else
      return bot.sendMessage(
        chatId,
        "⚠️ Please select a language / Пожалуйста, выберите язык / Por favor, elige un idioma",
        langKeyboard
      );

    s.step = "main";
    return bot.sendMessage(chatId, t(s.lang, "mainMenu"), {
      reply_markup: mainMenuKeyboard(s.lang),
    });
  }

  const lang = s.lang || "en";

  // Global buttons
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
      switch (s.step) {
        case "askContact":
          return bot.sendMessage(chatId, t(lang, "askContact"), {
            reply_markup: backMainKeyboard(lang),
          });
        case "askExperience":
          return bot.sendMessage(chatId, t(lang, "askExperience"), {
            reply_markup: experienceKeyboard(lang),
          });
        case "askState":
          return bot.sendMessage(chatId, t(lang, "askState"), {
            reply_markup: backMainKeyboard(lang),
          });
        case "askCity":
          return bot.sendMessage(chatId, t(lang, "askCity"), {
            reply_markup: backMainKeyboard(lang),
          });
        case "askZip":
          return bot.sendMessage(chatId, t(lang, "askZip"), {
            reply_markup: backMainKeyboard(lang),
          });
        case "askDriver":
          return bot.sendMessage(chatId, t(lang, "askDriver"), {
            reply_markup: driverKeyboard(lang),
          });
      }
    }
  }

  // Main menu
  if (s.step === "main") {
    if (raw === t(lang, "about"))
      return bot.sendMessage(chatId, "ℹ️ We are a company ...", {
        reply_markup: mainMenuKeyboard(lang),
      });
    if (raw === t(lang, "contacts"))
      return bot.sendMessage(chatId, "📞 Contact us at: +123456789", {
        reply_markup: mainMenuKeyboard(lang),
      });
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

  // Flow steps
  switch (s.step) {
    case "chooseVacancy": {
      const validVac = vacancies.find((v) => v[lang] === raw);
      if (!validVac)
        return bot.sendMessage(chatId, t(lang, "invalidOption"), {
          reply_markup: vacanciesKeyboard(lang),
        });
      s.vacancy = validVac;
      s.previousStep = "chooseVacancy";
      s.step = "askName";
      return bot.sendMessage(chatId, t(lang, "askName"), {
        reply_markup: backMainKeyboard(lang),
      });
    }

    case "askName": {
      s.name = raw;
      s.previousStep = "askName";
      s.step = "askContact";
      return bot.sendMessage(chatId, t(lang, "askContact"), {
        reply_markup: backMainKeyboard(lang),
      });
    }

    case "askContact": {
      s.contact = raw;
      s.previousStep = "askContact";
      s.step = "askExperience";
      return bot.sendMessage(chatId, t(lang, "askExperience"), {
        reply_markup: experienceKeyboard(lang),
      });
    }

    case "askExperience": {
      if (![t(lang, "exp0"), t(lang, "exp1"), t(lang, "exp3")].includes(raw))
        return bot.sendMessage(chatId, t(lang, "invalidOption"), {
          reply_markup: experienceKeyboard(lang),
        });
      s.experience = raw;
      s.previousStep = "askExperience";
      s.step = "askState";
      return bot.sendMessage(chatId, t(lang, "askState"), {
        reply_markup: backMainKeyboard(lang),
      });
    }

    case "askState": {
      s.state = raw;
      s.previousStep = "askState";
      s.step = "askCity";
      return bot.sendMessage(chatId, t(lang, "askCity"), {
        reply_markup: backMainKeyboard(lang),
      });
    }

    case "askCity": {
      s.city = raw;
      s.previousStep = "askCity";
      s.step = "askZip";
      return bot.sendMessage(chatId, t(lang, "askZip"), {
        reply_markup: backMainKeyboard(lang),
      });
    }

    case "askZip": {
      if (!/^\d+$/.test(raw))
        return bot.sendMessage(chatId, t(lang, "invalidOption"), {
          reply_markup: backMainKeyboard(lang),
        });
      s.zip = raw;
      s.previousStep = "askZip";
      s.step = "askDriver";
      return bot.sendMessage(chatId, t(lang, "askDriver"), {
        reply_markup: driverKeyboard(lang),
      });
    }

    case "askDriver": {
      if (!t(lang, "driverOptions").includes(raw))
        return bot.sendMessage(chatId, t(lang, "invalidOption"), {
          reply_markup: driverKeyboard(lang),
        });
      s.driver = raw;
      s.previousStep = "askDriver";
      s.step = "confirm";
      const summary = `${t(lang, "confirm")}
🏢 Vacancy: ${s.vacancy[lang]}
✍️ Name: ${s.name}
📱 Contact: ${s.contact}
💼 Experience: ${s.experience}
🏙️ State: ${s.state}
🏘️ City: ${s.city}
🏷️ ZIP: ${s.zip}
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
      const managerMsg = `New application:
🏢 Vacancy: ${s.vacancy[lang]}
✍️ Name: ${s.name}
📱 Contact: ${s.contact}
💼 Experience: ${s.experience}
🏙️ State: ${s.state}
🏘️ City: ${s.city}
🏷️ ZIP: ${s.zip}
🚗 Driver: ${s.driver}`;
      await bot.sendMessage(MANAGER_ID, managerMsg);
      await bot.sendMessage(chatId, t(lang, "applied"), {
        reply_markup: mainMenuKeyboard(lang),
      });
      s.step = "main";
      s.previousStep = null;
      return;
    }
  }
});

// Keep server alive
app.get("/", (req, res) => res.send("🤖 Bot is running..."));
app.listen(PORT, () => console.log(`🌐 Server running on ${PORT}`));
