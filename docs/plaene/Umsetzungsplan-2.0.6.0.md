# Umsetzungsplan FabCollectionTool 2.0.6.0

**Grundlage:** `docs/Feedback 2.0.5.0.md` (14 Change Requests), Stand 2.0.5.0 (Commit 92d9c7b)
**Stand:** 25. September 2026 · **Status:** umgesetzt, Abnahme durch Elmar offen

## Kontext
Elmar hat 2.0.5.0 ausprobiert und 14 Change Requests formuliert: Bedienung per Tastatur
(Scrollen, +/−), Zeilen einfügen/löschen, klarere Dialoge rund um Arbeitsordner, „Neu“ und
„Öffnen“, Speichern in Firefox, Erklärungen (Farben, Spalte ST) und das Wording (statt „Drucke“).
Geklärt am 25.09.2026:
- **Löschen (CR 4):** Eine gelöschte Zeile, deren Variante in den Stammdaten steht, wird zur
  **○-Lückenzeile** (verlässt die Datei, bleibt grau an ihrem Platz sichtbar).
- **Firefox (CR 7):** Firefox kann keine Datei überschreiben. Lösung: **feste Dateinamen ohne
  Zeitstempel + Anleitung** für die Firefox-Einstellung „Jedes Mal nachfragen, wo gespeichert
  werden soll“; das Protokoll wird als vollständige Datei geschrieben.

Regeln wie bisher: klassische Skripte ohne Build, `file://`, ≤ 100 Zeichen/Zeile, Code englisch,
Doku deutsch, altes Tool unberührt, Arbeitsdateien nie ins Repo, Commit nur auf Zuruf. Nach
Freigabe wird dieser Plan als `docs/Umsetzungsplan-2.0.6.0.md` ins Repo gelegt.

## Arbeitspakete

### 1. Version
`VERSION`, `FCT.VERSION` (`app/core.js`), `?v=2.0.6.0` in `index.html`/`doku.html`.

### 2. Tastatur: Zeile bleibt in der Mitte (CR 2)
- Befund: `grid.js/scrollToRow` (951 ff.) scrollt nur, wenn die Zeile den sichtbaren Bereich
  verlässt, und rechnet mit `index * rowHeight`. Nach unten greift das nicht zuverlässig
  (Verdacht: tatsächliche Zeilenhöhe ≠ `rowHeight` bzw. sichtbare Höhe falsch berechnet, z. B.
  durch Meldungsbereich/Filterzeile). Ursache im Browser bestätigen.
- Neu: Bei Bewegung per Tastatur (Pfeile, Enter, Tab, Bild↑/↓, Enter im Editor) wird die
  Cursorzeile **vertikal zentriert**:
  `scrollTop = Zeilenposition − (sichtbare Höhe − Zeilenhöhe)/2`, begrenzt auf 0 … max.
  Sichtbare Höhe = `scroller.clientHeight − thead.offsetHeight`; Zeilenposition aus der
  gerenderten `tr` (`offsetTop`), sonst `index * rowHeight`.
- Mausklicks zentrieren nicht (sonst springt die Liste unter der Maus); `scrollWatch.own`
  bleibt gesetzt, damit die Sprung-Diagnose nicht anschlägt.

### 3. Mengen mit + und − (CR 3)
- `grid.js` Keydown (1088 ff.): In einer Mengenspalte (`column.step`) zählen `+` und `-`
  (auch Ziffernblock) hoch bzw. runter wie Shift+↑/↓; in anderen Spalten bleiben sie normale
  Eingabe. Im geöffneten Zelleditor ändert sich nichts.
- Doku (`doku.html`, Tastaturtabelle 361 ff.), Tutorial (`tour.js:27`) und Hinweis im
  Editiermodus: eigene, hervorgehobene Zeile „**+ / −** oder **Shift+↑ / Shift+↓**: Menge
  ±1 – das ist in Tabellenprogrammen kein Standard, sondern eine Besonderheit dieser App“.

### 4. Löschen macht aus der Zeile eine ○-Lücke (CR 4)
- `app.js/removeRow` (1726): Die Zeile wird wie bisher aus `collection.rows` entfernt;
  `model.withGaps` zeigt ihre Variante danach als ○-Zeile an derselben Stelle. Anker ist die Id
  (genauer: Id + Edition + Art Treatment wie in `variantKey`).
- Rückfrage im Bestätigungsdialog passend formulieren: steht die Variante in den Stammdaten
  → „Zeile leeren? Mengen und Notiz werden entfernt, die Variante bleibt als ○ in der Liste“;
  sonst → „Zeile vollständig löschen?“.
