# Umsetzungsplan FabCollectionTool 2.0.1.0

**Grundlage:** `docs/Feedback 2.0.0.0.md` (18 Punkte), Stand 2.0.0.0 auf `feature/fabcollectiontool2`
**Stand:** 23. September 2026 · **Status:** umgesetzt, Abnahme siehe unten

## Kontext

2.0.0.0 ist funktional (Import, Export, Raster), aber im Alltag unruhig und umständlich: Raster
ruckelt, Schrift zu klein, keine Set-Navigation, Stammdaten-Stand unsichtbar, Zeilenaktionen
nur über die Werkzeugleiste, keine Nachvollziehbarkeit von Änderungen. 2.0.1.0 ist ein
Komfort-Update auf demselben Fundament — keine neue Architektur, gleiche Regeln (klassische
Skripte, kein Build, `file://`, 100 Zeichen, Code englisch / Doku deutsch, altes Tool unberührt,
nie Nutzerdaten im Repo).

## Getroffene Entscheidungen (23.09.2026)

| Frage | Entscheidung |
|---|---|
| Accordeon-Quelle | **Aus Spalten abgeleitet:** Ebene 1 = `Set`, Ebene 2 = `Talent` + `Class1` + `Class2` (leer → „Generic“) |
| Ansichtseinstellungen | **localStorage nur für Oberfläche** (Spalten, Schrift, Meldungsposition, Gruppierung); nie Bestandsdaten; bei Sperre still Standardwerte |
| Änderungsprotokoll | **Eigene Datei** `<bestand>-log.csv`, beim Speichern ergänzt; in der App als Liste sichtbar |
| „Stammdaten editierbar“ | **Abweichungen je Bestandszeile:** Stammdatenspalten normal gesperrt, im Editiermodus überschreibbar, markiert, zurücksetzbar; gespeichert in `collection.csv` |

## Arbeitspakete

### 1. Version und Einstellungen (Fundament)
- `VERSION` und `FCT.VERSION` in `app/core.js` → `2.0.1.0`.
- Neu `app/settings.js`: `FCT.settings.get(key, default)` / `set(key, value)` über
  `localStorage` mit Schlüsselpräfix `fct2.`, jeder Zugriff in `try/catch`. In `index.html` nach
  `core.js` laden. Gilt für: sichtbare Spalten + Spaltenbreiten, Schriftgröße, Meldungsposition,
  Gruppierung, Editiermodus aus/an wird **nicht** gespeichert.
- Umsetzungsplan 2.0.0.0 bleibt; im neuen Plan wird die Ausnahme „Browser-Speicher nur für
  Ansicht“ ausdrücklich dokumentiert.

### 2. Ruhiges Raster und Schriftgröße (Feedback 3, 4)
- Ursache des Ruckelns: `table-layout: fixed` greift nur mit gesetzter Tabellenbreite; ohne sie
  rechnet der Browser die Spalten je gerendertem Ausschnitt neu. `grid.js/buildHeader()` setzt
  künftig `table.style.width` = Summe der Spaltenbreiten.
- Breiten in `em` statt `px` (bestehende Pixelwerte aus `app.js/buildColumns()` ÷ 13), damit sie
  mit der Schrift skalieren.
- Schriftgröße S / M / L (12 / 14 / 16 px) als Umschalter in der Werkzeugleiste, gesetzt als
  CSS-Variable `--font-size` auf `:root`. `ROW_HEIGHT` in `grid.js` wird nicht mehr konstant,
  sondern aus `--row-height` (≈ 1,8 × Schrift) gelesen; nach Umschalten neu rendern. Die Filter-
  Zeile bekommt `top: var(--row-height)` statt `24px`.

