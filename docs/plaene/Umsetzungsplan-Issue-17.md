# Umsetzungsplan Issue #17 – Fabrary-Export nur aus the-fab-cube, fehlende Karten mit 0

**Issue:** https://github.com/Jazzman1976/FabCollectionTool/issues/17
**Branch:** `feature/17-fabrary-export-thefabcube` · **Stand:** 29. September 2026
**Status:** umgesetzt, PR nach `develop`; Nachtrag Fabrary-Zuordnung umgesetzt (siehe unten)

## Kontext
Heute kopiert der Fabrary-Export das mitgelieferte Skelett (`reference/fabrary-skeleton.js`,
16.571 Zeilen aus einem Fabrary-Export) und trägt nur die Mengen ein. Zeilen ohne Bestand
bekommen bei *Have* ein leeres Feld. Varianten, die das Skelett nicht kennt, werden
übersprungen.

Abgestimmt mit Elmar:
- **the-fab-cube ist die Quelle der Wahrheit.** Das Skelett und damit der Fabrary-Export als
  Eingabe des Build-Skripts entfallen.
- **Have ist nie leer.** Fehlende Karten bekommen `0`, nur so zeigt Fabrary sie als fehlend an.
  *Extra for trade* ebenso.
- **Nur Varianten, die es gibt,** mit genau den Foilings, die the-fab-cube kennt. **Alle Sets.**
- **Benennung wie im 1.0-Tool** (`FabraryDto.cs`). Damit hat der Import immer funktioniert,
  obwohl `docs/1.0 fabrary.csv` nur in rund 9.300 von 16.571 Zeilen mit Fabrarys eigenem
  Export übereinstimmt. Fabrary ist beim Import also tolerant.

## Zeilen des Exports
Eine Zeile je Variante der gerade geltenden Stammdaten (online oder mitgeliefert) und je
Foiling dieser Variante, sortiert nach Identifier, Set number, Edition, Foiling wie bisher.
Das sind heute rund 16.600 Zeilen.

| Spalte | Wert |
|---|---|
| Identifier | wie 1.0: Name + Leerzeichen + Pitch, ohne Akzente, doppelte Leerzeichen und Sonderzeichen, Leerzeichen und `\|` als `-`, klein geschrieben |
| Name | Kartenname von the-fab-cube, doppelseitige Karten als `Vorderseite // Rückseite` |
| Pitch | Red, Yellow, Blue, Purple oder leer |
| Set | Setname von the-fab-cube |
| Set number | Kartennummer, z. B. `MST131` |
| Edition | Alpha, First, Unlimited oder leer |
| Foiling | leer (Standard), Rainbow, Cold, Gold |
| Treatment | siehe unten |
| Have | Summe aller Bestandszeilen dieser Variante in diesem Foiling, sonst `0` |
| Want in trade, Want to buy, Extra to sell | leer, wie bisher |
| Extra for trade | nach den Regeln des alten Tools wie bisher, sonst `0` |

**Treatment:** Fabrary kennt nur einen Wert, the-fab-cube teilweise mehrere. Der Abgleich mit
Fabrarys Export ergibt eine klare Rangfolge: **Alternate Art vor Alternate Border vor Alternate
Text vor Full Art vor Extended Art**. Beispiele: „Alternate Art, Extended Art“ → Alternate Art
(46 von 46), „Alternate Border, Extended Art“ → Alternate Border (28 von 30), „Alternate Art,
Full Art“ → Alternate Art (24 von 33). Micro Text Box wird zu Extended Art. Die Ausnahme
`fabraryExtendedArtAsNormal` (ROS002, ROS008) bleibt.

**Bestand → Zeile:** Sprach-Editionen (EN, DE …) zählen zur Zeile ohne Edition wie bisher
(`model.fabraryEdition`). Bestandszeilen, deren Variante oder Foiling die Stammdaten nicht
kennen, werden übersprungen und mit Menge im Bericht genannt. Der Name entscheidet wie bisher,
wenn sich mehrere Karten eine Kartennummer teilen.

## Änderungen
- `app/export-fabrary.js`: Zeilen aus `FCT.reference` statt aus dem Skelett bauen, *Have* und
  *Extra for trade* immer mit Zahl, Kopfzeile als Konstante (bisher `info.fabraryHeader`),
  Quote-Stil wie bisher (erste fünf Spalten in Anführungszeichen, LF). Bericht: Zeilen gesamt,
  mit Menge > 0, übersprungene Bestandszeilen.
