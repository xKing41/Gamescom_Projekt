# Von hier zu Steam

> Stand: 26.10.2026. Ziel: Steam-Seite Anfang 2027, Demo zum Next Fest im Juni 2027, gamescom im August 2027.

## Was schon fertig ist

- **Desktop-Fassung** für Windows und Linux (Electron). Jeder Push baut sie automatisch; die entpackten Ordner sind genau der Inhalt der Steam-Depots.
- **Controller** mit Xbox-Tastenbildern, wie sie auch das Steam Deck zeigt. PlayStation-Controller bekommen ihre eigenen Symbole.
- **Vollbild** über F11 oder Alt+Enter, auf dem Steam Deck automatisch.
- **Spielstand als Datei** in einem festen Ordner. Die Steam Cloud kann ihn ohne zusätzlichen Code abgleichen („Auto-Cloud“, siehe unten).
- **Ohne Netz und ohne fremde Dateien:** Grafik und Ton entstehen im Code, Schriften liegen bei (SIL Open Font License).

## Was du in Steamworks erledigen musst

1. **Steamworks-Konto** auf partner.steamgames.com anlegen, mit Bank- und Steuerdaten und Identitätsprüfung. Das dauert ein paar Tage.
2. **App-Gebühr** zahlen: 100 US-Dollar pro Spiel. Steam zahlt sie zurück, sobald das Spiel 1.000 Dollar Umsatz gemacht hat. Danach gibt es eine **App-ID**.
3. **Store-Seite** anlegen: Beschreibung, mindestens fünf Screenshots, Trailer und die Capsule-Bilder in den Größen, die Steamworks vorgibt.
4. **„Demnächst verfügbar“** schalten, sobald die Seite steht. Ab dann sammelt sie Wunschlisten – je früher, desto besser fürs Next Fest. Vor dem Release muss die Seite mindestens zwei Wochen so sichtbar sein.
5. **Demo** als eigene App in Steamworks anlegen, mit eigenem Build. Die Demo kann derselbe Build sein; welche Inhalte sie zeigt, legen wir im Spiel fest.
6. **Next Fest** in Steamworks anmelden. Jedes Spiel darf nur einmal teilnehmen, deshalb ist Juni 2027 die richtige Wahl. Fristen und Regeln stehen dort.

## Builds hochladen

| Depot | Inhalt | Start |
|---|---|---|
| Windows | Ordner `Hort` aus `Hort-Windows.zip` | `Hort.exe` |
| Linux | Ordner `Hort` aus `Hort-Linux.tar.gz` | `start-hort.sh` |

Hochgeladen wird mit SteamPipe (ContentBuilder aus dem Steamworks SDK). Später kann der GitHub-Workflow das selbst übernehmen; dafür bekommt er ein eigenes Steam-Konto mit Upload-Rechten als Secret.

## Steam Cloud ohne Code (Auto-Cloud)

In Steamworks unter „Anwendung“ → „Steam Cloud“:

- Bytes pro Nutzer: 1 MB, Anzahl Dateien: 10
- Root: `WinAppDataRoaming`, Unterordner `Hort/save`, Muster `*.json`, alle Betriebssysteme
- Root-Überschreibung für Linux: `LinuxXdgConfigHome`, Unterordner `Hort/save`

Steam lädt den Ordner vor dem Start herunter und sichert ihn nach dem Beenden. Das Spiel schreibt jede Änderung sofort in `profile.json` und hält eine Sicherungskopie in `profile.bak.json`.

## Steam Deck

- In Steamworks „Volle Controller-Unterstützung“ eintragen und als Standard-Belegung „Gamepad“ wählen.
- Für „Verifiziert“ prüft Valve unter anderem lesbare Schrift bei 1280 × 800, passende Tastenbilder, Starten ohne Tastatur und keinen Launcher. Die Desktop-Fassung ist darauf ausgelegt; sicher ist es erst nach einem Test auf dem Gerät.
- Die Linux-Fassung startet über `start-hort.sh`. Alternativ läuft die Windows-Fassung über Proton.

## Was noch fehlt

- **Steam-Anbindung** für Erfolge (die Taten) und Bestenlisten (Endlose Belagerung, Wochen-Hort). Dafür braucht es die App-ID und eine Anbindung an die Steamworks-API, zum Beispiel steamworks.js; vorher prüfen, ob sie mit der aktuellen Electron-Version läuft. Auch das Steam-Overlay braucht in Electron eigene Einstellungen.
- **Bilder für die Store-Seite:** Capsules, Logo und Bibliotheks-Hintergrund, ohne KI-Bilder. Entweder im Zeichenstil des Spiels aus dem Code oder von einer Grafikerin oder einem Grafiker.
- **Trailer:** 30 bis 60 Sekunden, aufgenommen im echten Spiel.
- **Studioname und Impressum** für die Store-Seite und den Eintrag `author` in `package.json`.
- **KI-Angaben:** Steam fragt beim Einreichen, ob Inhalte mit KI entstanden sind. Grafik und Ton entstehen hier im Code, Code und Texte sind mit Claude entstanden. Lies die aktuelle Regel in Steamworks und gib es ehrlich an.
