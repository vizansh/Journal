import { Pressable, StyleSheet, Text, View } from "react-native";
import { getEmotionColor } from "../config/emotionLevels";

export default function EntryCard({ entry, onLongPress, fusionMode }) {
  const createdAt = new Date(entry.createdAt);
  const elapsedHours = Math.floor(
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60),
  );
  const hoursLeft = Math.max(0, 24 - elapsedHours);
  const excerpt =
    entry.text.length > 120
      ? `${entry.text.slice(0, 120).trim()}...`
      : entry.text;
  const emotion = entry.emotion || "Neutral";

  const getFusionLabel = (emotion, typingStyle, weather, metrics) => {
    if (!emotion) return "No fused insight";
    const traits = [];
    if (typingStyle === "fast") traits.push("urgent rhythm");
    if (typingStyle === "slow") traits.push("deliberate pacing");
    if (typingStyle === "steady") traits.push("measured calm");
    if (weather) traits.push(`under ${weather}`);
    if (metrics?.backspaceCount > 3) traits.push("high edit pressure");
    if (metrics?.pauseCount > 1) traits.push("hesitant pauses");
    return `${emotion} ${traits.join(" and ")}`;
  };

  const renderSensorDetails = () => {
    if (!entry.typingMetrics && !entry.motionMetrics) return null;
    return (
      <View style={styles.sensorBox}>
        {entry.typingMetrics ? (
          <Text style={styles.sensorText}>
            Typing: {entry.typingMetrics.keystrokeCount} keys,{" "}
            {entry.typingMetrics.backspaceCount} deletions,{" "}
            {entry.typingMetrics.pauseCount} pauses
          </Text>
        ) : null}
        {entry.motionMetrics ? (
          <Text style={styles.sensorText}>
            Motion: {entry.motionMetrics.sampleCount} samples, mean{" "}
            {entry.motionMetrics.meanMag}, peaks {entry.motionMetrics.peakCount}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <Pressable
      onLongPress={onLongPress}
      disabled={hoursLeft <= 0}
      style={({ pressed }) => [
        styles.card,
        pressed && hoursLeft > 0 ? styles.pressed : null,
      ]}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.emotionPill,
            {
              backgroundColor: getEmotionColor(emotion, 0.16),
              borderColor: getEmotionColor(emotion, 0.45),
            },
          ]}
        >
          <Text style={styles.emotionText}>{emotion}</Text>
        </View>
        <Text style={styles.metaText}>
          {createdAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      {fusionMode ? (
        <View style={styles.fusionRow}>
          <Text style={styles.fusionText}>
            Fusion:{" "}
            {getFusionLabel(
              entry.emotion,
              entry.typingStyle,
              entry.weatherMemory,
              entry.typingMetrics,
            )}
          </Text>
        </View>
      ) : null}
      {renderSensorDetails()}
      <Text style={styles.text} numberOfLines={3} ellipsizeMode="tail">
        {excerpt}
      </Text>
      <View style={styles.footerRow}>
        <Text style={styles.metaText}>
          {hoursLeft > 0 ? `${hoursLeft}h left to edit` : "Edit window expired"}
        </Text>
        <Text style={styles.metaText}>{entry.typingStyle || "steady"}</Text>
      </View>
      {entry.editCount > 0 ? (
        <Text style={styles.metaText}>
          Edited {entry.editCount} time{entry.editCount > 1 ? "s" : ""}
        </Text>
      ) : null}
      {entry.weatherMemory ? (
        <Text style={styles.weatherText}>Weather: {entry.weatherMemory}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 12,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  pressed: {
    opacity: 0.75,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  text: {
    fontSize: 15,
    color: "#111",
    lineHeight: 22,
  },
  emotionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  emotionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
  },
  fusionRow: {
    marginTop: 10,
  },
  fusionText: {
    fontSize: 12,
    color: "#444",
    fontStyle: "italic",
  },
  sensorBox: {
    marginTop: 8,
  },
  sensorText: {
    fontSize: 12,
    color: "#555",
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: "#666",
  },
  weatherText: {
    marginTop: 8,
    fontSize: 12,
    color: "#555",
  },
});
