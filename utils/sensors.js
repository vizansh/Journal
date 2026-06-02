import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHED_LOCATION_KEY = "cachedLocation";
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export const getCachedLocation = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHED_LOCATION_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj.timestamp) return obj;
    const age = Date.now() - obj.timestamp;
    if (age > LOCATION_CACHE_TTL_MS) return null;
    return obj;
  } catch (err) {
    return null;
  }
};

export const cacheLocation = async (coords) => {
  try {
    await AsyncStorage.setItem(
      CACHED_LOCATION_KEY,
      JSON.stringify({ coords, timestamp: Date.now() }),
    );
  } catch (err) {
    // ignore
  }
};

export const requestLocationPermission = async () => {
  try {
    const ExpoLocationModule = await import("expo-location");
    const ExpoLocation = ExpoLocationModule.default || ExpoLocationModule;
    if (!ExpoLocation) return false;
    const requestFn =
      typeof ExpoLocation.requestForegroundPermissionsAsync === "function"
        ? ExpoLocation.requestForegroundPermissionsAsync
        : typeof ExpoLocation.requestPermissionsAsync === "function"
          ? ExpoLocation.requestPermissionsAsync
          : null;
    if (!requestFn) return false;
    const { status } = await requestFn.call(ExpoLocation);
    return status === "granted";
  } catch (_err) {
    return false;
  }
};

export const getCurrentLocation = async () => {
  try {
    const ExpoLocationModule = await import("expo-location");
    const ExpoLocation = ExpoLocationModule.default || ExpoLocationModule;
    if (
      ExpoLocation &&
      typeof ExpoLocation.getCurrentPositionAsync === "function"
    ) {
      const pos = await ExpoLocation.getCurrentPositionAsync({});
      const coords = pos?.coords
        ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        : null;
      if (coords) await cacheLocation(coords);
      return coords;
    }
  } catch (err) {
    return null;
  }
  return null;
};

export const requestMotionPermission = async () => {
  try {
    const ExpoSensorsModule = await import("expo-sensors");
    const ExpoSensors = ExpoSensorsModule.default || ExpoSensorsModule;
    const DeviceMotion = ExpoSensors?.DeviceMotion;
    return !!DeviceMotion && typeof DeviceMotion.addListener === "function";
  } catch (_err) {
    return false;
  }
};

export const subscribeToMotion = async (callback, frequencyHz = 10) => {
  try {
    const ExpoSensorsModule = await import("expo-sensors");
    const ExpoSensors = ExpoSensorsModule.default || ExpoSensorsModule;
    if (!ExpoSensors) return () => {};
    const DeviceMotion = ExpoSensors.DeviceMotion;
    if (!DeviceMotion || typeof DeviceMotion.addListener !== "function") {
      return () => {};
    }
    if (typeof DeviceMotion.setUpdateInterval === "function") {
      DeviceMotion.setUpdateInterval(
        Math.round(1000 / Math.max(frequencyHz, 1)),
      );
    }
    const sub = DeviceMotion.addListener((data) => {
      callback(data);
    });
    return () => sub?.remove?.();
  } catch (_err) {
    return () => {};
  }
};

export default {
  getCachedLocation,
  cacheLocation,
  requestLocationPermission,
  getCurrentLocation,
  requestMotionPermission,
  subscribeToMotion,
};
