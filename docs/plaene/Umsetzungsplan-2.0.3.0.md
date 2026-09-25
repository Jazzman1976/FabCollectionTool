# Umsetzungsplan FabCollectionTool 2.0.3.0

**Grundlage:** `docs/Feedback 2.0.2.0.md` (12 Punkte), Stand 2.0.2.0 (Commit dc13cf4)
**Stand:** 24. September 2026 · **Status:** umgesetzt, Abnahme siehe unten

## Kontext

2.0.2.0 hat die Arbeit wie in der ODS eingeführt. Das Feedback betrifft jetzt vor allem vier
Dinge: **Bearbeiten direkt in der Tabelle** (der Editiermodus funktioniert mit der Maus nicht),
**Filtern wie in der ODS** (Häkchenlisten, Platzhalter, Filter auf den Status), **Sets selbst
aufnehmen** und **Nachvollziehbarkeit** (Protokoll über Sitzungen hinweg, Diagnose-Logging,
Tutorial und Dokumentation). Die Regeln bleiben unverändert: klassische Skripte, kein
Build-Schritt, `file://`, höchstens 100 Zeichen pro Zeile, Code englisch und Doku deutsch. Das
alte Tool bleibt unberührt, und Nutzerdaten kommen nie ins Repo.

## Befunde beim Review

- **Fehler im Editiermodus (Feedback 5):** Jeder Klick baut die sichtbaren Zeilen neu auf
  (`grid.js`: click → `setCursor` → `render`). Beim zweiten Klick eines Doppelklicks ist die
  angeklickte Zelle deshalb schon aus dem Dokument entfernt, und `dblclick` erreicht den
  `tbody` nie. Mit Tippen oder F2 funktioniert das Bearbeiten, per Maus nicht. Werte, die von
  den Stammdaten abweichen, sind schon heute erlaubt (sie werden als Override ✱ gespeichert).
  Das bleibt so.
- **„Gravy“ (Feedback 2):** Der Spaltenfilter sucht schon heute nach Textteilen, „Gravy“ passt
  also auf „Armory Deck - Gravy Bones“. Platzhalter und die Häkchenliste (Feedback 14) machen
  das künftig deutlicher.
- **Statusfilter (Feedback 13):** Es gibt schon den Schnellfilter „Weicht von den Stammdaten ab
  (≠)“, er versteckt sich aber im Auswahlfeld. Künftig bekommt die Statusspalte einen eigenen
  Filter (siehe 3).
- **Playset (Feedback 6):** Die heutige Ableitung (`model.defaultPlayset`) weicht bei 205 von
  6.520 Zeilen des eigenen Bestands ab, z. B. bei Legendary-Karten (1), Resources/Gems, Dolchen
  und Proto-Base-Ausrüstung. 539 Zeilen haben keine Stammdaten.

## Entscheidungen (24.09.2026)

| Frage | Entscheidung |
|---|---|
| Set ohne eigene Karte aufnehmen | **Alle Drucke als echte Zeilen** mit leeren Mengen (wie in der ODS). Später erscheinende Drucke des Sets tauchen automatisch als Lücken ○ auf. |
| Playset | **Wird zur Stammdatenspalte**, abgeleitet aus den Typen und dem Schlüsselwort Legendary und nur im Editiermodus änderbar. Werte in der Datei, die abweichen, bleiben als lokale Änderung ✱ erhalten. Die Zusage „Übernehmen ändert nie Playset“ entfällt. Mengen, Notiz, Id, Edition und Art Treatment bleiben geschützt. |
| Speicherort | **Arbeitsordner**, einmal gewählt (Chrome/Edge). Bestand, Protokoll und Diagnose-Logs liegen dort. Die Berechtigung gilt für den ganzen Ordner, Dateidialoge starten dort. Firefox speichert weiter als Download. |

## Arbeitspakete

### 1. Version, Logging-Grundlage (Feedback 9)
- `VERSION`, `FCT.VERSION` → `2.0.3.0`.
- Neues Modul `app/log.js` (`FCT.log.debug/info/warn/error(area, message, data)`). Es wird
  **zuerst** geladen, damit alle Module loggen können. Einträge landen in einem Ringpuffer im
  Speicher (max. 2.000). Außerdem fängt es `window.onerror` und `unhandledrejection` ab, und
  `guarded()` loggt Fehler mit Stack.
