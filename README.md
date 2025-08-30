# 🌤️ Weather Now
Weather Now is a simple React application that lets users quickly check **current weather conditions** and view a **24-hour temperature forecast graph** for any city, using the free [Open-Meteo API](https://open-meteo.com/). It’s built for **outdoor enthusiasts** who need fast, no-login weather updates.

## ✨ Features
- 🔎 Search for **any city** (via Open-Meteo Geocoding API)  
- 📍 **Use My Location** (browser geolocation + reverse geocoding)  
- 🌡️ **Current conditions**:  
  - Temperature (°C / °F)  
  - Feels-like temperature  
  - Precipitation  
  - Wind speed + direction  
  - Weather description (clear, cloudy, rain, etc.)  
- 📈 **24-hour hourly temperature graph** (Recharts)  
- ⚡ **Unit toggle**: Metric (°C, km/h) ↔ Imperial (°F, mph)  
- 🕑 **Recent searches** stored in localStorage (up to 5)  
- 🔁 **Refresh button** to re-fetch latest data  
- 🎨 **Responsive UI** with Tailwind CSS (light & dark mode support)  

## 🛠️ Tech Stack
- [React (Vite)](https://vitejs.dev/) – Frontend framework  
- [Tailwind CSS](https://tailwindcss.com/) – Styling  
- [Recharts](https://recharts.org/en-US/) – Charting library for hourly graph  
- [Open-Meteo API](https://open-meteo.com/) – Weather + geocoding (no API key required)  

## 🚀 Getting Started
1. **Clone the repository**
    ```bash
    git clone https://github.com/your-username/weather-now.git
    cd weather-now
    ```
2. **Install dependencies**
    ```bash
    npm install
    ```
3. **Start the development server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:5173](http://localhost:5173) in your browser.
4. **Build for production**
    ```bash
    npm run build
    ```

## 📦 Dependencies
- react  
- react-dom  
- recharts  
- tailwindcss  

## 🌍 API Reference
This project uses the **Open-Meteo API** — free and requires no authentication.  
Example forecast request:  https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true&hourly=temperature_2m

👤 Author

Built by Karthik R S ✨
Inspired by the needs of outdoor enthusiasts who want quick weather insights.


```bash
https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true&hourly=temperature_2m
