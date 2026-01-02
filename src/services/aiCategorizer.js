// AI Categorization Service using OpenRouter API
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Free models on OpenRouter
const FREE_MODEL = "mistralai/mistral-7b-instruct:free";

// Cache for AI responses (avoid duplicate API calls)
const categoryCache = new Map();

// Get API key from localStorage
export const getApiKey = () => {
  return localStorage.getItem("openrouter_api_key") || "";
};

// Save API key to localStorage
export const setApiKey = (key) => {
  localStorage.setItem("openrouter_api_key", key);
};

// Check if API key is configured
export const hasApiKey = () => {
  const key = getApiKey();
  return key && key.length > 10;
};

// Categorize a single reason using AI
export const categorizeReason = async (reason) => {
  // Check cache first
  const cacheKey = reason.toLowerCase().trim();
  if (categoryCache.has(cacheKey)) {
    return categoryCache.get(cacheKey);
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key not configured");
  }

  const prompt = `Kamu adalah asisten yang membantu mengkategorikan alasan trading loss. 

Dari alasan berikut, tentukan kategori kesalahan trading yang paling sesuai.
Jawab HANYA dengan nama kategori singkat (2-4 kata), tanpa penjelasan tambahan.

Contoh kategori yang umum:
- Tidak Fokus
- FOMO
- Revenge Trade
- Emosi/Marah
- Ketiduran
- Tidak Pasang SL
- Serakah/Greedy
- Lawan Trend
- Entry Terlalu Cepat
- Overtrade
- Distraksi

Alasan: "${reason}"

Kategori:`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Trading Journal",
      },
      body: JSON.stringify({
        model: FREE_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "API request failed");
    }

    const data = await response.json();
    const category = data.choices?.[0]?.message?.content?.trim() || reason;

    // Clean up the category (remove quotes, extra text)
    const cleanCategory = category
      .replace(/^["']|["']$/g, "")
      .replace(/\n.*/g, "")
      .trim();

    // Cache the result
    categoryCache.set(cacheKey, cleanCategory);

    return cleanCategory;
  } catch (error) {
    console.error("AI categorization error:", error);
    // Fallback: return cleaned version of original reason
    return reason.length > 25 ? reason.substring(0, 25) + "..." : reason;
  }
};

// Batch categorize multiple reasons
export const categorizeReasons = async (reasons) => {
  const results = {};

  for (const reason of reasons) {
    const trimmed = reason.trim();
    if (!trimmed) continue;

    try {
      const category = await categorizeReason(trimmed);

      if (!results[category]) {
        results[category] = {
          category,
          examples: [],
          count: 0,
          totalAmount: 0,
        };
      }

      results[category].count += 1;
      if (
        results[category].examples.length < 3 &&
        !results[category].examples.includes(trimmed)
      ) {
        results[category].examples.push(trimmed);
      }
    } catch (error) {
      console.error("Error categorizing:", trimmed, error);
    }
  }

  return Object.values(results);
};

// Clear cache (useful when user wants to re-categorize)
export const clearCache = () => {
  categoryCache.clear();
};

// ================================
// AI REACTIONS - Fun Trading Buddy
// ================================

// Fallback reactions (no API needed)
const FALLBACK_WIN_REACTIONS = [
  "Profit $AMOUNT! 🔥 Mantap jiwa! Tapi inget ya, satu trade profit bukan berarti kamu Warren Buffett. Stay humble! 😎",
  "CUAN $AMOUNT! 💰 Gas terus! Tapi jangan lupa take profit, jangan sampe unrealized profit jadi realized loss 🤡",
  "Ijo $AMOUNT! 🌿 Alhamdulillah rezeki. Tapi jangan keenakan, market bisa balik kapan aja. Lock profit! 🔒",
  "+$AMOUNT masuk kantong! 🎯 Skill atau hoki? Yang penting profit dulu! Jangan lupa catat strateginya biar bisa diulang 📝",
  "Profit $AMOUNT! ✅ Selamat! Tapi inget, overconfidence adalah musuh trader. Next trade tetap disiplin ya! 💪",
  "CUAN $AMOUNT! 🚀 Mantul! Sekarang reward yourself, tapi jangan langsung all-in lagi ya. Slow and steady! 🐢",
];