- Nach dem Löschen steht der Cursor auf der neuen ○-Zeile (neue Hilfsfunktion sucht sie in
  `state.shownRows` nach `variantKey`). Ist die Variante noch durch eine andere Zeile gedeckt
  (z. B. zweite Sprache), verschwindet die Zeile – Meldung nennt die verbleibende Zeile.
- Befund prüfen: warum die Zeile bei Elmar ganz verschwand (Kandidaten: doppelte Zeile,
  Edition/Treatment nicht als Stammdaten-Variante erkannt, Schnellfilter „Nur Bestand“). Bei
  einem Fehler in der Variantenzuordnung wird dieser behoben.
- Hinweis in der Doku: Wird die letzte Zeile eines Sets gelöscht, verschwindet das Set (wie vor
  dem Aufnehmen); über „Sets aufnehmen“ kommt es wieder.
- Protokoll: Aktion „Geleert“ (Variante bleibt als ○) bzw. „Gelöscht“.

### 5. Neue Zeile mit Vorbelegung (CR 5)
- `app.js/onAction('insert')` (1706): Set und Edition von der Zeile darüber, **Id + 1** mit
  gleicher Stellenzahl (`MON062` → `MON063`; ohne Zahl am Ende bleibt die Id leer).
- Neue Funktion `model.commonValues(id)`: alle Varianten dieser Id in den Stammdaten
  (`FCT.reference.printings(id)`); jede Stammdatenspalte (Name, Backside Name, Pitch, Rarity,
  Metatype, Talent/Class/Type/Sub …) und Playset, deren Wert **in allen Varianten gleich** ist,
  wird eingetragen; abweichende Spalten (z. B. Art Treatment, Rarity bei Marvel) bleiben leer.
  Werte über `FCT.reference.expected` bzw. dieselbe Zerlegung wie `referenceRows`.
- Id nicht in den Stammdaten → Verhalten wie bisher (Set, Metatype, Talente, Klassen, Playset
  von der Zeile darüber).
- Selbsttest: Id-Hochzählen, gemeinsame vs. abweichende Felder.

### 6. Aktionen: „In den Bestand aufnehmen“ unterscheidbar, beides möglich (CR 6)
- `grid.js/ICONS`: neues Symbol `adopt` (Häkchen in einem Kasten bzw. Pfeil in die Ablage),
  deutlich anders als das Plus von `insert`; Tooltips „In den Bestand aufnehmen“ /
  „Neue Zeile darunter einfügen“.
- ○-Zeilen bekommen zusätzlich **„Neue Zeile darunter einfügen“** (und „Kopie einfügen“, falls
  etwas kopiert ist). Dafür die Platzsuche aus `adoptReferenceRow` (1645) in eine Hilfsfunktion
  `placeInSet(id)` auslagern; `insertBelow` nutzt sie, wenn die Zeile darüber eine ○-Zeile ist
  (heute würde `indexOf` −1 liefern und am Dateianfang einfügen).
- Breite der Aktionsspalte (`ACTIONS_WIDTH`) prüfen.

### 7. Firefox: eine Datei statt vieler (CR 7)
- `storage.js`: Downloads immer mit **festem Namen** – Bestand unter seinem Namen,
  Protokoll `<bestand>-log.csv` (vollständige Datei aus der Kopie im Browser, nicht nur neue
  Zeilen), Diagnose `fct-diagnose.log` (`diagnosis.js:67`, heute mit Zeitstempel). Backups und
  Fabrary-Export behalten den Zeitstempel (sollen ja neue Dateien sein).
- Das Protokoll für Firefox kommt aus `changelog.entries()` (bis `changelog.LIMIT`), die schon
  in der IndexedDB-Kopie liegen.
- Einmaliger Hinweis beim ersten Speichern in Firefox (und in der Statuszeile/Doku): In den
  Firefox-Einstellungen „Jedes Mal nachfragen, wo gespeichert werden soll“ einschalten, dann
  wählt man Ort und Namen selbst und bestätigt das Überschreiben; ohne diese Einstellung hängt
  Firefox „(1)“ an. Ehrlich formuliert: automatisches Überschreiben erlaubt Firefox nicht.
- Doku-Abschnitt „Firefox“ mit Schritt-für-Schritt-Anleitung.

