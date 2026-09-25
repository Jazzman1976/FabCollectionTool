# Fix FabCollectionTool 2.0.6.2: Gruppe „Gemischt“ für Sets ohne Talent+Class-Gruppen

**Grundlage:** Wunsch von Elmar (25.09.2026), Stand 2.0.6.1 (Commit ff39664)
**Stand:** 25. September 2026 · **Status:** umgesetzt, Abnahme durch Elmar offen

## Kontext
Sets, deren Talent+Class-Gruppen zu stark zerfallen (Promos, Blitz-/Armory-Decks …), waren seit
2.0.5.0 „flach“: Unter der Set-Überschrift standen direkt die Zeilen. Mit Gliederungsstufe 2
erschienen dadurch bei diesen Sets Zeilen, obwohl Stufe 2 nur Set- und Talent+Class-Gruppen
zeigen soll. Gewünscht: Jedes Set hat mindestens eine Gruppe darunter; bei flachen Sets heißt
sie „Gemischt“.

## Änderungen
1. `app/model.js/sections`: Ein flaches Set bekommt statt der zerfallenen Abschnitte einen
   einzigen Abschnitt „Gemischt“ mit allen Zeilen (Schlüssel Set + „Gemischt“ + erste Id).
   „Fabled“ gilt dort nicht. `flat` bleibt im Ergebnis (Selbsttest).
2. `app/grid.js/groupRows`: Die Sonderfälle für flache Sets sind entfallen; alle Sets laufen
   über ihre Abschnitte, „Gemischt“ zählt auch für die Gliederungsknöpfe 1/2/3.
3. `doku.html` (Gliederung), Selbsttest „Accordion sections“ (jedes flache Set hat genau einen
   Abschnitt „Gemischt“), Version 2.0.6.2 (`VERSION`, `app/core.js`, `?v=`, `README.md`).

## Abnahme (25.09.2026)
- Selbsttest: alle 33 Prüfungen grün (114 Sets, davon 68 mit „Gemischt“), Zeilen ≤ 100.
- Chrome über `localhost` (no-store) mit der Testkopie: Gliederung 2 zeigt über die ganze Liste
  nur Set- und Gruppenzeilen, keine Datenzeile; „Hero Card Promos (HER)“ und „Local Game Store
  Promos (LGS)“ haben die Gruppe „Gemischt“; Aufklappen zeigt HER000, HER001, …; Gliederung
  „nur Set“ zeigt die Zeilen wie bisher direkt unter dem Set; keine Konsolenfehler.
- Offen bei Elmar: Blick auf die eigenen Sets.