### 3. Standardansicht und Spaltendialog (Feedback 6, 7)
- Standardspalten in dieser Reihenfolge:
  `Set | Edition | Id | Rarity | Talent | Class1 | Class2 | Type1 | Type2 | Sub1 | Sub2 | Sub3 |
  Name | Pitch | Playset | ST | RF | CF | GF | Have (set) | Need (set) | Left (set) |
  Have (total) | Need (total) | Left (total)`.
  Neue Rechenspalte `Have (set)` aus dem vorhandenen `_calc.haveSet`; die bisherige
  Zeilen-Spalte heißt `Have (this)` (wie in der ODS) und ist ausgeblendet. `buildColumns()` baut
  die Spaltenreihenfolge künftig aus einer Liste statt „nach GF einfügen“.
- Sichtbarkeit wird über `FCT.settings` gemerkt; im Dialog Knopf „Standard wiederherstellen“.
- Dialog schließt bei Klick außerhalb und mit Escape (`document`-Listener auf `click`/`keydown`,
  der `details.dropdown` schließt, wenn das Ziel nicht darin liegt).

### 4. Sichtbare Sortierbarkeit (Feedback 17)
- Jede Kopfzelle zeigt rechts ein dezentes `⇅`; aktiv `▲`/`▼` in Akzentfarbe. Hover hebt die
  Kopfzelle hervor. Umsetzung in `grid.js/buildHeader()` + CSS.

### 5. Editierbar vs. berechnet farblich (Feedback 10)
- Drei Zellarten mit klar unterscheidbarem Hintergrund (hell und dunkel):
  **editierbar** (Playset, ST/RF/CF/GF, Note; im Editiermodus zusätzlich alle übrigen Spalten) —
  weißer „Eingabefeld“-Hintergrund mit feinem Rahmen; **gesperrt** (Stammdaten) — neutral;
  **berechnet** (Have/Need/Left) — grau getönt, kursiv-freie Zahlen.
- Zeilenfarben „fehlt/überzählig“ wandern von der ganzen Zeile auf einen farbigen linken Rand
  bzw. die Rechenspalten, damit die Editierfarbe sichtbar bleibt.
- Spaltenmodell bekommt statt `editable: true` für alle eine Kategorie
  `kind: 'input' | 'reference' | 'identity' | 'calc'` (`model.js` definiert die Listen).

### 6. − / + an den Mengen (Feedback 11)
- In ST/RF/CF/GF (und Playset) je ein kleines `−` und `+` im Zellrand, sichtbar bei Hover und in
  der markierten Zeile; Platz ist immer reserviert (kein Springen). Nicht unter 0. Doppelklick
  zum Tippen bleibt. Jede Betätigung läuft über denselben `onEdit`-Weg (Rechnung, Dirty, Log).

### 7. Zeilenaktionen am Zeilenende (Feedback 13–16)
- Neue letzte Spalte „Aktionen“, `position: sticky; right: 0`, damit sie auch bei horizontalem
  Scrollen sichtbar bleibt. Icons als Inline-SVG (keine Abhängigkeit), mit `title`:
  ✎ Editieren · ＋ Zeile darunter einfügen · ⧉ Kopieren · 📋 Einfügen (darunter) · 🗑 Löschen.
- **Einfügen (+):** neue Zeile direkt unter dieser; übernimmt `Set`, `Talent`, `Class1`,
  `Class2`, `Playset` der Zeile, damit sie im selben Accordeon-Abschnitt landet; Rest leer.
- **Kopieren / Einfügen:** Kopie liegt in der App (kein System-Clipboard); Einfügen setzt sie
  unter der Zielzeile ein, **ohne Mengen** (wie bisher „Duplizieren“ — typischer Fall: andere
  Sprache/Behandlung). Einfügen-Icon nur aktiv, wenn etwas kopiert ist.
- **Löschen:** mit Rückfrage wie bisher.
- **Editieren:** öffnet einen Zeilendialog mit allen Feldern; je Stammdatenfeld wird der
  Stammdatenwert daneben gezeigt, mit „↺ zurücksetzen“ je Feld und „Alle zurücksetzen“.