### 8. Dialog „Arbeitsordner festlegen“ (CR 8)
`app.js/ensureFolder` (609): Text in zwei Spalten/Absätzen „Mit Arbeitsordner“ vs. „Ohne
Arbeitsordner“: ohne Ordner wählt man jede Datei (Bestand, Protokoll, Backups) einzeln im
Dateidialog, das Protokoll wird beim ersten Speichern gesondert gefragt, der Browser fragt nach
jedem Start je Datei nach der Erlaubnis, das Diagnose-Log kommt als Download. Hinweis, dass sich
das später über „Ordner …“ ändern lässt. Knopf heißt „Ohne Arbeitsordner (Dateien einzeln)“.

### 9. Dialog „Bestand öffnen – Ordner …“ (CR 9)
`app.js/pickFromFolder` (702):
- Kein Bestand im Ordner → Frage mit drei Wegen: „1.0-Tabelle importieren (.ods)“,
  „Fabrary-Export importieren“, „Erstes Set aus den Stammdaten übernehmen“ (legt einen neuen
  Bestand im Ordner an, siehe Paket 10, und öffnet danach „Sets aufnehmen“).
- Knopf „Andere Datei …“ wird zu **„Anderen Arbeitsordner auswählen …“** (`chooseFolder`,
  danach Liste des neuen Ordners). Dateien außerhalb eines Arbeitsordners öffnet man, indem man
  ihren Ordner wählt; ohne Arbeitsordner bleibt der normale Dateidialog.

### 10. Eigener Dialog für „Neu“ (CR 10)
`app.js/newCollection` (507) wird ein Dialog, der den aktuellen Bestand erst nach
Bestätigung ersetzt; „Abbrechen“ lässt alles, wie es ist:
- Text: „Der aktuelle Bestand <Name> bleibt als Datei erhalten und lässt sich jederzeit über
  ‚Öffnen‘ wieder laden.“ Bei ungespeicherten Änderungen zusätzlich Warnung plus Knopf
  „Erst speichern“.
- Feld **Name** (Vorschlag `bestand.csv`, `.csv` wird ergänzt) und **Ort**:
  - mit Arbeitsordner: der Arbeitsordner (zuletzt gewählter Ort), daneben „Anderen Ordner …“;
    Existiert der Name schon → Rückfrage (wie `askFileName`, 737).
  - Chrome/Edge ohne Ordner: „Speichern unter“ (`showSaveFilePicker`) mit Startort = Ordner
    der zuletzt geöffneten Datei (`startIn: <letzter Handle>`, `id: 'fct-collection'`).
  - Firefox: nur Name; gespeichert wird beim ersten Strg+S als Download (Paket 7).
- Bestätigen legt die Datei sofort an (leerer Bestand mit Kopfzeile), setzt sie als geöffnete
  Datei (Autosave-Frage wie bei `openResult`) und zeigt den Leer-Hinweis mit „Sets aufnehmen“.
- Gemeinsame Funktion `createCollectionFile(name)` für Paket 9 und 10.

### 11. „Übernehmen …“ bei leerem Bestand (CR 11)
`app.js/applyReference` (2111): Ist `state.collection.rows` leer, erklärt eine eigene Meldung:
„Der Bestand ist leer – es gibt nichts, worauf Stammdaten übernommen werden können. Zuerst
Zeilen anlegen: Sets aufnehmen, 1.0-Tabelle oder Fabrary importieren.“ (mit Knopf „Sets
aufnehmen …“).

### 12. Farbcode erklären (CR 12)
- Badge `reference-status` (`app.js/referenceStatus`, 1952): Tooltip immer mit Legende –
  **grün** = online geladen, aktueller Standard-Branch; **orange** = Vorschau-Branch oder online
  nicht erreichbar (mitgelieferte Daten gelten); **grau** = mitgelieferte Daten / wird geladen.
- „Info“-Dialog der Stammdaten (`showReferenceInfo`) und `doku.html` bekommen dieselbe
  Legende, dazu die Farben in der Tabelle (≠ orange = weicht ab, ✱ lila = lokal geändert,
  ○ grau = noch nicht im Bestand, rot/grün = fehlt zum Playset/überzählig).

### 13. Wording „Variante“ (CR 13, geändert am 25.09.2026)
Befund: Eine Zeile ist nicht ein Printing, sondern **Kartennummer + Edition + Art Treatment**
(`model.variantKey`); die Foilings sind die Mengenspalten ST/RF/CF/GF, Vorder- und Rückseite
gehören zur selben Zeile. Ein Printing im Sinne von FaB/Cardmarket entspricht also einer
Mengenzelle. Elmars Entscheidung: **„Variante“**.
- „Druck/Drucke/Druckvariante“ → „Variante/Varianten“ in allen sichtbaren Texten: `app.js`
  (8 Stellen, z. B. „fehlende Varianten“, „Set mit 250 Varianten“, „+N Varianten gegenüber
  vorher“, Info „Umfang: … Varianten“), `reference-update.js`, `tour.js`, `index.html`
  (Schnellfilter „Nur Bestand (ohne fehlende Varianten)“), `doku.html` (12), `README.md` (4).