- Geloggt wird: Start (Version, Browser, `canWriteBack`), Öffnen/Speichern/Autosave (Dauer,
  Größe, Ergebnis), Zustände der Dateiberechtigungen, Import/Export (Zeilen, Dauer),
  Stammdaten-Update (Quelle, Commit, Dauer), Dialog-Ergebnisse, Fehler. Einzelne
  Zelländerungen stehen schon im Protokoll und werden nicht doppelt geloggt.
- **Begrenzt:** Im Arbeitsordner wird `fct-diagnose.log` alle 10 s gebündelt fortgeschrieben.
  Ab 512 KB wird die Datei zu `fct-diagnose.1.log` (die alte `.1` fällt weg), maximal also rund
  1 MB. Ohne Ordner (Firefox) gibt es nur den Ringpuffer plus IndexedDB (letzte 2.000
  Einträge). Dazu kommt ein Knopf **„Diagnose herunterladen“** (Menü „Hilfe“).

### 2. Bearbeiten in der Tabelle reparieren und erweitern (Feedback 5, 12)
- **Ursache beheben:** Klick auf die Zelle, die schon den Cursor hat, baut nicht neu auf. Der
  Doppelklick wird im `mousedown` über `event.detail >= 2` erkannt statt über `dblclick`.
- **Einfacher Klick auf die aktive Zelle** startet das Bearbeiten (wie in LibreOffice).
- Auswahllisten öffnen sich beim Start per Maus sofort (`select.showPicker()`, wo verfügbar).
- Die Auswahllisten enthalten nur gültige Werte (Vokabular + Stammdaten + Bestand, wie
  `model.choices`). Es gibt keinen Freitext für feste Werte. Abweichungen von den Stammdaten
  bleiben erlaubt und werden als ✱ markiert. Ganz oben in der Liste steht zusätzlich der
  Stammdatenwert als „Stammdaten: X“.
- **Abweichende Zellen (Feedback 12)** sind auch **außerhalb des Editiermodus** direkt
  bearbeitbar: `isEditable` liefert true, wenn die Zelle `stale`/`override` markiert ist.
  Die gestrichelte Unterstreichung wird zum Hinweis „hier klicken“ (Mauszeiger, Tooltip
  „Klicken zum Korrigieren“). Übernimmt man den Stammdatenwert, verschwinden Markierung und
  Override.
- Selbsttest-fähige Logik (welche Zelle bearbeitbar ist) wandert nach `model.js`.

### 3. Filter wie in der ODS (Feedback 2, 13, 14)
- **Häkchenfilter** für Spalten mit festen Werten (alle Spalten mit `model.choices`: Set,
  Edition, Rarity, Talent, Class1/2, Type1/2, Sub1–3, Pitch, Peculiarity, Art Treatment) und
  für die **Statusspalte**. Im Filterkopf steht dann ein Knopf („Alle“ / „3 von 12“) statt
  eines Textfelds. Das Panel zeigt die in der aktuellen Ansicht vorkommenden Werte mit
  Anzahl, außerdem „(leer)“, „Alle“ / „Keine“ und ein Suchfeld mit Platzhaltern. Es schließt
  bei Klick daneben und mit Esc (wie `details.dropdown`).
- Statusfilter-Werte: ≠ weicht ab, ✱ lokal geändert, ○ nicht im Bestand, ? unbekannte
  Kartennummer, „ohne Auffälligkeit“. Die Schnellfilter „differs“ und „gaps“ bleiben
  zusätzlich erhalten.
- **Platzhalter** in Textfiltern und in der Suche: `*` = beliebig viele, `?` = ein Zeichen.
  Ohne Platzhalter bleibt „enthält“. Mit Platzhalter muss der ganze Wert passen
  (`Gravy*` = beginnt mit), z. B. `*Gravy*`. `=`, `!` und `= leer` bleiben. Umsetzung in
  `grid.js/matchesFilter` (Muster → RegExp, vorher Sonderzeichen maskieren).
- „Filter zurücksetzen“ leert auch die Häkchenfilter. Aktive Filter werden im Spaltenkopf
  hervorgehoben.

### 4. Sets aufnehmen (Feedback 1)
- Neuer Knopf **„Sets aufnehmen …“** (Gruppe Bestand). Der Dialog listet alle Sets der
  Stammdaten, die **nicht** im Bestand vorkommen, mit Code, Name, Erscheinungsdatum und Zahl
  der Drucke. Sortiert ist nach Datum (neueste zuerst), es gibt ein Suchfeld mit Platzhaltern
  und Häkchen. Sets mit 0 Drucken erscheinen nicht.
