# Umsetzungsplan FabCollectionTool 2.0.4.0

**Grundlage:** `docs/Feedback 2.0.3.0.md` (10 Punkte, 2 Recherche-Aufträge, 1 Erklärung) und
`docs/Screenshot 2.0.3.0 - 1.jpg`, Stand 2.0.3.0 (Commit 1a92502, Beispieldaten d597368)
**Stand:** 24. September 2026 · **Status:** umgesetzt, Abnahme siehe unten

## Kontext

2.0.3.0 ist angenommen. Das Feedback betrifft jetzt vor allem vier Bereiche:
- **Ansicht:** Spaltenreihenfolge, Standardspalten, ein einklappbarer Block mit den
  Rechenspalten, lesbare Überschriften, helles und dunkles Design.
- **Kartenbilder** an der Kartennummer.
- **Stammdaten aus wählbarem Branch:** Neue Sets wie „Usurp the Shadow Throne“ liegen zuerst
  in eigenen Branches des Datensatzes.
- **Kleinigkeiten:** Filter mit × löschen, und „ODS“ in den Texten ersetzen.

Dazu kommen zwei Recherchen, die als `.md` für die Planung von 2.0.5.0 bereitliegen sollen.
Die Regeln bleiben unverändert:
- klassische Skripte, kein Build-Schritt, lauffähig über `file://`
- höchstens 100 Zeichen pro Zeile, Code englisch, Doku deutsch
- das alte Tool bleibt unberührt
- Arbeitsdateien nie ins Repo

## Befunde der Vorrecherche

- **Branches:** Die GitHub-API liefert `develop` (Standard), `main` und
  `usurp-the-shadow-throne`. Ohne Anmeldung sind 60 Abfragen pro Stunde erlaubt, das reicht
  für eine Abfrage beim Öffnen der Auswahl.
- **Kartenbilder:** `card-printing.csv` enthält eine Spalte `Image URL`, gefüllt bei 16.682
  von 16.686 Zeilen, fast alle auf `legendstory-production-s3-public…/media/cards/large/<Name>.webp`.
  Von dort gibt es drei Größen:
  - `small`: 180×251 px, 11 KB
  - `normal`: 376×525 px, 35 KB
  - `large`: 546×762 px, 55 KB

  Bei 5.409 Druckvarianten unterscheidet sich das Bild je Foiling.
- **Mehrere Talente:** Es gibt 12 Karten mit zwei Talenten, z. B. Royal Draconic (5) oder
  Earth Ice / Ice Earth (je 2). Heute stehen beide zusammen in `Talent` („Ice Earth“).
- **Neue `example.ods`:** Der Selbsttest läuft mit ihr grün. Es sind 6.517 Zeilen, 363 von
  83.706 Zellen weichen ab, darunter 40 Playsets.

## Entscheidung (24.09.2026)

| Frage | Entscheidung |
|---|---|
| Neue Spaltenreihenfolge | **Tabelle und `collection.csv` gleich.** Die CSV ist bewusst zum Bearbeiten in externen Tools gedacht und hat deshalb exakt die Reihenfolge der Tabelle (ohne die berechneten Spalten). Alte Dateien werden weiter über die Spaltennamen gelesen; beim ersten Speichern ändert sich die Spaltenfolge der Datei. |

## Arbeitspakete

### 1. Version und Spalten (Feedback 2, 4, 5, 6)
- `VERSION`, `FCT.VERSION` → `2.0.4.0`.
- **Eine Reihenfolge für Tabelle und Datei:** `model.COLUMNS` wird umgestellt auf … Name,
  **Backside Name, Translated Name**, Translated Backside Name, Peculiarity, Art Treatment,
  **Pitch, Playset**, ST, RF, CF, GF, Note, Overrides. `buildColumns` baut die Tabelle
  weiter aus `model.COLUMNS` (Rechenspalten hinter GF), so bleiben beide automatisch gleich.
  Alte Dateien werden weiter über die Spaltennamen gelesen, und Zusatzspalten stehen weiter
  am Ende. Beim ersten Speichern schreibt die App die neue Reihenfolge; ein Hinweis beim
  Laden einer Datei in alter Reihenfolge sagt das an. Der Selbsttest prüft, dass Tabelle und
  Datei dieselbe Reihenfolge haben.