- „Zeile“ bleibt für die Tabellenaktionen (Zeile löschen, Neue Zeile darunter, Zeilen im
  Bestand).
- „Printing“ nur für die Foilings (Tooltip ST/RF/CF/GF, Paket 14).
- Glossar in `doku.html`: Karte → Variante (eine Zeile) → Printing (Mengenzelle ST/RF/CF/GF);
  eigene Zeilen (z. B. andere Sprache) sind zusätzliche Zeilen derselben Variante.
- Alte Pläne/Feedbacks in `docs/` bleiben unverändert (Historie). Abschließend
  `grep -i druck` ohne Treffer in UI-Texten.

### 14. Tooltip der Mengenspalten (CR 14)
Neue Spalteneigenschaft `hint` (`app.js/buildColumns`), vom Kopf in `grid.js/buildHeader`
(238) als Tooltip vor „klicken zum Sortieren“ ausgegeben, auch in der Spaltenauswahl:
- ST: „Standard – die regulären (Regular) Printings; ‚Standard‘ heißt es bei Cardmarket“
- RF: „Rainbow Foil“ · CF: „Cold Foil“ · GF: „Gold Cold Foil“
Doku-Spaltenliste entsprechend.

### 15. Selbsttest, Doku, Abschluss
- Selbsttest neu: Id + 1 mit Stellenzahl, `commonValues` (gleiche/abweichende Felder),
  Löschen → Variante erscheint als ○ an derselben Stelle, Einfügen unter ○-Zeile landet im
  richtigen Set, feste Download-Namen, keine „Druck“-Texte in UI-Dateien.
- `doku.html`, `tour.js`, `README.md`; Abschnitt „Abweichungen und Befunde“ und „Abnahme“ im
  Plan in `docs/`.

## Reihenfolge
1 → 13 → 14 → 3 → 2 → 6 → 5 → 4 → 11 → 12 → 8 → 10 → 9 → 7 → 15. Wording zuerst,
damit neue Texte gleich stimmen; Dialoge 8–10 zusammen, weil 9 die Neuanlage aus 10 nutzt.
Nach jedem Paket Selbsttest.

## Kritische Dateien
`app/app.js` (removeRow, onAction/insertBelow, adoptReferenceRow, rowActions, newCollection,
ensureFolder, pickFromFolder, applyReference, referenceStatus, buildColumns, save/writeLog),
`app/grid.js` (scrollToRow, Keydown, ICONS, buildHeader), `app/model.js` (commonValues, Id + 1),
`app/storage.js` (Downloads mit festem Namen, saveAs mit startIn), `app/diagnosis.js`,
`app/tour.js`, `app/reference-update.js`, `index.html`, `doku.html`, `README.md`,
`tools/selftest.mjs`, `VERSION`, `app/core.js`.

## Prüfung
- `node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export Beispiel.csv"
  <Quellordner>` → alle grün, Zeilen ≤ 100.
- Chrome über `localhost` mit `Cache-Control: no-store` (Erweiterung, sonst Edge headless):
  „Übernehmen …“ startet zugeklappt bzw. erklärt den leeren Bestand; ST-Spalte mit Enter/↓
  über 50 Zeilen – Zeile bleibt mittig; + / − ändern Mengen; Zeile löschen → grau ○ an gleicher
  Stelle, Cursor darauf; ＋ unter MON062 → MON063 mit gemeinsamen Feldern, Art Treatment leer;
  ○-Zeile hat zwei unterscheidbare Symbole, Einfügen darunter landet im Set; „Neu“ →
  Abbrechen lässt den Bestand stehen, Bestätigen legt die Datei im Arbeitsordner an;
  „Öffnen“ in leerem Ordner bietet Import/erstes Set/anderen Ordner; Tooltips an Badge und
  ST/RF/CF/GF; kein „Druck“ mehr in der Oberfläche; Konsole und Diagnose-Log ohne Fehler.
- Firefox (Elmar): mit „Jedes Mal nachfragen“ überschreibt Strg+S dieselbe Datei; Protokoll
  und Diagnose haben feste Namen. Dazu `file://` in Chrome/Firefox.