- Übernommen werden **alle Drucke** der gewählten Sets als echte Zeilen mit leeren Mengen (wie
  Lückenzeilen: `model.referenceRows`-Logik, gefiltert auf die Codes; Playset aus 5). Sie werden
  nach Kartennummer an den Bestand angehängt. Ins Protokoll kommt je Set ein Eintrag
  „Set aufgenommen“ mit Zeilenzahl.
- Neue Funktion `model.addSets(collection, codes)` → Zeilen (im Selbsttest prüfbar).

### 5. Playset aus den Stammdaten (Feedback 6)
- `reference-transform.js`: zusätzlich die Spalte `Card Keywords` aus `card.csv` lesen.
  `cards` bekommt ein Kennzeichen `legendary`. `REQUIRED` wird erweitert, `reference/*.js` mit
  `tools/build-reference.mjs` neu erzeugt.
- `model.defaultPlayset` wird verbessert: Legendary → 1, die übrigen Regeln bleiben, dazu
  kommen Anpassungen aus dem Abgleich mit dem eigenen Bestand. Der Abgleich mit
  `app/collection.csv` wird vor und nach der Änderung ausgewertet, die verbleibenden
  Unterschiede stehen im Umsetzungsplan.
- `Playset` wandert von `INPUT_COLUMNS` nach `REFERENCE_COLUMNS`. `FCT.reference.expected`
  liefert `Playset`. Die Spalte ist nur im Editiermodus bzw. bei Abweichung bearbeitbar.
  **Übergang:** Beim Laden einer Datei ohne Playset-Override, deren Wert abweicht, wird
  `Playset` in `Overrides` eingetragen. So wird nichts stillschweigend geändert, die Zeile
  zeigt ✱, und der Statusfilter findet sie. Zeilen ohne Stammdaten behalten ihren Wert.
- Fingerabdruck und Hinweistexte in `model.takeOver` / `applyReference` werden angepasst
  (Playset nicht mehr geschützt). Der Selbsttest prüft: Übernehmen ändert Mengen, Notiz, Id,
  Edition, Art Treatment und den Fabrary-Export weiterhin nicht.

### 6. Arbeitsordner (Feedback 7)
- `storage.js`: `chooseFolder()` (`showDirectoryPicker`, readwrite). Der Ordner-Handle wird
  in IndexedDB gemerkt (eigener Schlüssel `folder`). Dazu kommen `folderFile(name, create)`,
  Lesen und Schreiben über den Ordner sowie die Prüfung, ob eine Datei im Ordner liegt
  (`resolve`).
- Ablauf: Beim ersten Speichern, Öffnen oder Import-Übernehmen fragt die App einmal nach dem
  Arbeitsordner (mit Erklärung). Danach gilt:
  - Bestand: `<name>.csv` im Ordner. „Öffnen“ und „Speichern unter“ starten dort (`startIn`).
  - Protokoll: immer `<name>-log.csv` daneben, **ohne eigene Dateiauswahl**. Der Knopf
    „Protokolldatei festlegen“ und der Protokoll-Dialog entfallen.
  - Diagnose-Logs: `fct-diagnose.log` im selben Ordner.
  - Backups: `<name>-backup-<zeit>.csv` direkt in den Ordner, ohne Dialog.
- Beim Start genügt eine Berechtigung für den Ordner statt je Datei (Banner und
  `askFileAccess` wirken dann auf den Ordner). Ein Bestand außerhalb des Ordners
  funktioniert weiter wie bisher (Datei-Handle), dann mit Hinweis.
- Statuszeile/„Bestand“: Ordnername anzeigen, dazu „Ordner ändern …“.
- Firefox: unverändert als Download, mit Hinweis in der Doku.

### 7. Protokoll: begrenzt, dauerhaft, hilfreich (Feedback 10)
- Die Protokolldatei behält **die letzten 1.000 Einträge**: Beim Schreiben wird sie aus dem
  bisherigen Inhalt plus den neuen Einträgen gebildet und auf 1.000 gekürzt (`makeText`).
- **Dauerhaft sichtbar:** Beim Öffnen/Verbinden liest die App die Protokolldatei ein. Ohne
  Ordner nutzt sie die Kopie in IndexedDB (letzte 1.000). Das Protokoll-Fenster zeigt also auch
  die Änderungen früherer Sitzungen, getrennt durch eine Datumszeile („heute“, „gestern“,
  Datum).
