# HORT – Konzept

> Arbeitstitel. Stand: 26.10.2026 – der Prototyp v0.4 setzt den neuen Kern um: die wachsende Höhle, Koboldtürme mit eigenem Baum, Leben/Rüstung/Segen, den Drachen als aktiven Mitspieler und Siegfried als Boss. Grafik, Ton, Controller, Desktop-Fassung, Hortbuch und Erzfeinde sind aus v0.3 mitgekommen.
> Ziel: Steam-Demo zum Next Fest im Juni 2027, Stand auf der gamescom im August 2027.

## In einem Satz

Du bist der Drache tief im Berg: Deine Kobolde graben die Höhle jeden Tag weiter, bauen Türme, Fallen und Köder an die Gänge – und jede Nacht kommen Helden, die dir das Glänzendste aus dem Hort tragen wollen, am Ende dein Ei.

## Leitplanken

1. **Ein Kern:** *Wo grabe ich hin, und was baue ich wohin, damit mir keiner etwas klaut?* Jede Mechanik muss diese Frage interessanter machen.
2. **Drachenlogik-Test:** Jede Regel muss sich mit „weil Drachen, Kobolde und Helden so sind“ erklären lassen. Türme klaut niemand – sie sind in den Fels geschraubt, und Helden wollen Gold, keinen Koboldschrott.
3. **Kein Genre-Mischmasch:** Tower Defense mit Deck und Bäumen, dazu ein Drache, den man selbst einsetzt. Kein Basisbau außerhalb der Höhle, keine Weltkarte, keine Crafting-Menüs.

## Was sich gegenüber v0.3 ändert

| v0.3 | v0.4 |
|---|---|
| Hort als Raster, Schätze anordnen und verschmelzen | Der Hort liegt in der Hortkammer am Ende des Gangs, der Drache sitzt darauf |
| Raubzüge bestimmen, wer kommt | Das Graben bestimmt, woher und wer kommt (Durchbrüche) |
| Atem-Karten mit Glut-Leiste | Drei Fähigkeiten des Drachen mit Abklingzeit |
| Schätze wehren sich selbst | Koboldtürme mit eigenem Baum, Fallen und Köder |
| Glut als Energie in der Nacht | Glut ist die Währung zwischen den Runs – und geht an den Dieb, wenn das Ei verloren ist |

## Ein Tag

| Phase | Was passiert |
|---|---|
| **Graben** | Drei Stollenstücke zur Wahl, dazu die Richtung. Die Hortkammer zieht einen Abschnitt weiter, der Gang dorthin wird länger. |
| **Bauen** | Vier Baupläne aus dem eigenen Deck: Türme in die Nischen neben dem Gang, Fallen in den Gang, Köder in eine Nische am Gang. Bezahlt wird mit Gold. Türme lernen Knoten in ihrem Baum, erbeutete Ausrüstung kommt in ihre Fassungen. Die Raben melden, wer heute Nacht durch welchen Eingang kommt. |
| **Nacht** | Helden laufen zum Glänzendsten, das sie tragen können, und wollen damit wieder hinaus. Türme und Fallen kämpfen von selbst, du setzt die Fähigkeiten des Drachen ein. Pausierbar, doppeltes Tempo möglich. |
| **Morgen** | Gold (Grundlohn, Goldadern, Besiegte), Glut, Ausrüstung der Besiegten, neue Stufen der Türme. |

Ein Run hat 8 Tage, etwa 25–35 Minuten. In der letzten Nacht kommt Siegfried. Wer sie übersteht, brütet das Ei aus.

## Die Kniffe

### 1. Die Höhle wächst (Vorbild: Rogue Tower)

