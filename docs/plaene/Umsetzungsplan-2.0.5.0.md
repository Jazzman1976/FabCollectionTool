# Umsetzungsplan FabCollectionTool 2.0.5.0

**Grundlage:** `docs/Feedback 2.0.4.0.md` (2 Change Requests, 3 Wünsche) und
`docs/Screenshot 2.0.4.0 - 1.jpg`, Stand 2.0.4.0 (Commit 5916ab5)
**Stand:** 25. September 2026 · **Status:** umgesetzt, Abnahme durch Elmar offen

## Kontext
Elmar hat `docs/Feedback 2.0.4.0.md` fertig: 2 Change Requests (Spaltentitel nie umbrechen,
Gruppierung ohne Id-Lücken) und 3 Wünsche (Talent1/Talent2, neue Stammdatenspalten laut
Recherche Punkt 2, Abgleich mit dem Regelwerk laut Recherche Punkt 3). Rückfragen sind geklärt
(24.09.2026):
- Promo-/Deck-Sets, die zu stark zerfallen, werden automatisch flach (ohne Untergruppen).
- Nur eine Gruppe aus lauter Fabled-Karten bekommt den Sondernamen „Fabled“.
- Functional Text: ausblendbare Spalte „Kartentext“ **und** durchsuchbar über die Suche oben.
- **Metatyp wird eine eigene, gespeicherte Spalte** wie Talent/Class/Type/Sub. Grundsatz von
  Elmar: Spalten so fein wie möglich für Exporte in andere Systeme, und die Spaltenreihenfolge
  entspricht der Typzeile auf der Karte (Regel 2.14.1: Meta, Super, Typ, Untertypen).

Regeln wie bisher: klassische Skripte ohne Build, `file://`, ≤ 100 Zeichen/Zeile, Code
englisch, Doku deutsch, altes Tool unberührt, Arbeitsdateien nie ins Repo, Commit nur auf Zuruf.

## Befunde der Vorrecherche (Stammdaten develop, Scratchpad-Skript)
- **Fabled-Verdacht:** In älteren Sets (WTR, ARC, MON, ELE, UPR, OUT, HVY) unterbricht nur
  die Nummer 000 (immer Fabled, 16 von 21 Fabled-Karten) die Id-Folge. Neuere Sets haben
  zusätzlich Marvel-/Zusatzkarten außer der Reihe (DTD005–012, ROS254–257, SEA262–264,
  OMN248–250). Promo-/Deck-Sets zerfallen stark (FAB 281 Abschnitte bei 57 Gruppen, AAZ 8/2).
- **Ursache im Code:** `grid.js/groupRows` (542–616) sammelt alle Zeilen mit gleichem
  Talent+Klasse eines Sets in einen Topf (Reihenfolge nach erstem Auftreten in der Datei).
- **Spaltentitel:** Das Pfeilchen ist `float:left` (`style.css:458`), der `th` darf umbrechen
  (`style.css:387`), die Breite wird per Canvas geschätzt (`grid.js:128–155`, fester
  Aufschlag 1,9 em fürs Pfeilchen). `index.html` lädt CSS/JS ohne Versionsanhang (Cache).
