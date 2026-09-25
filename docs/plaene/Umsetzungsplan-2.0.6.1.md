# Fix FabCollectionTool 2.0.6.1: Bildsymbol in der Id-Zelle inline

**Grundlage:** `docs/Screenshot 2.0.6.0 - 1.jpg`, Stand 2.0.6.0 (Commit 10ea08e)
**Stand:** 25. September 2026 · **Status:** umgesetzt, Abnahme durch Elmar offen

## Kontext
In der Spalte Id rutschte das Bildsymbol (Kartenbild) unter die Kartennummer, statt daneben zu
stehen. Dadurch wurde jede Zeile mit Kartenbild unnötig hoch. Gewünscht: Symbol inline neben der
Id, Zeilen wieder einzeilig. Nur dieser Fix, versioniert als 2.0.6.1.

## Ursache
- `app/style.css`: `.grid td.has-image .card-icon` war `float: right` und steht im DOM **nach**
  dem Text (`app/grid.js`, renderCell). Passten Kartennummer und Symbol nicht in die
  Spaltenbreite (`WIDTHS.Id = 5.5` em), rückte das Float in die nächste Zeile; die
  Tabellenzelle wuchs mit (`height` ist bei Tabellenzellen nur eine Mindesthöhe). Ob es
  passt, hängt von der Schrift ab – bei Elmar passte es nicht.
- Nebenwirkung: Die virtuelle Liste rechnet mit fester Zeilenhöhe. Zu hohe Zeilen verschieben
  diese Rechnung – vermutlich die Ursache des Scrollproblems aus CR 2 (Feedback zu 2.0.5.0:
  nach unten scrollte die Liste nicht mit).

## Änderungen
1. `app/style.css`: `.grid td.has-image` bekommt `position: relative` und reserviert rechts
   Platz (`padding-right: calc(5px + 1.4em)`); das Symbol steht absolut rechts, vertikal
   zentriert. Zu langer Text wird mit „…“ gekürzt, die Zeile wächst nie.
2. `app/app.js`: `WIDTHS.Id` 5.5 → 6.5 em, damit Kartennummer und Symbol ganz zu sehen sind.
3. Version 2.0.6.1: `VERSION`, `FCT.VERSION`, `?v=2.0.6.1` in `index.html`/`doku.html`,
   `README.md`.

## Abnahme (25.09.2026)
- Selbsttest: alle 33 Prüfungen grün, alle Zeilen ≤ 100.
- Chrome über `localhost` (no-store): In Schrift klein/mittel/groß sind alle gerenderten Zeilen
  genau `--row-height` hoch (21/25/28 px), das Symbol liegt innerhalb der Zeile rechts neben
  der Id. Gegenprobe bei schmaler Spalte: mit dem alten CSS waren alle 57 sichtbaren Zeilen zu
  hoch, mit dem neuen keine. Klick aufs Symbol öffnet das Kartenbild; 60 × ↓ in ST – Zeile
  bleibt mittig.
- Offen bei Elmar: Blick mit der eigenen Schrift/Bildschirmskalierung (dort trat der Fehler
  auf) und ob das Scrollen nach unten jetzt auch ohne das Zentrieren stimmig ist.
