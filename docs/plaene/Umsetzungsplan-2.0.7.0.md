# Umsetzungsplan FabCollectionTool 2.0.7.0

**Grundlage:** `docs/Feedback 2.0.6.3.md` (5 Feature-Wünsche), Stand 2.0.6.3 (Commit 111fe6c)
**Stand:** 25. September 2026 · **Status:** umgesetzt, von Elmar freigegeben

## Kontext
Elmar wünscht: einen Einrichtungs-Assistenten für Neulinge (zusätzlich zum Tutorial), dass die
Ansicht (aufgeklappte Gruppen, Position) über Sitzungen erhalten bleibt, einen eigenen,
abbrechbaren Backup-Dialog mit Dateiname, eine eigene ausblendbare Bild-Spalte und
„collection.csv“ als Standardnamen. Geklärt (25.09.2026): Beim allerersten Besuch ohne Bestand
kommt **zuerst der Assistent**, er bietet am Ende das Tutorial an; die Bild-Spalte steht
**direkt nach Id**, die Id-Zelle zeigt kein Symbol mehr.

Regeln wie bisher: klassische Skripte ohne Build, `file://`, ≤ 100 Zeichen/Zeile, Code englisch,
Doku deutsch, altes Tool unberührt, Arbeitsdateien nie ins Repo, Commit nur auf Zuruf. Der Plan
kommt nach Freigabe als `docs/Umsetzungsplan-2.0.7.0.md` ins Repo, das Feedback mit.

## Arbeitspakete

### 1. Version
`VERSION`, `FCT.VERSION` (`app/core.js`), `?v=2.0.7.0` in `index.html`/`doku.html`, `README.md`.

### 2. Standardname „collection.csv“ (Wunsch 5)
`app/app.js/suggestName` und `createCollectionFile` (Firefox-Zweig), Vorgabe im Neu-Dialog:
`collection.csv` statt `bestand.csv`. Liegt im Ordner schon eine `collection.csv`, schlägt der
Dialog `collection-2.csv` usw. vor (ein vorhandener Bestand wird nie überschrieben); der Name
bleibt änderbar.

### 3. Eigene Bild-Spalte (Wunsch 4)
- `app/app.js/buildColumns`: neue Anzeigespalte `_image` (kind `calc`, schmal ≈ 2,4 em) direkt
  nach Id, Beschriftung „Kartenbild“ in der Spaltenauswahl, im Kopf ein **Bild-Symbol in der
  Farbe des Titeltexts** (`currentColor`), Tooltip „Kartenbild: überfahren = Vorschau, Klick =
  groß“. Standard sichtbar (`DEFAULT_COLUMNS`), ausblendbar; einmaliges Merkmal
  `columns2070`, damit gemerkte Spaltenauswahlen sie einmal dazubekommen. Nie in
  `collection.csv`, kein Filter, nicht sortierbar.
- `app/grid.js`: neue Spalteneigenschaften `icon` (Kopf zeigt `icon(name)` statt Text; die
  Breitenmessung nimmt dann die Symbolbreite), `noFilter`, `noSort`. `imageColumn` wird
  `'_image'`: Die Zelle zeigt nur das Symbol, Überfahren = Vorschau, Klick = großes Bild
  (bestehende Logik in `renderCell`/Klick-Handler, `FCT.cardImage`).
- Id-Zelle wieder ohne Symbol: Klick auf die Id wählt nur aus bzw. bearbeitet im
  Editiermodus; `WIDTHS.Id` zurück auf 5,5 em. CSS `.grid td.has-image` passend auf die neue
  Spalte (Symbol zentriert).

### 4. Ansicht über Sitzungen merken (Wunsch 2)
- `app/grid.js`: neue Option `openState` (gemerkte Auf/Zu-Zustände `{ key: true/false }`,
  Startwert für `groupOpen`) und Rückmeldung `onOpenChange(states)` bei jedem Auf-/Zuklappen
  und bei Gliederung 1/2/3; neue Methoden `viewPosition()` → `{ key, offset, cursor }` (Zeile
  oben im sichtbaren Bereich, als Variantenschlüssel Id|Edition|Art Treatment bzw. Gruppen-
  schlüssel, plus Cursorzelle) und `restorePosition(position)` (scrollt dorthin, setzt den
  Cursor; fehlt die Zeile, bleibt die Ansicht oben).