- Metatypen je Karte: höchstens einer (Event, Rosetta, High Seas, Omens of the Third Age,
  Arakni, Puffin, Scurv). Cost/Power/Defense sind meist Zahlen, selten X/XX/*.
  Functional Text ≈ 590 KB (cards.js heute 400 KB).

## Arbeitspakete


### 1. Version
`VERSION`, `FCT.VERSION` (`app/core.js`) → 2.0.5.0. `index.html`/`doku.html` laden Skripte
und `style.css` mit `?v=2.0.5.0`, damit kein alter Stand aus dem Cache kommt.

### 2. Spaltentitel nie umbrechen (CR 1)
- Kopfzeile: `th` der Titelzeile bekommt `white-space: nowrap` für alle Spalten (Regel in
  `style.css` 387 ff. ersetzen). Das Pfeilchen ◂ ist ein Inline-Element direkt vor dem Titel
  (kein `float`); Sortierzeichen bleibt rechts, vertikal ausgerichtet.
- `grid.js/widthOf`: Breite = gemessene Breite von Pfeilchen + Titel + Sortierzeichen mit der
  tatsächlich berechneten Schrift (`getComputedStyle(th).font`), neu gemessen nach
  `document.fonts.ready` und bei Wechsel der Schriftgröße. Die Spalte darf dafür breiter werden.
- Zweizeilige Kopfzeile aus 2.0.4.0 entfällt damit; `--head-height` bleibt gemessen.

### 3. Gruppierung ohne Id-Lücken (CR 2)
Neue Regel in `grid.js/groupRows` (Name der Gruppe weiter aus `model.groupNames`):
- Je Set werden alle Zeilen (ungefiltert, inkl. angezeigter Lückenzeilen) nach Id sortiert.
  Aufeinanderfolgende Zeilen mit gleichem Gruppenschlüssel bilden einen **Abschnitt**. Taucht
  der Schlüssel später wieder auf, entsteht ein weiterer Abschnitt mit demselben Namen
  (z. B. zweimal „Lightning“). Die Abschnitte werden ungefiltert gebildet, damit Filter die
  Gruppen nicht verschieben; gefilterte Zeilen fallen in ihren Abschnitt.
- Reihenfolge der Abschnitte = Id-Folge (statt erstes Auftreten in der Datei). Sortieren nach
  einer Spalte sortiert wie bisher nur innerhalb der Gruppen.
- **Name „Fabled“:** Besteht ein Abschnitt nur aus Zeilen mit Rarity Fabled, heißt er „Fabled“.
- **Automatisch flach:** Hat ein Set mehr als doppelt so viele Abschnitte wie verschiedene
  Gruppenschlüssel, bekommt es keine Untergruppen: Set-Überschrift, darunter die Id-Liste.
- Gruppenschlüssel: Metatyp + Talente + Klassen; Talente mengenartig verglichen, damit
  „Ice Earth“ und „Earth Ice“ nicht verschieden sind. Gruppen-Id für den Auf/Zu-Zustand:
  Set + Name + erste Id des Abschnitts.
- Zähler je Abschnitt wie bisher (Zeilen · Karten · fehlen · nicht im Bestand).

### 4. Zerlegung der Typzeile nach Regelwerk (Wunsch 3)
- `reference/vocab.js` nach Regelwerk 2.11.6a/b und 2.15.6a: Klassen 17 (+ „Generic“ als
  Anzeigewert, ohne Pit-Fighter), Talente 12 (ohne Rosetta), Typen mit Companion, ohne Event.
  Quelle und Regelnummern als Kommentar.
- `model.splitTypes` positionsbasiert (Regel 2.14.1): vor dem ersten Typ = Klasse/Talent,
  sonst Metatyp; nach dem letzten Typ = Untertyp; Karten ohne Typ (21 Tokens) nutzen den
  Strich aus `Type Text`. Unbekannte Wörter an Listenstelle → Hinweis im Diagnose-Log
  (einmal je Wort). Ergebnis: Metatype, Talent1, Talent2, Class1, Class2, Type1, Type2,
  Sub1–3; alle Werte in der Reihenfolge der Karte.
- Dafür bekommt jede Karte in den Stammdaten `Type Text` (s. Paket 6).

### 5. Neue gespeicherte Spalten Metatype, Talent1, Talent2 (Wunsch 1 + Metatyp)
- `model.COLUMNS`: … Rarity, **Metatype, Talent1, Talent2**, Class1, Class2, Type1, Type2,
  Sub1–3, Name … (Reihenfolge der Typzeile; Tabelle und `collection.csv` gleich).
  `REFERENCE_COLUMNS`, `CHOICE_VOCAB` (Talent1/2 → talents, Metatype → Liste ohne feste
  Werteliste wie Set), `WIDTHS`, `DEFAULT_COLUMNS` (Metatype und Talent2 schmal, sichtbar),
  einmaliges Merkmal `columns2050` für gemerkte Spaltenauswahlen.
- **Übergang alter Dateien** (CSV und 1.0-Tabelle): Spalte `Talent` wird beim Laden in
  Talent1/Talent2 zerlegt (am Leerzeichen, Reihenfolge bleibt); ein Override auf `Talent` wird
  zu Talent1/Talent2; Info-Meldung wie beim Playset-Übergang. Beim nächsten Speichern steht
  die neue Spaltenfolge in der Datei.
- Zeilen, deren Werte sich durch die neue Zerlegung ändern (Pit-Fighter → Sub, Rosetta →
  Metatype, Companion → Type, Event → Metatype, Metatypen aus Sub raus), erscheinen als
  Abweichung ≠ und werden wie gewohnt übernommen. Die harte Zusage bleibt: Übernehmen ändert
  nie Mengen, Playset, Notiz, Id, Edition, Art Treatment.
- „＋ Zeile darunter“ (`app.js:1653`) kopiert Metatype, Talent1, Talent2 mit.
- Fabrary-Import/-Export: nicht betroffen.

### 6. Stammdatenspalten nur zum Anzeigen (Wunsch 2, Recherche Punkt 2)
- `reference-transform.js`: je Karte zusätzlich Cost, Power, Defense, Card Keywords,
  Functional Text, Type Text, „Verboten in“ (aus Blitz/CC/Silver Age/Commoner/LL Legal
  zusammengefasst, z. B. „CC, Blitz“); je Druckvariante Artists (Feld 9). Felder werden
  angehängt, bestehende Indizes bleiben. `build-reference.mjs` erzeugt `reference/*.js` neu
  (gleicher Commit e56071b), Kopfkommentare angepasst; `model.reference.install` mappt die
  neuen Felder.
- Neue ausblendbare Spalten (Standard ausgeblendet, **nicht** in `collection.csv`), hinter
  „Typen (Stammdaten)“: Cost, Power, Defense (Zahlenfilter wie bei den Mengen), Card Keywords
  (Textfilter „enthält“), Artist, Verboten in, Erscheinungsdatum (Set), Kartentext.
- Suche oben findet zusätzlich Wörter im Kartentext (`searchKeys` um einen Wertgeber
  erweitern, `grid.js` liest dann `value(row)`).

### 7. Selbsttest, Doku, Abschluss
- Selbsttest neu/angepasst: Typzerlegung (Pit-Fighter, Rosetta, Companion, Event, Tokens
  ohne Typ, zwei Talente in Kartenreihenfolge, jede Typzeile vollständig zugeordnet);
  Talent-Übergang alter Dateien inkl. Override; Spaltenreihenfolge; Gruppen-Abschnitte
  (OMN: zwei „Lightning“, „Fabled“, AAZ flach, keine Id-Lücke innerhalb einer Gruppe);
  neue Stammdatenfelder; Transform = mitgeliefert; Wertelisten.
- `doku.html`, `tour.js`, `index.html` (Gliederung „Set › Talent Class“), `README.md`
  (CSV-Kopf), Recherche-Dokument mit Verweis auf die Umsetzung.

## Reihenfolge
1 → 2 → 4 → 5 → 3 → 6 → 7. Nach jedem Paket Selbsttest; Browser-Checks über lokalen
Server mit `Cache-Control: no-store` (Chrome-Erweiterung, sonst Edge headless wie in 2.0.4.0).

## Kritische Dateien
`app/grid.js` (groupRows, widthOf, buildHeader, Suche), `app/style.css`, `app/model.js`
(COLUMNS, splitTypes, fromCsv-Übergang, groupNames, install), `app/app.js` (buildColumns,
DEFAULT_COLUMNS, WIDTHS, searchKeys), `app/reference-transform.js`, `reference/vocab.js`,
`reference/*.js` (neu erzeugt), `app/import-ods.js` (Talent-Übergang), `tools/selftest.mjs`,
`tools/build-reference.mjs`, `index.html`, `doku.html`, `app/tour.js`, `README.md`,
`VERSION`, `app/core.js`.

## Prüfung
- `node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export Beispiel.csv"
  <Quellordner>` → alle grün, Zeilen ≤ 100.
- Browser mit eigenem Bestand: kein Titel bricht um (alle drei Schriftgrößen), Pfeilchen vor
  „Have (set)“; OMN zeigt „Fabled“ (OMN000) und lückenlose „Lightning“-Gruppen; FAB/AAZ flach;
  Spalten Metatype/Talent1/Talent2 in Tabelle und gespeicherter CSV in Kartenreihenfolge;
  alte CSV mit `Talent` wird verlustfrei übernommen; neue Stammdatenspalten ein-/ausblenden,
  Zahlenfilter „Cost <2“, Suche nach Kartentext; Konsole und Diagnose-Log ohne Fehler.
- Von Elmar: `file://` in Chrome/Firefox.

## Abweichungen und Befunde bei der Umsetzung
- **Paket 4 (25.09.):** Die reine Positionsregel reicht nicht für alle Karten. Ergänzt: Wörter
  hinter dem Strich der gedruckten Typzeile (`Type Text`) sind immer Untertypen. Damit landen
  richtig: „Alpha Rampage“ (Datenfehler „Brute, Attack, Action“ → Sub1 Attack), „Ruu'di“
  („Hero, Merchant“ → Sub1 Merchant) und die Tokens ohne Typ. Meld-Karten („Rampant Growth //
  Life“ = „Wizard, Instant, Earth, Instant“) führen beide Hälften in einer Zeile; Supertypen
  zwischen zwei Typen zählen mit, doppelte Werte entfallen (Talent1 Earth, Class1 Wizard,
  Type1 Instant).
- `vocab.js` hat eine neue Liste `metatypes` (bekannte Metatypen); unbekannte Wörter vor dem
  Typ landen im Metatyp und erzeugen **einmal je Wort** eine Warnung im Diagnose-Log. Die
  Hilfskarte UPR225 „Dragons of Legend“ hat die Typzeile „Invocation Placeholder Card“; beide
  Wörter stehen als bekannte Ausnahme in der Liste. Metatype hat in der Bearbeitung trotzdem
  **keine feste Werteliste** (wie im Plan), die Auswahl kommt aus den Stammdaten.
- **Paket 6-Datenteil:** `cards.js` wächst von 400 KB auf 1,3 MB (Kartentext), `printings.js`
  von 820 KB auf 1 MB (Artists). „No“ in den Legal-Spalten heißt „nicht legal“ – bei Silver Age
  (1.088 Karten) und Commoner (2.251) meist wegen der Rarity, nicht wegen eines Banns. Der
  Spaltenname wird daher **„Nicht legal in“** statt „Verboten in“.
- Übergang geprüft mit der echten `collection.csv` (6.818 Zeilen): Mengen, Notizen und Ids
  unverändert, keine Zusatzspalte, eine Info-Meldung.
- **Paket 3:** Die Abschnittsbildung steht als reine Funktion in `model.sections` (statt in
  `grid.js`), damit der Selbsttest sie ohne Browser prüfen kann. Mit allen Stammdaten: 114 Sets,
  davon 68 flach (nur Promos, Blitz-/Armory-/Hero-Decks, Silver-Age-Kapitel, First Strike,
  Classic Battles, Round the Table); WTR/MON/OMN/ROS mit Untergruppen, OMN000/WTR000 „Fabled“,
  OMN mit zweimal „Lightning Illusionist“ (OMN001 und OMN248). Der Metatyp ist Teil des
  Gruppennamens (z. B. Gruppe „Omens of the Third Age“ bei OMN227).
- **Paket 6-Anzeige:** Leere Werte zählen bei Mengen als 0. Für Cost/Power/Defense wäre das
  falsch (Helden und Waffen hätten bei „<2“ gepasst); neue Spalteneigenschaft `sparse`:
  leere Werte passen zu keinem Zahlenvergleich. Kartentext wird einzeilig und ohne `**`
  angezeigt.

## Abnahme (25.09.2026)
- Selbsttest: **31 Prüfungen grün** (neu: Typzerlegung mit 11 Fällen + alle 4.952 Typzeilen
  vollständig zugeordnet, Talent-Übergang CSV/ODS inkl. Override, Abschnitte,
  Anzeige-Stammdaten); alle Zeilen ≤ 100 Zeichen.
- Chrome (Erweiterung) über `localhost` mit no-store und Elmars `collection.csv` (nur
  gelesen, ohne Datei-Handle): Stammdaten online mit den neuen Pflichtspalten geladen;
  Talent-Übergang gemeldet; OMN-Abschnitte in Id-Folge; Suche „crowd boos“ findet 48 Zeilen
  über den Kartentext; neue Spalten ein-/ausblendbar und gefüllt; „Cost <2“ zeigt nur 0 und 1;
  kein Titel bricht um (klein/mittel/groß); keine Konsolenfehler.
- Offen bei Elmar: `file://` in Chrome/Firefox, Blick auf die Gruppen der eigenen Sets,
  Speichern (erst dann steht das neue Spaltenformat in der Datei).
