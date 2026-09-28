# Umsetzungsplan Issue #4 – Pitch-Farben besser erkennbar machen

**Issue:** https://github.com/Jazzman1976/FabCollectionTool/issues/4
**Branch:** `feature/4-pitch-farben` (von `develop` d1d1a52) · **Stand:** 28. September 2026
**Status:** umgesetzt, PR nach `develop`

## Kontext
Bisher stand der Pitch einer Karte nur als Text in der Tabelle („Red“, „Yellow“, „Blue“). Im
Issue wird gewünscht, dass man die Pitch-Farbe auf einen Blick erkennt. Abgestimmt ist ein
**farbiger Punkt ● vor dem Text**. Der Text bleibt, damit Filter, Sortierung und Suche
unverändert funktionieren.

Das ist das erste Issue nach der neuen Arbeitsweise: Board-Spalte Approved = freigegeben,
ein `feature/`-Branch je Issue, PR nach `develop`, Test und Merge durch Elmar. Die
Versionsnummer wird erst im Release-Branch erhöht.

## Änderungen
- `app/grid.js`: Spalten können optional `valueClass(value)` haben. Die zurückgegebene Klasse
  kommt an die Zelle (`renderCell`) und wird an die Filterliste weitergereicht. Das Grid
  selbst kennt „Pitch“ nicht.
- `app/grid-filter.js`: Die Einträge der Filterliste bekommen dieselbe Klasse, also auch dort
  den farbigen Punkt.
- `app/app.js`: `PITCH_CLASSES`/`pitchClass` für Red, Yellow, Blue und Purple an der Spalte
  Pitch. Die Standardbreite der Spalte steigt von 4,5 auf 5,5 em, damit „Yellow“ mit Punkt
  passt.
- `app/style.css`: Farbtoken `--pitch-red/-yellow/-blue/-purple` für das helle und das dunkle
  Design (auch „System“). Der Punkt wird per `::before` gesetzt. Gelb ist im hellen Design
  abgedunkelt, damit es lesbar bleibt.
- `doku.html`: Die Spaltenbeschreibung Pitch erwähnt den Punkt.

## Abnahme
- Selbsttest (`node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export
  Beispiel.csv"`) ist grün, einschließlich Zeilenlänge ≤ 100.
- Chrome über localhost mit Bestand, geprüft:
  - Punkte im dunklen und hellen Design
  - Punkte in der Filterliste
  - Filter „nur Red“ zeigt 55 Zellen, alle „Red“ mit Punkt, auch bearbeitbare, geänderte
    Zellen („edit stale“)
  - keine Konsolenfehler

## Befund am Rande
In den Beispieldaten stehen zwei Zeilen mit Pitch „4“. Das ist ein Datenfehler und liegt
außerhalb dieses Issues. Diese Zellen bekommen keinen Punkt.
