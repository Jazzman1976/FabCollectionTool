# Umsetzungsplan Issue #17 – Fabrary-Export nur aus the-fab-cube, fehlende Karten mit 0

**Issue:** https://github.com/Jazzman1976/FabCollectionTool/issues/17
**Branch:** `feature/17-fabrary-export-thefabcube` · **Stand:** 28. September 2026
**Status:** Plan, Ready

## Kontext
Heute kopiert der Fabrary-Export das mitgelieferte Skelett (`reference/fabrary-skeleton.js`,
16.571 Zeilen aus einem Fabrary-Export) und trägt nur die Mengen ein. Zeilen ohne Bestand
bekommen bei *Have* ein leeres Feld. Varianten, die das Skelett nicht kennt, werden
übersprungen.

Abgestimmt mit Elmar:
- **the-fab-cube ist die Quelle der Wahrheit.** Das Skelett und damit der Fabrary-Export als
  Eingabe des Build-Skripts entfallen.
- **Have ist nie leer.** Fehlende Karten bekommen `0`, nur so zeigt Fabrary sie als fehlend an.
  *Extra for trade* ebenso.
- **Nur Varianten, die es gibt,** mit genau den Foilings, die the-fab-cube kennt. **Alle Sets.**
- **Benennung wie im 1.0-Tool** (`FabraryDto.cs`). Damit hat der Import immer funktioniert,
  obwohl `docs/1.0 fabrary.csv` nur in rund 9.300 von 16.571 Zeilen mit Fabrarys eigenem
  Export übereinstimmt. Fabrary ist beim Import also tolerant.

## Zeilen des Exports
Eine Zeile je Variante der gerade geltenden Stammdaten (online oder mitgeliefert) und je
Foiling dieser Variante, sortiert nach Identifier, Set number, Edition, Foiling wie bisher.
Das sind heute rund 16.600 Zeilen.

| Spalte | Wert |
|---|---|
| Identifier | wie 1.0: Name + Leerzeichen + Pitch, ohne Akzente, doppelte Leerzeichen und Sonderzeichen, Leerzeichen und `\|` als `-`, klein geschrieben |
| Name | Kartenname von the-fab-cube, doppelseitige Karten als `Vorderseite // Rückseite` |
| Pitch | Red, Yellow, Blue, Purple oder leer |
| Set | Setname von the-fab-cube |
| Set number | Kartennummer, z. B. `MST131` |
| Edition | Alpha, First, Unlimited oder leer |
| Foiling | leer (Standard), Rainbow, Cold, Gold |
| Treatment | siehe unten |
| Have | Summe aller Bestandszeilen dieser Variante in diesem Foiling, sonst `0` |
| Want in trade, Want to buy, Extra to sell | leer, wie bisher |
| Extra for trade | nach den Regeln des alten Tools wie bisher, sonst `0` |

**Treatment:** Fabrary kennt nur einen Wert, the-fab-cube teilweise mehrere. Der Abgleich mit
Fabrarys Export ergibt eine klare Rangfolge: **Alternate Art vor Alternate Border vor Alternate
Text vor Full Art vor Extended Art**. Beispiele: „Alternate Art, Extended Art“ → Alternate Art
(46 von 46), „Alternate Border, Extended Art“ → Alternate Border (28 von 30), „Alternate Art,
Full Art“ → Alternate Art (24 von 33). Micro Text Box wird zu Extended Art. Die Ausnahme
`fabraryExtendedArtAsNormal` (ROS002, ROS008) bleibt.

**Bestand → Zeile:** Sprach-Editionen (EN, DE …) zählen zur Zeile ohne Edition wie bisher
(`model.fabraryEdition`). Bestandszeilen, deren Variante oder Foiling die Stammdaten nicht
kennen, werden übersprungen und mit Menge im Bericht genannt. Der Name entscheidet wie bisher,
wenn sich mehrere Karten eine Kartennummer teilen.

## Änderungen
- `app/export-fabrary.js`: Zeilen aus `FCT.reference` statt aus dem Skelett bauen, *Have* und
  *Extra for trade* immer mit Zahl, Kopfzeile als Konstante (bisher `info.fabraryHeader`),
  Quote-Stil wie bisher (erste fünf Spalten in Anführungszeichen, LF). Bericht: Zeilen gesamt,
  mit Menge > 0, übersprungene Bestandszeilen.
- `reference/fabrary-skeleton.js` löschen; `index.html` und `tools/load-app.mjs` ohne das
  Skript; `?v=` bleibt unverändert (Version nur auf dem Release-Branch).
- `tools/build-reference.mjs`: ohne Fabrary-Export (`<Quellordner> [Commit] [Datum]`),
  `info.js` ohne `fabraryHeader`.
- `tools/selftest.mjs`: Aufruf ohne Fabrary-Export als Pflicht für das Skelett. Neue Prüfungen
  statt der Skelett-Vergleiche:
  - jede Variante × Foiling der Stammdaten genau einmal, keine anderen
  - *Have* und *Extra for trade* nie leer
  - Identifier-Regel an Beispielen (Pitch, Akzente, `//`, Sonderzeichen)
  - Treatment-Rangfolge an Beispielen
  - Mengen aus `docs/example.ods` kommen an; Rundlauf Import → Export → Import gleich
  - Vergleich mit `docs/Fabrary Export Beispiel.csv` als Info: wie viele Zeilen identisch
- `README.md` (Abschnitt Fabrary, Grenzen), `reference/README.md` (Tabelle, Erneuern ohne
  Fabrary-Export), `doku.html` (Abschnitt Fabrary), Release-Ablauf in `RELEASE-NOTES.md`:
  vor jedem Release Stand mit the-fab-cube `develop` vergleichen und bei Bedarf erneuern.

## Abnahme
- Selbsttest grün.
- Chrome über localhost: Export mit Bestand, Datei stichprobenartig prüfen (Kopfzeile, `0` bei
  fehlenden Karten, Mengen vorhandener Karten, keine erfundenen Foilings), Bericht in den
  Meldungen, keine Konsolenfehler.
- **Elmar** importiert die Datei in Fabrary: Fehlende Karten erscheinen als fehlend, vorhandene
  mit der richtigen Menge.
