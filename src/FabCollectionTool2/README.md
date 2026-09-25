# FabCollectionTool 2.0.7.0

Verwaltung einer Flesh-and-Blood-Kartensammlung im Browser. Keine Installation, kein Server,
keine Abhängigkeiten.

## Start

`index.html` in diesem Ordner per Doppelklick im Browser öffnen (Chrome, Edge oder Firefox).
Das funktioniert direkt aus dem Repository-Checkout über `file://`. Beim ersten Besuch ohne
Bestand startet der Einrichtungs-Assistent, danach eine kurze Tour (wiederholbar über
*Hilfe → Einrichtung* und *Hilfe → Tutorial*).

**Die ausführliche Anleitung für Anwender steht in [`doku.html`](doku.html)** (in der App:
*Hilfe → Dokumentation*): Arbeitsordner und Speichern, Spalten, Tastatur, Status und
Kartenbilder, Editiermodus, Filter mit Häkchen und Platzhaltern, Gliederung, Sets aufnehmen,
Stammdaten mit Branch-Auswahl, Protokoll und Rückgängig, Import/Export, Backup, Diagnose,
häufige Fragen.

## Überblick

| Bereich | Funktion |
|---|---|
| **Bestand** | *Neu*, *Öffnen*, *Speichern* (Strg+S), *Backup*, *Ordner …* (Arbeitsordner), *Sets aufnehmen …* |
| **Import / Export** | ODS (die FabCollectionTool-1.0-Tabelle), Fabrary |
| **Stammdaten** | Branch des Datensatzes, Stand, *Aktualisieren*, *Übernehmen …* (je Karte), *Info* |
| **Ansicht** | Design (Auto, Hell, Dunkel), Schriftgröße, Lage der Meldungen, *Editiermodus* |
| **Hilfe** | *Einrichtung* (Assistent), *Tutorial*, *Dokumentation*, *Diagnose* (Log herunterladen) |
| **Filter** | Suche, Schnellfilter, *Spalten*, *Filter zurücksetzen*; in der Tabelle Häkchen- und Textfilter je Spalte |
| **Gliederung** | Gruppierung, Reihenfolge der Sets, Ebenen **1** / **2** / **3** |

In der Tabelle: Kartenbilder in einer eigenen Spalte nach der Kartennummer (Vorschau beim
Überfahren, groß per Klick; die
Bilder lädt der Browser aus dem Internet), einklappbarer Block der Rechenspalten, × zum Löschen
eines Filters.

