import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Button, Dimensions, ScrollView, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import {
  ALL_EMOTIONS,
  getEmotionColor,
  getEmotionLevel,
} from "../config/emotionLevels";
import { isThisMonth, isThisWeek } from "../utils/dateHelpers";
import { getForecastWithMetadata } from "../utils/forecastEmotions";

export default function EmotionGraph() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [forecast, setForecast] = useState(null);
  const [entryCount, setEntryCount] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const stored = await AsyncStorage.getItem("entries");
      if (stored) {
        const entries = JSON.parse(stored);

        // Filter by time for graph display
        const filtered = entries.filter((e) => {
          const date = new Date(e.createdAt);
          if (filter === "week") return isThisWeek(date);
          if (filter === "month") return isThisMonth(date);
          return true;
        });

        // Group by day and get most recent emotion per day (or store all for visualization)
        const grouped = {};
        filtered.forEach((e) => {
          const day = new Date(e.createdAt).toLocaleDateString();
          if (!grouped[day]) {
            grouped[day] = [];
          }
          grouped[day].push(e.emotion);
        });

        const labels = Object.keys(grouped).slice(-7); // last 7 days

        // For each emotion, create a dataset with emotion levels
        const datasets = ALL_EMOTIONS.map((emo) => ({
          data: labels.map((day) => {
            // Count how many times this emotion appears that day and map to its level
            const count = grouped[day].filter((e) => e === emo).length;
            return count > 0 ? getEmotionLevel(emo) : 0;
          }),
          color: (opacity = 1) => getEmotionColor(emo, opacity),
          strokeWidth: 2,
          strokeDasharray: [0], // solid line
        }));

        setData({ labels, datasets });

        // Get forecast with metadata
        const { forecast: forecastData, entryCount: count } =
          getForecastWithMetadata(entries);
        setForecast(forecastData);
        setEntryCount(count);
      }
    };
    loadData();
  }, [filter]);

  return (
    <ScrollView>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, marginBottom: 10, fontWeight: "bold" }}>
          Emotion Trends
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            marginBottom: 16,
          }}
        >
          <Button
            title="All"
            onPress={() => setFilter("all")}
            color={filter === "all" ? "#007AFF" : "#999"}
          />
          <Button
            title="This Week"
            onPress={() => setFilter("week")}
            color={filter === "week" ? "#007AFF" : "#999"}
          />
          <Button
            title="This Month"
            onPress={() => setFilter("month")}
            color={filter === "month" ? "#007AFF" : "#999"}
          />
        </View>

        {data && (
          <>
            <Text style={{ fontSize: 14, marginBottom: 8, color: "#666" }}>
              Historical Data (Last 7 Days)
            </Text>
            <LineChart
              data={data}
              width={Dimensions.get("window").width - 40}
              height={300}
              chartConfig={{
                backgroundColor: "#fff",
                backgroundGradientFrom: "#f9f9f9",
                backgroundGradientTo: "#f9f9f9",
                color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
                labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,
                strokeWidth: 2,
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                },
                propsForBackgroundLines: {
                  strokeDasharray: "4",
                  stroke: "#e0e0e0",
                },
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16 }}
              yAxisLabel=""
              yAxisSuffix=""
              yMin={-5}
              yMax={5}
              xAxisLabel=""
            />
          </>
        )}

        {/* Forecast Section */}
        {forecast ? (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 14, marginBottom: 8, color: "#666" }}>
              7-Day Forecast (Predicted)
            </Text>
            <Text
              style={{
                fontSize: 12,
                marginBottom: 12,
                color: "#999",
                fontStyle: "italic",
              }}
            >
              Based on {entryCount} entries from last 30 days
            </Text>
            {forecast.map((day, idx) => (
              <View
                key={idx}
                style={{
                  marginBottom: 12,
                  padding: 12,
                  backgroundColor: "#f5f5f5",
                  borderRadius: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: "#999",
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "600", marginBottom: 6 }}
                >
                  {day.dayOfWeek} - {day.date}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {day.predictions.map((pred, pidx) => (
                    <View
                      key={pidx}
                      style={{
                        backgroundColor: getEmotionColor(pred.emotion, 0.3),
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: getEmotionColor(pred.emotion, 0.6),
                        marginRight: 10,
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "500" }}>
                        {pred.emotion}
                      </Text>
                      <Text style={{ fontSize: 10, color: "#666" }}>
                        {pred.confidence}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View
            style={{
              marginTop: 24,
              padding: 16,
              backgroundColor: "#f0f0f0",
              borderRadius: 8,
              borderLeftWidth: 3,
              borderLeftColor: "#999",
            }}
          >
            <Text style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
              Forecast Not Available
            </Text>
            <Text style={{ fontSize: 11, color: "#999" }}>
              You need at least 25 entries from the last 30 days to see
              predictions. Current entries: {entryCount}/25
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
