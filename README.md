# marisol-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/fourxxxcoder/marisol-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/fourxxxcoder/marisol-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Marisol Heat is an original open-world crime game that plays offline in a desktop browser: roam the sun-soaked coastal city of Marisol Bay on foot and by car, steal cars, run story missions for Valentina Cruz, and outrun the Marisol Bay police.

## Run it

```sh
node serve.ts   # then open http://localhost:8080 — or: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts to build the dossier in out/
```

---
<sub>Entered on [make.fun](https://make.fun/?ref=7z89ba3s&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

## How to play

You are Mari Solano, back in Marisol Bay after years away. Valentina Cruz, who
runs Club Coral, has work for you — and the Marisol Bay Police Department has
opinions about how you do it. The city is fully explorable from the first
minute: avenues and streets on a grid, a beach and pier along the east shore,
and named stops including Club Coral, the Marina, Hotel Aurelia, the police
station, the hospital, the garage and the lighthouse.

**Controls**

- **WASD / arrow keys** — walk, or throttle / brake / steer when driving
- **Shift** — run on foot
- **E** — get into the nearest car (parked cars, and traffic if you are quick) or get out
- **F** — punch the nearest pedestrian; they drop cash, and witnesses talk
- **P / Esc** — pause · **M** — mute · **Enter** — confirm

**The law.** Crimes build heat, shown as 0–5 stars: stealing a witnessed car,
trading paint, punching and worse. Interceptors spawn to match your stars and
will ram you; if they pin you while you are slow, the bust meter fills — a
bust costs a fine and a walk out of the police station. Heat fades when nobody
witnesses anything for a while and no patrol is close. Drop to zero health and
you wake up at the hospital, minus the bill.

**Story.** Five jobs from Valentina, each with a beacon on the map and a
marker on the minimap: *First Wheels* (steal the magenta coupe and deliver it
to the club garage), *Marina Run* (a package from the Marina to Hotel Aurelia,
with the police tipped off), *Neon Debts* (three debt envelopes against the
clock), *Lose the Heat* (start at four stars, end at none, then reach the
hideout) and *Lighthouse Finale* (a timed run to the pier under pressure).
Finishing the story unlocks free roam.

**Side money.** Flag down fares: while driving, stop for a pedestrian with a
TAXI sign and deliver them before the timer runs out. Twenty shells are
scattered along the beach and around town, each worth cash. Your progress —
cash, mission, shells — saves automatically in the browser, and the title
screen offers Continue when a save exists.

Everything is synthesized live: the engine note follows your speed, the siren
follows your stars, and there are no audio files, no libraries and no network
requests — the whole game is the static files under `game/`.