- **Art Treatment** ist in `DEFAULT_COLUMNS` enthalten. Gemerkte Spaltenauswahlen bekommen es
  einmalig dazu (Merkmal in den Einstellungen), damit die Änderung auch bei dir ankommt.
- **Have (this)** entfällt ganz, als Spalte und in der Auswahl „Spalten“. `_calc.have`
  bleibt intern für die Summen.

### 2. Einklappbarer Rechenblock, lesbare Überschriften (Feedback 8)
- Die Spalten Have (set) … Left (total) bilden eine **Spaltengruppe**. Ihre Überschrift hat
  einen Knopf ◂, der den Block auf eine schmale Spalte „Σ ▸“ zusammenklappt; ein Klick darauf
  klappt ihn wieder auf. Der Zustand wird gemerkt (`calcCollapsed`). Umsetzung in `grid.js`:
  Spalten bekommen `group: 'calc'`, `visibleColumns()` ersetzt eine eingeklappte Gruppe durch
  eine Platzhalterspalte. Zellcursor, Tab und Scrollen gehen über die Platzhalterspalte
  hinweg.
- **Überschriften nie gekürzt:** Die Kopfzeile darf zwei Zeilen haben, z. B. „Have“ über
  „(set)“. Die übrigen Spalten bleiben einzeilig. Die Filterzeile klebt unter der tatsächlich
  gemessenen Höhe der Kopfzeile (CSS-Variable `--head-height`, gesetzt in `buildHeader`) statt
  unter `--row-height`. Spaltenbreiten werden so angepasst, dass jeder Titel ganz lesbar ist.
  Das virtuelle Scrollen nutzt schon heute die gemessene Kopfhöhe (`headHeight`).

### 3. Filter mit × löschen (Feedback 9)
- Jeder Textfilter mit Inhalt bekommt rechts im Feld ein **×**. Ein Klick darauf leert den
  Filter, und die Ansicht aktualisiert sich sofort.
- Aktive Häkchenfilter bekommen ebenfalls ein × neben dem Knopf „3 gewählt ▾“, das „Alle“
  wiederherstellt.
- Das Suchfeld oben bekommt ein eigenes × (einheitlich statt des browsereigenen Knopfs).
- Umsetzung in `grid.js/buildHeader` mit gemeinsamer Hilfsfunktion; Styles in `style.css`.

### 4. Kartenbilder an der Kartennummer (Feedback 3)
- **Stammdaten:** `reference-transform.js` liest `Image URL` (in `REQUIRED` für `printing`
  ergänzt). Je Druckvariante wird das Bild des einfachsten Foilings genommen, also
  dieselbe Regel wie bei der Rarity. `printings` bekommt ein 8. Feld, platzsparend
  abgelegt: Für das übliche Muster nur der Dateiname ohne Pfad (`1HP001`), sonst die volle
  URL. `reference/*.js` wird mit `tools/build-reference.mjs` neu erzeugt (gleicher Commit),
  und der Selbsttest „Transform = mitgeliefert“ bleibt.
- `FCT.reference.image(row, size)` liefert die Bild-URL einer Zeile. Die Druckvariante wird
  wie bei `expected()` bestimmt (Nummer, Edition, Art Treatment, Kartenseite nach Name).
  `size` ist `normal` (Vorschau) oder `large` (großes Fenster).
- **Erkennbar:** Die Id-Zelle bekommt ein kleines Bildsymbol und eine gepunktete
  Unterstreichung, der Mauszeiger wird zur Lupe. Das gilt nur, wenn ein Bild existiert.
- **Vorschau beim Überfahren:** Nach 300 ms erscheint ein schwebendes Fenster neben der
  Zelle. Es zeigt das `normal`-Bild, etwa 260 px breit, sodass der Kartentitel gut lesbar
  ist. Es bleibt im Fenster und verschwindet beim Verlassen der Zelle.