- `reference/fabrary-skeleton.js` löschen; `index.html` und `tools/load-app.mjs` ohne das
  Skript; `?v=` bleibt unverändert (Version nur auf dem Release-Branch).
- `tools/build-reference.mjs`: ohne Fabrary-Export (`<Quellordner> [Commit] [Datum]`),
  `info.js` ohne `fabraryHeader`.
- `tools/selftest.mjs`: Aufruf ohne Fabrary-Export als Pflicht für das Skelett. Neue Prüfungen
  statt der Skelett-Vergleiche:
  - jede Variante × Foiling der Stammdaten genau einmal, keine anderen
  - *Have* und *Extra for trade* nie leer
  - Identifier-Regel an Beispielen (Pitch, Akzente, `//`, Sonderzeichen)
  - Treatment-Rangfolge an Beispielen
  - Mengen aus `docs/example.ods` kommen an; Rundlauf Import → Export → Import gleich
  - Vergleich mit `docs/Fabrary Export Beispiel.csv` als Info: wie viele Zeilen identisch
- `README.md` (Abschnitt Fabrary, Grenzen), `reference/README.md` (Tabelle, Erneuern ohne
  Fabrary-Export), `doku.html` (Abschnitt Fabrary), Release-Ablauf in `RELEASE-NOTES.md`:
  vor jedem Release Stand mit the-fab-cube `develop` vergleichen und bei Bedarf erneuern.

## Abnahme
- Selbsttest grün.
- Chrome über localhost: Export mit Bestand, Datei stichprobenartig prüfen (Kopfzeile, `0` bei
  fehlenden Karten, Mengen vorhandener Karten, keine erfundenen Foilings), Bericht in den
  Meldungen, keine Konsolenfehler.
- **Elmar** importiert die Datei in Fabrary: Fehlende Karten erscheinen als fehlend, vorhandene
  mit der richtigen Menge.

## Umsetzung und Abweichungen
- **Mehrere Karten unter einer Kartennummer** (z. B. Engel und Figment, DTD005): Fabrary führt
  sie als getrennte Zeilen (73 von 75 Fällen im Vergleich), der Export also auch – eine Zeile je
  Karte, Variante und Foiling. Die Menge einer Bestandszeile geht wie bisher an die Karte mit
  ihrem Namen (Vorderseite).
- **Identifier** exakt nach `StringExtensions.cs` des alten Tools: erlaubt bleiben Buchstaben,
  Ziffern, Leerzeichen, `.`, `_`, `-`, `|`. Damit wird „Arcane Seeds // Life“ zu
  `arcane-seeds--life-red` wie bei Fabrary.
- Zeilen, die Fabrary als gleich ansehen würde (z. B. Micro Text Box und Extended Art), werden
  einmal geschrieben.
- Der Bericht nennt zusätzlich die **Zahl der übersprungenen Exemplare**; `exportFabrary`
  liefert sie als `skipped`.
- **Release-Ablauf** steht in `reference/README.md` („Wann: vor jedem Release“), nicht in
  `RELEASE-NOTES.md`: Release Notes werden nur auf dem Release-Branch geändert.
- `reference/info.js` ohne `fabraryHeader`; die Kopfzeile ist jetzt eine Konstante im Export.
  Das Build-Skript wurde mit den Quelldateien von Commit `e56071b` erneut ausgeführt:
  `sets.js`, `cards.js`, `printings.js` sind inhaltlich identisch (nur Zeilenenden), deshalb
  unverändert gelassen.
- Rundlauf-Prüfung: Import → Export → Import ergibt denselben Bestand bis auf den **Setnamen**
  (der Export schreibt die Namen von the-fab-cube, z. B. „Armory Deck - Gravy Bones“ statt
  Fabrarys „Armory Deck: Gravy Bones“); ein zweiter Export ist identisch mit dem ersten.

