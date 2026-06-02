import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import EntryCard from "../components/EntryCard";
import { analyzeEmotion } from "../utils/analyzeEmotion";
import { isSameDay, isThisMonth, isThisWeek } from "../utils/dateHelpers";
import {
  buildWeeklyReport,
  getWeekReportId,
  hasReportForWeek,
  isSunday,
  loadWeeklyReports,
  saveWeeklyReports,
} from "../utils/fusionReport";
import * as sensors from "../utils/sensors";
import * as weather from "../utils/weather";
import EmotionGraph from "./EmotionGraph";

export default function MoodJournal() {
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showGraph, setShowGraph] = useState(false);
  const [loading, setLoading] = useState(false);
  const [typingStartedAt, setTypingStartedAt] = useState(null);
  const [weatherMemory, setWeatherMemory] = useState("");
  const [weatherSource, setWeatherSource] = useState("device-context");
  const [weatherInput, setWeatherInput] = useState("");
  const [showFusion, setShowFusion] = useState(false);
  const [fusionMode, setFusionMode] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [weeklyLoaded, setWeeklyLoaded] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportStatus, setReportStatus] = useState("");
  const [sensorsEnabled, setSensorsEnabled] = useState(false);
  const [motionSupported, setMotionSupported] = useState(false);
  const [locationSupported, setLocationSupported] = useState(false);
  const [sensorStatus, setSensorStatus] = useState("");
  const prevTextRef = useRef("");
  const backspaceCountRef = useRef(0);
  const insertCountRef = useRef(0);
  const keystrokeTimestampsRef = useRef([]);
  const motionSamplesRef = useRef([]);
  const motionUnsubRef = useRef(null);
  const motionInitRef = useRef(false);

  const startMotionSampling = (callback) => {
    if (motionInitRef.current || motionUnsubRef.current) return;
    motionInitRef.current = true;
    motionSamplesRef.current = [];
    sensors
      .subscribeToMotion(callback)
      .then((unsubscribe) => {
        motionUnsubRef.current = unsubscribe;
      })
      .catch(() => {
        motionUnsubRef.current = () => {};
      })
      .finally(() => {
        motionInitRef.current = false;
      });
  };

  // Load entries and weather memory from storage on mount
  const inferWeatherFromDevice = async (cachedWeather) => {
    if (cachedWeather?.trim()) {
      return { value: cachedWeather.trim(), source: "cached" };
    }

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
      const hour = new Date().getHours();
      const partOfDay =
        hour < 6
          ? "night"
          : hour < 12
            ? "morning"
            : hour < 18
              ? "afternoon"
              : "evening";
      const ambientHint =
        partOfDay === "morning"
          ? "cool and calm"
          : partOfDay === "afternoon"
            ? "warm and active"
            : partOfDay === "evening"
              ? "cool and reflective"
              : "quiet and low-light";
      return {
        value: `${ambientHint} (${partOfDay}, ${tz})`,
        source: "device-context",
      };
    } catch {
      return {
        value: "Unknown device-context weather",
        source: "device-context",
      };
    }
  };

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const stored = await AsyncStorage.getItem("entries");
        if (stored) setEntries(JSON.parse(stored));
        const cachedWeather = await AsyncStorage.getItem("weatherMemory");
        const inferred = await inferWeatherFromDevice(cachedWeather);
        setWeatherMemory(inferred.value);
        setWeatherSource(inferred.source);
        if (cachedWeather?.trim()) setWeatherInput(cachedWeather.trim());
        // also check for a cached precise location and try to resolve weather for it
        try {
          const cachedLoc = await sensors.getCachedLocation();
          if (cachedLoc && cachedLoc.coords) {
            try {
              const w = await weather.getWeatherForLocation(cachedLoc.coords);
              if (w) {
                await AsyncStorage.setItem("weatherMemory", w);
                setWeatherMemory(w);
                setWeatherSource("cached-location");
              } else {
                setWeatherMemory(
                  `${cachedLoc.coords.latitude.toFixed(3)}, ${cachedLoc.coords.longitude.toFixed(3)}`,
                );
                setWeatherSource("cached-location");
              }
            } catch (e) {
              setWeatherMemory(
                `${cachedLoc.coords.latitude.toFixed(3)}, ${cachedLoc.coords.longitude.toFixed(3)}`,
              );
              setWeatherSource("cached-location");
            }
          }
        } catch (e) {
          // ignore
        }
        const reports = await loadWeeklyReports();
        setWeeklyReports(reports);
        setWeeklyReport(reports[reports.length - 1] || null);
      } catch (err) {
        console.error("Failed to load entries or weather memory", err);
      } finally {
        setWeeklyLoaded(true);
      }
    };
    loadStoredData();
  }, []);

  const updateStoredEntries = async (updatedEntries) => {
    await AsyncStorage.setItem("entries", JSON.stringify(updatedEntries));
    setEntries(updatedEntries);
  };

  useEffect(() => {
    const ensureSundayReport = async () => {
      if (!weeklyLoaded) return;
      if (!entries.length) {
        setReportStatus("Start journaling to generate Sunday AI reports.");
        return;
      }

      const today = new Date();
      if (!isSunday(today)) {
        const lastReport = weeklyReports[weeklyReports.length - 1];
        if (lastReport) {
          setWeeklyReport(lastReport);
          setReportStatus(
            `Last AI report: ${lastReport.weekStart} → ${lastReport.weekEnd}`,
          );
        } else {
          setReportStatus("Weekly AI reports appear on Sundays.");
        }
        return;
      }

      if (hasReportForWeek(weeklyReports, today)) {
        setWeeklyReport(
          weeklyReports.find((report) => report.id === getWeekReportId(today)),
        );
        setReportStatus("Today's AI report is ready.");
        return;
      }

      setReportLoading(true);
      setReportStatus("Generating Sunday's AI report...");
      try {
        const report = await buildWeeklyReport(entries, weatherMemory, today);
        if (report) {
          const nextReports = [...weeklyReports, report].slice(-12);
          await saveWeeklyReports(nextReports);
          setWeeklyReports(nextReports);
          setWeeklyReport(report);
          setReportStatus("Sunday AI report generated.");
        } else {
          setReportStatus(
            "Not enough weekly entries yet; report will generate once there are enough records.",
          );
        }
      } catch (err) {
        console.error("Weekly report generation failed", err);
        setReportStatus("Could not generate AI report right now.");
      } finally {
        setReportLoading(false);
      }
    };

    ensureSundayReport();
  }, [weeklyLoaded, entries, weatherMemory, weeklyReports]);

  const startEditing = (entry) => {
    setEditingEntryId(entry.createdAt);
    setEditText(entry.text);
  };

  const saveEdit = async () => {
    if (!editText.trim()) return;
    setLoading(true);
    try {
      const emotion = await analyzeEmotion(editText);
      const wordCount = editText.trim().split(/\s+/).length;
      const charCount = editText.length;
      const avgWordLength = wordCount
        ? Math.round(editText.replace(/\s+/g, "").length / wordCount)
        : 0;
      const updated = entries.map((entry) =>
        entry.createdAt === editingEntryId
          ? {
              ...entry,
              text: editText,
              emotion,
              wordCount,
              charCount,
              avgWordLength,
              editCount: (entry.editCount || 0) + 1,
              lastEditedAt: new Date().toISOString(),
            }
          : entry,
      );
      await updateStoredEntries(updated);
      setEditingEntryId(null);
      setEditText("");
    } catch (err) {
      Alert.alert("Error", "Could not save edit.");
    } finally {
      setLoading(false);
    }
  };

  const computeTypingStyle = (text, durationMs) => {
    const trimmed = text.trim();
    if (!trimmed || durationMs <= 0) return "steady";
    const words = trimmed.split(/\s+/).length;
    const minutes = Math.max(durationMs / 60000, 0.1);
    const wpm = words / minutes;
    if (wpm < 20) return "slow";
    if (wpm > 55) return "fast";
    return "steady";
  };

  const getFusionLabel = (emotion, typingStyle, weather) => {
    if (!emotion) return "No insight available";
    const traits = [];
    if (typingStyle === "fast") traits.push("urgent energy");
    if (typingStyle === "slow") traits.push("deliberate reflection");
    if (typingStyle === "steady") traits.push("measured calm");
    if (weather) traits.push(`under ${weather}`);
    return `${emotion} with ${traits.join(" and ")}`;
  };

  const enableSensors = async () => {
    setSensorStatus("Requesting permissions...");
    try {
      const locGranted = await sensors.requestLocationPermission();
      const motionGranted = await sensors.requestMotionPermission();
      setLocationSupported(!!locGranted);
      setMotionSupported(!!motionGranted);

      if (locGranted) {
        const coords = await sensors.getCurrentLocation();
        if (coords) {
          try {
            const w = await weather.getWeatherForLocation(coords);
            if (w) {
              await AsyncStorage.setItem("weatherMemory", w);
              setWeatherMemory(w);
              setWeatherSource("location");
            } else {
              setWeatherMemory(
                `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`,
              );
              setWeatherSource("location");
            }
          } catch (e) {
            setWeatherMemory(
              `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`,
            );
            setWeatherSource("location");
          }
        }
      }

      const any = !!locGranted || !!motionGranted;
      setSensorsEnabled(any);
      setSensorStatus(any ? "Sensors enabled" : "Permissions not granted");
    } catch (err) {
      setSensorStatus("Could not enable sensors");
    }
  };

  const handleNewEntryChange = (text) => {
    if (!typingStartedAt && text.trim()) {
      setTypingStartedAt(Date.now());
      startMotionSampling((data) => {
        if (!data) return;
        try {
          const acc =
            data.acceleration ||
            data.accelerationIncludingGravity ||
            data.rotationRate ||
            null;
          const timestamp = Date.now();
          let mag = 0;
          if (acc) {
            const x = acc.x || 0;
            const y = acc.y || 0;
            const z = acc.z || 0;
            mag = Math.sqrt(x * x + y * y + z * z);
          }
          motionSamplesRef.current.push({ t: timestamp, mag });
        } catch (e) {
          // ignore motion errors
        }
      });
    }

    // keystroke diffs and timestamps
    const prev = prevTextRef.current || "";
    const prevLen = prev.length;
    const newLen = text.length;
    if (newLen < prevLen) {
      backspaceCountRef.current += prevLen - newLen;
    } else if (newLen > prevLen) {
      insertCountRef.current += newLen - prevLen;
    }
    keystrokeTimestampsRef.current.push(Date.now());
    prevTextRef.current = text;
    setNewEntry(text);
  };

  // Filter entries by week/month
  const filteredEntries = entries.filter((entry) => {
    if (filter === "week") return isThisWeek(new Date(entry.createdAt));
    if (filter === "month") return isThisMonth(new Date(entry.createdAt));
    return true;
  });

  const addEntry = async () => {
    if (newEntry.trim() === "") return;

    const todayEntry = entries.find((entry) =>
      isSameDay(entry.createdAt, new Date()),
    );

    if (todayEntry) {
      Alert.alert(
        "One entry per day",
        "You already made today's entry. Long press it to edit.",
      );
      return;
    }

    setLoading(true);
    try {
      const emotion = await analyzeEmotion(newEntry);
      const typingDurationMs = typingStartedAt
        ? Date.now() - typingStartedAt
        : 0;
      const typingStyle = computeTypingStyle(newEntry, typingDurationMs);
      const wordCount = newEntry.trim().split(/\s+/).length;
      const charCount = newEntry.length;
      const avgWordLength = wordCount
        ? Math.round(newEntry.replace(/\s+/g, "").length / wordCount)
        : 0;

      // typing metrics from refs
      const keystrokes = keystrokeTimestampsRef.current.slice();
      const interKeyDiffs = [];
      for (let i = 1; i < keystrokes.length; i++) {
        interKeyDiffs.push(keystrokes[i] - keystrokes[i - 1]);
      }
      const avgInterKeyMs = interKeyDiffs.length
        ? Math.round(
            interKeyDiffs.reduce((a, b) => a + b, 0) / interKeyDiffs.length,
          )
        : 0;
      const pauseCount = interKeyDiffs.filter((d) => d > 2000).length;

      // motion metrics
      const motionSamples = motionSamplesRef.current || [];
      const mags = motionSamples.map((s) => s.mag || 0);
      const meanMag = mags.length
        ? mags.reduce((a, b) => a + b, 0) / mags.length
        : 0;
      const stdMag = mags.length
        ? Math.sqrt(
            mags.reduce((sum, v) => sum + Math.pow(v - meanMag, 2), 0) /
              mags.length,
          )
        : 0;
      const peakCount = mags.filter((m) => m > 0.5).length;

      const entry = {
        text: newEntry,
        emotion,
        mode: "mood",
        createdAt: new Date().toISOString(),
        typingStyle,
        typingDurationMs,
        weatherMemory,
        wordCount,
        charCount,
        avgWordLength,
        editCount: 0,
        lastEditedAt: null,
        typingMetrics: {
          keystrokeCount: keystrokes.length,
          insertCount: insertCountRef.current,
          backspaceCount: backspaceCountRef.current,
          avgInterKeyMs,
          pauseCount,
        },
        motionMetrics: {
          sampleCount: motionSamples.length,
          meanMag: +meanMag.toFixed(3),
          stdMag: +stdMag.toFixed(3),
          peakCount,
        },
      };

      const updatedEntries = [...entries, entry];

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const filtered = updatedEntries.filter(
        (e) => new Date(e.createdAt) >= cutoff,
      );
      setTypingStartedAt(null);

      await updateStoredEntries(filtered);
      setNewEntry("");

      // stop motion subscription and reset refs
      try {
        if (motionUnsubRef.current) {
          motionUnsubRef.current();
        }
      } catch (e) {
        // ignore
      }
      motionUnsubRef.current = null;
      motionSamplesRef.current = [];
      prevTextRef.current = "";
      backspaceCountRef.current = 0;
      insertCountRef.current = 0;
      keystrokeTimestampsRef.current = [];
    } catch (err) {
      console.error("addEntry error:", err);
      Alert.alert("Error", "Could not add entry. See logs for details.");
    } finally {
      setLoading(false);
    }
  };

  const saveWeatherMemory = async () => {
    if (!weatherInput.trim()) return;
    try {
      const trimmed = weatherInput.trim();
      await AsyncStorage.setItem("weatherMemory", trimmed);
      setWeatherMemory(trimmed);
      setWeatherSource("cached");
      setWeatherInput("");
    } catch (err) {
      console.error("Failed to save weather memory", err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Journal</Text>
      <Text style={styles.subTitle}>
        AI-powered cross-model insight for text, typing, and weather context.
      </Text>
      <View style={styles.modeRow}>
        <Text style={styles.modeLabel}>Cross-model fusion mode</Text>
        <Switch value={fusionMode} onValueChange={setFusionMode} />
      </View>

      <View
        style={{
          marginBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, marginBottom: 6 }}>
            Sensors & Location
          </Text>
          <Text style={{ fontSize: 12, color: "#666" }}>{sensorStatus}</Text>
        </View>
        <Switch
          value={sensorsEnabled}
          onValueChange={async (val) => {
            if (val) {
              // user turned it on — request permissions immediately
              await enableSensors();
            } else {
              // user turned it off — disable sensors and unsubscribe
              try {
                if (motionUnsubRef.current) {
                  motionUnsubRef.current();
                }
              } catch (e) {
                // ignore
              }
              motionUnsubRef.current = null;
              motionSamplesRef.current = [];
              setSensorsEnabled(false);
              setLocationSupported(false);
              setMotionSupported(false);
              setSensorStatus("Sensors disabled");
            }
          }}
        />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Write today's journal entry..."
        value={newEntry}
        onChangeText={handleNewEntryChange}
        multiline
      />

      {editingEntryId ? (
        <View style={styles.editBox}>
          <TextInput
            style={styles.input}
            value={editText}
            onChangeText={setEditText}
            multiline
          />
          <View style={styles.buttonRow}>
            <Button title="Save Edit" onPress={saveEdit} />
            <Button
              title="Cancel"
              onPress={() => {
                setEditingEntryId(null);
                setEditText("");
              }}
            />
          </View>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <Button title="Add Entry" onPress={addEntry} disabled={loading} />
      )}

      <View style={styles.weatherPanel}>
        <Text style={styles.sectionLabel}>Weather Context</Text>
        <Text style={styles.metaText}>
          {weatherMemory || "No weather context available"}
        </Text>
        <Text style={[styles.metaText, { marginBottom: 10 }]}>
          Source:{" "}
          {weatherSource === "cached"
            ? "Cached device weather"
            : "Inferred from local device context"}
        </Text>
        {weatherSource === "cached" ? (
          <View style={styles.weatherRow}>
            <Button
              title="Refresh"
              onPress={async () => {
                const inferred = await inferWeatherFromDevice(weatherMemory);
                setWeatherMemory(inferred.value);
                setWeatherSource(inferred.source);
              }}
            />
          </View>
        ) : null}
      </View>

      <Button
        title={showFusion ? "Hide Fusion Insights" : "Show AI Fusion Report"}
        onPress={() => setShowFusion((prev) => !prev)}
      />
      {showFusion && (
        <View style={styles.fusionPanel}>
          <Text style={styles.sectionLabel}>Fusion Insight</Text>
          <Text style={styles.metaText}>
            {getFusionLabel(
              filteredEntries[filteredEntries.length - 1]?.emotion,
              filteredEntries[filteredEntries.length - 1]?.typingStyle,
              weatherMemory,
            )}
          </Text>
          <Text style={styles.metaText}>
            Typing style:{" "}
            {filteredEntries[filteredEntries.length - 1]?.typingStyle ||
              "steady"}
          </Text>
          <Text style={styles.metaText}>
            Weather memory: {weatherMemory || "Not set"}
          </Text>
          <Text style={[styles.metaText, { marginTop: 10, fontWeight: "700" }]}>
            AI Report Status
          </Text>
          <Text style={styles.metaText}>{reportStatus}</Text>
          {reportLoading ? (
            <ActivityIndicator size="small" style={{ marginTop: 8 }} />
          ) : null}
          {weeklyReport ? (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.metaText, { fontWeight: "700" }]}>
                Weekly Summary
              </Text>
              <Text style={styles.metaText}>{weeklyReport.summary}</Text>
              <Text style={[styles.metaText, { marginTop: 8 }]}>
                Source:{" "}
                {weeklyReport.summarySource === "fallback"
                  ? "Fallback summary (OpenAI unavailable)"
                  : "AI-driven analysis"}
              </Text>
              {weeklyReport.metrics ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={[styles.metaText, { fontWeight: "700" }]}>
                    Context metrics
                  </Text>
                  <Text style={styles.metaText}>
                    Typing: avg {weeklyReport.metrics.averageKeystrokes} keys,{" "}
                    {weeklyReport.metrics.averageBackspaces} deletions,{" "}
                    {weeklyReport.metrics.averagePauses} pauses
                  </Text>
                  <Text style={styles.metaText}>
                    Rhythm: {weeklyReport.metrics.averageInterKeyMs}ms average
                    pause, {weeklyReport.metrics.averageWPM} WPM
                  </Text>
                  <Text style={styles.metaText}>
                    Motion: mean {weeklyReport.metrics.averageMotionMean}, std{" "}
                    {weeklyReport.metrics.averageMotionStd}, peaks{" "}
                    {weeklyReport.metrics.averageMotionPeaks}
                  </Text>
                  <Text style={styles.metaText}>
                    Weather occurrences:{" "}
                    {Object.keys(weeklyReport.metrics.weatherCounts || {}).join(
                      ", ",
                    ) || "none"}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.filters}>
        <Button title="All" onPress={() => setFilter("all")} />
        <Button title="This Week" onPress={() => setFilter("week")} />
        <Button title="This Month" onPress={() => setFilter("month")} />
      </View>

      <Button
        title={showGraph ? "Hide Graph" : "Show Graph"}
        onPress={() => setShowGraph((prev) => !prev)}
      />
      {showGraph && <EmotionGraph />}

      <FlatList
        data={filteredEntries}
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            fusionMode={fusionMode}
            onLongPress={() => startEditing(item)}
          />
        )}
        keyExtractor={(item) => item.createdAt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, marginTop: 40, backgroundColor: "#fff" },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 8, color: "#111" },
  subTitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 16,
    lineHeight: 20,
  },
  modeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modeLabel: {
    fontSize: 13,
    color: "#444",
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    backgroundColor: "#fafafa",
    textAlignVertical: "top",
  },
  editBox: {
    marginBottom: 14,
    backgroundColor: "#fafafa",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  weatherPanel: {
    backgroundColor: "#fcfcfc",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 14,
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weatherInput: {
    flex: 1,
    marginRight: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
    marginBottom: 10,
  },
  fusionPanel: {
    backgroundColor: "#f6f7ff",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9dcff",
    marginBottom: 14,
  },
  metaText: {
    fontSize: 13,
    color: "#555",
    marginBottom: 4,
  },
  filters: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
  },
});
