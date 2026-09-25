# Umsetzungsplan FabCollectionTool 2.0.2.0

**Grundlage:** `docs/Feedback 2.0.1.0.md` (18 Punkte + Erklärung zu „Edition“), Stand 2.0.1.0
(Commit 6341521)
**Stand:** 23. September 2026 · **Status:** umgesetzt, Abnahme siehe unten

## Kontext

2.0.1.0 wurde als deutliche Verbesserung angenommen. Das Feedback zielt jetzt auf **Arbeiten wie
in der ODS**: Tastaturbedienung mit Zellcursor, automatisches Speichern, Auswahllisten statt
Tippen, Accordeon mit Gliederungsebenen, vollständige Sets ohne Lücken. Dazu kommt ein
nachvollziehbarer Umgang mit Stammdaten-Abweichungen **je Zeile** mit einer harten Zusage:
**Übernehmen von Stammdaten verändert nie die Sammlung.** Regeln unverändert: klassische
Skripte, kein Build, `file://`, 100 Zeichen, Code englisch / Doku deutsch, altes Tool
unberührt, nie Nutzerdaten im Repo.

## Entscheidungen (23.09.2026)

| Frage | Entscheidung |
|---|---|
| Automatisch speichern | **Ja, in die Datei.** Chrome/Edge schreiben nach jeder Änderung (kurz verzögert) Bestand und Protokoll. Firefox kann das technisch nicht: dort manuell, mit Hinweis. |
| Enter nach dem Tippen | **Nach unten** (wie LibreOffice-Standard); Tab nach rechts |
| Lücken in Sets | **Jede fehlende Druckvariante** — aber nur in Sets, die im Bestand vorkommen (sonst 85 neue Sets / 2.694 Zeilen, v. a. Blitz-/Armory-Decks) |
| Stammdaten übernehmen | **Je Karte** (Häkchen pro Zeile übernimmt alle ihre Abweichungen) |
| „Edition“ doppeldeutig | Keine Änderung am Datenmodell. Sprach-Editionen (EN, DE, …) gelten weiter als „keine Sammler-Edition“ (`model.fabraryEdition`). |

## Arbeitspakete

### 1. Version, Stammdaten um Erscheinungsdatum erweitern
- `VERSION`, `FCT.VERSION` → `2.0.2.0`.
- `reference-transform.js`: zusätzlich `set-printing.csv` lesen (`Set Unique ID`,
  `Initial Release Date`), frühestes Datum je Set; `sets` wird `[code, name, releaseDate]`.
  `FILES`/`REQUIRED` erweitern; `reference-update.js` lädt die vierte Datei mit.
- `FCT.reference.setDate(code)` in `model.js`.
- `reference/*.js` mit `tools/build-reference.mjs` neu erzeugen (Quelldateien von the-fab-cube
  in den Scratchpad laden, Commit-SHA/-Datum per GitHub-API); Selbsttest „Transform = shipped“.

### 2. Vollständige Sets statt „Alle Karten einblenden“ (Feedback 16)
- Checkbox „Alle Karten einblenden“ und `state.showReference` entfallen.
- `model.referenceRows` → `model.withGaps(collection)`: liefert die Bestandszeilen **plus**
  fehlende Druckvarianten, aber nur für Set-Codes (Id-Präfix), die im Bestand vorkommen.
  Jede Lücke wird **an ihrer Stelle** eingereiht (nach der letzten Bestandszeile desselben
  Codes mit Id ≤ ihrer Id, Logik aus `app.js/adoptReferenceRow`) statt unten angehängt.
- Abdeckung korrigieren: „Micro Text Box“ zählt wie „Extended Art“ (`vocab.fabraryTreatments`,
  betrifft 69 Zeilen, die fälschlich als fehlend erschienen).
- `Set` einer Lücke = der im Bestand für diesen Code übliche Set-Name (Mehrheit), damit sie in
  der eigenen Gruppe landet, nicht in einer mit dem Stammdaten-Namen.
- Darstellung: normale Schrift (nicht kursiv), Mengen leer, gedämpfte Farbe und Statuszeichen
  ○ „nicht im Bestand“ (siehe 5). Bearbeiten oder − / + übernimmt die Zeile wie bisher.
- Statuszeile: „6.517 Zeilen im Bestand · 2.910 fehlende Drucke“.