- Referenzzeilen („Alle Karten einblenden“) zeigen nur ✎ und ＋ „in Bestand übernehmen“.
- Werkzeuggruppe „Zeile“ (Neu/Duplizieren/Löschen) und `addRow/duplicateRow/deleteRow` in
  `app.js` entfallen bzw. werden zu zeilenbezogenen Funktionen umgebaut.

### 8. Accordeon nach Set und Talent/Class (Feedback 5)
- `grid.js` bekommt einen Gruppierungsmodus: **Aus** / **Set** / **Set → Talent Class**
  (Standard), gemerkt in den Einstellungen.
- Gruppenkopfzeilen werden als eigene virtuelle Zeilen in `viewRows` eingefügt (gleiche feste
  Zeilenhöhe → virtuelles Scrollen bleibt unverändert schnell). Kopf zeigt ▸/▾, Name, Zeilenzahl
  und Summen (Have, fehlende Karten).
- Reihenfolge der Gruppen = erstes Vorkommen in der Datei (entspricht der ODS-Reihenfolge);
  Sortierung gilt **innerhalb** der Gruppen. Leere Talent/Class → „Generic“.
- Knöpfe „Alle auf“ / „Alle zu“. Bei aktiver Suche oder Filter werden Gruppen mit Treffern
  automatisch aufgeklappt; Gruppen ohne Treffer verschwinden.
- Klick auf einen Gruppenkopf klappt; der Auf/Zu-Zustand lebt nur in der Sitzung.

### 9. Stammdaten: Stand, Aktualisierung, lokale Abweichungen (Feedback 1, 2)
- **Sichtbarkeit:** neue Werkzeuggruppe „Stammdaten“ mit Statusanzeige (mitgeliefert / online,
  Commit-Datum, Ladezeit) und Knöpfen **„Aktualisieren“** (ruft `FCT.referenceUpdate.run()`
  erneut auf) und **„Info“** (Dialog: Quelle, Commit, Anzahl Sets/Karten/Drucke, letzter Fehler).
  Automatischer Start-Download bleibt.
- **Typzeile zerlegen:** `reference-transform.js` bzw. `FCT.reference` zerlegt `Types`
  („Light, Illusionist, Action, Attack“) in Talent / Class1 / Class2 / Type1 / Type2 / Sub1–3
  anhand neuer Listen `talents`, `classes`, `cardTypes` in `reference/vocab.js`. Keine Änderung
  am Format von `cards.js` nötig (Zerlegung zur Laufzeit).
- **Stammdatenwert je Zeile:** neue Funktion `FCT.reference.expected(row)` liefert für die
  Stammdatenspalten `Set, Rarity, Talent, Class1, Class2, Type1, Type2, Sub1, Sub2, Sub3, Name,
  Backside Name, Pitch` den erwarteten Wert (Druck über Id + Edition + Art Treatment, Kartenseite
  über den Namen). Zeilen ohne Stammdaten (z. B. 2HP) bleiben unberührt.
- **Neue Spalte `Overrides`** in `collection.csv` (Liste der lokal überschriebenen Spalten,
  `;`-getrennt). Ältere Dateien ohne die Spalte laden weiter (leer ergänzt).
- **Editiermodus** (Umschalter in der Werkzeugleiste, farbige Leiste „Editiermodus aktiv“):
  alle Spalten inline editierbar. Änderung an einer Stammdatenspalte → Spaltenname in
  `Overrides`. Zellen mit Override sind immer markiert (eigene Farbe + Ecke, Tooltip zeigt
  Stammdatenwert). Nur im Editiermodus zusätzlich markiert: Zellen, die ohne Override vom
  Stammdatenwert abweichen („veraltet/abweichend“).
- **Übernehmen:** Knopf „Stammdaten übernehmen …“ öffnet eine Vorschau (bestehender
  `preview`-Dialog) mit Anzahl Änderungen je Spalte und Häkchen je Spalte; übernimmt nur Zellen
  **ohne** Override. Damit lassen sich auch Fabrary-Importe (ohne Talent/Class) auffüllen.