## Ergebnis der Abnahme (29.09.2026)
- Selbsttest grün, neue Prüfungen:
  - alle Varianten × Foilings der Stammdaten, keine anderen
  - *Have* und *Extra for trade* nie leer
  - Mengen: 24.283 exportiert + 276 übersprungen = 24.559 im Bestand von `docs/example.ods`
  - Identifier- und Treatment-Regeln an Beispielen
  - Rundlauf wie oben
  - Info: 13.470 von 16.571 Zeilen aus Fabrarys eigenem Export sind zeichengleich (1.0-Datei:
    rund 9.300)
- Die 276 übersprungenen Exemplare (163 Bestandszeilen) sind Abweichungen des Bestands von
  the-fab-cube, z. B. HER101 als Rainbow mit Extended Art (the-fab-cube: ohne Art Treatment),
  LGS227 als Standard (gibt es nur als Rainbow), GEM070 als Standard (nur Cold). In der Tabelle
  sind solche Zellen schraffiert bzw. mit ≠ markiert.
- Chrome über localhost mit dem Bestand aus `docs/example.ods` (Download abgefangen):
  - Kopfzeile wie bei Fabrary
  - 16.599 Zeilen, 6.367 mit Menge, 10.232 mit `0`, keine leeren Felder
  - Bericht mit 276 übersprungenen Exemplaren
  - keine Fehler im Diagnose-Log
- Offen: Import der Datei in Fabrary durch Elmar.

## Nachtrag: Fabrary-Zuordnung (Overrides und Abgleich)

**Stand:** 29.09.2026 · **Status:** umgesetzt, PR #20 nach `develop`

### Kontext
Elmars Test des Exports: ANQ006 (und 5 weitere Karten mit Bestand) kommen in Fabrary nicht an.
Der Vergleich unseres Exports mit Fabrarys Export nach dem Import
(`docs/screenshots/Pull Request #17/`) zeigt:
- 16.916 von 17.099 Zeilen passen genau (Identifier, Set number, Edition, Foiling, Treatment).
- **Treatment:** Fabrary erwartet die volle Liste („Alternate Art, Alternate Border, Extended
  Art“), wir schreiben ein Merkmal → 126 Zeilen, davon 3 mit Bestand (ANQ006, FAB375, LGS427).
- **Identifier:** Fabrary lässt Punkte weg (`argh-smash-yellow`) → 57 Zeilen, 3 mit Bestand.
- **Set-Name** spielt beim Zuordnen keine Rolle (ANQ011 kam unter anderem Set-Namen an), soll
  aber trotzdem überschreibbar sein.
- Nicht lösbar per Zuordnung: Dragons of Legend UPR225 (gibt es bei Fabrary nicht), Gold LGS229
  (Zeile identisch, Ursache unklar).

Abgestimmt mit Elmar:
- Export nutzt ein **Mapping** the-fab-cube → Fabrary-Bezeichnungen.
- **Mitgeliefertes Grund-Mapping** (aus Elmars aktuellem Fabrary-Export erzeugt), darauf
  **eigene Overrides** je Bestand; eigene gehen vor.
- Overrides stehen in der **Konfigurationsdatei aus #18** (`<bestand>-config.json`) →
  **#17 wird „blocked by #18“**.
- **Ein Dialog „Fabrary-Zuordnung …“** (Gruppe Export) mit Override-Tabelle und darin
  „Mit Fabrary-Export abgleichen …“.
- Abgleich zeigt eine **Vorschau**: eindeutige Funde vorausgewählt, unklare zur Wahl.

### Reihenfolge
1. Plan als Nachtrag in `docs/plaene/Umsetzungsplan-Issue-17.md` + Kommentar in Issue #17,
   „Blocked by #18“ per REST setzen, Board → Ready. Umsetzung erst ab „Ready for dev“.
2. Nach Merge von PR #21 (#18): `develop` per Merge in `feature/17-…` holen, Konflikte lösen
   (`app.js`, `index.html`, `doku.html`, `selftest.mjs`).
3. Umsetzen wie unten, Selbsttest, Chrome-Check, Push → PR #20 wieder In review.

### Datenmodell
Schlüssel einer Export-Zeile (vor dem Mapping), eindeutig auch bei geteilten Kartennummern:
`Set number|Edition|Foiling|Treatment(unser)|Identifier(unser)`.

