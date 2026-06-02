# Testing Guide for Journal Sensor & Weather Integration

This guide covers the new location, weather, typing, and motion sensor features added to the app.

## 1. Install dependencies

Run this from the project root:

```bash
npm install
```

If you add a weather provider key, set it in `config.js`:

```js
export const WEATHER_API_KEY = "your_openweathermap_api_key";
```

## 2. Run lint as a quick syntax check

```bash
npm run lint
```

This validates the JavaScript/Expo files and catches syntax or formatting issues.

## 3. Start the app

Open the app in Expo:

```bash
npx expo start
```

Then launch in a device/emulator or Expo Go.

## 4. Enable location and motion sensors

- Open `Journal` screen.
- Tap `Enable Sensors & Location`.
- Grant location permission when prompted.
- On supported devices, motion sampling will begin once typing starts.

If permissions are denied, the app will still work with inferred device-context weather.

## 5. Create a new entry and verify sensor context

- Type a journal entry in the text box.
- The app tracks typing rhythm, backspaces, and pauses.
- On submit, the entry stores `typingMetrics` and `motionMetrics`.
- Verify the entry card shows:
  - Weather context
  - Typing summary
  - Motion summary
  - Fusion insight label

## 6. Verify weather lookup

- If `WEATHER_API_KEY` is set and location permission granted, the app should fetch live weather from OpenWeatherMap.
- If the key is missing, the app falls back to a coordinate string.
- Cached weather is stored in `AsyncStorage` and reloaded on app restart.

## 7. Check weekly AI report metrics

- On Sundays or after enough entries, the app generates a weekly report.
- Verify the report panel includes:
  - AI summary
  - Data source label
  - Typing and motion context metrics
  - Weather occurrence summary

## 8. Final verification

- Confirm there are no new errors in the modified files.
- Open the `EntryCard.js`, `MoodJournal.js`, `fusionReport.js`, and `weather.js` logic visually.
- For a final manual run, ensure the app opens without crash and the Journal UI updates as expected.

## Notes

- `expo-location` and `expo-sensors` are required to run the new features.
- If you test on an emulator, motion data may be limited.
- For the best sensor results, test on a physical device.