- `app/app.js`: speichert beides verzögert (≈ 500 ms nach Scrollen/Klappen) in `settings`
  (`viewState`: `{ file, open, position }`), nur Ansicht, keine Bestandsdaten. Beim Start nach
  `restoreLast` bzw. beim Öffnen **derselben** Datei (gleicher Name) wird der Zustand
  angewandt; bei einem anderen Bestand beginnt die Ansicht wie bisher zugeklappt oben.
  Während Suche/Filter aktiv sind, wird nichts überschrieben (eigener Zustand `filterOpen`).

### 5. Backup-Dialog (Wunsch 3)
`app/app.js/backup` und `writeBackup`: eigener Dialog „Backup anlegen“ mit Feld **Dateiname**
(Vorgabe wie bisher `<bestand>-backup-JJJJMMTT-HHMMSS.csv`), Angabe des Orts (Arbeitsordner /
„Speichern unter“ / Download), Knöpfe „Abbrechen“ und „Backup anlegen“; Enter bestätigt.
`.csv` wird ergänzt; gibt es den Namen im Arbeitsordner schon, fragt der Dialog erneut
(kein Überschreiben). Auch „Stand beim Öffnen als Backup sichern“ (`offerOpenedBackup`) läuft
über diesen Dialog. Firefox: Download unter dem gewählten Namen.

### 6. Einrichtungs-Assistent (Wunsch 1)
- Neue Datei `app/onboarding.js` (`FCT.onboarding`), in `index.html` vor `app.js` geladen. Die
  Oberfläche nutzt die Dialoge der App; `app.js` übergibt die Aktionen
  (`ensureFolder`, `newCollection`, `addSets`, `importOds`, `importFabrary`, `open`, `save`,
  `startTour`, `openDialog`).
- Ablauf (jeder Schritt abbrechbar, Kopfzeile „Schritt n von m“):
  1. **Willkommen – wie möchtest du starten?** Neu anfangen · 1.0-Tabelle importieren ·
     Fabrary-Export importieren · Vorhandene collection.csv öffnen · Später.
  2. **Ablageort:** kurze Erklärung, dann der bestehende Arbeitsordner-Dialog
     (`ensureFolder`, Chrome/Edge; in Firefox ein Hinweis zu Downloads).
  3. je nach Wahl: Neu → Neu-Dialog (Name/Ort) und anschließend „Sets aufnehmen“; Import →
     Import mit Vorschau, danach Speichern; Öffnen → Öffnen-Dialog.
  4. **Fertig:** was jetzt zu tun ist (Mengen eintragen, + / −, automatisches Speichern) und
     Knopf „Tutorial starten“.
- Start: automatisch beim ersten Besuch, wenn **kein Bestand** da ist (keine Kopie im Browser,
  keine Zeilen) und `onboardingDone` nicht gesetzt ist; danach gesetzt, auch bei „Später“.
  Wer schon einen Bestand hat (z. B. Elmar), sieht ihn nicht von selbst; `onboardingDone`
  wird dann still gesetzt. Das Tutorial startet beim ersten Besuch erst nach dem Assistenten
  (bzw. über dessen Knopf).
- Wiederholbar über neuen Knopf **„Einrichtung“** in der Gruppe Hilfe (Tooltip „Assistent
  zum Einrichten eines Bestands“). Mit geöffnetem Bestand warnt Schritt 1, dass „Neu“,
  Import und Öffnen den aktuellen Bestand ersetzen (er bleibt als Datei erhalten).

### 7. Selbsttest, Doku, Abschluss
- `tools/selftest.mjs`: Namensvorschlag (collection.csv / collection-2.csv, falls als reine
  Funktion testbar), Spalte `_image` nicht in `model.COLUMNS`/`collection.csv`,
  `onboarding.js` in der Längenprüfung.
- `doku.html`: neuer Abschnitt „Einrichtungs-Assistent“, Backup-Dialog, Bild-Spalte (statt
  Symbol an der Id), gemerkte Ansicht; `tour.js`: Hinweis auf „Einrichtung“ im Hilfe-Schritt,
  Kartenbild-Text anpassen; `README.md`.

## Reihenfolge
1 → 2 → 3 → 5 → 4 → 6 → 7; nach jedem Paket Selbsttest.

