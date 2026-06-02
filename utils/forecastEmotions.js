/**
 * Forecast Emotions Utility
 * Generates 7-day emotion forecast based on historical patterns
 */

import { ALL_EMOTIONS } from "../config/emotionLevels";
import { isWithinDays } from "./dateHelpers";

/**
 * Calculate emotion frequency from historical entries (last 30 days)
 * @param {Array} entries - All stored entries
 * @returns {Object} Emotion frequencies as percentages
 */
const calculateEmotionFrequency = (entries) => {
  if (!entries || entries.length === 0) {
    // Default distribution if no entries
    return ALL_EMOTIONS.reduce((acc, emotion) => {
      acc[emotion] = 100 / ALL_EMOTIONS.length;
      return acc;
    }, {});
  }

  const emotionCounts = {};
  let totalWeight = 0;

  entries.forEach((entry) => {
    const emotion = entry.emotion || "Neutral";
    const entryDate = new Date(entry.createdAt);
    const daysSince = Math.floor(
      (Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Weight recent entries more heavily (exponential decay with 14-day half-life)
    const weight = Math.exp(-daysSince / 14);

    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + weight;
    totalWeight += weight;
  });

  // Convert to percentages
  const frequencies = {};
  ALL_EMOTIONS.forEach((emotion) => {
    frequencies[emotion] =
      totalWeight > 0
        ? ((emotionCounts[emotion] || 0) / totalWeight) * 100
        : 100 / ALL_EMOTIONS.length;
  });

  return frequencies;
};

/**
 * Get top N emotions with their confidence scores
 * @param {Object} frequencies - Emotion frequency map
 * @param {number} count - Number of top emotions to return
 * @returns {Array} Array of {emotion, confidence} objects, sorted by confidence descending
 */
const getTopEmotions = (frequencies, count = 3) => {
  return Object.entries(frequencies)
    .map(([emotion, confidence]) => ({ emotion, confidence }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, count);
};

/**
 * Generate 7-day emotion forecast
 * @param {Array} entries - All stored entries
 * @returns {Array} Array of 7 forecast days, each with top 3 predicted emotions and confidence %
 *                  Returns null if fewer than 25 entries in last 30 days
 */
export const generateForecast = (entries) => {
  if (!entries || !Array.isArray(entries)) {
    return null;
  }

  // Filter entries from last 30 days
  const last30Days = entries.filter((e) => {
    const date = new Date(e.createdAt);
    return isWithinDays(date, 30);
  });

  // Check threshold: need at least 25 entries
  if (last30Days.length < 25) {
    return null;
  }

  // Calculate emotion frequencies from last 30 days
  const frequencies = calculateEmotionFrequency(last30Days);

  // Generate 7-day forecast (same pattern for each day)
  const forecast = [];
  for (let day = 1; day <= 7; day++) {
    const forecastDate = new Date();
    forecastDate.setDate(forecastDate.getDate() + day);

    const topEmotions = getTopEmotions(frequencies, 3);

    // Normalize confidences to sum to 100%
    const totalConfidence = topEmotions.reduce(
      (sum, e) => sum + e.confidence,
      0,
    );
    const normalizedEmotions = topEmotions.map((e) => ({
      emotion: e.emotion,
      confidence: Math.round((e.confidence / totalConfidence) * 100),
    }));

    forecast.push({
      date: forecastDate.toLocaleDateString(),
      dayOfWeek: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][forecastDate.getDay()],
      predictions: normalizedEmotions,
    });
  }

  return forecast;
};

/**
 * Get forecast with entry count check
 * @param {Array} entries - All stored entries
 * @returns {Object} { forecast: Array|null, entryCount: number, threshold: number }
 */
export const getForecastWithMetadata = (entries) => {
  if (!entries || !Array.isArray(entries)) {
    return { forecast: null, entryCount: 0, threshold: 25 };
  }

  const last30Days = entries.filter((e) => {
    const date = new Date(e.createdAt);
    return isWithinDays(date, 30);
  });

  const entryCount = last30Days.length;
  const forecast = entryCount >= 25 ? generateForecast(entries) : null;

  return { forecast, entryCount, threshold: 25 };
};