### 3. Accordeon: Gliederung, Sortierung, Aussehen (Feedback 1, 2, 17, 18)
- **Standard alles zugeklappt** (beide Ebenen).
- Gliederungsknöpfe wie in der ODS statt „Alle auf/zu“: **1** = nur Sets, **2** = Sets offen,
  Talent/Class zu, **3** = alles offen. Einzelgruppen weiter per Klick.
- Set-Reihenfolge: Auswahl **„nach Erscheinen“** (Standard) / **„alphabetisch“**, gemerkt.
  Code einer Gruppe = häufigster Id-Präfix ihrer Zeilen; Datum aus 1; ohne Datum ans Ende.
  Talent/Class-Gruppen bleiben in Datei-Reihenfolge.
- Titel **zentriert**, Sets als „Monarch (MON)“; Zähler dahinter gedämpft.
- Deutlicher: Ebene 1 kräftig getönt mit 2px-Akzentrand oben/unten, Ebene 2 heller, aber klar
  vom Raster abgesetzt, beide mit eigener Randfarbe (hell- und dunkel-Modus).

### 4. Tastaturbedienung wie in der ODS (Feedback 11–14)
- Das Raster wird fokussierbar und hat einen **Zellcursor** (aktive Zelle, deutlicher Rahmen).
  Klick setzt ihn. Tasten: Pfeile, Tab/Shift+Tab (am Zeilenende in die nächste Zeile),
  Pos1/Ende, Strg+Pos1/Strg+Ende, Bild↑/Bild↓. Der Cursor scrollt mit (vertikal über
  `scrollToRow`, horizontal über die Spaltenposition).
- **Tippen** einer Taste startet die Bearbeitung und ersetzt den Inhalt (Zahl direkt
  eintragen); **F2** bearbeitet mit bestehendem Inhalt; **Entf/Rück** leert die Zelle.
- Beim Bearbeiten: **Enter** übernimmt und geht nach unten, **Tab** nach rechts,
  Pfeil ↑/↓ übernimmt und geht hoch/runter, **Esc** verwirft; Verlassen übernimmt.
- **Shift+↑ / Shift+↓** auf Mengenzellen (ST/RF/CF/GF, Playset): +1 / −1, nie unter 0.
- **− / +** erscheinen nur noch in der aktiven Zelle (nicht mehr beim Überfahren).
- Auf Gruppenzeilen: Enter/Leertaste klappt, → öffnet, ← schließt.
- Tastenkürzel greifen nicht, solange der Fokus in Suchfeld, Filtern oder Dialogen liegt.

### 5. Abweichungen je Zeile sichtbar und übernehmbar (Feedback 4, 6, 9, 16)
- Neue schmale **Statusspalte** ganz links (sticky beim seitlichen Scrollen):
  **≠** (orange) = Zeile weicht von den Stammdaten ab, **✱** (violett) = lokal geändert,
  **○** = Druck noch nicht im Bestand, **?** = Kartennummer unbekannt. Tooltip listet genau,
  was abweicht („Rarity: Majestic → Marvel“). Klick öffnet den Zeilendialog.
- Abweichende Zellen sind **immer** gestrichelt unterstrichen (bisher nur im Editiermodus).
- Neuer Schnellfilter „Weicht von den Stammdaten ab“.
- Zeilendialog: zusätzlich Knopf „Stammdaten für diese Zeile übernehmen“.
- **„Übernehmen …“ je Karte:** Liste aller abweichenden Zeilen, nach Set gruppiert, je Zeile ein
  Häkchen und die Abweichungen als Text; „Alle“ / „Keine“. Übernimmt nur Zellen ohne Override.
- **Sammlung bleibt garantiert unverändert:** Übernehmen schreibt ausschließlich
  `model.REFERENCE_COLUMNS`. Zusätzlich wird vor und nach dem Übernehmen ein Fingerabdruck von
  Id, Edition, Art Treatment, Playset, ST, RF, CF, GF, Note und Zeilenzahl verglichen; bei
  Abweichung wird alles zurückgerollt und ein Fehler gemeldet. Selbsttest prüft das und dass
  der Fabrary-Export davor und danach identisch ist.

