import React, { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const WEATHER_CODE = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle (light)",
  57: "Freezing drizzle (dense)",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Freezing rain (light)",
  67: "Freezing rain (heavy)",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function degToCompass(num) {
  if (num == null || isNaN(num)) return "—";
  const val = Math.floor(num / 22.5 + 0.5);
  const arr = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return arr[val % 16];
}

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function formatHour(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function WeatherNowApp() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  const [selectedPlace, setSelectedPlace] = useState(null);
  const [unit, setUnit] = useState("metric");

  const [current, setCurrent] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [error, setError] = useState("");

  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("recentSearches")) || [];
    } catch {
      return [];
    }
  });

  const debouncedQuery = useDebouncedValue(query, 350);
  const listRef = useRef(null);

  // --- Suggestions (Open‑Meteo geocoding)
  useEffect(() => {
    async function fetchSuggestions(name) {
      setLoadingSuggest(true);
      setError("");
      try {
        const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
        url.searchParams.set("name", name);
        url.searchParams.set("count", "6");
        url.searchParams.set("language", "en");
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch places");
        const data = await res.json();
        setSuggestions(
          (data?.results || []).map((r) => ({
            id: r.id ? `${r.id}` : `${r.latitude},${r.longitude}`,
            name: r.name,
            admin1: r.admin1,
            country: r.country,
            lat: r.latitude,
            lon: r.longitude,
            timezone: r.timezone,
          }))
        );
      } catch (e) {
        setSuggestions([]);
        setError(e.message || "Could not load suggestions");
      } finally {
        setLoadingSuggest(false);
      }
    }

    if (debouncedQuery?.trim().length >= 2) {
      fetchSuggestions(debouncedQuery.trim());
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  // --- Load weather (current + next 24 hours)
  async function loadWeather(place) {
    if (!place) return;
    setLoadingWeather(true);
    setError("");
    setCurrent(null);
    setHourly([]);

    try {
      const isImperial = unit === "imperial";
      const tempUnit = isImperial ? "fahrenheit" : "celsius";
      const windUnit = isImperial ? "mph" : "kmh";

      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", place.lat);
      url.searchParams.set("longitude", place.lon);
      url.searchParams.set(
        "hourly",
        "temperature_2m,apparent_temperature,precipitation,windspeed_10m,winddirection_10m"
      );
      url.searchParams.set("current_weather", "true");
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("temperature_unit", tempUnit);
      url.searchParams.set("windspeed_unit", windUnit);

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch weather");
      const data = await res.json();

      const cw = data.current_weather;
      const times = data.hourly?.time || [];
      const temps = data.hourly?.temperature_2m || [];
      const apparents = data.hourly?.apparent_temperature || [];
      const precs = data.hourly?.precipitation || [];
      const winds = data.hourly?.windspeed_10m || [];
      const winddirs = data.hourly?.winddirection_10m || [];

      const idx = cw ? times.indexOf(cw.time) : -1;
      const start = idx >= 0 ? idx : 0;

      const hourlyData = times.slice(start, start + 24).map((t, i) => {
        const absIdx = start + i;
        return {
          time: formatHour(t),
          temp: temps[absIdx],
          apparent: apparents[absIdx],
          precipitation: precs[absIdx],
          windspeed: winds[absIdx],
          winddirection: winddirs[absIdx],
          iso: t,
        };
      });

      const currentObj = {
        temperature: cw?.temperature ?? (temps[start] ?? null),
        apparent_temperature: apparents[idx] ?? null,
        precipitation: precs[idx] ?? null,
        windspeed: cw?.windspeed ?? winds[idx] ?? null,
        winddirection: cw?.winddirection ?? winddirs[idx] ?? null,
        weathercode: cw?.weathercode ?? null,
        time: cw?.time ?? times[start],
        units: data.hourly_units || {},
        place,
      };

      setCurrent(currentObj);
      setHourly(hourlyData);

      // update recent searches (keep unique, up to 5)
      const normalizedId = place.id ?? `${place.lat},${place.lon}`;
      const normalizedPlace = { ...place, id: normalizedId };
      const newRecent = [normalizedPlace, ...recent.filter((p) => p.id !== normalizedId)].slice(0, 5);
      setRecent(newRecent);
      localStorage.setItem("recentSearches", JSON.stringify(newRecent));
    } catch (e) {
      setError(e.message || "Could not load weather");
    } finally {
      setLoadingWeather(false);
    }
  }

  // refetch when unit or selected place changes
  useEffect(() => {
    if (selectedPlace) loadWeather(selectedPlace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlace, unit]);

  function onSuggestionClick(s) {
    setSelectedPlace(s);
    setQuery(`${s.name}${s.admin1 ? ", " + s.admin1 : ""}${s.country ? ", " + s.country : ""}`);
    setSuggestions([]);
  }

  function onRecentClick(r) {
    onSuggestionClick(r);
  }

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
          url.searchParams.set("latitude", latitude);
          url.searchParams.set("longitude", longitude);
          url.searchParams.set("language", "en");
          const res = await fetch(url);
          const data = await res.json();
          const best = data?.results?.[0];
          const place = best
            ? {
                id: `${best.id}`,
                name: best.name,
                admin1: best.admin1,
                country: best.country,
                lat: best.latitude,
                lon: best.longitude,
                timezone: best.timezone,
              }
            : { id: `${latitude},${longitude}`, name: "My location", lat: latitude, lon: longitude };
          setSelectedPlace(place);
          setQuery(
            `${place.name}${place.admin1 ? ", " + place.admin1 : ""}${place.country ? ", " + place.country : ""}`
          );
        } catch (e) {
          setSelectedPlace({ id: `${latitude},${longitude}`, name: "My location", lat: latitude, lon: longitude });
        }
      },
      (err) => setError(err.message || "Unable to get your location")
    );
  }

  const temp = current?.temperature;
  const tempUnitLabel = current?.units?.temperature_2m || (unit === "imperial" ? "°F" : "°C");
  const feels = current?.apparent_temperature;
  const precip = current?.precipitation;
  const wind = current?.windspeed;
  const windUnitLabel = current?.units?.windspeed_10m || (unit === "imperial" ? "mph" : "km/h");
  const windDir = current?.winddirection;
  const code = current?.weathercode;
  const desc = WEATHER_CODE[code ?? -1] || "—";

  // crude day/night: derive from current local hour (optional)
  let isDay = true;
  try {
    if (current?.time) {
      const h = new Date(current.time).getHours();
      isDay = h >= 6 && h < 18;
    }
  } catch {}

  const cardGradient = isDay ? "from-sky-200 via-sky-100 to-white" : "from-slate-800 via-slate-900 to-black";

  // Set text color for cards for visibility: always dark text on light background
  const cardTextColor = "text-gray-900"; // Always visible on light backgrounds

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 flex items-start justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Weather Now</h1>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setUnit((u) => (u === "metric" ? "imperial" : "metric"))}
              className="px-3 py-1.5 rounded-2xl border border-slate-300/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 backdrop-blur text-sm"
              aria-label="Toggle temperature units"
            >
              {unit === "metric" ? "°C / km/h" : "°F / mph"}
            </button>
            <button
              onClick={useMyLocation}
              className="px-3 py-1.5 rounded-2xl border border-slate-300/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 backdrop-blur text-sm"
              aria-label="Use my location"
            >
              Use my location
            </button>
          </div>
        </header>

        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city… (e.g., London, Bengaluru)"
            className="w-full px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 backdrop-blur outline-none ring-0 focus:border-sky-400 dark:focus:border-sky-400"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="place-list"
          />

          {loadingSuggest && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-70">Searching…</div>}

          {suggestions.length > 0 && (
            <ul
              id="place-list"
              ref={listRef}
              className="absolute z-10 mt-2 w-full max-h-72 overflow-auto rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl"
            >
              {suggestions.map((s) => (
                <li
                  key={s.id}
                  className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  onClick={() => onSuggestionClick(s)}
                >
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs opacity-70">{[s.admin1, s.country].filter(Boolean).join(", ")}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {recent.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {recent.map((r) => (
              <button
                key={r.id}
                onClick={() => onRecentClick(r)}
                className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {r.name}{r.country ? `, ${r.country}` : ""}
              </button>
            ))}
          </div>
        )}

        {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

        <main className="mt-6">
          {loadingWeather && (
            <div className="animate-pulse p-6 rounded-3xl bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200/60 dark:border-slate-700/60">
              Loading weather…
            </div>
          )}

          {current && !loadingWeather && (
            <section
              className={`p-6 rounded-3xl bg-gradient-to-br ${cardGradient} border ${
                isDay ? "border-sky-200/70" : "border-slate-700/60"
              } shadow-lg`}
            >
              {/* Explicit text color */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className={`text-xl sm:text-2xl font-semibold text-gray-900`}>{current.place?.name}</h2>
                  <p className={`text-sm opacity-80 text-gray-700 dark:text-gray-300`}>
                    {[current.place?.admin1, current.place?.country, current.place?.timezone].filter(Boolean).join(" • ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadWeather(current.place)}
                    className={`text-sm px-3 py-1.5 rounded-2xl border
                      ${isDay
                        ? "border-sky-300/70 bg-white/70 hover:bg-white text-gray-900"
                        : "border-slate-700/70 bg-slate-800/60 hover:bg-slate-800 text-gray-100"
                      } backdrop-blur`}
                  >
                    Refresh
                  </button>

                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard label="Temperature" value={temp} unit={tempUnitLabel} emphasize />
                <MetricCard label="Feels like" value={feels} unit={tempUnitLabel} />
                <MetricCard label="Wind" value={wind} unit={windUnitLabel} />
                <MetricCard label="Precipitation" value={precip} unit={current?.units?.precipitation || "mm"} />
              </div>

              <div className="mt-6 flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm bg-white/80 text-gray-900`}>
                  {desc}
                </span>
                {typeof windDir === "number" && (
                  <span className={`inline-flex items-center gap-2 text-sm text-gray-900`}>
                    <WindArrow deg={windDir} /> {degToCompass(windDir)}
                  </span>
                )}
              </div>

              {hourly.length > 0 && (
                <div className="mt-8">
                  <h3 className={`text-lg font-semibold mb-3 text-gray-900`}>Next 24h Temperature</h3>
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={hourly} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                        <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} unit={tempUnitLabel} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}
                          formatter={(value) => [Math.round(value) + ` ${tempUnitLabel}`, "Temp"]}
                        />
                        <Line type="monotone" dataKey="temp" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <p className={`mt-6 text-xs opacity-70 text-gray-700`}>
                Data by Open‑Meteo • Updated at {current?.time}
              </p>
            </section>
          )}

          {!current && !loadingWeather && (
            <div className="p-6 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 text-sm opacity-80">
              Search for a city above or use your location to see current conditions.
            </div>
          )}
        </main>

        <footer className="mt-8 text-xs opacity-70">
          Built with React + Open‑Meteo By KR. No API keys required.
        </footer>
      </div>
    </div>
  );
}

// UPDATED: Add strong contrasting text color for all text bits.
function MetricCard({ label, value, unit, emphasize = false }) {
  return (
    <div
      className={`rounded-2xl p-4 border ${
        emphasize
          ? "bg-white/80 dark:bg-slate-800/60 border-sky-200/70 dark:border-slate-700/70"
          : "bg-white/60 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50"
      } backdrop-blur`}
    >
      <div className="text-xs opacity-70 text-gray-700 dark:text-gray-200">{label}</div>
      <div className={`mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100`}>
        {value == null || Number.isNaN(value) ? (
          "—"
        ) : (
          <>
            {Math.round(value)}
            <span className="text-sm font-normal ml-1">{unit}</span>
          </>
        )}
      </div>
    </div>
  );
}

function WindArrow({ deg = 0 }) {
  const rotation = { transform: `rotate(${deg}deg)` };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={rotation} className="opacity-80">
      <path d="M12 2l4 8h-3v8h-2V10H8l4-8z" fill="currentColor" />
    </svg>
  );
}