- **Zurücksetzen:** im Zeilendialog je Feld / ganze Zeile; entfernt Override und setzt den
  Stammdatenwert.

### 10. Änderungsprotokoll (Feedback 12)
- Neu `app/changelog.js`: Einträge `{ time, action, id, name, column, old, new }` für Zellwert,
  − / +, Einfügen, Kopie einfügen, Löschen, Zurücksetzen, Stammdaten übernehmen (eine
  Sammelzeile je Spalte), Import (Sammelzeile), Referenzzeile übernommen.
- Anzeige: Meldungsbereich bekommt zwei Reiter **Meldungen | Protokoll** (neueste oben).
- Speichern schreibt zusätzlich `<bestand>-log.csv` (Spalten wie oben, RFC-4180 über `csv.js`):
  - Chrome/Edge: beim ersten Speichern der Sitzung `showSaveFilePicker` mit vorgeschlagenem
    Namen; vorhandener Inhalt wird gelesen und die neuen Einträge angehängt.
  - Firefox: Download `<bestand>-log-<zeitstempel>.csv` nur mit den neuen Einträgen.
  - Ungespeicherte Einträge zählen zu „ungespeicherte Änderungen“; nach dem Speichern als
    geschrieben markiert. Das Backup nimmt das Protokoll nicht mit.
- `.gitignore` deckt `*.csv` bereits ab.

### 11. Meldungen positionierbar (Feedback 18)
- Umschalter unten / links / rechts (gemerkt). `body` wird zu einem Raster; seitlich
  `width: clamp(16em, 22em, 30vw); min-width: min-content`, damit das längste Wort ohne Umbruch
  passt, der Bereich aber nicht ausufert. Volle Höhe zwischen Kopf und Statuszeile, eigenes
  Scrollen.

### 12. Selbsttest, README, Doku
- `tools/selftest.mjs` erweitern (reine Logik, ohne Browser):
  Typzeilen-Zerlegung an Beispielen (Light Illusionist, Generic Equipment, Ice Earth Guardian),
  `Overrides`-Round-Trip in `collection.csv`, altes CSV ohne `Overrides` lädt,
  `expected()` gegen ODS-Zeilen (Anzahl Abweichungen je Spalte ausgeben), Gruppierung
  (Gruppenzahl > 0, jede Zeile genau einer Gruppe), Protokoll-CSV Round-Trip.
- `README.md`: Editiermodus, Zeilenaktionen, Accordeon, Protokolldatei, Einstellungen im
  Browser (nur Ansicht), Stammdaten aktualisieren.
- `docs/Umsetzungsplan-2.0.1.0.md` mit Abnahmetabelle am Ende.

## Betroffene Dateien

`app/core.js`, `app/app.js` (größte Änderung), `app/grid.js` (Breite, Zeilenhöhe, Gruppen,
Aktionen, − / +, Zellarten), `app/model.js` (Spaltenkategorien, `Overrides`, `Have (set)`),
`app/reference-transform.js` bzw. `FCT.reference` in `model.js` (Typzeile, `expected`),
`app/reference-update.js` (erneut aufrufbar, Fehlerinfo), `app/style.css`, `index.html`,
`reference/vocab.js` (Talente, Klassen, Kartentypen), neu `app/settings.js`,
`app/changelog.js`; `tools/selftest.mjs`, `README.md`, `VERSION`.
Unverändert: alles unter `src/FabCollectionTool/`, `dist/`, Wurzel-`readme.md`/`.gitignore`.

## Reihenfolge

1 → 2 → 3 → 4 → 5 (Fundament der Darstellung) → 8 (Accordeon, braucht feste Zeilenhöhe) →
6 → 7 → 9 (braucht Zellarten und Zeilendialog) → 10 (braucht alle Änderungswege) → 11 → 12.
Nach jedem Paket Selbsttest und kurzer Browser-Check.

