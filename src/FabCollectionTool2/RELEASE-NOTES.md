# Release Notes FabCollectionTool 2

Versionsschema **Major.Minor.Release.Build**. Eine neue Version entsteht als Branch
`release/<Version>` von `develop`. Jede Erweiterung oder Korrektur auf dem Release-Branch erhöht
die dritte Stelle (z. B. 2.2.0.0 → 2.2.1.0). Nach dem Test wird der Branch nach `main`
gemergt (Veröffentlichung als GitHub Page, Tag) und danach zurück nach `develop`.

## 2.2.0.0 – 28.09.2026

### Neu
- **Export nach Cardmarket** (#7): Der Button *Export → Cardmarket* erzeugt eine Wants-Liste
  der Karten, die für ein Playset noch fehlen. Sie wird bei Cardmarket unter Wants → „Add Deck
  List“ eingefügt. Im Dialog wählbar:
  - ein Set oder mehrere Sets zusammen, jeweils mit Anzahl der fehlenden Karten
  - Seltenheiten
  - Menge: fehlend gesamt oder je Set
  - Setname und Edition am Zeilenende
  - nur die Zeilen der aktuellen Ansicht
  
  Das Format entspricht dem des ersten Tools. Karten mit gleichem Namen und Pitch zählen
  zusammen, auch mit CC Label. Den Pitch schreibt der Export nur bei Karten, die es in
  mehreren Pitches gibt.
- **Pitch-Farben** (#4): Ein farbiger Punkt vor Red, Yellow, Blue und Purple, in der Tabelle
  und in der Filterliste der Spalte, im hellen und im dunklen Design.

### Korrigiert
- **Pitch „4“ heißt „Purple“** (#4): Lila Karten des neuesten Sets kamen mit dem Wert „4“ in
  Stammdaten und Bestand. Bestände und 1.0-Tabellen mit „4“ werden beim Laden umgestellt, dazu
  erscheint eine Info-Meldung.

### Entwicklung
- Arbeit über das Projekt-Board: Issues auf *Approved* sind freigegeben. Jedes Issue bekommt
  einen eigenen `feature/`-Branch mit PR nach `develop`.
- Eine GitHub Action schließt beim Merge nach `develop` die Issues, die im PR in einer eigenen
  Zeile mit „Closes“ genannt sind. Das Board setzt sie dann auf *Done*.

## 2.1.0.0 – 25.09.2026
Erste öffentliche Version als GitHub Page (<https://jazzman1976.github.io/FabCollectionTool/>).
Unterstützt wird Chrome (und Edge), Firefox nicht mehr.
