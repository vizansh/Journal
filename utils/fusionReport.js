/**
 * Fusion report utility.
 * Builds weekly reports from text emotion, typing patterns, edit behavior, and weather memory.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OPENAI_API_KEY } from "../config";

const WEEKLY_REPORT_KEY = "weeklyReports";
const MAX_SAVED_REPORTS = 12;

const formatDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const getReportWeekStart = (referenceDate) => {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const offset = day === 0 ? 7 : day;
  date.setDate(date.getDate() - offset);
  date.setHours(0, 0, 0, 0, 0);
  return date;
};

const getWeekRange = (referenceDate) => {
  const weekStart = getReportWeekStart(referenceDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
};

const filterEntriesForWeek = (entries, weekStart, weekEnd) =>
  entries.filter((entry) => {
    const date = new Date(entry.createdAt);
    return date >= weekStart && date <= weekEnd;
  });

const countBy = (items, keyFn) =>
  items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const average = (values) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const buildMetrics = (entries, weatherMemory) => {
  const entryCount = entries.length;
  const emotionCounts = countBy(entries, (entry) => entry.emotion || "Neutral");
  const entriesByTime = [...entries].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  const typingCounts = countBy(
    entries,
    (entry) => entry.typingStyle || "steady",
  );
  const editCountTotal = entries.reduce(
    (sum, entry) => sum + (entry.editCount || 0),
    0,
  );
  const editedEntries = entries.filter(
    (entry) => (entry.editCount || 0) > 0,
  ).length;
  const wordCounts = entries.map(
    (entry) => entry.wordCount || entry.text.trim().split(/\s+/).length,
  );
  const avgWordLengths = entries.map(
    (entry) =>
      entry.avgWordLength ||
      Math.round(
        (entry.text.replace(/\s+/g, "").length || 0) /
          Math.max(entry.text.trim().split(/\s+/).length, 1),
      ),
  );
  const typedPunctuationDensity = entries.map((entry) => {
    const words = entry.wordCount || entry.text.trim().split(/\s+/).length;
    const punctuationLength = (entry.text.match(/[!?.]/g) || []).length;
    return words > 0 ? punctuationLength / words : 0;
  });
  const typingWPM = entries
    .map((entry) => {
      if (!entry.typingDurationMs || entry.typingDurationMs <= 0) return 0;
      const words = entry.wordCount || entry.text.trim().split(/\s+/).length;
      return (words / Math.max(entry.typingDurationMs / 60000, 0.1)).toFixed(1);
    })
    .map(Number)
    .filter((value) => value > 0);

  const timeOfDayCounts = entries.reduce((acc, entry) => {
    const hour = new Date(entry.createdAt).getHours();
    const bucket =
      hour < 6
        ? "night"
        : hour < 12
          ? "morning"
          : hour < 18
            ? "afternoon"
            : "evening";
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});

  const editLatencies = entries
    .map((entry) => {
      if (!entry.lastEditedAt) return null;
      return (
        (new Date(entry.lastEditedAt).getTime() -
          new Date(entry.createdAt).getTime()) /
        (1000 * 60 * 60)
      );
    })
    .filter((value) => value !== null && value >= 0);

  const weatherValues = entries
    .map((entry) => entry.weatherMemory)
    .filter((value) => typeof value === "string" && value.trim().length > 0);
  const weatherCounts = countBy(weatherValues, (value) =>
    value.trim().toLowerCase(),
  );

  // Aggregate typing and motion metrics when available
  const typingMetricsList = entries.map((e) => e.typingMetrics).filter(Boolean);
  const motionMetricsList = entries.map((e) => e.motionMetrics).filter(Boolean);

  const avg = (arr, key) => {
    const vals = arr
      .map((a) => a[key] || 0)
      .filter((v) => typeof v === "number");
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  const averageBackspaces = +avg(typingMetricsList, "backspaceCount").toFixed(
    1,
  );
  const averageInserts = +avg(typingMetricsList, "insertCount").toFixed(1);
  const averageKeystrokes = +avg(typingMetricsList, "keystrokeCount").toFixed(
    1,
  );
  const averageInterKeyMs = +avg(typingMetricsList, "avgInterKeyMs").toFixed(1);
  const averagePauses = +avg(typingMetricsList, "pauseCount").toFixed(1);

  const averageMotionMean = +avg(motionMetricsList, "meanMag").toFixed(3);
  const averageMotionStd = +avg(motionMetricsList, "stdMag").toFixed(3);
  const averageMotionPeaks = +avg(motionMetricsList, "peakCount").toFixed(1);

  const sortedEmotions = Object.entries(emotionCounts).sort(
    (a, b) => b[1] - a[1],
  );
  const dominantEmotion = sortedEmotions[0]?.[0] || "Neutral";
  const dominantEmotionShare =
    entryCount > 0
      ? Math.round((sortedEmotions[0]?.[1] / entryCount) * 100)
      : 0;
  const emotionVolatility = entriesByTime.reduce((count, entry, idx) => {
    if (idx === 0) return 0;
    return entry.emotion !== entriesByTime[idx - 1].emotion ? count + 1 : count;
  }, 0);
  const distinctEmotions = Object.keys(emotionCounts).length;
  const longEntryCount = entries.filter(
    (entry) => (entry.wordCount || entry.text.trim().split(/\s+/).length) > 60,
  ).length;
  const shortEntryCount = entries.filter(
    (entry) => (entry.wordCount || entry.text.trim().split(/\s+/).length) < 20,
  ).length;

  const positiveEmotions = ["Joy", "Love", "Excitement", "Surprise", "Calm"];
  const negativeEmotions = ["Sadness", "Anger", "Fear", "Anxiety", "Disgust"];
  const positiveCount = Object.entries(emotionCounts).reduce(
    (sum, [key, value]) => (positiveEmotions.includes(key) ? sum + value : sum),
    0,
  );
  const negativeCount = Object.entries(emotionCounts).reduce(
    (sum, [key, value]) => (negativeEmotions.includes(key) ? sum + value : sum),
    0,
  );

  return {
    entryCount,
    emotionCounts,
    dominantEmotion,
    dominantEmotionShare,
    distinctEmotions,
    emotionVolatility,
    positiveRatio:
      entryCount > 0 ? +(positiveCount / entryCount).toFixed(2) : 0,
    negativeRatio:
      entryCount > 0 ? +(negativeCount / entryCount).toFixed(2) : 0,
    typingCounts,
    averageWPM: +average(typingWPM).toFixed(1),
    averageWords: +average(wordCounts).toFixed(1),
    averageWordLength: +average(avgWordLengths).toFixed(1),
    averagePunctuationDensity: +average(typedPunctuationDensity).toFixed(2),
    timeOfDayCounts,
    longEntryRatio:
      entryCount > 0 ? +(longEntryCount / entryCount).toFixed(2) : 0,
    shortEntryRatio:
      entryCount > 0 ? +(shortEntryCount / entryCount).toFixed(2) : 0,
    editRate: entryCount > 0 ? +(editedEntries / entryCount).toFixed(2) : 0,
    averageEdits:
      entryCount > 0 ? +(editCountTotal / entryCount).toFixed(1) : 0,
    averageEditLatencyHours:
      editLatencies.length > 0 ? +average(editLatencies).toFixed(1) : 0,
    weatherCounts,
    weatherMemory: weatherMemory?.trim() || "",
    // typing & motion aggregates
    averageBackspaces,
    averageInserts,
    averageKeystrokes,
    averageInterKeyMs,
    averagePauses,
    averageMotionMean,
    averageMotionStd,
    averageMotionPeaks,
  };
};

const buildReportPrompt = (metrics, weekStart, weekEnd) => {
  const emotionLines = Object.entries(metrics.emotionCounts)
    .map(([emotion, count]) => `- ${emotion}: ${count}`)
    .join("\n");

  const weatherLine = metrics.weatherMemory
    ? `Weather memory: ${metrics.weatherMemory}`
    : "No weather memory was stored this week.";

  return `You are a research psychologist and affective behavior AI. Use the data below to generate a nuanced, multi-dimensional insight across emotion, typing rhythm, editing behavior, linguistic complexity, and weather context. Avoid simplistic rule-based summaries. Use the data as evidence and provide a complex but readable emotional analysis.

Week start: ${formatDate(weekStart)}
Week end: ${formatDate(weekEnd)}
Total entries: ${metrics.entryCount}
Emotion distribution:
${emotionLines}
Typing style counts: ${JSON.stringify(metrics.typingCounts)}
Average words per entry: ${metrics.averageWords}
Average word length: ${metrics.averageWordLength}
Average punctuation density: ${metrics.averagePunctuationDensity}
Time-of-day distribution: ${JSON.stringify(metrics.timeOfDayCounts)}
Long entry ratio: ${(metrics.longEntryRatio * 100).toFixed(0)}%
Short entry ratio: ${(metrics.shortEntryRatio * 100).toFixed(0)}%
Average typing speed (WPM): ${metrics.averageWPM}
Edit rate: ${(metrics.editRate * 100).toFixed(0)}% of entries were edited
Average edits per entry: ${metrics.averageEdits}
Average edit latency (hours): ${metrics.averageEditLatencyHours}
Distinct emotions recorded: ${metrics.distinctEmotions}
Emotion volatility count: ${metrics.emotionVolatility}
${weatherLine}

Typing & keystroke signals: average keystrokes per entry: ${metrics.averageKeystrokes}, average backspaces per entry: ${metrics.averageBackspaces}, average inserts per entry: ${metrics.averageInserts}, average inter-key ms: ${metrics.averageInterKeyMs}, average pause count (>2s): ${metrics.averagePauses}

Motion sensor signals: average motion magnitude: ${metrics.averageMotionMean}, motion stddev: ${metrics.averageMotionStd}, average motion peaks per entry: ${metrics.averageMotionPeaks}

Treat weather as an environmental signal and consider how it may interact with mood, energy, and expression.
If the data includes sensor or device context such as motion, orientation, or display interactions, incorporate that detail into the analysis; if not, make a strong behavioral inference from the available text and typing features.

Write:
1) A layered emotional summary describing tone, volatility, and intent.
2) A research-informed insight about how writing style, rhythm, editing, and environmental cues reflect state.
3) A practical recommendation for next week.

Return the result as a short paragraph plus one clear suggestion sentence.`;
};

const callOpenAIForReport = async (prompt) => {
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
        { role: "system", content: "You are an empathetic AI mood analyst." },
        { role: "user", content: prompt },
      ],
      max_tokens: 220,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status} ${body}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || "";
};

const buildFallbackSummary = (metrics, weekStart, weekEnd) => {
  const lines = [];
  lines.push(
    `From ${formatDate(weekStart)} to ${formatDate(weekEnd)}, your entries show ${metrics.entryCount} total journal records.`,
  );
  lines.push(
    `The most frequent feeling was ${metrics.dominantEmotion} (${metrics.dominantEmotionShare}% of entries).`,
  );
  if (metrics.positiveRatio > 0.6) {
    lines.push("The overall tone is positive and steady.");
  } else if (metrics.negativeRatio > 0.4) {
    lines.push("This week includes more challenging emotions than usual.");
  } else {
    lines.push(
      "The emotional balance is mixed with both calm and restless moments.",
    );
  }
  if (metrics.typingCounts.fast > 0) {
    lines.push("Fast typing suggests energy or urgency in how you wrote.");
  }
  if (metrics.typingCounts.slow > 0) {
    lines.push("Slower typing indicates careful thought or reflection.");
  }
  if (metrics.weatherMemory) {
    lines.push(
      `Weather memory (${metrics.weatherMemory}) may be linked to these feelings.`,
    );
  }
  const suggestion =
    metrics.negativeRatio > 0.4
      ? "Try a simple breathing or gratitude check-in next week to support mood stability."
      : "Keep tracking your mood and notice how typing pace and weather relate to how you feel.";
  return `${lines.join(" ")} ${suggestion}`;
};

export const getWeekReportId = (referenceDate) =>
  `week-${formatDate(getReportWeekStart(referenceDate))}`;

export const loadWeeklyReports = async () => {
  try {
    const stored = await AsyncStorage.getItem(WEEKLY_REPORT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveWeeklyReports = async (reports) => {
  try {
    await AsyncStorage.setItem(WEEKLY_REPORT_KEY, JSON.stringify(reports));
  } catch (err) {
    console.error("Failed to save weekly reports", err);
  }
};

export const buildWeeklyReport = async (
  entries,
  weatherMemory,
  referenceDate = new Date(),
) => {
  const { weekStart, weekEnd } = getWeekRange(referenceDate);
  const weekEntries = filterEntriesForWeek(entries, weekStart, weekEnd);

  if (weekEntries.length === 0) return null;

  const metrics = buildMetrics(weekEntries, weatherMemory);
  let summary = "";
  let summarySource = "ai";
  try {
    const prompt = buildReportPrompt(metrics, weekStart, weekEnd);
    summary = await callOpenAIForReport(prompt);
  } catch (err) {
    summarySource = "fallback";
    summary = buildFallbackSummary(metrics, weekStart, weekEnd);
  }

  return {
    id: getWeekReportId(referenceDate),
    generatedAt: new Date().toISOString(),
    weekStart: formatDate(weekStart),
    summarySource,
    weekEnd: formatDate(weekEnd),
    summary,
    metrics,
  };
};

export const isSunday = (referenceDate = new Date()) =>
  new Date(referenceDate).getDay() === 0;

export const hasReportForWeek = (reports, referenceDate = new Date()) =>
  reports.some((report) => report.id === getWeekReportId(referenceDate));
