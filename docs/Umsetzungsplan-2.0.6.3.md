# Umsetzungsplan FabCollectionTool 2.0.6.3: Unterschied der ○-Zeilen sichtbar machen

**Grundlage:** Frage von Elmar (25.09.2026) zu doppelten Varianten in WTR, Stand 2.0.6.2
(Commit 7f89df5).
**Stand:** 25. September 2026 · **Status:** umgesetzt, von Elmar getestet

## Kontext und Befund (kein Bug)
WTR steht in den Stammdaten in **zwei Editionen**: Alpha und Unlimited (je 226 Karten, dazu
WTR-Alpha-Alternate-Art). Elmars 228 WTR-Zeilen sind alle „Unlimited“, deshalb zeigt die App
227 ○-Zeilen mit Edition „Alpha“ (z. B. WTR000 Alpha, laut Stammdaten nur als Cold Foil). Der
Unterschied steht nur in der Spalte Edition und fällt leicht nicht auf – besonders wenn die
unterscheidende Spalte ausgeblendet ist. Ziel: Man sieht sofort, worin sich eine ○-Zeile von
den eigenen Zeilen unterscheidet, welche Printings es von ihr gibt, und wer eine Edition nicht
sammelt, kann deren ○-Zeilen ausblenden. Elmar hat alle drei Teile gewählt.

## Arbeitspakete

### 1. Version
`VERSION`, `FCT.VERSION` (`app/core.js`), `?v=2.0.6.3` in `index.html`/`doku.html`, Titel
`README.md`.

### 2. Unterschied markieren
- `app/app.js/rebuild`: Zeilen des Bestands je Kartennummer merken (`state.rowsById`, Map
  Id → Zeilen), damit Markierung und Tooltip ohne Suche auskommen.
- Neue Funktion `variantDiff(row)` (app.js): Für eine ○-Zeile die Bestandszeilen derselben Id;
  verglichen werden Edition, Art Treatment, Rarity, Name, Backside Name, Pitch. Eine Spalte
  gilt als Unterschied, wenn **keine** Bestandszeile dieser Id denselben Wert hat. Ergebnis:
  `[{ column, value, own: [Werte im Bestand] }]`, oder `null`, wenn die Karte gar nicht im
  Bestand ist.
- `rowMarks` (app.js, heute `if (row._reference) return marks;`): ○-Zeilen bekommen für jede
  unterscheidende Spalte `{ className: 'variant-diff', title: 'Unterschied zu deinen Zeilen
  WTR000: bei dir „Unlimited“' }`.
- `app/style.css`: `.grid tr.ref td.variant-diff` fett in Akzentfarbe (gegen das Grau der
  ○-Zeile), im hellen und dunklen Design lesbar.
- `rowStatus` für ○-Zeilen: Tooltip nennt den Unterschied auch bei ausgeblendeter Spalte, z. B.
  „Noch nicht im Bestand. Unterschied zu deinen Zeilen dieser Karte: Edition „Alpha“ (bei dir
  „Unlimited“). Printings laut Stammdaten: CF.“ Karte gar nicht im Bestand → „Diese Karte hast
  du noch in keiner Variante.“

### 3. Vorhandene Foilings zeigen
- `app/model.js/FCT.reference`: neue Funktion `foilings(row)` → Menge der Mengenspalten, die es
  von genau dieser Variante gibt (Foilings-Buchstaben `S R C G` → ST, RF, CF, GF, siehe
  `reference-transform.js` `FOILING_ORDER`), oder `null`, wenn die Variante nicht eindeutig in
  den Stammdaten steht (dann keine Markierung – z. B. Sprach-Editionen, die auf eine andere
  Variante zurückfallen).
- `rowMarks`: Mengenzellen eines nicht vorhandenen Foilings bekommen `no-printing` (gedimmt,
  Tooltip „Diese Variante gibt es laut Stammdaten nicht als Rainbow Foil“). Gilt für alle
  Zeilen, nicht nur ○. Steht dort trotzdem eine Menge > 0, wird die Zelle zusätzlich als
  Hinweis markiert (Tooltip „… trotzdem eingetragen – im Editiermodus prüfen“).
- **Gesperrt (Ergänzung Elmar, 25.09.2026):** Solche Zellen sind außerhalb des Editiermodus
  deaktiviert: `model.isEditable` liefert für sie `false` (neue Hilfsfunktion
  `model.noPrinting(row, column)`). Im Editiermodus sind sie normal bearbeitbar.
  **Geändert nach Elmars Test:** Zuerst übersprang der Zellcursor diese Zellen (Grid-Option
  `isBlocked`) und ein Klick wählte sie nicht aus. Da man beim diagonalen Navigieren über sie
  hinweg muss, sind sie wieder normal erreichbar (Tastatur und Maus) – nur nicht bearbeitbar
  (kein Tippen, kein +/−, kein Entf, keine −/+-Knöpfe). `isBlocked` ist wieder entfernt.
- `style.css`: `.grid td.no-printing` mit gedämpftem Hintergrund/Schraffur, Cursor
  `not-allowed`.