### 6. Auswahllisten im Editiermodus (Feedback 3)
- Spalten mit festen Werten bekommen statt Textfeld eine Auswahlliste (`<select>`, erster
  Eintrag leer; ein vorhandener unbekannter Wert bleibt als eigener Eintrag erhalten):
  Edition, Rarity, Pitch, Peculiarity, Art Treatment (`vocab`), Class1/Class2 (`classes`),
  Type1/Type2 (`cardTypes`), Talent, Sub1–3 und Set (vorhandene Werte aus Stammdaten und
  Bestand). Gilt im Raster und im Zeilendialog. Tastatur: Buchstaben springen, Enter übernimmt.
- Die Wertelisten baut `model.js` einmal je Stammdatenstand (`FCT.model.choices(column)`).

### 7. Automatisch speichern (Feedback 14)
- Chrome/Edge: Beim Öffnen wird direkt Schreibrecht angefragt (`requestPermission` im selben
  Klick). Nach jeder Änderung speichert die App nach 1,5 s Ruhe Bestand **und** Protokoll.
  Nach einem Import greift das ab dem ersten manuellen Speichern (dann ist die Datei bekannt).
- Protokolldatei: beim ersten Mal ein Knopf in der Statuszeile „Protokolldatei festlegen“ —
  der Browser verlangt für den Dateidialog einen Klick; bis dahin sammeln sich die Einträge.
- Statuszeile statt Meldungsflut: „automatisch gespeichert 18:44:05“ bzw. Fehler deutlich rot.
- Sicherheit: Der Dateiinhalt beim Öffnen wird im Speicher gehalten; nach dem ersten
  automatischen Speichern bietet eine Meldung „Stand beim Öffnen als Backup sichern“ an.
- Firefox: kein Autosave möglich; Hinweis in der Statuszeile, Strg+S wie bisher.
- „Speichern“ bleibt (erzwingt sofort bzw. „Speichern unter“ ohne Datei).

### 8. Fenster, Meldungen, Werkzeugleiste (Feedback 7, 10, 15)
- Alle Dialoge schließen bei Klick daneben (Klick auf den Hintergrund = Abbrechen) und mit Esc,
  wie das Spalten-Menü. Umsetzung zentral in `app.js/openDialog`.
- Meldungen und Protokoll haben **dieselbe feste Höhe** (unten 30 vh; seitlich volle Höhe).
- Werkzeuggruppen als umrandete Kästen (`<fieldset>` mit `<legend>` Bestand, Import, Export,
  Stammdaten, Ansicht, Gliederung), deutlicher Rahmen und Abstand.

### 9. Selbsttest, README, Doku
- Neue Prüfungen: Set-Daten vorhanden (Sets des Bestands ohne Datum werden genannt);
  Lückenfüllung (keine Lücke für vorhandene Variante, Micro Text Box = Extended Art, nur Sets
  des Bestands, Lücken stehen sortiert); Übernehmen ändert Mengen/Identität/Export nicht;
  Wertelisten enthalten alle Werte des ODS-Imports; Transform = mitgelieferte Daten.
- `README.md` (Tastatur, Autosave, Gliederung, Statusspalte, Übernehmen je Karte),
  `docs/Umsetzungsplan-2.0.2.0.md` mit Abnahme.

## Betroffene Dateien

`app/grid.js` (Zellcursor, Tastatur, Auswahllisten-Editor, Statusspalte, Gliederung,
Set-Sortierung, Aussehen der Gruppen), `app/app.js` (Autosave, Dialoge, Übernehmen je Karte,
Wegfall „Alle Karten“), `app/model.js` (`withGaps`, `choices`, `setDate`, Fingerabdruck),
`app/reference-transform.js`, `app/reference-update.js`, `app/storage.js` (Schreibrecht,
stilles Schreiben), `app/style.css`, `index.html`, `reference/*.js` (neu erzeugt),
`tools/build-reference.mjs`, `tools/selftest.mjs`, `README.md`, `VERSION`, `app/core.js`.
Falls `grid.js` zu groß wird: Tastatur/Editoren nach `app/grid-keys.js` auslagern.

## Reihenfolge

1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 → 9. Nach jedem Paket Selbsttest; Browser-Checks über einen
lokalen Server mit `Cache-Control: no-store`.

## Prüfung

- `node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export Beispiel.csv"
  <Quellordner>` → alle Prüfungen grün, Zeilenlänge ≤ 100.