- Je Eintrag: **„Zur Zeile“** (springt über `grid.select` zur Zeile, Suche über Id/Variante)
  und **„Rückgängig“** bei Zelländerungen. Rückgängig setzt den alten Wert, wenn die Zelle
  noch den neuen Wert hat, und wird selbst protokolliert. Sonst erscheint der Hinweis
  „inzwischen geändert“.
- `changelog.js`: `load(records)`, `limit(1000)`. Neue Einträge bekommen eine eindeutige
  laufende Nummer.

### 8. Hinweisbereich (Feedback 11)
- `#banners` wird zum **einheitlichen Hinweisbereich** mit auffälliger Hinweisfarbe
  (gelb/bernstein, linker Akzentbalken, Symbol), hell und dunkel. Es gibt drei Stufen: Hinweis
  (gelb), Fehler (rot) und Erfolg (grün, blendet nach 5 s aus).
- Neue Funktion `notice(id, level, text, buttons)` / `clearNotice(id)` in `app.js`. Bestehende
  Banner (Wiederherstellen, Browsererlaubnis, Editiermodus) werden darauf umgestellt.
  Künftige Hinweise dieser Art (z. B. Autosave-Fehler, fehlender Ordner) gehen ebenfalls
  hierhin. Jeder Hinweis lässt sich schließen (×), sofern er keine Aktion verlangt.
- Das Meldungsfenster unten bleibt für Berichte (Import, Prüfung) bestehen.

### 9. Tutorial und Dokumentation (Feedback 8)
- **Tutorial** (`app/tour.js`): Beim ersten Besuch (Ansichtseinstellung `tourDone`) startet
  eine Schritt-für-Schritt-Tour. Ein Popup mit Pfeil liegt über dem hervorgehobenen Element,
  alles andere ist abgedunkelt. Es gibt die Knöpfe „Weiter“, „Zurück“ und „Beenden“ und
  „Schritt x von n“, dazu Esc zum Abbrechen. Etwa 10 Schritte: Bestand öffnen/Arbeitsordner,
  Tabelle und Zellcursor, Mengen eintragen (Tippen, Shift+↑/↓), Statusspalte, Filter
  (Häkchen), Gliederung, Stammdaten übernehmen, Sets aufnehmen, Protokoll, Hilfe.
  Wiederholbar über **„Hilfe“ → „Tutorial starten“**.
- **Dokumentation** `doku.html` (neben `index.html`, gleiche `style.css`, öffnet in neuem
  Tab): vollständig aus Sicht des Anwenders, mit Inhaltsverzeichnis. Kapitel: Erste Schritte,
  Arbeitsordner und Speichern (inkl. Autosave, Browserfragen, Firefox), Bestand und Spalten
  (jede Spalte erklärt), Bearbeiten und Tastatur (alle Tasten), Editiermodus und Abweichungen
  (≠ ✱ ○ ?), Filter/Suche/Platzhalter, Gliederung, Sets aufnehmen, Stammdaten (Herkunft,
  Aktualisieren, Übernehmen), Protokoll und Rückgängig, Import/Export ODS und Fabrary, Backup
  und Kopie im Browser, Diagnose, häufige Fragen.
- Neue Werkzeuggruppe **„Hilfe“**: Tutorial, Dokumentation, Diagnose herunterladen.

### 10. Selbsttest, README, Abschluss
- Neue Prüfungen in `tools/selftest.mjs`:
  - Platzhalter-Filter (`*Gravy*`, `Gravy*`, `?` und Sonderzeichen)
  - `model.addSets` (alle Drucke, keine Duplikate, leere Mengen)
  - Playset-Übergang (abweichende Werte werden Override, keine Werte ändern sich)
  - Übernehmen schützt Mengen und Identität weiterhin
  - Protokoll auf 1.000 gekürzt
  - Log-Rotation (Größengrenze, Logik als reine Funktion)
  - Bearbeitbarkeit abweichender Zellen
- `README.md` aktualisieren (kurz, verweist auf `doku.html`), dazu
  `docs/Umsetzungsplan-2.0.3.0.md` mit Abweichungen und Abnahme.

## Betroffene Dateien