- **Regel:** Der Berg besteht aus 5 × 5 Abschnitten. Jeden Tag graben die Kobolde einen weiter, und die Hortkammer zieht hinterher. Der Gang vom Höhlenmund bis zum Hort wird jeden Tag länger.
- **Drachenlogik:** Drachen ziehen sich mit ihrem Hort tiefer in den Berg zurück. Die Kobolde graben voraus.
- **Kniff:** Führt man den neuen Gang an alten Türmen vorbei, schießen diese auf beide Gänge. Aber der Berg ist begrenzt: Wer sich in eine Ecke gräbt, kommt nicht mehr weiter.
- **Warum es hilft:** Jeder Run sieht anders aus, und das Graben ist eine echte Entscheidung statt Kulisse.

### 2. Wer zu gierig gräbt (Vorbild: Cards & Cannons)

- **Regel:** Je tiefer, desto reicher die Stücke: Goldadern bringen jeden Morgen Gold, Grabkammern einen Schatz. Manche Stücke brechen durch – in den Brunnenschacht des Dorfs, einen alten Zwergenstollen oder eine Gruft. Von dort kommen ab dann Helden, auf kürzerem Weg.
- **Vorbild:** In Cards & Cannons setzt man die Gegner-Spawner selbst. In Hort entscheidet die Gier, wo neue Eingänge entstehen.

| Eingang | Wer kommt | Was es bringt |
|---|---|---|
| Höhlenmund | Diebe und Söldner, von Anfang an | – |
| Brunnenschacht | Bauern in Scharen, viel Leben | Goldader und die Münzen aus dem Wunschbrunnen |
| Zwergenstollen | Zwerge in schwerer Rüstung, die Katzengold erkennen | Zwei Goldadern |
| Gruft | Paladine mit Segen, Magier, die aus der Ferne zaubern | Felsvorsprung und eine Grabbeigabe |

### 3. Glanz und Köder

- **Regel:** Helden holen sich das Glänzendste, was sie tragen können: einen Schatz aus dem Hort, einen Köder in einer Nische oder etwas, das am Boden liegt. Das Ei glänzt mit 4 – liegt nichts Glänzenderes im Hort, wollen sie das Ei.
- **Kniff:** Katzengold glänzt mit 6. Wer es einsammelt, braucht dreimal so lange – mitten vor den Türmen – und zieht danach mit wertlosem Zeug ab. Je reicher der Hort, desto stärker müssen Köder glänzen.
- **Warum es hilft:** Man sieht, wohin jeder Held will, und kann ihn umlenken.

### 4. Leben, Rüstung, Segen (Vorbild: Rogue Tower)

- **Regel:** Helden haben bis zu drei Schichten. Schaden trifft zuerst den Segen (blau), dann die Rüstung (weiß), dann das Leben (rot).
- **Türme:** Speere und Feuer sind stark gegen Leben, Steine gegen Rüstung, Flüche gegen Segen. Drachenfeuer wirkt gegen alles gleich.
- **Warum es hilft:** Welche Eingänge man öffnet, bestimmt, welche Türme man braucht. Das verbindet das Graben mit dem Bauen.

### 5. Türme mit eigenem Baum (Vorbild: der Passivbaum in Path of Exile 2)

- **Regel:** Jeder Turm sammelt Erfahrung mit jedem Treffer. Jede Stufe bringt einen Punkt für seinen Baum: kleine Knoten, große Knoten, eine zweite Fassung und je Zweig ein Schlussstein, der die Regeln des Turms ändert.
- **Beispiele für Schlusssteine:** Speerhagel (drei Speere auf drei Helden, jeder schwächer), Felsbrocken (halb so oft, doppelter Schaden, betäubt), Flammenherz (der Brand springt über), Seelenfessel (Verfluchte können nichts greifen, der Stein macht keinen Schaden mehr).
- **Ausrüstung der Besiegten:** Was Helden fallen lassen, kommt in die Fassungen: Diebesdolch (doppelter Schaden), Zwergenhacke (schlägt Rüstung ab), Zauberstab (Blitz zu zwei weiteren Helden), Paladinschild (doppelt gegen Segen), Mistgabel (stößt zurück), Söldnerklinge, Siegfrieds Balmung.
- **Warum es hilft:** Keine zwei Türme sind gleich. Die Tiefe steckt in Entscheidungen, nicht in Kartenglück.