const FALLBACK_LOSS_REACTIONS = [
  "Loss $AMOUNT... 😬 Yaudah gapapa, anggap bayar SPP belajar trading. Yang penting jangan ulangi kesalahan yang sama! 💪",
  "-$AMOUNT yah... 🥲 It's okay, even the best traders lose. Yang bedain trader pro sama amateur itu gimana handle loss-nya. Bangkit! 🔥",
  "Minus $AMOUNT... 😔 Gapapa, loss itu bagian dari game. Review apa yang salah, catat, dan move on. Besok perang lagi! ⚔️",
  "Loss $AMOUNT 📉 Ouch. Tapi hey, setidaknya kamu jujur catat. Itu step pertama jadi trader disiplin. Keep going! 🎯",
  "-$AMOUNT masuk ke market 😅 Yaudah, kasih makan bandar. Besok ambil balik! Yang penting mental jangan down. 💎",
  "Duit $AMOUNT gone... 🫠 Gpp, trading itu marathon bukan sprint. Satu loss ga define kamu. Evaluasi dan lanjut! 🏃",
];

const FALLBACK_SUMMARY_WIN = [
  "Hari ini ijo! 🌿 Total AMOUNT. Good job! Tapi jangan keenakan, besok tetap harus disiplin. Rest well dan prepare for tomorrow! 😴",
  "Profit AMOUNT hari ini! 🔥 Mantap! Sekarang tutup chart, nikmati profit-nya. Jangan greedy mau nambah-nambah lagi ya! 🛑",
  "Today was a good day! +AMOUNT 💰 Inget, consistency is key. Jangan ubah strategy cuma gara-gara satu hari profit. Stay the course! 🎯",
];

const FALLBACK_SUMMARY_LOSS = [
  "Hari ini merah AMOUNT... 😔 Gapapa, every trader punya bad days. Review mistakes, learn, dan besok bangkit lagi! 💪",
  "Minus AMOUNT today 📉 Ouch. Tapi hey, loss hari ini bukan end of the world. Evaluate, rest, come back stronger tomorrow! 🔥",
  "Hari yang berat, -AMOUNT 🥲 It happens. Yang penting: 1) Jangan revenge trade, 2) Catat lesson learned, 3) Rest. Besok hari baru! ☀️",
];

// Helper to get random fallback
const getRandomFallback = (array, amount) => {
  const reaction = array[Math.floor(Math.random() * array.length)];
  return reaction.replace(
    /\$?AMOUNT/g,
    `$${Math.abs(amount).toLocaleString()}`
  );
};

