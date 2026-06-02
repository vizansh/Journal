import { WEATHER_API_KEY } from "../config";

const formatCoords = (coords) =>
  `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`;

export const getWeatherForLocation = async (coords) => {
  if (!coords) return null;
  if (!WEATHER_API_KEY) {
    // Try reverse-geocoding to get a human-readable place (no API key required)
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "journal-app/1.0" },
      });
      if (res.ok) {
        const json = await res.json();
        const addr = json.address || {};
        const place =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.county ||
          addr.state ||
          addr.country;
        if (place) return `${place} (${formatCoords(coords)})`;
      }
    } catch (e) {
      // fall through to coordinate fallback
    }
    // no API key and reverse geocode failed — return coords string as fallback
    return formatCoords(coords);
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.latitude}&lon=${coords.longitude}&units=metric&appid=${WEATHER_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return formatCoords(coords);
    const json = await res.json();
    const w = json.weather && json.weather[0] ? json.weather[0] : null;
    const main = w ? w.main : null;
    const desc = w ? w.description : "";
    const temp = json.main ? json.main.temp : null;
    const feels = json.main ? json.main.feels_like : null;
    const parts = [];
    if (desc) parts.push(desc);
    if (temp !== null) parts.push(`${Math.round(temp)}°C`);
    if (feels !== null) parts.push(`feels ${Math.round(feels)}°C`);
    return parts.length ? parts.join(", ") : formatCoords(coords);
  } catch (err) {
    return formatCoords(coords);
  }
};

export default { getWeatherForLocation };
