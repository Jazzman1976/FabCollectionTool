# FabCollectionTool 2.0.1.0

Verwaltung einer Flesh-and-Blood-Kartensammlung im Browser. Keine Installation, kein Server,
keine Abhängigkeiten.

## Start

`index.html` in diesem Ordner per Doppelklick im Browser öffnen (Chrome, Edge oder Firefox).
Das funktioniert direkt aus dem Repository-Checkout über `file://`.

Beim Start lädt die Anwendung automatisch die aktuellen Stammdaten (Karten, Drucke, Sets) aus
dem offenen Datensatz [the-fab-cube/flesh-and-blood-cards](https://github.com/the-fab-cube/flesh-and-blood-cards).
Ohne Internet oder bei einem Fehler arbeitet sie mit den mitgelieferten Stammdaten weiter. Die
Gruppe **Stammdaten** in der Werkzeugleiste zeigt, welche verwendet werden (online oder
mitgeliefert, Stand des Datensatzes, Ladezeit). *Aktualisieren* lädt sie jederzeit neu, *Info*
zeigt Herkunft, Umfang und den letzten Fehler.

## Bedienung

| Bereich | Funktion |
|---|---|
| **Bestand** | *Neu*, *Öffnen* (`collection.csv`), *Speichern* (Strg+S), *Backup* (Kopie mit Zeitstempel) |
| **Import** | *ODS*: das alte Calc-File übernehmen · *Fabrary*: einen Fabrary-Export übernehmen |
| **Export** | *Fabrary*: Importdatei für Fabrary erzeugen |
| **Stammdaten** | Stand, *Aktualisieren*, *Übernehmen …* (Abweichungen übernehmen), *Info* |
| **Ansicht** | Schriftgröße (klein, mittel, groß), Position der Meldungen (unten, links, rechts) |

- **Farben der Zellen:** weiß mit blauem Rahmen = eigene Eingabe (Playset, ST, RF, CF, GF,
  Note); grau = aus den Stammdaten (gesperrt); dunkler grau = berechnet (Have/Need/Left).
- **Bearbeiten:** Doppelklick in eine Zelle. *Enter* speichert und springt eine Zeile tiefer,
  *Tab* in die nächste Spalte, *Esc* bricht ab. Bei den Mengen erscheinen beim Überfahren
  **−** und **+**.
- **Zeilenaktionen** am Ende jeder Zeile (bleiben beim seitlichen Scrollen sichtbar):
  ✎ alle Felder bearbeiten (mit Stammdatenwerten und Zurücksetzen), ＋ neue Zeile darunter
  (übernimmt Set, Talent und Klassen), Kopieren, Kopie darunter einfügen (ohne Mengen, z. B.
  für eine weitere Sprache), Löschen.
- **Editiermodus:** macht auch die Stammdaten- und Identitätsspalten (Name, Rarity, Talent,
  Edition, Id, …) bearbeitbar (gelb hinterlegt). Weicht ein Wert danach von den Stammdaten ab,
  gilt er als **lokal geändert**: violette Ecke, der Stammdatenwert steht im Tooltip. Im
  Editiermodus sind außerdem Werte gestrichelt unterstrichen, die ohne Absicht von den
  Stammdaten abweichen. Zurücksetzen über ✎ je Feld oder alle auf einmal.
- **Stammdaten übernehmen:** *Übernehmen …* listet je Spalte, wie viele Werte des Bestands von
  den Stammdaten abweichen, mit Beispielen. Angehakte Spalten werden übernommen; lokal
  geänderte Werte bleiben unberührt. So lassen sich auch Fabrary-Importe um Talent, Klassen
  und Typen ergänzen.
- **Gruppen (Accordeon):** wie in der ODS nach Set und darunter nach Talent/Klasse. Klick auf
  eine Gruppenzeile klappt sie auf oder zu; *Alle auf* / *Alle zu*. Bei Suche oder Filter sind
  alle Gruppen mit Treffern offen. Sortieren wirkt innerhalb der Gruppen. Umschaltbar auf
  „nur Set“ oder „keine Gruppen“.
- **Suchen und Filtern:** Das Suchfeld durchsucht Name, übersetzte Namen, Id, Set und Notiz.
  Unter jeder Spaltenüberschrift steht ein Filter: Text = „enthält“, `=Text` = genau, `=` = leer,
  `!Text` = enthält nicht; bei Zahlen `3`, `>0`, `<3`, `>=2`, `!=0`.
  Ein Klick auf die Überschrift sortiert (auf-, absteigend, aus); ⇅ zeigt, dass eine Spalte
  sortierbar ist, ▲/▼ die aktive Sortierung.
- **Schnellfilter:** im Besitz, fehlt zum Playset (gesamt oder je Set), überzählig, auffällige
  Zeilen (unbekannte Kartennummer, ungültige Zahl, fehlende Id).
- **Spalten** blendet Spalten ein und aus, auch die aus den Stammdaten abgeleiteten Typen.
  *Standard wiederherstellen* stellt die Standardansicht her. Der Dialog schließt bei Klick
  daneben oder mit *Esc*.
- **Alle Karten einblenden** zeigt zusätzlich alle Drucke aus den Stammdaten, die noch nicht im
  Bestand sind (grau, kursiv). Sobald dort eine Zelle bearbeitet oder ＋ gedrückt wird, wird die
  Zeile Teil des Bestands. So werden neue Karten ohne Abtippen erfasst.
- **Zeilenfarben:** roter Balken am Zeilenanfang und rot getönte Rechenspalten = zum Playset
  fehlen noch Karten (über alle Sets); grün = mehr als ein Playset in diesem Set.

Die Spalten *Have (this)*, *Have/Need/Left (set)*, *Have/Need/Left (total)* rechnet die Anwendung
selbst; „set“ bezieht sich auf dieselbe Kartennummer, „total“ auf dieselbe Karte
(Name, Pitch, Peculiarity) über alle Sets.

## Einstellungen

Sichtbare Spalten, Schriftgröße, Position der Meldungen und Gruppierung merkt sich der Browser
(localStorage). Das sind **nur Ansichtseinstellungen, nie Bestandsdaten**. Sperrt der Browser
den Speicher, gelten nach dem Neuladen einfach wieder die Standardwerte.

## Änderungsprotokoll

Jede Änderung am Bestand (Zellwert, − / +, Einfügen, Kopie einfügen, Löschen, Zurücksetzen,
Stammdaten übernehmen, Import) wird mit Zeit, Karte, Variante, Spalte, altem und neuem Wert
festgehalten. Der Reiter **Protokoll** neben *Meldungen* zeigt die neuesten Einträge.

Beim *Speichern* werden die neuen Einträge an die Protokolldatei `<bestand>-log.csv` angehängt
(Spalten `Time, Action, Id, Name, Variant, Column, Old, New`):

- **Chrome und Edge** fragen einmal je Sitzung nach der Protokolldatei. Die bisherige Datei
  wählen; die neuen Einträge werden angehängt, auch wenn der Browser „Ersetzen“ anbietet.
- **Firefox** lädt bei jedem Speichern eine Datei `<bestand>-log-JJJJMMTT-HHMMSS.csv` mit den
  neuen Einträgen herunter.

## Speichern und Backup

Der Bestand liegt ausschließlich in der Datei, die du öffnest und speicherst — nie im Browser.

- **Chrome und Edge** schreiben beim *Speichern* direkt in die geöffnete Datei.
- **Firefox** speichert als Download in den Download-Ordner. Tipp: In den Firefox-Einstellungen
  „Jedes Mal nachfragen, wo gespeichert werden soll“ aktivieren, dann lässt sich der Ort wählen.
- **Backup** legt eine Kopie `…-backup-JJJJMMTT-HHMMSS.csv` an.
- **Cloud-Backup:** Die Datei (und die Backups) einfach in einem OneDrive-, Dropbox- oder
  Google-Drive-Ordner ablegen. Das ist optional; die Anwendung setzt keinen Cloud-Dienst voraus.
- Beim Schließen mit ungespeicherten Änderungen fragt der Browser nach.

**Nutzerdaten gehören nicht ins Repository.** Die `.gitignore` in diesem Ordner schließt `*.csv`
und `*.ods` aus; den Bestand am besten ganz außerhalb des Checkouts ablegen.

## Umstieg vom Calc-File

1. *Import → ODS* und das alte `.ods` wählen.
2. Die Vorschau zeigt, was übernommen wird: erkannte Tabelle, übersprungene Formelspalten und
   Zwischenüberschriften, unbekannte Spalten (werden als Zusatzspalten mitgeführt),
   Kartennummern ohne Stammdaten, abweichende Namen.
3. *Übernehmen*, dann *Speichern* als `collection.csv`.

Die Spalten werden über ihre Überschriften zugeordnet, nicht über ihre Position. Die Reihenfolge
im Calc-File ist daher egal, und es gibt keine Spaltenbegrenzung.

## Dateiformate

### `collection.csv` (eigener Bestand)

CSV nach RFC 4180, UTF-8, jedes Feld in Anführungszeichen, eine Zeile je Druckvariante:

```
Set,Edition,Id,First In,Rarity,Talent,Class1,Class2,Type1,Type2,Sub1,Sub2,Sub3,Name,
Translated Name,Backside Name,Translated Backside Name,Pitch,Peculiarity,Art Treatment,
Playset,ST,RF,CF,GF,Note,Overrides
```

(im Original eine Zeile). `ST`, `RF`, `CF`, `GF` sind die Mengen je Foiling (Standard, Rainbow,
Cold, Gold). `Edition` ist eine Edition (`Alpha`, `First`, `Unlimited`) oder eine Sprache (`EN`,
`DE`, …). Alle Werte bleiben so erhalten, wie sie in der Datei stehen; ungültige Zahlen werden
gemeldet und rot markiert, aber nicht verändert. Zusätzliche Spalten bleiben erhalten.
`Overrides` listet (mit `;` getrennt) die Stammdatenspalten einer Zeile, die bewusst lokal
geändert wurden. Dateien von 2.0.0.0 ohne diese Spalte lassen sich weiter öffnen.

### Fabrary

- **Import:** der Sammlungsexport aus Fabrary. Zeilen mit Menge werden zu Bestand; die
  Foilings werden zu `ST`/`RF`/`CF`/`GF` zusammengefasst.
- **Export:** Fabrarys eigene Zeilen (das „Skelett“ in `reference/fabrary-skeleton.js`) werden
  zeichengenau übernommen, nur die Mengen werden eingetragen. Sprachvarianten werden
  zusammengezählt, „Micro Text Box“ wird zu „Extended Art“. „Extra for trade“ wird nach den
  Regeln des alten Tools berechnet. Drucke, die das Skelett nicht kennt, werden im Protokoll
  gemeldet und nicht geraten.

## Grenzen dieser Fassung

- Kein Browser-Speicher für den Bestand: Ohne *Speichern* gehen Änderungen beim Schließen
  verloren.
- Imports ersetzen den geöffneten Bestand (kein Zusammenführen).
- Das Fabrary-Skelett wird mitgeliefert und nicht online aktualisiert. Ganz neue Drucke
  exportiert erst eine neuere Fassung des Skeletts (siehe `reference/README.md`).
- Cardmarket, Dragon Shield und TCGplayer folgen später.

## Wartung

Für Entwickler; Node.js 18 oder neuer. Die Anwendung selbst braucht kein Node.js.

- `tools/build-reference.mjs`: erzeugt `reference/*.js` neu (siehe `reference/README.md`).
- `tools/selftest.mjs`: automatische Prüfungen (CSV, ODS-Import, Fabrary-Import/-Export,
  Round-Trip, Skelett ohne Mengen, Typzeilen-Zerlegung, `Overrides`, Stammdatenabgleich,
  Gruppen, Änderungsprotokoll, Zeilenlänge):
  `node tools/selftest.mjs <altes.ods> <fabrary-export.csv> [Ordner mit Quell-CSVs]`
