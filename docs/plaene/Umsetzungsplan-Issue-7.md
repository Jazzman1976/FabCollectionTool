# Umsetzungsplan Issue #7 – Export-Funktion für Cardmarket

**Issue:** https://github.com/Jazzman1976/FabCollectionTool/issues/7
**Branch:** `feature/7-cardmarket-export` (von `develop` 6414c4c) · **Stand:** 28. September 2026
**Status:** umgesetzt, PR nach `develop`

## Kontext
Das erste FabCollectionTool konnte eine Wants-Liste für Cardmarket schreiben (`cm-wants.txt`),
für ein Set oder mehrere Sets zusammen. In der Neuentwicklung fehlte das. Abgestimmt ist:
- Set-Auswahl wie im alten Tool, ein Set oder mehrere gebündelt
- zusätzlich Seltenheit filtern, Setname anhängen und „nur aktuelle Ansicht“
- Menge im Dialog wählbar: fehlend gesamt oder fehlend je Set

## Format
Eine Zeile je Karte, wie im alten Tool (`ParseOds.ParseToCardmarketDecklist`):
`<Anzahl> <Name>[ // <Rückseite>][ <Pitch>][ (<Set>[ - <Edition>])]`, sortiert nach Name,
Zeilenende LF, Datei `cardmarket-wants-<Zeitstempel>.txt`. Bei Cardmarket wird der Inhalt unter
Wants → „Add Deck List“ eingefügt.

- **Pitch** steht nur bei Karten, die es in mehreren Pitches gibt. Das entscheiden die
  Stammdaten. Der Bestand zählt nur für Namen, die die Stammdaten nicht kennen, zum Beispiel ein
  noch fehlendes Set.
- **Namensausnahmen** kommen aus `cardmarket-irregular-cardnames.json` des alten Tools und
  stehen jetzt als `cardmarketNames` in `reference/vocab.js` (Kāṣāya → Kasaya, Lyath). Der
  Bericht nennt jede Anpassung.

## Menge (Abweichung vom Plan)
Geplant war, die Tabellenspalten „Need total“ und „Need set“ zu übernehmen. Der Selbsttest
zeigte, dass die Tabelle getrennt nach **Peculiarity** rechnet. CC-Label-Drucke zählen dort also
extra, auf Cardmarket haben sie aber denselben Namen. Deshalb gilt jetzt dieselbe Regel wie im
alten Tool:
- Alle Zeilen mit gleichem Namen, gleicher Rückseite und gleichem Pitch zählen zusammen.
- Gewünscht ist das größte Playset dieser Zeilen minus alle Exemplare. Das Playset ist eine
  Eingabe, es kann je Zeile verschieden sein, etwa bei einem History Pack.
- *fehlend gesamt*: Exemplare über alle Sets, eine Zeile je Karte.
- *fehlend je Set*: jedes Set für sich, eine Zeile je Karte und Set. Der Setname steht dann
  immer am Ende, damit Cardmarket die Zeilen auseinanderhält.
- Die Exemplare werden immer über den ganzen Bestand gezählt, auch wenn nur ein Set, eine
  Seltenheit oder die aktuelle Ansicht exportiert wird.

## Änderungen
- `app/export-cardmarket.js` (neu): `wants(collection, options)` liefert die gewünschten
  Karten, `exportCardmarket(collection, options)` liefert Text und Bericht, `describe()` den
  Zähltext.
- `app/app.js`: Dialog `exportCardmarket()` mit
  - Set-Liste (neueste zuerst, Suche mit * ?, Alle/Keine, „n fehlend“ je Set)
  - Seltenheiten, Menge, Set am Zeilenende, „Nur Zeilen der aktuellen Ansicht“
  - Live-Vorschau; „Exportieren“ ist gesperrt, solange kein Set angehakt ist oder nichts fehlt
  
  Alles außer den Sets wird gemerkt (`settings` → `cardmarketExport`). Danach folgen Download,
  Log-Eintrag und Bericht.
- `app/grid.js`: `visibleRows()` liefert die Zeilen der aktuellen Ansicht, auch in
  zugeklappten Gruppen.
- `index.html`: Button „Cardmarket“ in der Gruppe Export, Skript eingebunden.
- `app/style.css`: Layout des Dialogs.
- `reference/vocab.js`: `cardmarketNames`.
- `doku.html`: Abschnitt „Cardmarket“ unter Import und Export.
- `tools/selftest.mjs`: fünf neue Prüfungen:
  - Format und Reihenfolge
  - Pitch nur bei Bedarf
  - eine Zeile je Karte mit richtiger Menge
  - Set-, Seltenheits- und Je-Set-Filter
  - Namensausnahmen

## Abnahme
- Selbsttest grün, 690 Zeilen und 1.251 Karten aus `docs/example.ods`. Syntaxprüfung der
  geänderten Skripte bestanden.
- Chrome über localhost mit Bestand, Download im Browser abgefangen:
  - Dialog mit 32 Sets und Zählern
  - Suche `*slam*` findet nur Super Slam
  - OMN + SUP = 362 Karten, das ist genau die Summe der Zähler (152 + 210)
  - mit Rare 103 Karten
  - „je Set“ sperrt „nicht anhängen“
  - Export: Datei `cardmarket-wants-….txt` mit 69 Zeilen, Bericht in den Meldungen, Auswahl
    gemerkt
  - „nur aktuelle Ansicht“ mit Suche „Aftershock“ ergibt 1 Zeile
  - keine Konsolenfehler
- Mit der Ausgabe des alten Tools direkt verglichen wurde nicht, weil es nur interaktiv in der
  Konsole läuft. Format und Rechenregel sind aus dem Quelltext übernommen.
