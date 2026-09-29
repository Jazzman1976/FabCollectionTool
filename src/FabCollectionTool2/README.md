# FabCollectionTool 2.3.0.0

Verwaltung einer Flesh-and-Blood-Kartensammlung im Browser. Keine Installation, kein Server,
keine Abhängigkeiten.

## Start

**Online:** <https://jazzman1976.github.io/FabCollectionTool/> – die GitHub Page wird bei jedem
Push auf `main` automatisch neu veröffentlicht (`.github/workflows/pages.yml`: erst der
Selbsttest, dann das Deployment dieses Ordners).

**Lokal:** `index.html` in diesem Ordner per Doppelklick öffnen; das funktioniert direkt aus
dem Repository-Checkout über `file://`.

**Browser:** unterstützt wird Google Chrome (Microsoft Edge beruht auf derselben Technik).
Firefox und Safari können nicht in Dateien schreiben und werden nicht unterstützt; die App
zeigt dort einen Hinweis und speichert nur als Download. Apple-Geräte sind ungetestet.

Beim ersten Besuch ohne
Bestand startet der Einrichtungs-Assistent, danach eine kurze Tour (wiederholbar über
*Hilfe → Einrichtung* und *Hilfe → Tutorial*).

**Die ausführliche Anleitung für Anwender steht in [`doku.html`](doku.html)** (in der App:
*Hilfe → Dokumentation*): Arbeitsordner und Speichern, Spalten, Tastatur, Status und
Kartenbilder, Editiermodus, Filter mit Häkchen und Platzhaltern, Gliederung, Sets aufnehmen,
Stammdaten mit Branch-Auswahl, Protokoll und Rückgängig, Import/Export, Backup, Diagnose,
häufige Fragen.

Was sich je Version geändert hat, steht in [`RELEASE-NOTES.md`](RELEASE-NOTES.md).

## Überblick

| Bereich | Funktion |
|---|---|
| **Bestand** | *Neu*, *Öffnen*, *Speichern* (Strg+S), *Backup*, *Ordner …* (Arbeitsordner), *Sets aufnehmen …* |
| **Import / Export** | Import: ODS (die FabCollectionTool-1.0-Tabelle), Fabrary · Export: Fabrary, Cardmarket (Wants-Liste) |
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
- **Export:** Die Zeilen kommen aus den Stammdaten von the-fab-cube, der Quelle der Wahrheit:
  jede Karte in jeder Variante und jedem Foiling, das es gibt, aus allen Sets. *Have* und
  *Extra for trade* sind nie leer; fehlende Karten bekommen `0`, damit Fabrary sie als fehlend
  zeigt. Identifier (Name + Pitch ohne Sonderzeichen), Name und Setname wie im alten Tool;
  bei mehreren Art Treatments gilt Alternate Art vor Alternate Border vor Alternate Text vor
  Full Art vor Extended Art, „Micro Text Box“ wird zu „Extended Art“. Sprachvarianten werden
  zusammengezählt. „Extra for trade“ wird nach den Regeln des alten Tools berechnet.
  Bestandszeilen, deren Variante oder Foiling die Stammdaten nicht kennen, werden gemeldet und
  nicht geraten.
- **Fabrary-Zuordnung** (Nachtrag zu Issue #17): Wo Fabrary Set-Namen, Identifier oder
  Treatments anders schreibt, ersetzt der Export sie nach einer Zuordnung. Mitgeliefert ist
  `reference/fabrary-map.js`, erzeugt aus einem Fabrary-Export (z. B. volle Treatment-Liste
  „Alternate Art, Alternate Border, Extended Art“, Identifier ohne Punkte, „Promos“ statt
  der Promo-Setnamen). Eigene Einträge je Bestand stehen in `<bestand>-config.json` und gehen
  vor. Der Dialog *Zuordnung …* zeigt beides, nimmt eigene Werte auf und gleicht mit einem
  Fabrary-Export ab (eindeutige Funde vorausgewählt, unklare zur Wahl).

## Grenzen dieser Fassung

- Imports ersetzen den geöffneten Bestand (kein Zusammenführen).
- Cost, Power, Defense, Keywords, Artist, Legalität und Kartentext werden nur angezeigt,
  nicht in `collection.csv` gespeichert (Grundlage:
  `docs/konzept/Recherche-Spalten-2.0.4.0.md`).
- Cardmarket, Dragon Shield und TCGplayer folgen später.

## Aufbau

Klassische Skripte ohne Build-Schritt (ES-Module sind unter `file://` gesperrt), Reihenfolge
in `index.html`: `core.js` (Namensraum, Hilfen), `log.js` (Diagnose-Log), `notices.js`
(Hinweisbereich), `settings.js`, `reference/*.js` (Stammdaten), `csv.js`,
`reference-transform.js` (Umwandlung, Branch-URL, Bild-URLs), `model.js` (Bestand,
Stammdatenabgleich, Berechnung),
`changelog.js`, `storage.js` (Dateien, Arbeitsordner, IndexedDB), `diagnosis.js` (Log-Datei
mit Rotation), `grid-filter.js`, `card-image.js` (Kartenbilder) und `grid.js` (Tabelle),
Importe/Exporte, `fabrary-map.js` (Fabrary-Zuordnung und Abgleich),
`reference-update.js`, `tour.js` (Tutorial), `onboarding.js` (Einrichtungs-Assistent),
`app.js` (Oberfläche).

## Wartung

Für Entwickler; Node.js 18 oder neuer. Die Anwendung selbst braucht kein Node.js.

- `tools/build-reference.mjs`: erzeugt `reference/*.js` neu (siehe `reference/README.md`).
- `tools/build-fabrary-map.mjs`: erzeugt `reference/fabrary-map.js` aus einem Fabrary-Export
  (siehe `reference/README.md`).
- `tools/selftest.mjs`: automatische Prüfungen (CSV, ODS-Import, Fabrary-Import/-Export,
  Round-Trip, Fabrary-Zeilen aus den Stammdaten, Fabrary-Zuordnung, Typzeilen-Zerlegung, `Overrides`, Stammdatenabgleich,
  Gruppen, Änderungsprotokoll, Erscheinungsdaten, Lückenfüllung, Übernehmen ohne Änderung
  des Bestands, Wertelisten, Platzhalter, Sets aufnehmen, Playset, bearbeitbare Zellen,
  Grenzen von Protokoll und Diagnose-Log, Spaltenreihenfolge, Kartenbilder, Branch-URL,
  Zeilenlänge):
  `node tools/selftest.mjs <altes.ods> <fabrary-export.csv> [Ordner mit Quell-CSVs]`;
  der Fabrary-Export sollte aktuell sein, die Fabrary-Zuordnung wird an ihm geprüft. Beide
  Dateien liegen außerhalb des Repositorys.