- **Großes Fenster beim Klick** auf das Bildsymbol oder die Id (außerhalb des
  Editiermodus): Es zeigt das `large`-Bild (546×762), bei kleinem Fenster auf dessen Höhe
  begrenzt, sodass auch der Kartentext lesbar ist. Darunter stehen Kartennummer, Name,
  Variante und Link „Bild in neuem Tab“. Es schließt mit Esc, einem Klick daneben oder ×.
  Im Editiermodus öffnet nur das Bildsymbol das Fenster; ein Klick auf die Id bearbeitet sie
  wie bisher.
- Ohne Internet oder bei fehlendem Bild erscheint „Kein Bild verfügbar“. Es entsteht kein
  Fehler, der Vorgang kommt nur ins Diagnose-Log.
- Neues Modul `app/card-image.js` (Vorschau und großes Fenster); `grid.js` bekommt dafür
  die Optionen `cellIcon(row, column)` und `onCellHover`.

### 5. Stammdaten aus wählbarem Branch (Feedback 1)
- Die Gruppe **Stammdaten** bekommt eine Auswahl „Branch“. Beim ersten Öffnen lädt sie die
  Branches über die GitHub-API; ohne Internet bietet sie `develop` und `main` an. Die Wahl
  wird gemerkt (`referenceBranch`), Standard ist `develop`.
- `reference-transform.js`: `sourceBase(branch)` statt der festen `SOURCE_BASE`.
  `reference-update.js/run(branch)` lädt die Dateien und den Commit dieses Branches.
  Nach einem Wechsel werden die Stammdaten sofort neu geladen; die Meldung nennt den Branch
  und die Zahl neuer Sets.
- Das Stammdaten-Abzeichen und *Info* zeigen den Branch. Ein anderer Branch als `develop`
  ist gelb markiert und erklärt: „Vorschau: Daten dieses Branches können sich noch ändern“.
- Die mitgelieferten Daten bleiben `develop`. Schlägt ein Branch fehl (z. B. inzwischen
  gelöscht), gelten die bisherigen Daten, und ein roter Hinweis bietet „zurück zu develop“ an.
- **Hinweis für die Doku:** Nimmt man Karten eines Vorschau-Sets auf und wechselt zurück
  zu `develop`, erscheinen sie als „? Kartennummer unbekannt“, bis das Set auch dort ist.
  Es geht nichts verloren.

### 6. Helles, dunkles und System-Design (Feedback 7)
- Die Gruppe Ansicht bekommt die Auswahl **„Design: System / Hell / Dunkel“**, gemerkt als
  `theme`.