## Abweichungen und Befunde bei der Umsetzung
- **Paket 2 (Scrollen):** Die Ursache des alten Verhaltens ließ sich nicht nachstellen; die
  Zeilenhöhe ist per CSS fest, die Rechnung `index * rowHeight` stimmt. Umgesetzt ist das
  Zentrieren bei jeder Tastaturbewegung (`scrollToRow(index, centre)`); Klicks und der
  Editor-Start per Maus machen die Zeile wie bisher nur sichtbar.
- **Paket 4 (Löschen):** Das Modell hat eine gelöschte Variante schon in 2.0.5.0 als ○
  gezeigt. Befund in Elmars `collection.csv` (6.818 Zeilen): 901 Zeilen passen zu keiner
  Stammdaten-Variante (536 × Edition „DE“, 257 × IAR, 2HP000, MST239 – überwiegend Ids, die
  nur in neueren Online-Daten stehen), 593 Zeilen teilen ihre Variante mit einer anderen Zeile
  (z. B. EN und DE derselben Karte). Solche Zeilen verschwinden beim Löschen ganz – das war
  wohl der beobachtete Fall. Jetzt sagt die Rückfrage vorher, was passiert, und bei geteilter
  Variante nennt eine Meldung die verbleibende Zeile.
- Bei mehreren Zeilen derselben Kartennummer (z. B. Alpha und Unlimited) steht die ○-Zeile
  an ihrer Kartennummer, kann aber mit der Schwesterzeile den Platz tauschen (Reihenfolge bei
  gleicher Id = Dateireihenfolge).
- **Paket 6:** ○-Zeilen haben jetzt ✎, „In den Bestand aufnehmen“ (Pfeil in eine Ablage), ＋
  und „Kopie einfügen“. `placeInSet` ist aus `adoptReferenceRow` herausgelöst.
- **Paket 7:** Der Firefox-Hinweis kommt einmal vor dem ersten Download (Merkmal
  `downloadHint2060`); die Meldung nach jedem Download wiederholt die Einstellung kurz.
- **Paket 9:** Aus „Erstes Set aus den Stammdaten übernehmen“ wird der Neu-Dialog (Name) mit
  anschließendem „Sets aufnehmen“. Importe aus dem Öffnen-Dialog fragen nicht noch einmal nach
  ungespeicherten Änderungen.
- **Paket 10:** Ein vorhandener Dateiname wird beim Anlegen nie überschrieben (Meldung,
  Dialog erneut). „Anderen Ordner …“ macht den gewählten Ordner erst beim Anlegen zum
  Arbeitsordner.
- Doku-Nebenbefund: Der Satz „Spaltenüberschriften … wo nötig in zwei Zeilen“ (Stand 2.0.4.0)
  war veraltet und ist korrigiert; der Vorschau-Branch heißt in der Doku jetzt „orange“ (wie
  angezeigt) statt „gelb“.
- Werkzeug-Hinweis: Python-Heredocs in Git Bash machen aus `\n` echte Zeilenumbrüche – zwei
  Stellen mussten korrigiert werden; Ersetzungen laufen seitdem über eine Spezifikationsdatei.

## Abnahme (25.09.2026)
- Selbsttest: **33 Prüfungen grün** (ohne Quellordner; neu: „New row values“, „Delete becomes a
  gap“ an 41 Stichproben der 1.0-Tabelle, „Download names and wording“); alle Zeilen ≤ 100.
- Chrome (Erweiterung) über `localhost` mit no-store und einer Testkopie im Browser (ohne
  Datei-Handle, nichts gespeichert): 30 × ↓ in ST – Zeile steht mittig (585 px bei Mitte
  585 px); `+`/`-` zählen, Tooltips an ST und an den Knöpfen; ○-Zeile mit vier
  unterscheidbaren Symbolen, ＋ unter HER030 legt HER031 mit Name, Typ, Klasse, Rarity und
  Playset an; Löschen des Duplikats → ganz weg mit Meldung, Löschen der einzigen Zeile → ○,
  Cursor darauf; „Übernehmen …“ mit 28 Sets, alle zugeklappt; Arbeitsordner-Dialog mit
  Erklärung; „Neu“ → Dialog mit Name/Ort/Warnung, Abbrechen lässt den Bestand stehen;
  Badge-Tooltip mit Farblegende; keine Konsolenfehler.
- Nicht automatisch prüfbar (Datei- und Ordnerdialoge des Browsers): Anlegen im Arbeitsordner,
  leerer Ordner im Öffnen-Dialog, „Anderen Arbeitsordner auswählen“, „Übernehmen“ bei leerem
  Bestand, Firefox-Downloads.
- Offen bei Elmar: diese Punkte, Firefox mit „Jedes Mal nachfragen“, `file://`.