`app/grid.js` (Klick/Doppelklick, Bearbeiten per Klick, Häkchenfilter, Platzhalter,
Statusfilter), `app/app.js` (Hinweisbereich, Sets aufnehmen, Arbeitsordner, Protokoll,
Hilfe-Gruppe), `app/model.js` (Playset als Stammdatenspalte, Übergang, `addSets`,
`defaultPlayset`, Bearbeitbarkeit), `app/storage.js` (Ordner, Rotation), `app/changelog.js`
(Laden, Kürzen, Nummer), neu `app/log.js`, `app/tour.js`, `doku.html`,
`app/reference-transform.js`, `reference/*.js` (neu erzeugt), `app/style.css`, `index.html`,
`tools/selftest.mjs`, `tools/load-app.mjs` (neue Skripte), `README.md`, `VERSION`,
`app/core.js`. Falls `grid.js` zu groß wird, kommt der Häkchenfilter nach
`app/grid-filter.js`.

## Reihenfolge

1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 → 9 → 10. Das Logging kommt zuerst, damit alles Weitere es
nutzt. Die Tour und die Doku kommen zuletzt, weil sie die fertige Oberfläche beschreiben. Nach
jedem Paket läuft der Selbsttest. Browser-Checks laufen über einen lokalen Server mit
`Cache-Control: no-store`.

## Prüfung

- `node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export Beispiel.csv"
  <Quellordner>` → alle Prüfungen grün, Zeilenlänge ≤ 100.
- Chrome (lokaler Server, eigener Bestand):
  - Bearbeiten: Doppelklick und Klick auf die aktive Zelle öffnen den Editor bzw. die
    Auswahlliste (im Editiermodus). Eine abweichende Zelle lässt sich ohne Editiermodus per
    Klick korrigieren. Ein abweichender Wert wird angenommen und als ✱ markiert.
  - Filter: Häkchenfilter auf Set, Rarity und Status; `*Gravy*` im Set- und Namensfilter.
  - Sets aufnehmen: z. B. ein neues Set, danach Zeilenzahl und Protokolleintrag prüfen.
  - Playset: nur im Editiermodus bearbeitbar; die 205 bisherigen Abweichungen erscheinen als ✱
    (Zahl nach Ableitungsverbesserung), Mengen unverändert.
  - Protokoll: Einträge aus früherer Sitzung sichtbar, „Zur Zeile“ und „Rückgängig“ gehen,
    Datei bleibt bei höchstens 1.000 Einträgen.
  - Hinweisbereich farbig, schließbar.
  - Tutorial: erster Start, Abbrechen, Wiederholen über Hilfe. `doku.html` öffnet.
  - Diagnose: Download enthält Start- und Speichereinträge, Konsole fehlerfrei.
- Von Elmar über `file://`:
  - Arbeitsordner wählen, danach Autosave von Bestand, Protokoll und Diagnose-Log in den
    Ordner; nach dem Neustart genügt eine Erlaubnis (Chrome/Edge).
  - Firefox: Downloads und Hinweise.
  - Offen aus 2.0.2.0: „Scrollen springt zurück“. Das Diagnose-Log zeichnet dafür die
    Scroll-Sprünge auf (debug, nur bei Sprung > 1 Bildschirm ohne Nutzeraktion).

---

## Abweichungen bei der Umsetzung (24.09.2026)

1. **Playset-Regel erweitert:** Neben Legendary → 1 gilt jetzt auch Evo-Ausrüstung → 3 (sie
   wird aus dem Deck gespielt) und Chi → 1. Beides ergab der Abgleich mit dem eigenen Bestand.
   Von vorher 205 abweichenden Zeilen bleiben **40**, als ✱ markiert. Die Werte sind im
   eigenen Bestand teils uneinheitlich (Cracked Bauble mal 1, mal 3), dazu kommen
   Proto-Base-Token (3), Ranger-Fallen mit Legendary (3), Quicksilver Dagger / Hunter's Klaive
   (1) u. a. Ein **leeres** Playset wird aus den Stammdaten ergänzt statt als Abweichung
   markiert.
2. **Übergang bei jedem Laden:** Der Übergang für Playset (abweichender Wert wird Override)
   läuft bei jedem Laden, nicht nur einmal. Es gibt kein Versionsmerkmal in der Datei, und so
   ändert sich nie etwas stillschweigend. Ändern sich später Stammdaten, erscheint eine solche
   Zeile als ✱ statt als ≠; der Statusfilter findet beide.
3. **Folge der Playset-Entscheidung:** Übernimmt man bei einer Karte das Playset aus den
   Stammdaten, kann sich im Fabrary-Export „Extra for trade“ ändern (die Spalte hängt vom
   Playset ab). Mengen und Identität bleiben geschützt.