- Chrome (lokaler Server) mit dem eigenen Bestand: Gruppen starten zu, Gliederung 1/2/3,
  Sortierung nach Datum/alphabetisch, zentrierte Titel mit Code; komplette Tastaturrunde
  (Pfeile, Tab, Tippen einer Zahl, Enter nach unten, Shift+↑/↓, Entf, F2, Esc, Gruppen per
  Tastatur); Auswahllisten im Editiermodus; Statusspalte + Tooltip; Übernehmen je Karte mit
  Summe der Mengen vorher = nachher; Dialoge schließen bei Klick daneben; gleiche Höhe von
  Meldungen/Protokoll; Konsole fehlerfrei.
- Von Elmar über `file://` in Chrome und Firefox: Autosave inkl. Protokolldatei (Chrome),
  Hinweis und Strg+S (Firefox).

---

## Abweichungen bei der Umsetzung (23.09.2026)

1. **Sets ohne Erscheinungsdatum stehen vorn**, nicht am Ende: Die Stammdaten kennen für die
   Promo-Sets (HER, LGS, GEM, FAB) kein Datum, und in der ODS standen die Promos oben. 2HP hat
   keine Stammdaten und steht deshalb ebenfalls vorn.
2. **Editiermodus-Knopf** sitzt in der Gruppe „Ansicht“; die zweite Werkzeugzeile hat die
   Gruppen „Filter“ und „Gliederung“.
3. **Zusätzliche Schnellfilter:** „Nur Bestand (ohne fehlende Drucke)“ und „Noch nicht im
   Bestand (○)“, weil die Sets jetzt immer vollständig sind.
4. **Zeilendialog:** zwei Knöpfe statt einem — „Abweichungen übernehmen“ (lokale Änderungen
   bleiben) und „Alles zurücksetzen“ (auch lokale Änderungen).
5. **Gruppentitel** werden im sichtbaren Ausschnitt zentriert, nicht über die ganze (breitere)
   Tabelle — sonst lägen sie bei schmalem Fenster außerhalb des Bildes.
6. **Übernehmen:** Die Schutzlogik (Fingerabdruck, Zurückrollen) steht in `model.takeOver`,
   damit der Selbsttest sie ohne Browser prüfen kann.
7. **Stammdaten neu erzeugt:** Der Datensatz stand noch auf demselben Commit (21.08.2026);
   dadurch hat sich nur `sets.js` geändert (Erscheinungsdatum als dritte Spalte).
8. **Erlaubnis fürs automatische Speichern erklärt** (Rückmeldung von Elmar am 23.09.2026):
   Die Browserfrage „Änderungen speichern?“ („Save changes?“) beim Öffnen war ohne Kontext
   verwirrend. Jetzt fragt die App beim ersten Öffnen selbst „Automatisch speichern?“, erklärt
   die folgende Browserfrage und merkt sich die Antwort (Ansichtseinstellung `autosave`).
   Bei gemerktem „Ja“ erklärt ein Hinweisbalken die Browserfrage, die nach jedem Öffnen wieder
   kommt. Umschalten jederzeit über *Automatisch speichern: an/aus* in der Statuszeile.
9. **Bestand sofort beim Start** (Wunsch und Entscheidung von Elmar am 23.09.2026): Die
   Anwendung hält eine **Kopie des Bestands im Browser** (IndexedDB), aktualisiert nach jedem
   Laden, Speichern und jeder Änderung, dazu in Chrome/Edge den Datei-Verweis und die
   Autosave-Entscheidung. Beim Start wird die Kopie sofort angezeigt. **Die Datei bleibt das
   Original:** Die App verbindet sich automatisch (wenn der Browser den Zugriff noch erlaubt)
   oder per Klick; ist die Datei außerhalb geändert worden, gilt sie — nur wenn die Kopie
   eigene ungespeicherte Änderungen hat, entscheidet der Nutzer. Das ersetzt die frühere
   Regel „kein Browser-Speicher für den Bestand“. Ein erster Ansatz (nur Datei-Verweis, Laden
   per Klick) reichte nicht: der Bestand war beim Neustart nicht direkt da.
   Die Autosave-Frage gilt **je Datei**: dieselbe Datei behält die Entscheidung, jeder
   andere Bestand fragt erneut.