```
fabrary: {
  sets:     { "ANQ": "Promos", … },                         // Set-Code → Fabrary-Setname
  variants: { "<Schlüssel>": { identifier?, treatment?, set? }, … }   // nur Abweichungen
}
```
- Mitgeliefert: `reference/fabrary-map.js` → `FCT.DATA.fabraryMap` in diesem Format.
- Eigen: `config.fabrary` in `<bestand>-config.json` (neben `collectedSets`), ohne
  Arbeitsordner in der Browser-Kopie mitgetragen wie `collectedSets` in #18
  (`applyConfig`, `configText`, `last.config`). Geladen nach `collection.fabraryOverrides`.
- Vorrang je Feld: eigener Variant-Eintrag > mitgelieferter Variant-Eintrag > eigener
  Set-Eintrag > mitgelieferter Set-Eintrag > heutige Regel (Identifier wie 1.0,
  `TREATMENT_ORDER`, Setname the-fab-cube).

### Änderungen
- **Neu `app/fabrary-map.js`** (`FCT.fabraryMap`), geteilt von App und Build-Tool wie
  `reference-transform.js`:
  - `key(identity)`, `apply(identity, setCode, overrides)` → gemappte Identity.
  - `compare(referenceRows, fabraryText)` → `{ sets, variants, unclear, notInFabrary }`:
    Fabrary-Zeilen einlesen (`FCT.csv.parseTable`, identische Doppelzeilen einmal), gruppieren
    nach Set number|Edition|Foiling; je unserer Zeile Kandidaten nach Name (`util.fold`)
    filtern, dann: gleiches Treatment → eindeutig; sonst genau ein Kandidat, dessen
    Treatment-Liste unseres enthält → eindeutig; sonst **unklar** mit Kandidatenliste. Zwei
    unserer Zeilen auf dieselbe Fabrary-Zeile → unklar. Set-Namen je Set-Code zusammenfassen,
    wenn innerhalb des Codes einheitlich, sonst je Variante.
- **`app/export-fabrary.js`**: `referenceRows()` wendet `FCT.fabraryMap.apply` an (Set-Code
  `p[1]` mitgeben); die Bestandszuordnung (`variantKey`) bleibt auf unseren Werten, nur die
  geschriebene Identity ändert sich. `referenceRows` für `compare` exportieren (ohne Mapping).
  Bericht: „N Zeilen per Zuordnung angepasst (davon M eigene)“.
- **`app/app.js`**:
  - Knopf `btn-fabrary-map` „Zuordnung …“ in der Export-Gruppe (`index.html`, Tooltip
    „Fabrary-Bezeichnungen festlegen und mit einem Fabrary-Export abgleichen“).
  - Dialog „Fabrary-Zuordnung“ (`openDialog`, `wide`): zwei Tabellen **Sets** und
    **Varianten** mit Suche; Spalten: Schlüssel (Kartennummer, Name, Edition, Foiling),
    Identifier, Treatment, Set; Herkunft „mitgeliefert“/„eigen“. Mitgelieferte Werte als
    Platzhalter, Eingabe macht einen eigenen Eintrag, „Zurücksetzen“ löscht ihn. Neue Variante:
    Kartennummer eingeben → Varianten aus den Stammdaten zur Wahl.
  - Darin „Mit Fabrary-Export abgleichen …“: Datei wählen (wie `importFabrary`) → Vorschau
    gruppiert nach Sets / Identifier / Treatment / Unklar, Häkchen je Fund (eindeutige an),
    Unklare mit Auswahl der Fabrary-Kandidaten, Info-Zahl „bei Fabrary nicht vorhanden“.
    Nur Abweichungen zur **aktuell geltenden** Zuordnung. „Übernehmen“ schreibt in
    `collection.fabraryOverrides`, markiert den Bestand als geändert → gespeichert mit der
    Config (`saveConfig`), Meldung + Diagnose-Eintrag.
  - `configText`/`applyConfig` um `fabrary` erweitern (leere Abschnitte nicht schreiben).
- **Neu `reference/fabrary-map.js`** + `tools/build-fabrary-map.mjs <fabrary-export.csv>`:
  läuft `compare` über die Stammdaten, schreibt nur eindeutige Funde (eine Zeile je Eintrag).
  Erzeugt aus Elmars Fabrary-Export vom 29.09.2026 (Datei aus
  `docs/screenshots/Pull Request #17/`).
  `index.html` + `tools/load-app.mjs`: beide neuen Skripte einbinden.