4. **Öffnen mit Arbeitsordner:** Statt des Dateidialogs zeigt „Öffnen“ die Bestände im
   Arbeitsordner zum Anklicken („Andere Datei …“ für den Rest). Grund: Der Browser erlaubt je
   Klick nur einen Dateidialog; nach der Ordnerwahl hätte ein zweiter Dialog im selben Klick
   scheitern können. Auch „Speichern“ ohne Datei fragt den Namen in einem Dialog der
   Anwendung ab. Dateien im Ordner werden immer über den Ordner angesprochen, damit dessen
   Erlaubnis gilt.
5. **Protokoll auch in der Browser-Kopie:** Die letzten 1.000 Einträge liegen zusätzlich in
   der Kopie im Browser. So bleibt das Protokoll auch ohne Arbeitsordner und in Firefox über
   einen Neustart sichtbar.
6. **Auswahllisten:** Eine per Maus geöffnete Liste übernimmt die Wahl sofort. Ganz oben
   steht fett der Stammdatenwert („Stammdaten: X“). Mit der Tastatur übernimmt weiter Enter.
7. **Eigene Module** statt noch größerem `app.js`/`grid.js`: `log.js`, `diagnosis.js`,
   `notices.js`, `grid-filter.js`, `tour.js`.
8. **Tutorial mit 12 Schritten** (statt etwa 10): Die Gliederung, der Editiermodus und die
   Hilfe-Gruppe sind dazugekommen.
9. **Statusfilter:** Eine Zeile mit Abweichung **und** lokaler Änderung zählt als ≠ (wie ihr
   Statuszeichen).
10. **Hilfe-Gruppe:** „Diagnose“ lädt das Log der letzten Sitzungen herunter (Ringpuffer plus
    Browser-Kopie, 2.000 Einträge). Das Log enthält keine Mengen und keine Notizen.

## Abnahme (24.09.2026)

| Prüfung | Ergebnis |
|---|---|
| Selbsttest `tools/selftest.mjs` mit Quellordner (25 Prüfungen, davon 6 neu: Platzhalter, Sets aufnehmen, Playset, bearbeitbare Zellen, Grenzen Protokoll/Diagnose; Zeilenlänge jetzt auch `doku.html`) | alle bestanden |
| Stammdaten neu erzeugt (gleicher Commit e56071b, 21.08.2026) | nur `cards.js` (Kennzeichen Legendary) und `info.js` geändert; Transform = mitgeliefert |
| Playset am eigenen Bestand | 40 Abweichungen als ✱ erhalten, keine Werte verändert |
| Browser (Chrome, lokaler Server, eigener Bestand) | Klick auf unterstrichene Rarity öffnet ohne Editiermodus die Auswahlliste mit Stammdatenwert oben, Übernahme ohne Override, Protokolleintrag; **Doppelklick im Editiermodus** öffnet die Auswahlliste, abweichender Wert wird übernommen; Statusfilter ≠/✱ (295 Zeilen); Häkchenfilter Set mit Suche `armory*`; Namensfilter `*olympia*`; Sets aufnehmen (AOL, 29 Zeilen); Hinweisbereich gelb, Editiermodus-Hinweis mit „Beenden“; Tutorial (Start beim ersten Besuch, 12 Schritte, Esc); `doku.html`; Konsole und Diagnose-Log ohne Fehler |
| Arbeitsordner (Chrome, simuliert mit dem browsereigenen Dateisystem statt Ordnerdialog) | Speichern fragt den Namen und schreibt in den Ordner; Autosave schreibt Bestand und `collection-log.csv` ohne Rückfrage; „Rückgängig“ im Protokoll setzt den Wert zurück und speichert; Neustart verbindet Ordner und Bestand selbst, Protokoll wieder da; „Öffnen“ zeigt die Dateiliste des Ordners; `fct-diagnose.log` wird geschrieben |
| Echter Ordnerdialog und Browser-Erlaubnis für den Ordner, auch nach Neustart über `file://` (Chrome/Edge) | **von Hand zu prüfen** – Dateidialoge lassen sich nicht automatisieren |
| Firefox über `file://` (Downloads, Protokoll nach Neustart aus der Browser-Kopie) | **von Hand zu prüfen** |
| „Scrollen springt zurück“ | offen; bei Auftreten bitte *Hilfe → Diagnose* herunterladen (Einträge „Scroll-Sprung ohne Nutzeraktion“) |