## Prüfung

- `node tools/selftest.mjs "../../docs/example.ods" "../../docs/Fabrary Export Beispiel.csv"`
  → alle Prüfungen grün, inkl. neuer Checks; Zeilenlänge ≤ 100.
- Browser über lokalen Server (Chrome, Automatisierung): Scrollen ohne Spaltenspringen,
  Schrift S/M/L, Spaltendialog schließt außen, Standardspalten, Accordeon auf/zu + Suche,
  − / +, Zeilenaktionen, Editiermodus + Override-Markierung + Zurücksetzen, Stammdaten
  aktualisieren/übernehmen, Protokoll-Reiter, Meldungen links/rechts; Konsole fehlerfrei.
- Von Elmar über `file://` in **Chrome und Firefox**: Einstellungen überleben Neuladen
  (localStorage), Speichern schreibt Bestand **und** Protokolldatei.
- `git status`: Änderungen nur unter `src/FabCollectionTool2/` und `docs/`.

---

## Abweichungen bei der Umsetzung (23.09.2026)

1. **Spaltenbreiten** werden nicht gespeichert: Es gibt (noch) keine Möglichkeit, Breiten per
   Maus zu ändern. Gespeichert werden sichtbare Spalten, Schriftgröße, Meldungsposition und
   Gruppierung.
2. **`Backside Name`** zählt nur als Abweichung, wenn die Stammdaten eine Rückseite kennen.
   Sonst hätte „Übernehmen“ ~190 Rückseitennamen aus der ODS geleert (z. B. doppelseitige
   Tokens, die the-fab-cube nur mit einer Seite führt).
3. **Neu eingefügte Zeilen bleiben sichtbar**, auch wenn eine Suche oder ein Filter sie sonst
   ausblenden würde — bis sich Suche oder Filter ändern. Ohne das verschwand eine mit ＋
   eingefügte leere Zeile sofort.
4. **Protokolldatei in Chrome/Edge:** Vor der Dateiauswahl erscheint ein kurzer Dialog. Er
   erklärt das Anhängen und liefert den Klick, den der Browser für den Dateidialog verlangt.
5. **Selbsttest:** Die Zeilenlängenprüfung berücksichtigt nur Quelldateien (`.js`, `.mjs`,
   `.html`, `.css`); eine im App-Ordner gespeicherte `collection.csv` ließ sie sonst scheitern.
6. **Abgleich ODS ↔ Stammdaten:** 0,5 % der Stammdatenzellen weichen ab (353 von 74.074), vor
   allem eigene Set-Namen, Sub-Typen und Rarity. „Set“ ist beim Übernehmen daher nicht
   vorausgewählt.

## Abnahme (23.09.2026)

| Prüfung | Ergebnis |
|---|---|
| Selbsttest `tools/selftest.mjs` (15 Prüfungen, davon 5 neu) | alle bestanden |
| Zeilenlänge ≤ 100 | bestanden |
| Browser (Chrome über lokalen Server), Bestand mit 6.517 Zeilen | Accordeon (31 Sets) auf/zu, Sortiermarker, Spaltenbreiten fix, − / +, Zeilenaktionen (Einfügen, Kopieren/Einfügen, Löschen, Bearbeiten-Dialog mit Zurücksetzen), Editiermodus mit Override-Markierung, Stammdaten online + Info + Übernehmen (287 Werte, jeder protokolliert), Schrift groß, Meldungen links/eingeklappt, Einstellungen nach Neuladen erhalten, Spaltendialog schließt bei Klick daneben; Konsole fehlerfrei |
| Speichern von Bestand **und** Protokolldatei | **von Hand zu prüfen** — Dateidialoge lassen sich nicht automatisieren |
| Browser über `file://` (Chrome **und** Firefox), inkl. localStorage | **von Hand zu prüfen** |
| Altbestand unverändert | `git status`: Änderungen nur unter `src/FabCollectionTool2/` und `docs/` |