- `style.css`: Die dunklen Farbwerte werden über `:root[data-theme="dark"]` gesetzt. Die
  Systemeinstellung wirkt nur noch als
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }`.
  `app.js/setTheme` setzt `data-theme` am `<html>`; bei „System“ wird das Attribut entfernt.
- Auch `doku.html` übernimmt das gewählte Design mit einem kleinen Skript, das die
  Einstellung liest.

### 7. „FabCollectionTool 1.0 Tabelle“ statt ODS (Feedback 10)
- Der Import-Knopf heißt weiter **ODS**. Alle anderen Texte sprechen von der
  „FabCollectionTool-1.0-Tabelle“ (bzw. „wie in der 1.0-Tabelle“):
  - Tooltips in `index.html` (Import, Gliederung)
  - `grid.js` (Autofilter-Tooltip)
  - `app.js` (Sets aufnehmen)
  - `tour.js` (3 Stellen)
  - `import-ods.js` (Berichtstitel und Fehlermeldungen)
  - `doku.html` (6 Stellen)
  - `README.md`
- Code-Bezeichner und Dateinamen (`import-ods.js`, `example.ods`) bleiben.

### 8. Recherche-Dokument (Konzeptarbeit 1 und 2)
- Neu: `docs/Recherche-Spalten-2.0.4.0.md` (deutsch), als Grundlage für das Feedback zu
  2.0.4.0.
- **Talent:**
  - Welche Karten mehrere Talente haben, mit Liste und Häufigkeit.
  - Wie sie heute dargestellt werden und was sich damit auf Gruppierung, Filter und
    Fabrary ändern würde.
  - Die Optionen: eine Spalte wie bisher, zwei Spalten Talent1/Talent2 wie bei Class, oder
    Häkchenfilter mit Mehrfachwerten.
  - Eine Empfehlung mit Aufwand.
- **Weitere Spalten:** Jede Spalte der Stammdaten wird bewertet, mit Beispielwerten,
  Füllgrad und Nutzen für die Sammlung. Dazu gehören:
  - Cost, Power, Defense, Health, Intelligence, Arcane
  - Card Keywords, Traits, Type Text, Functional Text
  - Legalitäten: Blitz, CC, Silver Age, Commoner, LL
  - Artists, Flavor Text, Expansion Slot, TCGPlayer ID, Erscheinungsdatum des Sets

  Am Ende steht ein Vorschlag, welche davon als ausblendbare Stammdatenspalten sinnvoll
  wären.
- Die Zahlen werden mit einem Auswertungsskript im Scratchpad erhoben. Das Skript kommt nicht
  ins Repo, die Ergebnisse stehen im Dokument.

### 9. Selbsttest, Doku, Abschluss
- Neue Prüfungen:
  - Bild-URL je Zeile, Stichproben für Edition, Art Treatment und doppelseitige Karten
  - Branch-URL-Bildung
  - Spaltenreihenfolge von Tabelle und CSV gleich; alte Datei mit alter Reihenfolge wird
    vollständig gelesen
  - `Have (this)` entfällt
  - Transform = mitgeliefert, jetzt mit Bildfeld
- `doku.html`: neue Abschnitte zu Kartenbildern, Branch-Auswahl und Design; Tabellen und
  Filter aktualisieren; Texte ohne „ODS“.
- `tour.js`: Schritt „Die Tabelle“ um die Kartenbilder ergänzen, Stammdaten-Schritt um den
  Branch ergänzen.
- `README.md`, `docs/Umsetzungsplan-2.0.4.0.md` mit Abweichungen und Abnahme.

## Betroffene Dateien

- `app/app.js`: Spalten, Design, Branch-Auswahl, Texte
- `app/grid.js`: Spaltengruppe, zweizeiliger Kopf, ×-Knöpfe, Zellsymbol und Hover
- neu `app/card-image.js`
- `app/model.js`: `reference.image`
- `app/reference-transform.js`, `app/reference-update.js`: Bild-URL, Branch
- `reference/*.js`: neu erzeugt
- `app/style.css`: Designs, Kopfzeile, ×, Vorschau
- `index.html`, `doku.html`, `app/tour.js`, `app/import-ods.js`
- `tools/selftest.mjs`, `tools/build-reference.mjs`, `tools/load-app.mjs`
- `README.md`, `VERSION`, `app/core.js`
- neu `docs/Recherche-Spalten-2.0.4.0.md`

## Reihenfolge

1 → 7 → 6 → 3 → 2 → 5 → 4 → 8 → 9. Erst die kleinen und risikoarmen Änderungen, dann
Kopfzeile und Spaltengruppe, danach die Stammdaten (Branch, Bildfeld mit Neuerzeugung),
zuletzt Recherche und Doku. Nach jedem Paket läuft der Selbsttest; Browser-Checks laufen
über einen lokalen Server mit `Cache-Control: no-store`.

## Prüfung

- `node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export Beispiel.csv"
  <Quellordner>` → alle Prüfungen grün, Zeilenlänge ≤ 100.
- Chrome (lokaler Server, eigener Bestand):
  - Spaltenreihenfolge (Pitch vor Playset, Backside vor Translated) in Tabelle und
    gespeicherter CSV gleich; Art Treatment sichtbar; Have (this) ist weg.
  - Rechenblock ein- und ausklappen, Zustand bleibt nach dem Neuladen; alle Überschriften
    ganz lesbar; Tastatur (Tab/Pfeile) über den eingeklappten Block.
  - × in Textfilter, Häkchenfilter und Suche.
  - Id überfahren zeigt die Vorschau mit lesbarem Titel; Klick öffnet das große Bild mit
    lesbarem Kartentext; im Editiermodus bearbeitet ein Klick die Id.
  - Branch `usurp-the-shadow-throne` wählen: Die neuen Sets erscheinen in „Sets aufnehmen …“;
    zurück zu `develop`.
  - Design Hell/Dunkel/System, auch in `doku.html`.
  - Keine „ODS“-Texte außer dem Import-Knopf; Konsole und Diagnose-Log ohne Fehler.
- Von Elmar über `file://`: Kartenbilder laden (externe Bilder über `file://`), Branch-Wechsel,
  Design.

---

## Abweichungen bei der Umsetzung (24.09.2026)

1. **Neue Sets beim Branch-Wechsel werden über die Drucke gezählt.** Die Set-Liste in
   `develop` kennt neue Sets oft schon, nur noch ohne Drucke. Die Meldung nennt deshalb Sets,
   die erst jetzt Drucke haben, und die Zahl zusätzlicher Drucke. Beispiel
   `usurp-the-shadow-throne`: 1 neues Set „Armory Deck - Malice (AMA)“ und +301 Drucke, der
   Rest verteilt sich auf bereits bekannte Sets.
2. **Überschriften passen die Spaltenbreite an** (Rückmeldung von Elmar: „Have (set)“ brach
   als „Hav|e“ um). Jede Spalte ist so breit wie nötig und so schmal wie möglich: mindestens
   ihre eingestellte Breite und breit genug für den Titel mit Sortierzeichen und dem
   Einklapp-Knopf. Die Breite wird im Browser gemessen. Die Titel der Rechenspalten bleiben
   einzeilig; andere Titel dürfen nur zwischen Wörtern umbrechen, nie mitten im Wort.
   Geprüft in allen drei Schriftgrößen: Kein Titel bricht, und die Kopfzeile hat wieder
   normale Höhe.
3. **Das Suchfeld** ist jetzt ein normales Textfeld mit eigenem ×, statt des browsereigenen
   Such-×. Sein Tooltip nennt die Platzhalter.
4. **Das Design** wird schon vor dem ersten Zeichnen gesetzt, per kleinem Skript im
   `<head>` von `index.html` und `doku.html`. So blitzt die Seite nicht kurz im falschen
   Design auf.
5. **Browser-Prüfung ohne Erweiterung:** Die Chrome-Erweiterung war nicht verbunden. Geprüft
   wurde deshalb mit Edge im Headless-Modus über das DevTools-Protokoll, mit einem Skript im
   Scratchpad, das nicht ins Repo kommt.
6. **Recherche-Ergebnis in Kürze** (`docs/Recherche-Spalten-2.0.4.0.md`):
   - 12 Karten haben zwei Talente, keine hat mehr. Empfohlen werden Talent1/Talent2 mit fester
     Reihenfolge.
   - Als weitere Spalten (nur anzeigen, ausblendbar) kommen in Frage: Cost, Power, Defense,
     Card Keywords, Artist, „Verboten in“ und Erscheinungsdatum. Der Kartentext soll
     durchsuchbar werden.

## Abnahme (24.09.2026)

| Prüfung | Ergebnis |
|---|---|
| Selbsttest `tools/selftest.mjs` mit Quellordner (28 Prüfungen, davon 3 neu: Spaltenreihenfolge, Kartenbilder, Branch-URL) | alle bestanden |
| Stammdaten neu erzeugt (gleicher Commit e56071b) | nur `printings.js` geändert (Bildfeld); Transform = mitgeliefert; 5.975 von 5.979 bekannten Zeilen der 1.0-Tabelle haben ein Bild |
| Browser (Edge headless über DevTools-Protokoll, lokaler Server, eigener Bestand) | Spaltenreihenfolge in Tabelle und `model.COLUMNS` gleich; keine Überschrift gekürzt; Rechenblock ein- und ausklappen, bleibt nach dem Neuladen; Tastatur (Ende, →, Tab) überspringt den eingeklappten Block; × löscht Text- und Häkchenfilter; Design Hell/Dunkel/System, auch in `doku.html`; Vorschau beim Überfahren (Bild 376×525, Titel lesbar); großes Bild (546×762, Kartentext lesbar), Esc schließt; im Editiermodus öffnet ein Klick auf die Id den Editor, das Symbol das Bild; Branch-Liste von GitHub (develop, main, usurp-the-shadow-throne), Wechsel und zurück; Tour findet alle Ziele; nur noch „ODS“ auf dem Import-Knopf; Konsole und Diagnose-Log ohne Fehler |
| In Chrome über `file://` (Kartenbilder, Branch-Wechsel, Design) | **von Hand zu prüfen** |