// Get AI reaction for a single trade
export const getTradeReaction = async (type, amount, reason = "") => {
  const apiKey = getApiKey();
  const isWin = type === "profit";

  // If no API key, use fallback
  if (!apiKey) {
    return getRandomFallback(
      isWin ? FALLBACK_WIN_REACTIONS : FALLBACK_LOSS_REACTIONS,
      amount
    );
  }

  const prompt = isWin
    ? `Kamu adalah trading buddy yang supportive tapi juga sedikit sarcastic. User baru profit $${amount}. 
Berikan reaksi singkat (1-2 kalimat) yang:
- Apresiasi kemenangannya
- Sedikit bercanda/roasting ringan
- Ingatkan untuk tidak overconfident

Respond dalam Bahasa Indonesia casual/gaul. Gunakan emoji.`
    : `Kamu adalah trading buddy yang supportive tapi juga savage. User baru loss $${amount}${
        reason ? ` karena "${reason}"` : ""
      }.
Berikan reaksi singkat (1-2 kalimat) yang:
- Roasting ringan tapi tidak jahat
- Ada wisdom/pelajaran
- Tetap supportive di akhir

Respond dalam Bahasa Indonesia casual/gaul. Gunakan emoji. Jangan terlalu panjang.`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Trading Journal",
      },
      body: JSON.stringify({
        model: FREE_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      // Fallback on API error
      return getRandomFallback(
        isWin ? FALLBACK_WIN_REACTIONS : FALLBACK_LOSS_REACTIONS,
        amount
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim();

    // Return AI response or fallback
    return (
      aiResponse ||
      getRandomFallback(
        isWin ? FALLBACK_WIN_REACTIONS : FALLBACK_LOSS_REACTIONS,
        amount
      )
    );
  } catch (error) {
    console.error("AI reaction error:", error);
    // Fallback on error
    return getRandomFallback(
      isWin ? FALLBACK_WIN_REACTIONS : FALLBACK_LOSS_REACTIONS,
      amount
    );
  }
};

// Get AI daily summary/roast
export const getDailySummary = async (todayTrades, dayTotal) => {
  const apiKey = getApiKey();
  const isProfit = dayTotal >= 0;

  // If no API key, use fallback
  if (!apiKey) {
    return getRandomFallback(
      isProfit ? FALLBACK_SUMMARY_WIN : FALLBACK_SUMMARY_LOSS,
      dayTotal
    );
  }

  const wins = todayTrades.filter((t) => t.type === "profit").length;
  const losses = todayTrades.filter((t) => t.type === "loss").length;
  const lossReasons = todayTrades
    .filter((t) => t.type === "loss" && t.reason)
    .map((t) => t.reason)
    .join(", ");

  const prompt = `Kamu adalah trading buddy yang jujur, supportive, tapi juga savage kalau perlu roasting.

Data trading hari ini:
- Total trades: ${todayTrades.length}
- Win: ${wins}, Loss: ${losses}
- Net P/L: ${dayTotal >= 0 ? "+" : ""}$${dayTotal}
${lossReasons ? `- Alasan loss: ${lossReasons}` : ""}

Berikan summary singkat (2-4 kalimat) yang:
1. Evaluasi performa hari ini
2. ${
    dayTotal >= 0
      ? "Apresiasi tapi ingatkan untuk tetap humble"
      : "Roasting tapi tetap kasih semangat"
  }
3. Satu tips actionable untuk besok

Bahasa Indonesia casual/gaul. Pakai emoji. Jangan terlalu formal.`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Trading Journal",
      },
      body: JSON.stringify({
        model: FREE_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      return getRandomFallback(
        isProfit ? FALLBACK_SUMMARY_WIN : FALLBACK_SUMMARY_LOSS,
        dayTotal
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim();

    return (
      aiResponse ||
      getRandomFallback(
        isProfit ? FALLBACK_SUMMARY_WIN : FALLBACK_SUMMARY_LOSS,
        dayTotal
      )
    );
  } catch (error) {
    console.error("AI summary error:", error);
    return getRandomFallback(
      isProfit ? FALLBACK_SUMMARY_WIN : FALLBACK_SUMMARY_LOSS,
      dayTotal
    );
  }
};

// Get motivational message when locked (2x loss)
export const getLockMessage = async (lossReasons) => {
  const apiKey = getApiKey();

  const fallback =
    "2x loss dalam sehari! 🤡 Market lagi ga berpihak sama kamu hari ini. Istirahat dulu, review kesalahan, besok kita balas! 💪🔥";

  if (!apiKey) return fallback;

  const prompt = `User baru kena lock trading karena 2x loss dalam sehari. Alasan loss mereka: "${lossReasons.join(
    '", "'
  )}".

Berikan pesan yang:
1. Savage roasting yang lucu (1 kalimat)
2. Tapi juga wisdom yang dalam (1 kalimat)
3. Motivasi untuk besok (1 kalimat)

Bahasa Indonesia casual/gaul. Pakai emoji. Total max 3 kalimat.`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Trading Journal",
      },
      body: JSON.stringify({
        model: FREE_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.9,
      }),
    });

    if (!response.ok) return fallback;

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || fallback;
  } catch (error) {
    console.error("AI lock message error:", error);
    return fallback;
  }
};

// ================================
// RANDOM POP-UP MESSAGES
// ================================

