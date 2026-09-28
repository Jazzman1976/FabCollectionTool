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

## Nachtrag: Pitch „4“ heißt „Purple“
Elmar hat angemerkt, dass die Filterliste „4“ statt „Purple“ zeigte. Mit dem neuesten Set gibt
es Karten mit lila Pitch-Balken, die für 4 Ressourcen pitchen.

- **Ursache:** Die Code-Tabelle `pitchCodes` in `reference/vocab.js` kannte nur 1–3. Unbekannte
  Codes der Stammdaten (the-fab-cube, `card.csv`) bleiben unverändert, deshalb kam „4“ in die
  Stammdaten und von dort in den Bestand. Fabrary und `vocab.pitches` nennen den Wert schon
  „Purple“.
- `reference/vocab.js`: Die Tabelle enthält jetzt `4: 'Purple'`. Die Stammdaten werden bei jedem
  Start online neu geladen und umgewandelt, deshalb wirkt das sofort.
- `app/model.js`: `upgradePitch`/`reportPitchUpgrade`. Beim Laden eines Bestands, aus der Datei
  oder aus der Kopie im Browser, wird „4“ zu „Purple“. Eine Info-Meldung weist darauf hin, und
  beim nächsten Speichern steht der neue Wert in der Datei. Dasselbe passiert beim Import einer
  1.0-Tabelle (`app/import-ods.js`).
- `tools/selftest.mjs`: Die neue Prüfung „Purple pitch“ ist grün.
- Chrome-Check: Die Filterliste zeigt jetzt Red, Yellow, Blue und Purple mit lila Punkt. Die
  beiden Zeilen sind „Soul of Existence“ (IAR000, IAR666), sie stehen jetzt auf „Purple“.

Andere Stellen mit Pitch-Codes gibt es nicht. Fabrary-Import und -Export und die 1.0-Tabelle
verwenden Namen. Der Cardmarket-Export (#7) übernimmt den Wert aus dem Bestand, also
„Purple“.