### 6. Der Drache greift ein

- **Regel:** Die Klaue trifft Helden in der Hortkammer von selbst. Dazu drei Fähigkeiten mit Abklingzeit: Feueratem (3 × 3 Felder, überall in der Höhle), Flügelschlag (stößt Helden vor dem Hort zurück, sie lassen fallen, was sie tragen), Brüllen (alle erstarren).
- **Drachenkraft:** Je wertvoller der Hort, desto härter die Klaue und der Atem. Jeder gestohlene Schatz schwächt den Drachen.
- **Warum es hilft:** Kein reines Tower Defense – in den entscheidenden Sekunden rettet man das Ei selbst.

### 7. Siegfried

- **Regel:** In der letzten Nacht kommt der Drachentöter. Er will nur das Ei, zerschlägt im Vorbeigehen Türme (er holt sichtbar aus) und ist von vorn fast unverwundbar. Vollen Schaden nimmt er nur von hinten, am Lindenblatt.
- **Kniff:** Hat er das Ei, muss er den ganzen Weg zurück – und kehrt allem, was hinter ihm steht, den Rücken zu. Auch die Klaue des Drachen trifft ihn dann voll.

### 8. Glut und Erzfeinde (Soulslite)

- **Regel:** Besiegte Helden und überstandene Nächte bringen Glut. Gewinnst du, kommt sie mit nach Hause. Verlierst du das Ei, trägt der Dieb deine Glut fort und kommt in einem späteren Run als Erzfeind zurück. Besiegst du ihn, holst du sie dir wieder.
- **Erzfeinde:** Auch wer mit einem wertvollen Schatz entkommt, bekommt einen Namen und kommt stärker wieder. Höchstens drei gleichzeitig.
- **Glutnester (geplant):** Zwischen den Schichten des Bergs rasten, umskillen – aber die Helden werden stärker.

## Zahlen im Prototyp

- 4 Türme mit je 10 Knoten, 4 Fallen, 3 Köder, 7 Stück Ausrüstung
- 7 Heldentypen (mit Siegfried), 4 Eingänge, 8 Arten von Stollenstücken
- 10 Schätze, 3 Fähigkeiten des Drachen, 4 Drachenarten, 10 Legende-Stufen, 9 Taten

Balance-Bot (menschliche Reaktionszeit, Legende 0): etwa 70 % Siege, ohne Fähigkeiten des Drachen gut 20–40 %. Wer jeden Durchbruch mitnimmt, verliert deutlich öfter. Die meisten Niederlagen kommen durch Zwerge, Magier und Siegfried.

## Was wir aus der Kritik lernen

| Kritik | So macht es Hort |
|---|---|
| Rogue Tower: Später entscheidet vor allem Kartenglück | Die Tiefe steckt in den Bäumen, die man selbst steuert. Das Deck stellt man vor dem Run selbst zusammen |
| Rogue Tower: Viele Freischaltungen verwässern den Kartenpool | Freischaltungen landen in der Sammlung, ins Deck kommen nur acht |
| 9 Kings: Roher Schaden schlägt alles | Leben, Rüstung und Segen verlangen verschiedene Türme |
| 9 Kings: Schwierigkeit springt plötzlich an | Die Gefahr steigt mit dem, was man selbst gräbt. Die Raben sagen vorher, wer kommt |
| Tower Defense allgemein: man schaut nur zu | Der Drache greift ein, und Diebe müssen den ganzen Weg zurück |

## Abgrenzung

| Spiel | Worum es geht | Was Hort anders macht |
|---|---|---|
| Cards & Cannons | Tower Defense mit Kartendeck, Spawner selbst setzen | Die Höhle wächst, Helden wollen hinein *und* wieder hinaus, der Drache greift selbst ein |
| Rogue Tower | Der Weg wächst, Türme leveln, Karten | Bäume statt Kartenglück, Gier beim Graben, Schutzschichten mit Geschichte |
| Dungeon Keeper | Dungeon bauen, Monster führen | Kein Wirtschaftsspiel, ein Tag ist in zwei Minuten geplant |
| 9 Kings | Königreich bauen, Armeen kämpfen automatisch | Man ist das Monster, und es geht darum, was geklaut wird |