## Kritische Dateien
`app/app.js` (suggestName, buildColumns, backup/writeBackup, offerOpenedBackup, init,
restoreLast), `app/grid.js` (Kopf-Symbol, noFilter/noSort, imageColumn, openState,
viewPosition/restorePosition), neu `app/onboarding.js`, `app/style.css`, `app/tour.js`,
`index.html`, `doku.html`, `README.md`, `tools/selftest.mjs`, Versionsdateien.

## Prüfung
- `node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export Beispiel.csv"`
  → alle grün, Zeilen ≤ 100.
- Chrome über `localhost` (no-store): Neu-Dialog schlägt `collection.csv` vor; Bild-Spalte nach
  Id mit Symbol im Kopf (Titelfarbe, hell/dunkel), Vorschau/Klick funktionieren, ausblendbar,
  Id ohne Symbol; Gruppen aufklappen, scrollen, Cursor setzen, neu laden → gleiche Ansicht;
  Backup-Dialog: Abbrechen legt nichts an, Name wird übernommen; Assistent in frischem Profil
  (IndexedDB/localStorage der Test-Origin geleert) startet vor dem Tutorial, jeder Weg bis
  „Fertig“ durchspielbar, über „Einrichtung“ wiederholbar; keine Konsolenfehler.
- Von Elmar: Datei-/Ordnerdialoge des Browsers, Firefox, `file://`.

## Abweichungen und Befunde bei der Umsetzung
- **Paket 2:** Der Namensvorschlag ist eine reine Funktion `model.freeName` (auch vom
  Selbsttest geprüft).
- **Paket 4:** Die Ansicht wird **je Bestand** gemerkt (Einstellung `views`, die letzten zehn
  Dateinamen), damit ein Wechsel zwischen Beständen sie nicht überschreibt; angewandt beim
  Start und beim Öffnen. Auch eine Cursorbewegung speichert die Ansicht. Befund: Die ○-Zeilen
  werden bei jedem Neuaufbau (z. B. nach dem Laden der Online-Stammdaten) neu erzeugt, dadurch
  ging der Zellcursor auf ihnen verloren. `grid.keepCursor` findet Zeilen jetzt auch über
  ihren Schlüssel wieder – das hilft auch unabhängig vom Merken der Ansicht.
- **Paket 5:** `storage.backup` entfällt; der Dialog schreibt direkt (Arbeitsordner,
  „Speichern unter“ oder Download).
- **Paket 6:** Der Assistent speichert einen Import gleich (Speichern-Dialog), damit am Ende
  eine Datei da ist. Bricht man mittendrin ab, endet er ohne „Fertig“-Seite; beim ersten
  Besuch startet dann das Tutorial.

## Abnahme (25.09.2026)
- Selbsttest: **35 Prüfungen grün** (neu: „Names, picture column, assistant“), Zeilen ≤ 100.
- Chrome über `localhost` (no-store) mit der Testkopie: Bild-Spalte direkt nach Id, im Kopf ein
  Bild-Symbol in der Titelfarbe, Tooltip „Kartenbild: überfahren = Vorschau, Klick = groß“, in
  „Spalten“ als „Kartenbild“ ausblendbar; Id ohne Symbol. Gliederung 3, Scrollen auf 30.000 px
  und Cursor auf FAB238 „Big Blue Sky“ → nach Neuladen gleiche Position und Cursor, auch nachdem
  die Online-Stammdaten die Tabelle neu aufgebaut haben. Backup-Dialog mit vorgeschlagenem Namen
  `collection-backup-…csv`, Fokus im Feld, Abbrechen ohne Wirkung. Neu-Dialog schlägt
  `collection.csv` vor. Bestehender Bestand → kein Assistent, `onboardingDone` gesetzt.
- Origin ohne Bestand (`127.0.0.1`): Assistent startet vor dem Tutorial, Schritt 1 → „Neu
  anfangen“ → Schritt 2 → Arbeitsordner-Dialog → Neu-Dialog (`collection.csv`); Abbrechen
  beendet den Assistenten, danach startet das Tutorial. Keine Konsolenfehler.
- Nicht automatisch prüfbar: die nativen Datei-/Ordnerdialoge (Anlegen, Import-Dateiwahl,
  Speichern), Firefox, `file://`.