- **`tools/selftest.mjs`**:
  - Mit Grund-Mapping trifft der Export Fabrarys Export (Datei oben) in allen Zeilen mit
    Bestand außer UPR225/LGS229; ANQ006, FAB375, LGS427, CRU009, SUP208, PEN165 zeichengleich.
  - Vorrang eigener Override vor mitgeliefertem, Set-Override, Zurücksetzen.
  - `compare`: eindeutig/unklar an Beispielen (geteilte Kartennummer, Doppelzeilen).
  - Config-Rundlauf mit `fabrary`; Rundlauf Import → Export → Import bleibt gleich.
- **Doku:** `doku.html` Abschnitt Fabrary (Zuordnung, Abgleich, Config-Datei),
  `README.md`, `reference/README.md` (Grund-Mapping erneuern vor jedem Release mit aktuellem
  Fabrary-Export), Nachtrag im Umsetzungsplan.

### Nicht im Umfang
- Import aus Fabrary bleibt unverändert (ordnet über Set number/Edition/Treatment zu).
- UPR225 und Gold LGS229 bleiben offen und werden im Plan-Nachtrag genannt.

### Abnahme
- Selbsttest grün (inkl. neue Prüfungen).
- Chrome über localhost mit Arbeitsordner (OPFS unterschieben): Export → ANQ006-Zeile mit
  „Alternate Art, Alternate Border, Extended Art“; Zuordnung eines Sets von Hand ändern →
  steht in `collection-config.json`, wirkt im Export, nach Neuladen noch da; Abgleich mit der
  Fabrary-Datei → Vorschau ohne Funde (Grund-Mapping deckt alles ab), nach Zurücksetzen eines
  Eintrags erscheint er als Fund; keine Konsolenfehler.
- **Elmar** importiert den neuen Export in Fabrary: die 6 Karten kommen an.

### Umsetzung und Abweichungen (Nachtrag)
- `develop` mit #18 per Merge geholt, ohne Konflikte.
- **Schlüssel mit allen Treatments:** the-fab-cube führt je Variante die volle Liste (ANQ006:
  „Alternate Art, Alternate Border, Extended Art“). Der Schlüssel der Zuordnung nimmt deshalb
  diese Liste statt des einen Export-Treatments. Fabrary unterscheidet z. B. HER125 Cold
  „Alternate Art“ und „Alternate Art, Full Art“. Solche Varianten wurden bisher zu einer
  Zeile zusammengefasst und stehen jetzt getrennt (3 Fälle: HER125, ROS008, UPR103). Der Export
  hat jetzt 16.602 statt 16.599 Zeilen. Bestandszeilen gehen bei mehreren passenden Zeilen
  an die mit gleichem Namen und gleicher Treatment-Liste.
- `app/fabrary-map.js`: `key`, `apply`, `value(s)`, `setVariant`, `setSet`, `normalize`,
  `compare`. Der Abgleich wählt die Fabrary-Zeile so: gleiche Kartennummer, Edition und
  Foiling; bei mehreren Karten der Name; dann die gleiche Treatment-Liste (Reihenfolge egal),
  sonst ein einziger Kandidat, sonst das gleiche Export-Treatment, sonst unklar.
  Set-Namen werden je Set-Code gefunden, wenn Fabrary innerhalb des Codes nur einen Namen
  nutzt, sonst je Variante.
- `export-fabrary.js`: `baseRows()` (Zeilen ohne Zuordnung, auch für Dialog und Build-Skript),
  `fullTreatment()`. Der Bericht nennt „N Zeilen per Fabrary-Zuordnung angepasst (davon M mit
  eigener Zuordnung)“.
- **Grund-Mapping** aus Elmars Fabrary-Export vom 29.09.2026: 55 Sets, 150 Varianten,
  keine unklaren Fälle. 33 Varianten gibt es bei Fabrary nicht, z. B. UPR225, SMP007–020,
  AUR001, JDG000 Cold.
