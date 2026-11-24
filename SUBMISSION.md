# Devpost submission: Sundose

Hackathon: **Acodemic × KeebsforWater Global SDG Hackathon** (hackathon-draft-32215.devpost.com)
Deadline: **Dec 1, 2026, 10:15 AM IST**

Required by the rules: project link · description (purpose, problem, audience, SDG alignment) · at least 3 screenshots · tech stack · source code link. Optional: a 1–5 minute video.

---

## Project name
Sundose

## Elevator pitch (tagline, ≤ 200 characters)
A free, offline sun meter for solar water disinfection. Sundose adds up the real sunlight on your bottles and tells you when the water is safe to drink. 5 languages, ~50 KB.

## Links
- **Live app:** https://ashank-crazy.github.io/sundose/
- **Source code:** https://github.com/ashank-crazy/sundose

## Screenshots (upload in this order)
1. `docs/screenshots/01-today.png`: Today: verdict, when bottles will be ready, latest start, sunlight chart
2. `docs/screenshots/07-phones.png`: on phones in Kiswahili, Hindi and Spanish
3. `docs/screenshots/02-bottles.png`: My bottles: live progress, the three checks, ETA, stats
4. `docs/screenshots/03-guide.png`: How to: illustrated steps and the clarity test
5. `docs/screenshots/06-print.png`: printable notice-board sheet for the village
6. `docs/screenshots/04-science.png`: How it works: the decision rules and sources
7. `docs/screenshots/05-add.png`: logging a batch

## Built with
javascript · html5 · css3 · svg · progressive-web-app · service-worker · open-meteo · node.js

---

## About the project (paste into the Devpost story field)

### Inspiration
**2.1 billion people, 1 in 4, still lacked safely managed drinking water in 2024**, and 106 million drink straight from rivers, lakes and ponds (WHO/UNICEF JMP, 2025). Diarrhoeal disease from unsafe water still kills children every day.

One of the cheapest fixes is **SODIS, solar water disinfection**: fill a clear plastic bottle, leave it in the sun, and UV plus heat kill the germs. The WHO recognises it as a household water treatment, and it needs nothing but a bottle and sunshine.

The weak point is time. The official advice is a blunt rule: *6 hours of sun, or 2 days if the sky is more than half cloudy.* On the in-between days that are common in tropical rainy seasons, families have to guess. Guess short and they drink untreated water. Guess long and they lose a day of drinking water. Devices that measure UV for SODIS exist, but each one costs money and families must buy their own.

Our question was simple: **most families already have a phone and there are free satellite and weather models, so why guess?**

### What it does
Sundose is a free web app that works as a SODIS sun meter for any phone.

- **Today**: pick your town once. Sundose shows whether today is a *one-day*, *two-day* or *rain* day for SODIS, **when bottles put out now will be ready**, and the latest time you can put them out and still finish before sunset. A chart shows the 15-minute sunlight forecast against the 500 W/m² "strong sun" line, with cloud cover and rain on top, plus a 4-day outlook.
- **My bottles**: tap **"I've put bottles out"** (or "earlier, at 8:00"). Each batch gets a live progress ring and three checks: **sun dose** (kWh/m² actually received), **daylight hours** and **midday sun**. It also shows the cloud and rain the bottles have had, and an ETA that updates as the sky changes. When the water is ready you get an alert, and you can add a calendar reminder. The app counts litres treated and estimates the firewood not burned for boiling.
- **How to**: six illustrated SODIS steps, an interactive **clarity (turbidity) test**, and an honest section on **when SODIS is not enough** (chemicals like arsenic, muddy water, continuous rain), pointing to boiling, chlorine or filters.
- **Community**: one tap shares the day's SODIS forecast to WhatsApp or any app. **"Print for a notice board"** produces a one-page sheet with the 4-day forecast, the six steps and a printed clarity-test headline, so a teacher or health worker can post it where only one person has a smartphone.

### Who it's for
Households in sunny low- and middle-income regions that rely on untreated water, along with the community health workers, teachers and NGOs that run SODIS programmes. Most of these programmes are in East and West Africa, Latin America and South Asia, so the app speaks **English, Español, Français, हिन्दी and Kiswahili**.

