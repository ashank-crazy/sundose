# Sundose ☀️🧴

**Know when the sun has finished treating your water.**

**Live app: https://ashank-crazy.github.io/sundose/**

Sundose is a free, offline-first web app for **SODIS (solar water disinfection)**, the WHO-recognised method of making drinking water safer by leaving clear bottles of water in the sun. It adds up the *real* sunlight falling on your bottles, using 15-minute satellite and weather-model data for your exact location, and tells you when the water is ready to drink.

Built for the **Acodemic × KeebsforWater Global SDG Hackathon**. Main goal: **SDG 6.1** (safe, affordable drinking water for all). Also **SDG 3.9** (fewer deaths from unsafe water) and **SDG 13** (water treated by the sun is water not boiled over a wood fire).

![Today screen](docs/screenshots/01-today.png)

![On phones in Kiswahili, Hindi and Spanish](docs/screenshots/07-phones.png)

## The problem

- **2.1 billion people**, 1 in 4, still lacked safely managed drinking water in 2024, and **106 million** drink straight from rivers, lakes and ponds ([WHO/UNICEF JMP 2025](https://www.who.int/news/item/26-08-2025-1-in-4-people-globally-still-lack-access-to-safe-drinking-water---who--unicef)).
- SODIS costs almost nothing: a clear PET bottle and sunshine. But the official advice is a blunt rule of thumb: **"6 hours of sun, or 2 days if the sky is more than half cloudy"** ([Eawag SODIS manual](https://www.eawag.ch/en/department/sandec/projects/swp/solar-water-disinfection-sodis)).
- On the in-between days, which are common in the tropics during rainy seasons, families have to guess. Guess short and people drink untreated water. Guess long and they lose a day of drinking water.
- Devices that measure UV for SODIS exist, but each household has to buy one.

## What Sundose does

| | |
|---|---|
| **Today** | A verdict for the day (*Strong sun / Cloudy, leave 2 days / Rain, use another method*), when bottles put out now will be ready, and the latest start that still finishes before sunset. Includes a sunlight chart with the 500 W/m² "strong sun" line, cloud cover and rain, and a 4-day outlook. |
| **My bottles** | Log a batch in one tap ("I've put bottles out", or "earlier, at 8:00"). Each batch has a live progress ring and three checks: sun dose, daylight hours and midday sun. It also shows the cloud and rain the bottles have had, plus an ETA. You can add a calendar reminder (.ics), get a browser alert when it's ready, and see litres treated and firewood not burned. |
| **How to** | Six illustrated SODIS steps, an interactive **clarity (turbidity) test**, and an honest "when SODIS is not enough" section (chemicals, muddy water, continuous rain). |
| **How it works** | The exact decision rules, where the data comes from, limits, privacy, and sources. |
| **Community** | Share the day's SODIS forecast to WhatsApp or any app, or **print a one-page notice-board sheet** with the 4-day forecast, the six steps and a printed clarity-test headline, for villages where only one person has a smartphone. |

### Built for where SODIS is actually used

- **Offline-first.** One forecast download (~3 KB) covers the next 4 days. After the first visit the app shell is cached by a service worker, and bottles keep being tracked with no connection. With no forecast at all, it falls back to the official Eawag schedule.
- **Tiny.** The whole app is about 50 KB compressed, uses system fonts and inline SVG, and has no framework, no build step and no trackers.
- **5 languages:** English, Español, Français, हिन्दी, Kiswahili. These cover Latin America, francophone West Africa, East Africa and South Asia, where most SODIS programmes run.
- **Readable outdoors:** a high-contrast light theme, large tap targets, and icons and colour for every verdict.
- **Private:** no accounts. Batches live in `localStorage`. The only data that leaves the phone is the location rounded to about 1 km, sent to Open-Meteo for the forecast.
- **Installable** as a PWA on Android and iOS home screens.

## How the decision works

A batch is **ready** when all three hold for the time since it went out ([`js/engine.js`](js/engine.js)):

1. **Sun dose ≥ 3.0 kWh/m².** This is the sum of 15-minute global horizontal irradiance, equivalent to the common SODIS threshold of 500 W/m² sustained for 6 hours.
2. **Daylight ≥ 6 h.** This is the Eawag rule: "at least 6 hours including noon hours".
3. **Midday sun.** The exposure must cover at least 2 of the 4 hours around solar noon. **If the mean cloud cover during exposure was above 50%, it must cover two days' middays** (Eawag's two-day rule).

The ETA is found by running the same rule forward over the forecast on a 15-minute grid. The day verdict uses the same rules, so it can't contradict the advice next to it. It is *rain* when it rains for 6 or more daylight hours, *one day* when bottles put out at sunrise would be ready by sunset, and *two days* otherwise.

Sundose is guidance, not a lab test. The app says so, and it always points to boiling or chlorine when SODIS isn't appropriate.

## Tech stack

- **Frontend:** vanilla HTML, CSS and JavaScript (ES modules). No framework, no build step.
- **Data:** [Open-Meteo](https://open-meteo.com/) forecast API (15-minute shortwave radiation, hourly cloud cover and precipitation, daily sunrise, sunset and radiation sums) and the Open-Meteo geocoding API. Both are free and need no key.
- **Offline:** a service worker for the app shell and `localStorage` for forecasts and batches.
- **PWA:** web app manifest with maskable icons.
- **Tests:** Node's built-in test runner (`node:test`). 15 tests cover the dose engine against synthetic sunny, cloudy and rainy days and a real Open-Meteo response, plus translation completeness.
- **Tooling:** a tiny Chrome DevTools Protocol script renders the icons and screenshots (`tools/`).

## Run it

```bash
npm test                      # engine + translation tests
python3 -m http.server 4173   # or: npm start
# open http://localhost:4173
```

It is deployed with GitHub Pages straight from the `main` branch, and any static host works. Serve the folder as is.

## Project layout

```
index.html          app shell
styles.css          all styles, including the print (notice-board) sheet
sw.js               offline cache
js/engine.js        the SODIS decision engine (pure functions, tested)
js/weather.js       Open-Meteo fetch and offline cache
js/app.js           views, dialogs, actions
js/chart.js         SVG sunlight chart
js/i18n.js          5 languages
js/icons.js         hand-drawn SVG icons and step illustrations
test/               node:test suites and a real forecast fixture
tools/              headless-Chrome scripts for icons and screenshots
```

## Sources

- Eawag / Sandec, *SODIS manual* (2016): exposure schedule, turbidity limit, bottle guidance.
- *Frontiers in Water* (2025), review of SODIS irradiance and dose requirements: the ~500 W/m² threshold.
- WHO / UNICEF Joint Monitoring Programme (2025): drinking-water statistics.
- Open-Meteo: weather data (CC BY 4.0).

## License

MIT. See [LICENSE](LICENSE).