- **Dialog „Zuordnung …“** (Gruppe Export): Tabellen Sets und Varianten. Grau steht der Wert
  ohne eigenen Eintrag, eigene Werte sind markiert wie lokale Änderungen. „-“ bedeutet
  ausdrücklich leer, ↺ entfernt den eigenen Eintrag. Sets kommen per Auswahl dazu, Varianten
  per Kartennummer; die Varianten lassen sich durchsuchen. „Mit Fabrary-Export abgleichen …“
  übernimmt zuerst die Eingaben, zeigt dann die Vorschau (Set-Namen, Varianten, Unklar mit
  Auswahl, „Bei Fabrary nicht vorhanden“ zur Information) und öffnet danach wieder die
  Zuordnung. Jede Änderung steht im Protokoll („Fabrary-Zuordnung“) und im Diagnose-Log.
- **Zusätzlich:** Ein Import (ODS/Fabrary) behält die eigene Fabrary-Zuordnung. Sie gehört
  zum Nutzer, nicht zu den importierten Daten.
- Konfigurationsdatei: Abschnitt `fabrary` nur, wenn es eigene Einträge gibt, sortiert nach
  Schlüsseln. Ohne Arbeitsordner trägt die Kopie im Browser ihn mit. Der Hinweis zur
  Konfigurationsdatei nennt jetzt auch die Zuordnung.
- Gold LGS229: Die Zeile ist identisch mit Fabrarys Export und wird richtig zugeordnet. Warum
  Fabrary die Menge nicht übernommen hat, bleibt offen.
- Unser Export aus dem Test (`docs/screenshots/Pull Request #17/fabrary-20260929-165014.csv`)
  bleibt ungetrackt liegen.

### Ergebnis der Abnahme (Nachtrag, 29.09.2026)
- Selbsttest grün, neue Prüfungen:
  - „Fabrary mapping meets Fabrary's export“: 16.602 Zeilen, **alle** identisch mit Fabrarys
    Export außer den Varianten, die es dort nicht gibt. Keine Menge geht verloren. ANQ006,
    FAB375, LGS427, CRU009, SUP208 und PEN165 sind zeichengleich.
  - „Fabrary comparison with the shipped mapping“: 16.569 gefunden, keine Abweichung.
  - „Fabrary mapping: own entries“: Vorrang, falscher Eintrag wird gefunden, Zurücksetzen,
    `normalize`.
  - Rundlauf mit Treatments auf das Export-Treatment reduziert.
  - Info mit dem alten Beispiel-Export: 16.302 statt bisher 13.470 von 16.571 Zeilen
    identisch.
- Chrome über localhost mit Arbeitsordner (privates Dateisystem des Browsers):
  - Fabrary-Export importiert, gespeichert.
  - „Zuordnung …“ zeigt 55 Sets und 150 Varianten.
  - ANQ → „Test-Set“: steht in `collection-config.json` und wirkt im Export. Die ANQ006-Zeile
    trägt „Alternate Art, Alternate Border, Extended Art“, `argh-smash-yellow` ist ohne Punkte.
  - Abgleich mit der Fabrary-Datei findet genau diesen Eintrag („Test-Set“ → „Promos“).
    Übernehmen leert die eigene Zuordnung.
  - Treatment „-“ wird als leerer Wert gespeichert und ist nach dem Neuladen noch da.
  - Keine Konsolenfehler, keine Fehler im Diagnose-Log.
- Offen: Elmar importiert den neuen Export in Fabrary.

### Nachtrag: Fabrary-Export nicht im Repository (29.09.2026)
- Elmars Fabrary-Export enthält seine Sammlung mit Mengen, das Repository ist öffentlich. Er
  liegt deshalb wie die Quelldateien von the-fab-cube außerhalb des Repositorys; die App
  braucht nur das erzeugte `reference/fabrary-map.js`.
- Der Selbsttest prüft die Zuordnung an der Fabrary-Datei, die beim Aufruf angegeben wird
  (zweites Argument); sie sollte aktuell sein. `reference/README.md` und `README.md`
  beschreiben das.
- Mit Elmars aktuellem Export als zweitem Argument sind alle Prüfungen grün. Mit dem alten
  `docs/Fabrary Export Beispiel.csv` schlagen die drei Zuordnungsprüfungen erwartungsgemäß
  fehl, weil Fabrary damals anders benannte.
- Rundlauf-Prüfung: Karten, die die Stammdaten nicht kennen (z. B. IAR038 aus einem Set, das
  nur auf einem Branch von the-fab-cube liegt), überspringt der Export bewusst; die Prüfung
  nimmt sie aus.