Die Stammdaten (Karten, Varianten, Sets) lädt die Anwendung beim Start automatisch aus dem offenen
Datensatz [the-fab-cube/flesh-and-blood-cards](https://github.com/the-fab-cube/flesh-and-blood-cards);
ohne Internet gelten die mitgelieferten in `reference/`.

## Wo die Daten liegen

- **Arbeitsordner** (Chrome/Edge, einmal gewählt): Bestand `<name>.csv`, Protokoll
  `<name>-log.csv` (die letzten 1.000 Änderungen), Backups `<name>-backup-<zeit>.csv`,
  Diagnose-Log `fct-diagnose.log` (bei 512 KB wird es zu `fct-diagnose.1.log`, höchstens etwa
  1 MB). Eine Browser-Erlaubnis für den Ordner deckt alle Dateien ab.
- **Browser** (IndexedDB): eine Kopie des letzten Bestands mit Protokoll, die Verweise auf Datei
  und Ordner, die Autosave-Entscheidung und die letzten 2.000 Diagnose-Einträge. Die Datei
  bleibt das Original.
- **Browser** (localStorage): nur Ansichtseinstellungen (Design, Spalten, eingeklappter
  Rechenblock, Branch der Stammdaten, Schrift, Gliederung, Tutorial/Assistent gesehen) und je
  Bestand die aufgeklappten Gruppen, die Position und den Zellcursor.
- **Firefox** speichert Bestand und Protokoll als Download, immer unter demselben Namen; mit
  der Firefox-Einstellung „Jedes Mal nachfragen, wo gespeichert werden soll“ ersetzt man so
  die alte Datei (siehe Dokumentation, Abschnitt Firefox).

**Nutzerdaten gehören nicht ins Repository.** Die `.gitignore` in diesem Ordner schließt `*.csv`
und `*.ods` aus; den Arbeitsordner am besten ganz außerhalb des Checkouts anlegen.

## Dateiformate

### `collection.csv` (eigener Bestand)

CSV nach RFC 4180, UTF-8, jedes Feld in Anführungszeichen, eine Zeile je Variante (Id + Edition +
Art Treatment):

```
Set,Edition,Id,First In,Rarity,Metatype,Talent1,Talent2,Class1,Class2,Type1,Type2,Sub1,
Sub2,Sub3,Name,Backside Name,Translated Name,Translated Backside Name,Peculiarity,
Art Treatment,Pitch,Playset,ST,RF,CF,GF,Note,Overrides
```

(im Original eine Zeile). Die Reihenfolge ist **dieselbe wie in der Tabelle der Anwendung**
(ohne die berechneten Spalten), damit die Datei in externen Tools genauso aussieht. Dateien
älterer Versionen mit anderer Reihenfolge werden über die Spaltennamen gelesen; beim nächsten
Speichern schreibt die Anwendung die aktuelle Reihenfolge. Metatype bis Sub3 folgen der
Typzeile der Karte (Regelwerk 2.14.1); die Spalte `Talent` bis 2.0.4.0 wird beim Lesen in
`Talent1` und `Talent2` aufgeteilt. `ST`, `RF`, `CF`, `GF` sind die Mengen je Foiling (Standard, Rainbow,
Cold, Gold). `Edition` ist eine Edition (`Alpha`, `First`, `Unlimited`) oder eine Sprache (`EN`,
`DE`, …). Alle Werte bleiben so erhalten, wie sie in der Datei stehen; ungültige Zahlen werden
gemeldet und rot markiert, aber nicht verändert. Zusätzliche Spalten bleiben erhalten.
`Overrides` listet (mit `;` getrennt) die Stammdatenspalten einer Zeile, die bewusst lokal
geändert wurden. Dateien von 2.0.0.0 ohne diese Spalte lassen sich weiter öffnen.

**Playset** ist seit 2.0.3.0 eine Stammdatenspalte (Legendary 1, Helden/Ausrüstung/Token 1,
Evo-Ausrüstung 3, einhändige Waffen 2, andere Waffen 1, Chi 1, sonst 3). Beim Laden wird ein
abweichender Wert aus einer älteren Datei als `Overrides`-Eintrag `Playset` markiert und nicht
verändert; ein leerer Wert wird aus den Stammdaten ergänzt.

### `<name>-log.csv` (Änderungsprotokoll)

Spalten `Time, Action, Id, Name, Variant, Column, Old, New`; die letzten 1.000 Einträge.

### Fabrary

- **Import:** der Sammlungsexport aus Fabrary. Zeilen mit Menge werden zu Bestand; die
  Foilings werden zu `ST`/`RF`/`CF`/`GF` zusammengefasst.
- **Export:** Fabrarys eigene Zeilen (das „Skelett“ in `reference/fabrary-skeleton.js`) werden
  zeichengenau übernommen, nur die Mengen werden eingetragen. Sprachvarianten werden
  zusammengezählt, „Micro Text Box“ wird zu „Extended Art“. „Extra for trade“ wird nach den
  Regeln des alten Tools berechnet. Varianten, die das Skelett nicht kennt, werden gemeldet und
  nicht geraten.

## Grenzen dieser Fassung

- Imports ersetzen den geöffneten Bestand (kein Zusammenführen).
- Cost, Power, Defense, Keywords, Artist, Legalität und Kartentext werden nur angezeigt,
  nicht in `collection.csv` gespeichert (Grundlage: `docs/Recherche-Spalten-2.0.4.0.md`).
- Das Fabrary-Skelett wird mitgeliefert und nicht online aktualisiert. Ganz neue Varianten
  exportiert erst eine neuere Fassung des Skeletts (siehe `reference/README.md`).
- Cardmarket, Dragon Shield und TCGplayer folgen später.

## Aufbau

Klassische Skripte ohne Build-Schritt (ES-Module sind unter `file://` gesperrt), Reihenfolge
in `index.html`: `core.js` (Namensraum, Hilfen), `log.js` (Diagnose-Log), `notices.js`
(Hinweisbereich), `settings.js`, `reference/*.js` (Stammdaten), `csv.js`,
`reference-transform.js` (Umwandlung, Branch-URL, Bild-URLs), `model.js` (Bestand,
Stammdatenabgleich, Berechnung),
`changelog.js`, `storage.js` (Dateien, Arbeitsordner, IndexedDB), `diagnosis.js` (Log-Datei
mit Rotation), `grid-filter.js`, `card-image.js` (Kartenbilder) und `grid.js` (Tabelle),
Importe/Exporte,
`reference-update.js`, `tour.js` (Tutorial), `onboarding.js` (Einrichtungs-Assistent),
`app.js` (Oberfläche).

## Wartung

Für Entwickler; Node.js 18 oder neuer. Die Anwendung selbst braucht kein Node.js.

- `tools/build-reference.mjs`: erzeugt `reference/*.js` neu (siehe `reference/README.md`).
- `tools/selftest.mjs`: automatische Prüfungen (CSV, ODS-Import, Fabrary-Import/-Export,
  Round-Trip, Skelett ohne Mengen, Typzeilen-Zerlegung, `Overrides`, Stammdatenabgleich,
  Gruppen, Änderungsprotokoll, Erscheinungsdaten, Lückenfüllung, Übernehmen ohne Änderung
  des Bestands, Wertelisten, Platzhalter, Sets aufnehmen, Playset, bearbeitbare Zellen,
  Grenzen von Protokoll und Diagnose-Log, Spaltenreihenfolge, Kartenbilder, Branch-URL,
  Zeilenlänge):
  `node tools/selftest.mjs <altes.ods> <fabrary-export.csv> [Ordner mit Quell-CSVs]`
