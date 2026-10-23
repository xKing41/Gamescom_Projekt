# Hort

Prototyp eines Roguelites: Du bist der Drache am Ende des Dungeons. Dein Goldhaufen ist dein Inventar – und jeder Held will ein Stück davon.

Das ganze Konzept steht in [KONZEPT.md](KONZEPT.md).

## Spielen

`dist/hort.html` herunterladen und im Browser öffnen. Das ist das komplette Spiel in einer Datei, es läuft auch offline (nur die Schriften kommen dann aus dem System).

So läuft ein Run:

1. **Tag:** Raubziel wählen, zwei Schätze mitnehmen, den Hort ordnen. Die Raben verraten, wer nachts kommt.
2. **Nacht:** Helden laufen immer zum glänzendsten Schatz, den sie erreichen und tragen können. Deine Klaue trifft sie direkt vor dir, mit Atem-Karten greifst du gezielt ein.
3. **Morgen:** Besiegte Helden lassen ihre Ausrüstung zurück – mit ihren Fähigkeiten.

Nach sechs Nächten schlüpft das Ei. Welche Drachenart, hängt davon ab, worauf es lag.

| Eingabe | Wirkung |
|---|---|
| Ziehen oder Antippen | Schatz verschieben, zwei gleiche aufeinander verschmelzen |
| 1–4 | Atem-Karte wählen |
| Leertaste | Pause |
| F | Tempo 1× / 2× |
| Esc | Auswahl abbrechen |

Jeder Run hat einen **Hort-Code** (am Ende angezeigt). Mit `#CODE` am Ende der Adresse startet genau dieser Run noch einmal.

## Was der Prototyp kann

- 6 Nächte, 3 Raubziele (Dorf, Kloster, Zwergenmine), 4 Heldentypen, 17 Schätze, 4 Atem-Karten
- Glanz-Regel, Gewicht, Verschmelzen, Nachbar-Effekte, Rabenbericht, Beute der Besiegten
- Drachenart beim Schlüpfen je nach Hort (Gold-, Kristall- oder Knochendrache)
- Läuft am PC mit Maus und Tastatur und am Handy mit Touch

Noch nicht drin: Meta-Progression, Sound, Controller, Steam-Version.

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:8080 – direkt aus src/, ohne Build
npm run build   # baut dist/hort.html
npm test        # Balance-Bot: 600 Runs ohne Grafik, prüft Logik und Schwierigkeit
npm run e2e     # Browser-Test mit Bildschirmfotos (braucht Playwright)
```

Stand des Balance-Bots (200 Seeds je Strategie):

| Strategie | Siege | Ei meist verloren in |
|---|---|---|
| Bot, reagiert alle 0,2 s | 90 % | Nacht 4–6 |
| Bot mit menschlicher Reaktionszeit (1,2 s) | 84 % | Nacht 5–6 |
| ohne Atem-Karten | 0 % | Nacht 1–2 |

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/data.js` | Alle Inhalte als Daten: Schätze, Helden, Raubziele, Atem-Karten, Werte |
| `src/map.js` | Die Höhle als Kachelkarte |
| `src/sim.js` | Spiellogik ohne Grafik: Tag, Nacht, Helden-Wegfindung, Karten |
| `src/rng.js` | Zufall mit Seed, Hort-Codes |
| `src/icons.js` | Drache, Helden und Schätze – alles im Code gezeichnet |
| `src/render.js` | Zeichnet die Höhle und die Effekte |
| `src/ui.js` | Die Tafel neben der Höhle und die Kopfzeile |
| `src/main.js` | Eingaben und Spielschleife |
| `tools/balance.mjs` | Balance-Bot |
| `tools/e2e.mjs` | Browser-Test |
| `tools/build.mjs` | Baut die Einzeldatei |