## Zwischen den Runs

Grundsatz: **Mehr Auswahl, nicht mehr Stärke.** Man gewinnt, weil man besser spielt, nicht weil man länger gespielt hat.

- **Werkstatt der Kobolde:** Glut schaltet neue Baupläne (Steinschlag, Mimik-Truhe, Narrengold) und gesperrte Schlusssteine frei (Speerhagel, Steinregen, Flammenherz, Seelenfessel).
- **Deck:** Acht Baupläne aus der Sammlung, jeden Tag zieht man vier.
- **Drachenarten:** Was am Ende im Hort liegt, entscheidet, was schlüpft. Kristalldrache (zwei Edelsteine im Hort: Kristallatem verlangsamt), Knochendrache (70 Gefallene: Knochenwächter), geheimer Mondsilberdrache (drei Helden in einer Nacht mit falschem Gold: Köder glänzen stärker).
- **Legende:** 10 Stufen je Drachenart, jede bringt eine Regel dazu und Narben am Drachen.
- **Hortbuch und Taten:** Baupläne, Helden, Schätze, Ausrüstung, Drachen, Taten, Erzfeinde. Unentdecktes zeigt einen Hinweis.
- **Modi:** Endlose Belagerung (Siegfried alle 8 Nächte), Wochen-Hort, Hort-Codes zum Teilen.

## Ausbaustufen

| Stufe | Inhalt |
|---|---|
| Prototyp v0.4 (jetzt) | Erste Schicht des Bergs, 8 Tage, alles oben Genannte |
| Demo (Next Fest Juni 2027, gamescom) | Feinschliff, Einführung zum Mitspielen, Bestenliste, ein Pixel-Artist für Drache und Kobolde |
| Early Access | Drei Schichten (Gestein, Zwergenminen, Glutschlund) mit Glutnestern dazwischen, mehr Türme und Bäume, mehr Eingänge und Heldenfraktionen |
| Updates und 1.0 | Neue Drachenarten, Legende bis 20, Twitch-Helden, Steam Workshop, Koop |

## Offene Fragen

1. **Köder:** Laut Bot sind Türme pro Gold noch stärker als Köder. Erst beim Spielen klären, ob das stimmt.
2. **Dauer:** Sind 8 Tage richtig für die erste Schicht?
3. **Kobolde sichtbar machen:** Graben und Bauen mit kleinen Kobold-Animationen?
4. **Setting:** Deutsche Sagenwelt (Nibelungen, Siegfried, Lindenblatt) als roter Faden für alle Bosse?

## Referenzen

- Cards & Cannons: [Steam](https://store.steampowered.com/app/4536920/Cards__Cannons/), [Flamehead Games](https://flameheadgames.com/), [Closed Beta](https://playtester.io/cards-and-cannons), [Interview](https://feedbagel.com/post/flamehead-games-fresh-take-on-the-classic-tower-defense-formula)
- Rogue Tower: [Steam](https://store.steampowered.com/app/1843760/Rogue_Tower), [Test bei IndieHellZone](https://indiehellzone.com/2022/02/21/rogue-tower/), [Einsteiger-Guide](https://gamepretty.com/rogue-tower-beginners-guide-game-mechanics-strategies/), [Kritik am Kartenglück](https://steamcommunity.com/app/1843760/discussions/0/3825299364576183432)
- 9 Kings: [Early-Access-Test](https://www.elliotcsmith.com/9-kings-early-access-review/), [Spieler-Kritik (Zusammenfassung)](https://vaporlens.app/app/2784470/9_kings)
- Live-Service-Müdigkeit: [Club386](https://www.club386.com/why-live-service-fatigue-growing-gamers/)