### SDG alignment
- **SDG 6.1**, safe and affordable drinking water for all: Sundose makes the cheapest household treatment method more reliable.
- **SDG 3.9 / 3.3**: fewer deaths and illnesses from unsafe water and diarrhoeal disease.
- **SDG 13**: every litre treated by the sun is a litre not boiled over a wood or charcoal fire. The app estimates the firewood saved.

### How we built it
- **The decision engine** (`js/engine.js`) is a set of pure, tested functions. A batch is ready when all three hold for its time outside:
  1. **sun dose ≥ 3.0 kWh/m²**, the sum of 15-minute global irradiance, equivalent to the classic SODIS threshold of 500 W/m² sustained for 6 hours;
  2. **≥ 6 hours of daylight**, the Eawag SODIS manual rule;
  3. **the midday hours**, at least 2 of the 4 hours around solar noon. **If the sky averaged more than 50% cloud, two days' middays are needed**, which encodes Eawag's two-day rule using measured cloud cover instead of a guess.

  The ETA comes from running the same rule forward through the forecast on a 15-minute grid. The day verdict uses the same rule, so the headline never contradicts the advice beneath it.
- **Data:** the free Open-Meteo forecast API (15-minute shortwave radiation, hourly cloud and precipitation, sunrise and sunset) and its geocoding API. No API keys, no backend.
- **Offline-first:** one forecast download is about 3 KB and covers 4 days, so bottles keep being tracked offline. A service worker caches the app. With no forecast at all, Sundose falls back to the official 6-hour / 2-day schedule.
- **Light:** vanilla HTML, CSS and JS modules. No framework, no build step, system fonts, hand-drawn inline SVG. The whole app is about 50 KB compressed.
- **Private:** no accounts and no tracking. Batches stay in the phone's storage. The only data that leaves the phone is the location rounded to about 1 km, sent for the forecast.
- **Quality:** 15 automated tests (`node --test`). They cover synthetic sunny, cloudy, rainy and night-rain days, the cloudy-afternoon edge case, the planner, a real Open-Meteo response, and translation completeness, which checks that every language has every string with matching placeholders.

### Challenges we ran into
- **Turning a rule of thumb into an algorithm.** "6 hours or 2 days" doesn't say what to do with a sunny morning and a stormy afternoon. We measure everything over the actual exposure window. Our first version labelled such a day "cloudy" while promising same-day water. We caught that contradiction and made the day label come from the same rule as the bottles.
- **Night rain.** Daily precipitation totals counted night showers against SODIS, so we switched to rain during daylight hours only.
- **Being honest about safety.** Sundose is guidance, not a lab test. Every screen keeps the limits visible: the turbidity test, chemicals, continuous rain, and "when in doubt, boil".

### Accomplishments that we're proud of
- A **free software replacement for a UV-meter gadget** that runs on any phone and works offline.
- **5 languages from day one**, including Hindi and Kiswahili.
- The **printable notice-board sheet**, which reaches people with no phone at all.

### What we learned
How SODIS works physically (UV-A plus heat, turbidity limits, why PET and not polycarbonate), what irradiance data looks like at 15-minute resolution, and how much a sunny-morning, stormy-afternoon day changes the answer.

### What's next
- Partner with a SODIS programme to check the 3 kWh/m² threshold against field microbiology, and add an optional bottle-temperature input (above 50 °C, SODIS works much faster).
- An SMS / USSD version of the daily forecast for feature phones.
- More languages (Bengali, Amharic, Hausa, Portuguese) from community translators.

---

## Optional video (1–5 min) outline
1. (0:00) The problem: 2.1 B people, SODIS is free, but "6 hours or 2 days?" is a guess.
2. (0:30) Today screen: pick Kisumu, read the verdict, the ready time and the chart.
3. (1:15) Tap "I've put bottles out", then show My bottles: progress ring, three checks, ETA, reminder.
4. (2:00) How to: clarity test with the "No" path.
5. (2:30) Share to WhatsApp and print the notice-board sheet.
6. (3:00) Switch to Kiswahili and Hindi, then go offline and show that it still works.
7. (3:30) How it works: the three rules and the sources. Close on SDG 6.1.