### 4. Variantenspalten immer sichtbar (geändert nach Elmars Test, 25.09.2026)
Ursprünglich geplant und zunächst umgesetzt war ein Kontrollkästchen „○ nur Editionen mit
Bestand“ in der Gruppe Filter. Elmar fand den Platz dafür zu schade; stattdessen:
- Die Spalten einer Variante (`model.VARIANT_COLUMNS` = Id, Edition, Art Treatment, die
  Bestandteile von `variantKey`) sind immer sichtbar (`fixed`). In „Spalten“ sind sie angehakt
  und nicht abwählbar (Tooltip „Immer sichtbar – diese Spalte unterscheidet die Varianten“);
  eine gemerkte Auswahl ohne sie zeigt sie trotzdem; `grid.setColumnHidden` blendet sie nie aus.
- Wer eine Edition nicht sammelt, nutzt den normalen Häkchenfilter der Spalte Edition.
- Kontrollkästchen, Einstellung und die Option `withGaps(…, { ownEditions })` sind wieder
  entfernt.

### 5. Doku, Selbsttest, Abschluss
- `doku.html`: Abschnitt „Vollständige Sets“ um Editionen (Beispiel WTR Alpha/Unlimited),
  Unterschied-Markierung, gesperrte Foilings und die immer sichtbaren Variantenspalten
  ergänzen; Farben-Tabelle um die neuen Markierungen.
- `tools/selftest.mjs`: `reference.foilings` (WTR000 Alpha → nur CF), Sperre,
  `VARIANT_COLUMNS`.
- `docs/Umsetzungsplan-2.0.6.3.md` mit Befund und Abnahme. Commit/Push nur auf Zuruf.

## Kritische Dateien
`app/app.js` (rebuild, rowMarks, rowStatus, buildColumns, Spaltenauswahl), `app/model.js`
(reference.foilings, noPrinting, VARIANT_COLUMNS), `app/grid.js` (isBlocked, setColumnHidden),
`app/style.css`, `doku.html`, `tools/selftest.mjs`, Versionsdateien.

## Prüfung
- `node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export Beispiel.csv"`
  → alle grün, Zeilen ≤ 100.
- Chrome über `localhost` (no-store) mit der Testkopie: WTR aufklappen – ○-Zeilen zeigen
  „Alpha“ hervorgehoben, Tooltip an Zelle und ○ nennt „bei dir Unlimited“ und die Printings;
  bei WTR000 Alpha sind ST/RF/GF gedimmt, CF nicht; Id, Edition, Art Treatment nicht
  ausblendbar; Häkchenfilter Edition ohne „Alpha“ blendet die Alpha-○ aus; Design hell/dunkel
  lesbar; keine Konsolenfehler.

## Befunde bei der Umsetzung
- In Elmars `collection.csv` (6.818 Zeilen) sind für 5.847 Zeilen die Foilings eindeutig
  bekannt; 13.140 Mengenzellen werden gesperrt. In **12** davon steht trotzdem eine Menge
  (z. B. EVO038–EVO041 ST=3, HVY006 EN RF=1, HNT010 EN CF=1, LGS227 ST=1). Sie sind orange
  umrandet und sollten im Editiermodus geprüft werden (Datenfehler im Bestand oder Lücke in den
  Stammdaten).
- Ohne die Alpha-Edition (Häkchenfilter) wären es in Elmars Bestand 2.081 statt 2.836 fehlende
  Varianten.


## Abnahme (25.09.2026)
- Selbsttest: **34 Prüfungen grün** (neu: „Variants: foilings and columns“ – WTR000 Alpha nur
  CF, Sprach-Edition ohne Aussage, Sperre nur außerhalb des Editiermodus, Variantenspalten);
  alle Zeilen ≤ 100.
- **Hervorhebung zurückgenommen (Elmars Wunsch nach dem Test):** Seit die Variantenspalten
  immer sichtbar sind, ist die fett-blaue Markierung unterscheidender Zellen in ○-Zeilen
  überflüssig. Geblieben sind der Tooltip an der Zelle und der Tooltip am ○.
- Chrome über `localhost` (no-store) mit der Testkopie: WTR000 Alpha zeigte „Alpha“ fett blau,
  Tooltips an Zelle und ○ („bei dir „Unlimited““, „Printings laut Stammdaten: CF“); ST/RF/GF
  der Alpha-Zeile und ST/CF/GF der Unlimited-Zeile schraffiert; Klick auf gesperrte Zelle ohne
  Wirkung, → springt von Playset über ST nach RF und weiter zu Have (set), ← zurück über ST nach
  Playset; im Editiermodus ist ST anklickbar; helles und dunkles Design lesbar; keine
  Konsolenfehler.
- Nach der Änderung (Variantenspalten fest): Kontrollkästchen entfernt; eine gemerkte
  Spaltenauswahl ohne Edition und Art Treatment zeigt beide trotzdem; in „Spalten“ sind Id,
  Edition, Art Treatment angehakt und deaktiviert; Häkchenfilter Edition ohne „Alpha“ → bei
  WTR000 nur noch die Unlimited-Zeile; keine Konsolenfehler. Die gemerkte Spaltenauswahl der
  Testkopie wurde danach wiederhergestellt.
- Offen bei Elmar: die 12 markierten Mengen prüfen, Blick auf die eigenen Sets.
