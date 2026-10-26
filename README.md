# Hort

Prototyp eines Roguelites: Du bist der Drache tief im Berg. Deine Kobolde graben die Höhle jeden Tag weiter und bauen Türme, Fallen und Köder an die Gänge – und jede Nacht kommen Helden, die dir das Glänzendste aus dem Hort tragen wollen.

Das ganze Konzept steht in [KONZEPT.md](KONZEPT.md), der Weg zu Steam in [STEAM.md](STEAM.md).

## Spielen

**Im Browser:** `dist/hort.html` herunterladen und öffnen. Das ist das komplette Spiel in einer Datei, es läuft auch offline (nur die Schriften kommen dann aus dem System).

**Am PC:** Jeder Push baut die Desktop-Fassung automatisch (GitHub Actions, „Desktop bauen“). Die aktuellen Builds liegen unter festen Links:

- Windows: [Hort-Windows.zip](https://github.com/xKing41/Gamescom_Projekt/releases/download/desktop/Hort-Windows.zip) – entpacken, `Hort.exe` starten
- Linux und Steam Deck: [Hort-Linux.tar.gz](https://github.com/xKing41/Gamescom_Projekt/releases/download/desktop/Hort-Linux.tar.gz) – entpacken, `start-hort.sh` starten

Windows warnt beim ersten Start vor einer unbekannten App („Weitere Informationen“ → „Trotzdem ausführen“). Das liegt an der fehlenden Signatur und fällt über Steam weg.

Du startest in deiner **Höhle**: Dort wählst du Drachenart, Legende-Stufe, dein Deck aus acht Bauplänen, schaltest in der Werkstatt Neues frei und wählst den Modus. Ein Tag im Run läuft so:

1. **Graben:** Eins von drei Stollenstücken und die Richtung wählen. Die Hortkammer zieht weiter, der Weg der Helden wird länger. Manche Stücke brechen in einen Brunnen, einen Zwergenstollen oder eine Gruft durch – von dort kommen ab dann Helden.
2. **Bauen:** Vier Baupläne aus dem Deck. Türme in die Nischen, Fallen in den Gang, Köder an den Gang. Türme lernen Knoten in ihrem Baum, Ausrüstung der Besiegten kommt in ihre Fassungen. Die Raben verraten, wer kommt.
3. **Nacht:** Helden holen sich das Glänzendste, was sie tragen können, und wollen wieder hinaus. Türme und Fallen kämpfen von selbst, du setzt Feueratem, Flügelschlag und Brüllen ein.
4. **Morgen:** Gold, Glut, Beute und neue Stufen.

Nach acht Nächten – in der letzten kommt Siegfried – schlüpft das Ei.

| Maus und Tastatur | Controller | Wirkung |
|---|---|---|
| Abschnitt oder Pfeil antippen | Steuerkreuz, A | Grabrichtung wählen, dann „Hier graben“ (Y) |
| Bauplan antippen, dann ein grünes Feld | LB / RB, Steuerkreuz, A | Bauen |
| Turm antippen | X, Steuerkreuz, A | Turm wählen: Baum, Ausrüstung, Abreißen |
| 1–4 | LB / RB | Bauplan wählen |
| 1–3 | LB, RB, LT | Fähigkeit des Drachen (Feueratem zielt) |
| Leertaste | Menü | Pause |
| F | Y (nachts) | Tempo 1× / 2× |
| M | – | Ton aus / an |
| Esc | B | Auswahl abbrechen, Fenster schließen |
| – | Y | Den goldenen Knopf drücken |

Xbox- und PlayStation-Controller und das Steam Deck werden erkannt, die Tastenbilder passen sich an. Die ganze Belegung steht im Spiel unter dem Lautsprecher-Symbol.

## Was der Prototyp kann (v0.4)

**Ein Run:** Ein Berg aus 5 × 5 Abschnitten, der jeden Tag weiter ausgegraben wird, 8 Arten von Stollenstücken, 4 Eingänge mit eigenen Helden, 7 Heldentypen mit Leben, Rüstung und Segen, 4 Koboldtürme mit je eigenem Baum (10 Knoten, Schlusssteine), 4 Fallen, 3 Köder, 7 Stück Ausrüstung, 10 Schätze, der Drache mit Klaue und drei Fähigkeiten, Siegfried als Boss mit dem Lindenblatt.

**Zwischen den Runs:**
- **Glut:** Kommt nach einem Sieg nach Hause. Wer das Ei verliert, verliert die Glut an den Dieb – er kommt als Erzfeind zurück
- **Werkstatt:** Glut gegen neue Baupläne und gesperrte Schlusssteine
- **Deck:** acht Baupläne aus der Sammlung
- **Drachenarten:** Gold, Kristall, Knochen und ein geheimer Mondsilberdrache, jeweils mit eigener Regel und Farbvarianten
- **Legende:** 10 Stufen je Art, jede mit einer neuen Regel und Narben am Drachen
- **Erzfeinde, Hortbuch und 9 Taten**
- **Modi:** Endlose Belagerung, Wochen-Hort (für alle gleich) und Hort-Codes (`#CODE` im Link)

Ein Spielstand aus v0.3 wird übernommen: Drachenarten, Legende, Statistik und Erzfeinde bleiben, für alte Freischaltungen gibt es Glut.

**Grafik:** Pixel-Art, 16 Pixel pro Feld. Die Höhle wird bei jedem Graben neu gezeichnet, darüber liegt Licht: Der Hort glüht, Feuertöpfe und Fluchsteine leuchten, Helden tragen Fackeln, durch die Durchbrüche fällt Mond- oder Laternenlicht. Türme, Fallen, Köder und Durchbrüche sind aus ganzen Pixeln gezeichnet, Helden und Schätze von Hand als Text-Raster. Schriften: Jacquard 24 und Pixelify Sans (SIL Open Font License).

**Ton:** Jedes Geräusch entsteht im Code, es gibt keine Audiodateien: Speere, Steine, Feuertöpfe, Flüche, Fallen, Siegfrieds Schwert, dazu Höhlenhall, Wind, Tropfen, eine ruhige Harfe und nachts ein Herzschlag, der mit der Gefahr schneller wird.

**Controller:** Fokus in der Tafel, ein Rahmen über der Höhle zum Bauen und Wählen, Fähigkeiten auf den Schultertasten, Zielhilfe für den Feueratem. Große Momente lassen den Controller rütteln.

**Desktop:** Electron-Fassung für Windows und Linux. Schriften liegen bei, das Spiel hat keinen Netzzugang und keine Rechte auf dem Rechner. Vollbild über F11 oder Alt+Enter, auf dem Steam Deck automatisch.

**Spielstand:** Er liegt im Browser. Als Claude-Artifact wird er zusätzlich in der Datenbank des Artifacts gespeichert und zwischen Handy und PC zusammengeführt. In der Desktop-Fassung liegt er als Datei im Ordner `save/` (Windows: `%APPDATA%\Hort\save`, Linux: `~/.config/Hort/save`), den die Steam Cloud abgleichen kann.

Noch nicht drin: weitere Schichten des Bergs mit Glutnestern, Steam-Anbindung (Erfolge, Bestenlisten), Twitch-Anbindung, Koop.

## Entwicklung

```bash
npm install
npm run dev       # http://localhost:8080 – direkt aus src/, ohne Build
npm run build     # baut dist/hort.html, dist/artifact.html und dist/desktop/
npm test          # Meta-Tests und Balance-Bot (rund 1.000 Runs ohne Grafik)
npm run e2e       # Browser-Test mit Bildschirmfotos, auch mit simuliertem Controller (braucht Playwright)
npm run audio     # Klang-Prüfung: Lautheit jedes Geräuschs, auch wie über einen Handy-Lautsprecher
npm run sprites   # Übersicht aller Pixel-Sprites, prüft die Raster
npm run desktop   # Desktop-Fassung starten
npm run pack      # Desktop-Fassung für das eigene System packen (Ordner release/)
```

Die Desktop-Fassung prüft `tools/desktop-check.mjs` (unter Linux ohne Bildschirm: `xvfb-run -a node tools/desktop-check.mjs`). Sie prüft, dass das Spiel läuft, offline ist und dass der Spielstand als Datei einen Neustart übersteht.

Stand des Balance-Bots mit menschlicher Reaktionszeit (1,2 s):

| | Legende 0 | Legende 5 | Legende 10 |
|---|---|---|---|
| Grunddeck, Golddrache | 64 % | – | – |
| Alles freigeschaltet, Golddrache | 95 % | 55 % | 15 % |
| Kristalldrache | 100 % | 95 % | 45 % |
| Knochendrache | 95 % | 75 % | 30 % |
| Mondsilberdrache | 90 % | 55 % | 15 % |

Ohne die Fähigkeiten des Drachen gewinnt der Bot nur rund ein Drittel der Runs, wer jeden Durchbruch mitnimmt, nur knapp die Hälfte. Die meisten Eier stehlen Zwerge, Magier und Siegfried. Köder nutzt der Bot noch schlecht: Mit nur Türmen gewinnt er fast immer.

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/data.js` | Alle Inhalte als Daten: Schätze, Helden, Eingänge, Stollenstücke, Baupläne mit ihren Bäumen, Ausrüstung, Drache, Drachenarten, Legende, Taten, Werte |
| `src/map.js` | Geometrie des Bergs: Abschnitte, Felder, Feldarten |
| `src/sim.js` | Spiellogik ohne Grafik: Graben, Bauen, Bäume, Nacht, Wegfindung, Schaden, Drache, Siegfried, Morgen |
| `src/meta.js` | Fortschritt zwischen den Runs: Glut, Werkstatt, Deck, Taten, Erzfeinde, Schlüpfen, Zusammenführen, alte Spielstände |
| `src/storage.js` | Speichern im Browser, in der Claude-Datenbank und als Datei der Desktop-Fassung |
| `src/audio.js` | Ton aus dem Code: Effekte, Atmosphäre, Harfe, Herzschlag |
| `src/pad.js` | Controller: Fokus, Rahmen über der Höhle, Fähigkeiten, Tastenbilder, Rütteln |
| `src/rng.js` | Zufall mit Seed, Hort-Codes |
| `src/pixel/art.js` | Pixel-Art von Hand: Schätze, Ausrüstung, Helden, Siegfried, Knochenwächter |
| `src/pixel/buildings.js` | Türme, Fallen, Köder, Durchbrüche und Schwerter aus ganzen Pixeln |
| `src/pixel/dragon.js` | Der Drache aus Teilen, groß für die Höhle zwischen den Runs und klein auf dem Hort |
| `src/pixel/cave.js` | Der Berg in 3/4-Ansicht: Fels, Gänge, Nischen, Felsvorsprünge, Goldadern, Hortkammer, Höhlenmund |
| `src/pixel/sprite.js`, `images.js`, `font.js` | Baukasten: Raster zu Bildern, Verpixeln, Umrandung, Pixel-Ziffern, Bilder für die Tafel |
| `src/icons.js` | Alte Vektorzeichnungen; Vorlage für Schätze, die noch keine Handzeichnung haben |
| `src/render.js` | Zeichnet die Höhle: Welt, Licht, Effekte, Vorschau beim Graben, Bauplätze, Reichweiten, Balken |
| `src/ui.js` | Höhle, Graben, Bauen, Turm mit Baum, Nacht, Morgen, Run-Ende, Hortbuch und Kopfzeile |
| `src/main.js` | Eingaben, Spielschleife, Ablauf zwischen Höhle und Run |
| `tools/meta-test.mjs` | Tests für Meta-Progression und Spiellogik |
| `tools/balance.mjs` | Balance-Bot |
| `tools/e2e.mjs` | Browser-Test, auch nur mit Controller |
| `tools/build.mjs` | Baut die Einzeldatei und die Desktop-Seite |
| `tools/audio-check.mjs` | Klang-Prüfung |
| `tools/desktop-check.mjs` | Test der Desktop-Fassung |
| `tools/icon.mjs` | Zeichnet das App-Symbol (`build/icon.png`) aus den Pixel-Sprites |
| `tools/sprites.mjs` | Übersicht aller Sprites und Drachen, prüft die Raster |
| `desktop/` | Electron-Hülle: Fenster, Spielstand-Datei, Startskript für Linux |
| `.github/workflows/desktop.yml` | Baut Windows und Linux bei jedem Push und aktualisiert die Download-Links |