// Random greetings/idle messages
const RANDOM_GREETINGS = [
  "Hey! 👋 Gimana trading hari ini? Semoga cuan terus ya!",
  "Jangan lupa stretching! 🧘 Duduk kelamaan depan chart ga bagus buat kesehatan.",
  "Pro tip: Kalau udah 2 jam nonstop lihat chart, istirahat dulu 15 menit. Otak butuh reset! 🧠",
  "Inget ya, trading itu marathon bukan sprint. Slow and steady wins the race! 🐢",
  "Udah makan belum? Jangan sampe hipoglikemia bikin keputusan trading jelek! 🍜",
  "Fun fact: 90% trader loss bukan karena strategy jelek, tapi karena mental ga kuat. Keep your cool! 😎",
  "Reminder: Jangan bawa emosi pribadi ke trading. Kalau lagi bad mood, mending skip dulu. 🧘",
];

// Messages when user has no trades yet
const NO_TRADES_MESSAGES = [
  "Belum ada trade hari ini? 🤔 Take your time, better no trade than bad trade!",
  "Masih kosong nih jurnal hari ini. Lagi nunggu setup yang mantap? Good patience! 👏",
  "No trade is also a trade decision! Kadang ga masuk market itu pilihan paling smart. 🧠",
];

// Messages when user is profitable
const PROFITABLE_MESSAGES = [
  "Wih, hari ini ijo nih! 🌿 Jangan lupa lock profit ya, jangan sampe balik merah!",
  "Mantap, udah profit hari ini! Mau tambahin trade lagi? Hati-hati overtrading! ⚠️",
  "Cuan detected! 💰 Inget, greed is the enemy. Tau kapan harus berhenti itu skill!",
];

// Messages when user is at loss
const LOSS_MESSAGES = [
  "Hari ini merah... 😔 Gapapa, yang penting evaluasi dan jangan revenge trade!",
  "Losing streak? Mungkin saatnya step back dan review strategy. No shame in that! 💪",
  "Merah itu bagian dari game. Yang penting: jangan double down pas lagi sial! 🎰➡️🚫",
];

// Messages when close to lock (1 loss)
const WARNING_MESSAGES = [
  "⚠️ Hati-hati! Udah 1x loss hari ini. Satu lagi dan trading terkunci!",
  "Sisa 1 kesempatan sebelum lock! Think twice before next trade. 🧠",
  "1 loss down, 1 to go before lockout. Yakin mau ambil trade lagi? Pastiin setup-nya A+! 🎯",
];

// Get random message based on context
export const getRandomPopUp = (todayTrades, dayTotal, lossCount) => {
  // Priority: Warning > Loss > Profit > No trades > General

  // Check if close to lock (1 loss)
  if (lossCount === 1) {
    // 40% chance to show warning
    if (Math.random() < 0.4) {
      return WARNING_MESSAGES[
        Math.floor(Math.random() * WARNING_MESSAGES.length)
      ];
    }
  }

  // No trades yet
  if (todayTrades.length === 0) {
    // 50% chance for no-trade message, 50% general
    if (Math.random() < 0.5) {
      return NO_TRADES_MESSAGES[
        Math.floor(Math.random() * NO_TRADES_MESSAGES.length)
      ];
    }
  }

  // Currently at loss
  if (dayTotal < 0) {
    // 50% chance for loss-specific message
    if (Math.random() < 0.5) {
      return LOSS_MESSAGES[Math.floor(Math.random() * LOSS_MESSAGES.length)];
    }
  }

  // Currently profitable
  if (dayTotal > 0) {
    // 50% chance for profit message
    if (Math.random() < 0.5) {
      return PROFITABLE_MESSAGES[
        Math.floor(Math.random() * PROFITABLE_MESSAGES.length)
      ];
    }
  }

  // Default: random greeting
  return RANDOM_GREETINGS[Math.floor(Math.random() * RANDOM_GREETINGS.length)];
};

// Get a motivational quote
const MOTIVATIONAL_QUOTES = [
  '"The goal of a successful trader is to make the best trades. Money is secondary." - Alexander Elder 📚',
  '"In trading, the impossible happens about twice a year." - Henri M Simoes 🎲',
  '"Cut your losses and let your profits run." - Trading 101 ✂️📈',
  '"The trend is your friend until the end." - Ed Seykota 📉📈',
  '"Plan your trade and trade your plan." - Every Trading Book Ever 📝',
  '"Risk comes from not knowing what you\'re doing." - Warren Buffett 🎯',
];

export const getRandomQuote = () => {
  return MOTIVATIONAL_QUOTES[
    Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)
  ];
};