10. **Scrollen repariert:** Die Zeilen waren 1 px niedriger als die Rasterlogik annahm
    (`box-sizing: border-box` in 2.0.1.0), der gezeichnete Ausschnitt verrutschte beim
    Scrollen gegen die Scrollposition. Jetzt ist jede Zeile exakt `--row-height` hoch (in allen
    drei Schriftgrößen gemessen); außerdem `overflow-anchor: none`, damit der Browser die
    Scrollposition nicht selbst korrigiert. Ohne Zellcursor beginnen Pfeiltasten/Bild↓ in der
    ersten sichtbaren Zeile statt am Tabellenanfang. Außerdem wurde das Raster bei jedem
    Scroll-Schritt komplett neu aufgebaut (~37 ms je Bild); jetzt nur noch, wenn der sichtbare
    Bereich den vorgezeichneten Puffer verlässt (Median 17 ms je Bild). Den von Elmar
    beschriebenen Rücksprung beim Scrollen konnte die Automatisierung nicht nachstellen
    (Mausrad, Scrollbalken, mit Zellcursor und Autosave) — **offen, bei Elmar zu prüfen**.
11. **Sortierung nach Kartennummer** (Screenshot `docs/screenshot 2.0.2.0 - 1.jpg`): Ohne
    gewählte Spalte waren die Zeilen in Datei-Reihenfolge; ein fehlender Druck wie AGB001
    landete dadurch hinter AGB028. Jetzt ist die Standardreihenfolge in den Gruppen die
    Kartennummer (aufsteigend); Zeilen ohne Kartennummer bleiben hinter ihrer Vorgängerzeile.
12. **Erlaubnis bei der ersten Änderung:** Nach dem Start aus der Kopie stand dauerhaft
    „wartet auf die Erlaubnis“, weil der Browser nur nach einem Klick fragen darf und es keinen
    gab. Ein automatisches Speichern beim Öffnen hilft nicht (ohne Klick schlägt es fehl).
    Jetzt fragt der Browser bei der ersten Änderung — innerhalb deren Klick/Tastendruck —; die
    App gleicht dabei die Datei ab und speichert dann automatisch. Der Knopf in der Statuszeile
    heißt in diesem Zustand „Automatisch speichern: jetzt erlauben“.
13. **Protokolldatei wird gemerkt:** Der Datei-Verweis der Protokolldatei steht mit im
    gemerkten Bestand (IndexedDB). Beim Öffnen desselben Bestands oder beim Start aus der Kopie
    wird er wiederverwendet, sobald der Browser den Zugriff erlaubt (Chrome fragt für
    Bestand und Protokoll gemeinsam). Nur wenn der Browser ablehnt, muss die Protokolldatei
    neu gewählt werden.
14. **Diagnose für „Allow on every visit“:** Beim Start meldet die App, welchen Zugriffsstatus
    Chrome für die Datei zurückgibt. Ob Chrome dauerhafte Rechte für Seiten unter `file://`
    behält, ist nicht dokumentiert — **offen, bei Elmar zu prüfen**.

## Abnahme (23.09.2026)

| Prüfung | Ergebnis |
|---|---|
| Selbsttest `tools/selftest.mjs` mit Quellordner (20 Prüfungen, davon 4 neu) | alle bestanden |
| Lückenfüllung eigener Bestand | 2.840 fehlende Drucke in den 29 Sets des Bestands (118 ms), keine falschen Lücken durch „Micro Text Box“ |
| Übernehmen ändert den Bestand nicht | Selbsttest: 353 Werte übernommen, Fingerabdruck und Fabrary-Export identisch; fehlerhafte Änderung wird erkannt und zurückgerollt |
| Browser (Chrome über lokalen Server, eigener Bestand) | Gruppen starten zu; Gliederung 1/2/3; Sets nach Datum/alphabetisch; Titel zentriert mit Code; Tastatur: Pfeile, Enter nach unten, Tab, Zahl tippen, Shift+↑/↓, Esc, Gruppen per Enter/→; Lückenzeile per Tippen übernommen; Auswahlliste im Editiermodus (Tippen springt); Statusspalte ≠ mit Tooltip; Schnellfilter „weicht ab“ (273 Zeilen); Übernehmen je Karte (4 Werte, 3 Karten); Dialog schließt bei Klick daneben; Meldungen und Protokoll gleich hoch; Autosave mit simulierter Datei (Status, Backup-Angebot, Knopf Protokolldatei); Konsole fehlerfrei |
| Autosave mit echter Datei und Schreib-Erlaubnis (Chrome/Edge), Protokolldatei | **von Hand zu prüfen** — Dateidialoge lassen sich nicht automatisieren |
| Browser über `file://` (Chrome **und** Firefox) | **von Hand zu prüfen** |
