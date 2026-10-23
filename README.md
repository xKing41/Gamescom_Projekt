# Hort

Prototyp eines Roguelites: Du bist der Drache am Ende des Dungeons. Dein Goldhaufen ist dein Inventar – und jeder Held will ein Stück davon.

Das ganze Konzept steht in [KONZEPT.md](KONZEPT.md).

## Spielen

`dist/hort.html` herunterladen und im Browser öffnen. Das ist das komplette Spiel in einer Datei, es läuft auch offline (nur die Schriften kommen dann aus dem System).

Du startest in deiner **Höhle**: Dort wählst du Drachenart, Legende-Stufe, deine vier Atem-Karten und den Modus. Ein Run läuft so:

1. **Tag:** Raubziel wählen, zwei Schätze mitnehmen, den Hort ordnen. Die Raben verraten, wer nachts kommt.
2. **Nacht:** Helden laufen immer zum glänzendsten Schatz, den sie erreichen und tragen können. Deine Klaue trifft sie direkt vor dir, mit Atem-Karten greifst du gezielt ein.
3. **Morgen:** Besiegte Helden lassen ihre Ausrüstung zurück – mit ihren Fähigkeiten.

Nach sechs Nächten schlüpft das Ei. Welche Drachenart, entscheiden die acht Felder rund ums Ei.

| Eingabe | Wirkung |
|---|---|
| Ziehen oder Antippen | Schatz verschieben, zwei gleiche aufeinander verschmelzen |
| 1–4 | Atem-Karte wählen |
| Leertaste | Pause |
| F | Tempo 1× / 2× |
| Esc | Auswahl abbrechen, Fenster schließen |

## Was der Prototyp kann (v0.2)

**Ein Run:** 6 Nächte, 5 Nachbarreiche (3 je Run), 6 Heldentypen, 27 Schätze, 7 Atem-Karten. Dazu kommen die Glanz-Regel, Gewicht, Verschmelzen, Nachbar-Effekte, der Rabenbericht und die Beute der Besiegten.

**Zwischen den Runs:**
- **Brutkammer:** Gold-, Kristall- und Knochendrache sowie ein geheimer Mondsilberdrache, jeweils mit eigener Regel, eigenem Start-Hort und Farbvarianten
- **Drachenalter:** 3 Stufen je Art; jede schaltet einen Schatz, ein Reich oder eine Atem-Karte frei
- **Legende:** 10 Stufen, jede mit einer neuen Regel, und Narben am Drachen
- **Erzfeinde:** Wer mit einem wertvollen Schatz entkommt, kommt mit Namen und deinem Schatz zurück
- **Hortbuch und 8 Taten**
- **Modi:** Endlose Belagerung, Wochen-Hort (für alle gleich) und Hort-Codes (`#CODE` im Link)

**Spielstand:** Er liegt im Browser. Als Claude-Artifact wird er zusätzlich in der Datenbank des Artifacts gespeichert und zwischen Handy und PC zusammengeführt.

Noch nicht drin: Sound, Controller, Steam-Version, Twitch-Anbindung, Koop.

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:8080 – direkt aus src/, ohne Build
npm run build   # baut dist/hort.html
npm test        # Meta-Tests und Balance-Bot (1.400 Runs ohne Grafik)
npm run e2e     # Browser-Test mit Bildschirmfotos (braucht Playwright)
```

Stand des Balance-Bots mit menschlicher Reaktionszeit (1,2 s), alles freigeschaltet, mit Erzfeinden:

| Drachenart | Legende 0 | Legende 5 | Legende 10 |
|---|---|---|---|
| Golddrache | 82 % | 44 % | 8 % |
| Kristalldrache | 90 % | 74 % | 4 % |
| Knochendrache | 82 % | 52 % | 0 % |
| Mondsilberdrache | 52 % | 24 % | 4 % |

Ohne Atem-Karten gewinnt der Bot nie. Der Mondsilberdrache ist am schwersten, weil der Bot die umgekehrte Glanz-Regel nicht versteht.

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/data.js` | Alle Inhalte als Daten: Schätze, Helden, Reiche, Karten, Drachenarten, Legende, Taten, Werte |
| `src/map.js` | Die Höhle als Kachelkarte |
| `src/sim.js` | Spiellogik ohne Grafik: Tag, Nacht, Wegfindung, Karten, Artregeln, Erzfeinde |
| `src/meta.js` | Fortschritt zwischen den Runs: Erfahrung, Freischaltungen, Taten, Schlüpfen, Zusammenführen |
| `src/storage.js` | Speichern im Browser und in der Claude-Datenbank |
| `src/rng.js` | Zufall mit Seed, Hort-Codes |
| `src/icons.js` | Drachen, Helden und Schätze – alles im Code gezeichnet |
| `src/render.js` | Zeichnet die Höhle und die Effekte |
| `src/ui.js` | Höhle, Phasen, Run-Ende, Hortbuch und Kopfzeile |
| `src/main.js` | Eingaben, Spielschleife, Ablauf zwischen Höhle und Run |
| `tools/meta-test.mjs` | Tests der Meta-Progression |
| `tools/balance.mjs` | Balance-Bot |
| `tools/e2e.mjs` | Browser-Test |
| `tools/build.mjs` | Baut die Einzeldatei |
