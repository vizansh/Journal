/**
 * Emotion Level Mapping
 * Maps each emotion to a numeric Y-axis value
 * Neutral = 0, Positive emotions above, Negative emotions below
 */

export const EMOTION_LEVELS = {
  // Positive emotions (above neutral)
  Joy: 5,
  Love: 5,
  Excitement: 4,
  Surprise: 3,
  Calm: 2,

  // Neutral
  Neutral: 0,

  // Negative emotions (below neutral)
  Fear: -3,
  Anxiety: -3,
  Sadness: -4,
  Anger: -4,
  Disgust: -4,
};

/**
 * Color mapping for emotions (RGBA format)
 * Used for consistent emotion coloring in visualizations
 */
export const EMOTION_COLORS = {
  Joy: "rgba(255, 200, 0, opacity)", // Gold
  Sadness: "rgba(100, 150, 255, opacity)", // Blue
  Anger: "rgba(255, 100, 100, opacity)", // Red
  Fear: "rgba(200, 100, 200, opacity)", // Purple
  Love: "rgba(255, 100, 180, opacity)", // Pink
  Surprise: "rgba(100, 255, 200, opacity)", // Cyan
  Calm: "rgba(100, 200, 100, opacity)", // Green
  Anxiety: "rgba(255, 150, 100, opacity)", // Orange
  Excitement: "rgba(255, 150, 200, opacity)", // Light Pink
  Disgust: "rgba(150, 100, 100, opacity)", // Brown
  Neutral: "rgba(180, 180, 180, opacity)", // Gray
};

/**
 * Get the Y-value for a given emotion
 * @param {string} emotion - The emotion name
 * @returns {number} The Y-value level for the emotion
 */
export const getEmotionLevel = (emotion) => {
  return EMOTION_LEVELS[emotion] ?? 0; // Default to neutral if emotion not found
};

/**
 * Get the color for a given emotion
 * @param {string} emotion - The emotion name
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} RGBA color string
 */
export const getEmotionColor = (emotion, opacity = 1) => {
  const colorTemplate = EMOTION_COLORS[emotion] ?? EMOTION_COLORS.Neutral;
  return colorTemplate.replace("opacity", opacity);
};

/**
 * List of all supported emotions
 */
export const ALL_EMOTIONS = Object.keys(EMOTION_LEVELS);
