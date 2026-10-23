# Hort

Prototyp eines Roguelites: Du bist der Drache am Ende des Dungeons. Dein Goldhaufen ist dein Inventar – und jeder Held will ein Stück davon.

Das ganze Konzept steht in [KONZEPT.md](KONZEPT.md), der Weg zu Steam in [STEAM.md](STEAM.md).

## Spielen

**Im Browser:** `dist/hort.html` herunterladen und öffnen. Das ist das komplette Spiel in einer Datei, es läuft auch offline (nur die Schriften kommen dann aus dem System).

**Am PC:** Jeder Push baut die Desktop-Fassung automatisch (GitHub Actions, „Desktop bauen“). Die aktuellen Builds liegen unter festen Links:

- Windows: [Hort-Windows.zip](https://github.com/xKing41/Gamescom_Projekt/releases/download/desktop/Hort-Windows.zip) – entpacken, `Hort.exe` starten
- Linux und Steam Deck: [Hort-Linux.tar.gz](https://github.com/xKing41/Gamescom_Projekt/releases/download/desktop/Hort-Linux.tar.gz) – entpacken, `start-hort.sh` starten

Windows warnt beim ersten Start vor einer unbekannten App („Weitere Informationen“ → „Trotzdem ausführen“). Das liegt an der fehlenden Signatur und fällt über Steam weg.

Du startest in deiner **Höhle**: Dort wählst du Drachenart, Legende-Stufe, deine vier Atem-Karten und den Modus. Ein Run läuft so:

1. **Tag:** Raubziel wählen, zwei Schätze mitnehmen, den Hort ordnen. Die Raben verraten, wer nachts kommt.
2. **Nacht:** Helden laufen immer zum glänzendsten Schatz, den sie erreichen und tragen können. Deine Klaue trifft sie direkt vor dir, mit Atem-Karten greifst du gezielt ein.
3. **Morgen:** Besiegte Helden lassen ihre Ausrüstung zurück – mit ihren Fähigkeiten.

Nach sechs Nächten schlüpft das Ei. Welche Drachenart, entscheiden die acht Felder rund ums Ei.

| Maus und Tastatur | Controller | Wirkung |
|---|---|---|
| Ziehen oder Antippen | Steuerkreuz, A | Schatz verschieben, zwei gleiche aufeinander verschmelzen |
| Beute antippen | LB / RB | Neue Beute aus dem Tablett nehmen |
| 1–4 | LB, RB, LT, RT | Atem-Karte wählen |
| Tippen auf Feld oder Held | Stick oder Steuerkreuz, dann A | Karte einsetzen |
| Leertaste | Menü | Pause |
| F | Y (nachts) | Tempo 1× / 2× |
| M | – | Ton aus / an |
| Esc | B | Auswahl abbrechen, Fenster schließen |
| – | Y | Den goldenen Knopf drücken (Nacht beginnen, Mitnehmen, Weiter) |

Xbox- und PlayStation-Controller und das Steam Deck werden erkannt, die Tastenbilder passen sich an. Die ganze Belegung steht im Spiel unter dem Lautsprecher-Symbol.

## Was der Prototyp kann (v0.3)

**Ein Run:** 6 Nächte, 5 Nachbarreiche (3 je Run), 6 Heldentypen, 27 Schätze, 7 Atem-Karten. Dazu kommen die Glanz-Regel, Gewicht, Verschmelzen, Nachbar-Effekte, der Rabenbericht und die Beute der Besiegten.

**Zwischen den Runs:**
- **Brutkammer:** Gold-, Kristall- und Knochendrache sowie ein geheimer Mondsilberdrache, jeweils mit eigener Regel, eigenem Start-Hort und Farbvarianten
- **Drachenalter:** 3 Stufen je Art; jede schaltet einen Schatz, ein Reich oder eine Atem-Karte frei
- **Legende:** 10 Stufen, jede mit einer neuen Regel, und Narben am Drachen
- **Erzfeinde:** Wer mit einem wertvollen Schatz entkommt, kommt mit Namen und deinem Schatz zurück
- **Hortbuch und 8 Taten**
- **Modi:** Endlose Belagerung, Wochen-Hort (für alle gleich) und Hort-Codes (`#CODE` im Link)

**Ton:** Jedes Geräusch entsteht im Code, es gibt keine Audiodateien. Dazu kommen Höhlenhall, Wind und Tropfen, eine ruhige Harfe in der Höhle und nachts ein Herzschlag, der mit der Gefahr schneller wird. Effekte und Musik haben getrennte Lautstärken.

**Controller:** Ein Rahmen auf dem Hort, Atem-Karten auf den Schultertasten und eine Zielhilfe, die den gefährlichsten Helden zuerst anvisiert. Tafel und Fenster lassen sich mit dem Steuerkreuz bedienen, große Momente lassen den Controller rütteln.

**Desktop:** Electron-Fassung für Windows und Linux. Schriften liegen bei, das Spiel hat keinen Netzzugang und keine Rechte auf dem Rechner. Vollbild über F11 oder Alt+Enter, auf dem Steam Deck automatisch.

**Spielstand:** Er liegt im Browser. Als Claude-Artifact wird er zusätzlich in der Datenbank des Artifacts gespeichert und zwischen Handy und PC zusammengeführt. In der Desktop-Fassung liegt er als Datei im Ordner `save/` (Windows: `%APPDATA%\Hort\save`, Linux: `~/.config/Hort/save`), den die Steam Cloud abgleichen kann.

Noch nicht drin: Steam-Anbindung (Erfolge, Bestenlisten), Twitch-Anbindung, Koop.

## Entwicklung

```bash
npm install
npm run dev       # http://localhost:8080 – direkt aus src/, ohne Build
npm run build     # baut dist/hort.html, dist/artifact.html und dist/desktop/
npm test          # Meta-Tests und Balance-Bot (1.400 Runs ohne Grafik)
npm run e2e       # Browser-Test mit Bildschirmfotos, auch mit simuliertem Controller (braucht Playwright)
npm run audio     # Klang-Prüfung: Lautheit jedes Geräuschs, auch wie über einen Handy-Lautsprecher
npm run desktop   # Desktop-Fassung starten
npm run pack      # Desktop-Fassung für das eigene System packen (Ordner release/)
```

Die Desktop-Fassung prüft `tools/desktop-check.mjs` (unter Linux ohne Bildschirm: `xvfb-run -a node tools/desktop-check.mjs`). Sie prüft, dass das Spiel läuft, offline ist und dass der Spielstand als Datei einen Neustart übersteht.

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
| `src/storage.js` | Speichern im Browser, in der Claude-Datenbank und als Datei der Desktop-Fassung |
| `src/audio.js` | Ton aus dem Code: Effekte, Atmosphäre, Harfe, Herzschlag |
| `src/pad.js` | Controller: Rahmen, Zielhilfe, Fokus, Tastenbilder, Rütteln |
| `src/rng.js` | Zufall mit Seed, Hort-Codes |
| `src/icons.js` | Drachen, Helden und Schätze – alles im Code gezeichnet |
| `src/render.js` | Zeichnet die Höhle und die Effekte |
| `src/ui.js` | Höhle, Phasen, Run-Ende, Hortbuch und Kopfzeile |
| `src/main.js` | Eingaben, Spielschleife, Ablauf zwischen Höhle und Run |
| `tools/meta-test.mjs` | Tests der Meta-Progression |
| `tools/balance.mjs` | Balance-Bot |
| `tools/e2e.mjs` | Browser-Test |
| `tools/build.mjs` | Baut die Einzeldatei und die Desktop-Seite |
| `tools/audio-check.mjs` | Klang-Prüfung |
| `tools/desktop-check.mjs` | Test der Desktop-Fassung |
| `tools/icon.mjs` | Zeichnet das App-Symbol (`build/icon.png`) mit dem Spielcode |
| `desktop/` | Electron-Hülle: Fenster, Spielstand-Datei, Startskript für Linux |
| `.github/workflows/desktop.yml` | Baut Windows und Linux bei jedem Push und aktualisiert die Download-Links |
