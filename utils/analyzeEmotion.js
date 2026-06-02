import { OPENAI_API_KEY } from "../config";

const EMOTION_KEYWORDS = {
  joy: ["happy", "joy", "glad", "delighted", "pleased", "great"],
  sadness: ["sad", "depressed", "down", "unhappy", "miserable"],
  anger: ["angry", "mad", "furious", "irritat"],
  fear: ["scared", "afraid", "fear", "anxious"],
  love: ["love", "cherish", "adore"],
  surprise: ["surprise", "surprised", "shocked"],
  calm: ["calm", "relaxed", "serene"],
  anxiety: ["anxious", "nervous", "worry"],
  excitement: ["excite", "excited", "thrill"],
  disgust: ["disgust", "repulse", "gross"],
  neutral: [],
};

const EMOTION_MAP = {
  joy: "Joy",
  sadness: "Sadness",
  anger: "Anger",
  fear: "Fear",
  love: "Love",
  surprise: "Surprise",
  calm: "Calm",
  anxiety: "Anxiety",
  excitement: "Excitement",
  disgust: "Disgust",
  neutral: "Neutral",
};

function normalizeEmotion(value) {
  if (!value || typeof value !== "string") return "Neutral";
  const normalized = value.trim().toLowerCase();
  return (
    EMOTION_MAP[normalized] ||
    EMOTION_MAP[normalized.replace(/[^a-z]/g, "")] ||
    "Neutral"
  );
}

function localHeuristic(text) {
  const t = text.toLowerCase();
  for (const [emo, kws] of Object.entries(EMOTION_KEYWORDS)) {
    if (kws.some((k) => t.includes(k))) return EMOTION_MAP[emo];
  }
  return EMOTION_MAP.neutral;
}

async function callOpenAI(text) {
  if (!OPENAI_API_KEY) throw new Error("No OPENAI_API_KEY");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Classify text into emotions: joy, sadness, anger, fear, love, surprise, calm, anxiety, excitement, disgust, neutral. Respond with a single word emotion.",
        },
        { role: "user", content: text },
      ],
      max_tokens: 8,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status} ${body}`);
  }
  const json = await res.json();
  return normalizeEmotion(json.choices?.[0]?.message?.content?.trim() ?? "");
}

export async function analyzeEmotion(text) {
  try {
    return await callOpenAI(text);
  } catch (err) {
    return localHeuristic(text);
  }
}
