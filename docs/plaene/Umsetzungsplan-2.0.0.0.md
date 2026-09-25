# Umsetzungsplan FabCollectionTool 2.0.0.0

**Stand:** 23. September 2026 · **Status:** umgesetzt (Schritte 1–10 und 11), Abnahme siehe unten
**Grundlagen:** `docs/AUDIT.md`, `docs/Konzept-Neuentwicklung.docx`, `docs/Konzept.md`

---

## Ausgangslage und Ziel

Das bestehende Tool (.NET 6 Konsole + 28-MB-ODS) hat laut Audit 27 Befunde, davon sechs schwere,
und erzeugt vor allem *still falsche* Exportdateien. Statt es zu reparieren, entsteht daneben eine
Neuentwicklung. Das Feedback in `docs/Konzept.md` bestätigt CSV als Datenformat und die statische
Web-Anwendung als Oberfläche und ergänzt eigene Prioritäten.

**Ziel:** eine lauffähige erste Fassung, Version **2.0.0.0**, in `src/FabCollectionTool2/`,
mit der ein Umstieg vom Calc-File möglich ist.

### Harte Randbedingung: das Bestehende bleibt unangetastet

Nichts unter `src/FabCollectionTool/`, `dist/`, `readme.md` oder die vorhandene `.gitignore` wird
geändert. Das alte Tool muss unverändert baubar und lauffähig bleiben — es dient später als
Vergleichsmaßstab. Ein eigenes `.gitignore` wird **innerhalb** von `src/FabCollectionTool2/`
angelegt, damit die Wurzel-Datei unberührt bleibt.

### Getroffene Entscheidungen

| Frage | Entscheidung |
|---|---|
| Umfang v1 | Fundament, Bestandsraster, **ODS-Import**, **Fabrary-Import**, **Fabrary-Export** |
| Datenhaltung | **Rein dateibasiert** — öffnen und speichern, kein Browser-Speicher |
| Auslieferung | **Nur Checkout**, keine GitHub Pages |
| Stammdaten | **Mitgeliefert im Repo** + **automatische Online-Aktualisierung beim Start** (entschieden 23.09.2026) |

### Maßgebliche Punkte aus `docs/Konzept.md`

- **Nie Nutzerdaten im Repo.** Das Repository enthält nur das Werkzeug. Alles, was der Nutzer
  lokal erzeugt, bleibt lokal. *(Damit entfällt das `data/collection.csv` aus dem Konzept-Dokument.)*
- **Solide Backup-Funktion**, optional in der Cloud — Speichern in einen OneDrive-Ordner genügt,
  darf aber nicht vorausgesetzt werden.
- Geschätzt wird am Bestehenden: **starkes Filtern/Ausblenden**, **Druckvarianten tabellarisch
  untereinander**, leichte manuelle Bearbeitbarkeit.
- Stört: große Datei, unsichtbar kaputte Berechnungen, komplizierte Parser, langsamer Export,
  keine Kartenaktualisierung, kein Komfort möglich, stößt an Grenzen.
- Unkritisch: manuelles Einpflegen, Index-Mapping, die Calc-Formeln (dienten nur der Sichtbarkeit
  per Farbkennung und wurden selten angestoßen).
- **Fabrary ist mit Abstand das wichtigste Zielsystem**, danach Cardmarket. TCGplayer nur am Rande.

---

## Technische Randbedingungen (geprüft, nicht angenommen)

Aus „nur Checkout“ folgt, dass die Anwendung über `file://` laufen muss. Das schränkt hart ein:

| Mechanismus | Über `file://` | Konsequenz |
|---|---|---|
| `localStorage`, IndexedDB | **blockiert** (opaque origin) | Kein Browser-Speicher — passt zur Entscheidung „rein dateibasiert“ |
| `fetch()` auf lokale Dateien | **blockiert** | Stammdaten **nicht** als CSV nachladbar |
| `<script type="module">` | **blockiert** | Keine ES-Module |
| `<script src="...">` klassisch | **funktioniert** | **Stammdaten als generierte `.js`-Dateien ausliefern** |
| `<input type="file">` + `FileReader` | funktioniert | Weg zum Öffnen von Bestand, ODS und Fabrary-CSV |
| `<a download>` + Blob-URL | funktioniert | Weg zum Speichern und für Backups |
| `DecompressionStream('deflate-raw')` | funktioniert (alle Browser) | ODS-Import ohne Fremdbibliothek möglich |
| `fetch()` auf HTTPS mit CORS | **funktioniert** (`raw.githubusercontent.com` sendet `Access-Control-Allow-Origin: *`) | Stammdaten beim Start online nachladbar |

Daraus ergibt sich die Bauweise: **klassische Skripte mit einem globalen Namensraum `FCT`, keine
Module, kein Build-Schritt, keine Abhängigkeiten.**

---

## Zielstruktur

```
src/FabCollectionTool2/
  index.html              Einstieg; lädt alle Skripte in fester Reihenfolge
  VERSION                 "2.0.0.0"
  README.md               deutsch: Start, Bedienung, Dateiformate, Backup
  .gitignore              schützt vor versehentlich abgelegten Nutzerdaten
  app/
    style.css
    core.js               Namensraum FCT, Version, kleine DOM-Helfer
    csv.js                CSV lesen/schreiben (RFC 4180: Quoting, Komma, Zeilenumbruch)
    reference-transform.js Quell-CSVs -> Stammdaten (gemeinsam für Build und Online-Update)
    model.js              Bestandsmodell + Berechnungen (Have/Need/Left)
    storage.js            Datei öffnen / speichern / Backup mit Zeitstempel
    grid.js               Raster, Sortierung, Filter, Spaltenauswahl
    import-ods.js         ODS lesen (ZIP via DecompressionStream + DOMParser)
    import-fabrary.js     Fabrary-Export-CSV als Bestandsquelle
    export-fabrary.js     Fabrary-Import-CSV nach dem Skelett-Verfahren
    reference-update.js   Online-Aktualisierung der Stammdaten beim Start
    app.js                Verdrahtung, Zustand, Meldungen
  reference/
    printings.js          aus card-printing.csv erzeugt
    cards.js              aus card.csv erzeugt
    sets.js               aus set.csv erzeugt
    vocab.js              Foiling, Rarity, Edition, Art-Variante
    fabrary-skeleton.js   aus dem Fabrary-Export erzeugt, ohne Mengen
    info.js               Herkunft und Stand der Stammdaten
    README.md             Herkunft, Stand, wie zu erneuern
  tools/
    build-reference.mjs   erzeugt reference/*.js aus den Quell-CSVs (nur Wartung)
    load-app.mjs          lädt die App-Skripte in Node.js (für Build und Selbsttest)
    selftest.mjs          automatische Abnahmeprüfungen (nur Wartung)
```

Die `reference/*.js` enthalten je einen Datensatz pro Zeile
(`FCT.DATA.printings = [` … `["WTR001","WTR",…],` … `];`), damit sie in Git zeilenweise
vergleichbar bleiben und ohne CSV-Parser auskommen.

> **Achtung bei `fabrary-skeleton.js`:** `docs/Fabrary Export Beispiel.csv` ist der *persönliche*
> Export mit echten Bestandsmengen. Für das Skelett werden die fünf Mengenspalten geleert; nur
> Identifier, Name, Pitch, Set, Set number, Edition, Foiling und Treatment werden übernommen.
> Es dürfen keine Bestandszahlen im Repository landen.

---

## Datenmodell: `collection.csv`

Bewusst nah am gewohnten Calc-Aufbau — eine Zeile je Druckvariante, vier Mengenspalten
nebeneinander. Das erfüllt „Druckvarianten tabellarisch untereinander“ und hält die Datei kurz.

```
Id,Edition,ArtTreatment,Playset,ST,RF,CF,GF,Note,Name,Set,Pitch,Rarity
```

- **Schlüssel:** `Id` + `Edition` + `ArtTreatment` (`Id` wie `WTR001` enthält den Set-Code).
  Der Abgleich gegen die Fabrary-Referenz hat gezeigt: Kartennummern treffen zu 100 %,
  Namen und Identifier nicht — deshalb wird nie über den Namen zugeordnet.
- **Nutzereigen:** `Playset`, `ST`, `RF`, `CF`, `GF`, `Note`.
- **`Name`, `Set`, `Pitch`, `Rarity`** werden aus den Stammdaten abgeleitet und beim Speichern
  neu geschrieben. Sie stehen nur zur menschlichen Lesbarkeit in der Datei und sind beim Laden
  nicht maßgeblich; Abweichungen werden gemeldet, nicht übernommen.
- Die sechs Formelspalten des Calc-Files entfallen — Have/Need/Left rechnet die Anwendung
  und zeigt sie im Raster farbig an (das war laut Feedback ohnehin ihr einziger Zweck).

---

## Umsetzungsschritte

1. **Gerüst** — Ordner, `VERSION` mit `2.0.0.0`, `.gitignore`, `index.html` mit fester Skript-
   Ladereihenfolge, `core.js` mit Namensraum und Versionsanzeige. Sichtbarer Beleg: Seite öffnet
   sich über `file://` und zeigt „FabCollectionTool 2.0.0.0“.
2. **`csv.js`** — robustes Lesen und Schreiben nach RFC 4180: Anführungszeichen, eingebettete
   Kommas und Zeilenumbrüche, BOM, CRLF/LF. Das adressiert die Sorge aus `docs/Konzept.md`, dass
   fremde Werkzeuge CSV zerlegen: Wir schreiben konservativ (immer quoten) und lesen tolerant.
3. **`tools/build-reference.mjs` + `reference/*.js`** — Quell-CSVs des offenen Datensatzes und den
   Fabrary-Export einlesen, auf die benötigten Spalten reduzieren, Mengen entfernen, `.js`
   erzeugen. Das Skript ist Wartungswerkzeug und wird nicht vom Nutzer ausgeführt.
4. **`model.js`** — Bestand laden/halten, Zuordnung zu Stammdaten über die Kartennummer,
   Berechnungen Have/Need/Left je Set und gesamt, Validierung gegen die Vokabularlisten.
   Unzuordenbare Zeilen gehen nie verloren, sondern in eine Meldeliste.
5. **`grid.js`** — Tabelle mit Sortierung, Freitextsuche und Spaltenfiltern, Spalten ein- und
   ausblendbar, farbliche Kennzeichnung für „fehlt“ / „überzählig“. Das ist die wichtigste
   Komfortfunktion — sie ersetzt, was heute LibreOffice leistet.
6. **`storage.js`** — Bestand öffnen (`<input type="file">`), speichern und „Backup erstellen“
   (Download mit Zeitstempel im Namen). Statusanzeige mit Dateiname und Hinweis auf
   ungespeicherte Änderungen. README erklärt, dass ein OneDrive-Ordner als Ziel genügt, um ein
   Cloud-Backup zu erhalten.
7. **`import-ods.js`** — ODS = ZIP. Zentralverzeichnis lesen, `content.xml` per
   `DecompressionStream('deflate-raw')` entpacken, mit `DOMParser` auswerten. Spalten **über die
   Kopfzeilen-Namen** zuordnen, `number-columns-repeated` korrekt behandeln, kein Spaltenlimit.
   Damit sind die Audit-Befunde C1, C2 und C3 konstruktiv ausgeschlossen. Ergebnis ist eine
   Vorschau mit Abweichungsbericht, erst danach wird übernommen.
8. **`import-fabrary.js`** — Fabrary-Export-CSV einlesen, über `Set number` + `Edition` +
   `Treatment` zuordnen, Foiling-Zeilen zu ST/RF/CF/GF zusammenfassen. Vorschau und Bericht wie
   bei 7. Die 87 nicht eindeutig adressierbaren Zeilen werden gesondert ausgewiesen.
9. **`export-fabrary.js`** — Skelett aus `fabrary-skeleton.js` nehmen, Identitätsspalten
   zeichengenau übernehmen, nur die Mengenspalten füllen, übrige Zeilen erhalten. Ausgabe als
   Download. Protokoll: gelesen / geschrieben / übersprungen je Grund.
10. **`README.md`** (deutsch) — Start ohne Installation, Bedienung, Dateiformate,
    Backup-Empfehlung, Migration aus dem Calc-File, Grenzen (kein Browser-Speicher, Speichern
    läuft über Download).

---

## Code-Regeln (aus `docs/Konzept.md`)

- Jeder logische Block wird mit einem kurzen Kommentar eingeleitet, der erklärt, was er tut.
- **Maximal 100 Zeichen pro Zeile.**
- Code und Code-Kommentare **englisch**; `.md`-Dokumentation **deutsch**.
- Wartbarkeit und Lesbarkeit vor Kürze. Keine Frameworks, keine Abhängigkeiten, kein Build.
- Keine `fetch`-Aufrufe auf lokale Dateien, keine ES-Module, kein `localStorage` — siehe
  Randbedingungen oben.

---

## Abnahme und Prüfung

- **Startet ohne alles:** `index.html` im Browser über `file://` öffnen — Oberfläche erscheint,
  Konsole ohne Fehler, Version zeigt `2.0.0.0`. In Chrome **und** Firefox prüfen.
- **Altbestand bleibt intakt:** `git status` zeigt ausschließlich neue Dateien unter
  `src/FabCollectionTool2/`; zusätzlich
  `dotnet build src/FabCollectionTool/FabCollectionTool.sln -c Debug` erneut ausführen — muss
  weiterhin ohne Fehler durchlaufen.
- **ODS-Import:** `docs/example.ods` einlesen. Erwartung: rund 6.895 Zeilen erkannt, Bericht
  nennt jede nicht zugeordnete Kopfzeile und jeden unbekannten Set-Code.
- **Fabrary-Import:** `docs/Fabrary Export Beispiel.csv` einlesen. Erwartung: 16.659 Zeilen
  gelesen, Zeilen mit Menge > 0 werden zu Bestand, der Rest ignoriert.
- **Fabrary-Export:** Nach dem ODS-Import exportieren und die Ausgabe gegen
  `docs/Fabrary Export Beispiel.csv` diffen — Kopfzeile identisch, Spaltenzahl identisch,
  Identitätsspalten unverändert, nur Mengen abweichend.
- **Round-Trip:** Fabrary-Import → Export → erneut importieren. Der Bestand muss identisch sein.
- **CSV-Robustheit:** Eine Karte mit Komma im Namen (z. B. „Rhinar, Reckless Rampage“) und eine
  mit Sonderzeichen speichern, Datei neu laden — Werte müssen unverändert sein.
- **Keine Nutzerdaten im Repo:** `reference/fabrary-skeleton.js` enthält keine Zahl in den fünf
  Mengenspalten (per Suche belegen).
- **Zeilenlänge:** Prüfen, dass keine Quelldatei Zeilen über 100 Zeichen hat.

---

## Ausblick (ausdrücklich **nicht** Teil dieser Fassung)

- **Cardmarket-Export** und die beiden übrigen Zielsysteme.
- **Cardmarket-Preise** — dazu die erbetenen Ideen, alle noch zu bewerten: Einlesen des eigenen
  Angebots-/Bestandsexports, den Cardmarket Verkäufern anbietet; der Preisguide steht nur
  gewerblichen Konten offen; ein API-Zugang ist nicht zu erwarten und Auslesen der Website
  scheidet aus. Als grobe Tendenz ließen sich TCGplayer-Preise über die im Stammdatensatz
  vorhandene `tcgplayer_product_id` anbinden — laut Feedback aber nur von Randinteresse.
- ~~Online-Aktualisierung der Stammdaten~~ — am 23.09.2026 in diese Fassung vorgezogen.
- Online-Aktualisierung des **Fabrary-Skeletts** (bisher nur über `tools/build-reference.mjs`).
- Import in einen bestehenden Bestand **zusammenführen** statt ihn zu ersetzen.

---

## Abweichungen bei der Umsetzung (23.09.2026)

Beim Bauen haben die echten Daten einige Annahmen des Plans widerlegt. Die Abweichungen:

1. **Datenmodell: alle Spalten des Calc-Files statt 13.** `docs/example.ods` enthält
   Sprach-Editionen (EN, DE, FR, JP), übersetzte Namen, Rückseitennamen, Talent/Class/Type/Sub
   und Peculiarity. `Id + Edition + ArtTreatment` ist dort **nicht eindeutig** (z. B. Tokens
   mit gleicher Nummer, aber anderer Rückseite, „CC Label“-Varianten, 2HP000). Deshalb
   übernimmt `collection.csv` alle 25 Nicht-Formelspalten mit den Überschriften des Calc-Files
   plus `Note`. Die Zeilen sind eine Liste, kein Schlüssel-Wert-Speicher. Name/Set/Pitch/Rarity
   werden **nicht** aus den Stammdaten überschrieben, sondern nur dagegen geprüft; Abweichungen
   werden gemeldet. Unbekannte Spalten werden als Zusatzspalten mitgeführt.
2. **Stammdaten sind TSV.** Die Quelldateien von the-fab-cube sind tabulatorgetrennt;
   `csv.js` kann das Trennzeichen wählen.
3. **ODS ohne `DOMParser`.** `content.xml` wird mit einem kleinen eigenen Tokenizer gelesen
   (Tabellen, Zeilen, Zellen, Absätze, Kommentare überspringen, Wiederholungen). Er ist schneller
   (0,4 s statt mehrere Sekunden für 28 MB) und in Node.js testbar.
4. **Speichern:** Chrome/Edge schreiben per File System Access API direkt in die geöffnete Datei;
   Firefox fällt auf den Download zurück.
5. **Zusätzliche Dateien:** `tools/load-app.mjs` und `tools/selftest.mjs` für
   Build und automatische Abnahme, `reference/info.js` für Herkunft und Stand.
6. **Zahlen:** `docs/example.ods` liefert 6.236 Kartenzeilen (der Plan nannte „rund 6.895“)
   und 320 Zwischenüberschriften. Der Fabrary-Export hat 88 identische Doppelzeilen (der Plan
   nannte 87); sie werden beim Import gemeldet.
7. **„Alle Karten einblenden“:** Stammdaten-Drucke, die noch nicht im Bestand sind, lassen sich
   einblenden und durch Bearbeiten übernehmen. Das ist der Weg, neue Karten zu erfassen.

## Abnahme (23.09.2026)

| Prüfung | Ergebnis |
|---|---|
| Selbsttest `tools/selftest.mjs` | alle Prüfungen bestanden |
| CSV-Robustheit (Komma, Anführungszeichen, Zeilenumbruch, Umlaute) | bestanden |
| ODS-Import `docs/example.ods` | 6.236 Zeilen, 538 Kartennummern ohne Stammdaten (v. a. 2HP), 24 Namensabweichungen gemeldet |
| Fabrary-Import | 16.659 Zeilen gelesen, 6.248 mit Menge → 4.890 Bestandszeilen |
| Fabrary-Export nach ODS-Import | Kopfzeile und 16.660 Zeilen identisch, 0 Abweichungen in den Identitätsspalten |
| Round-Trip Fabrary → Export → Import | identisch |
| Skelett ohne Mengen | 16.659 Zeilen mit je 8 Identitätsspalten |
| Zeilenlänge ≤ 100 | bestanden (generierte Datendateien ausgenommen) |
| Stammdaten-Umwandlung reproduziert `reference/*.js` | bestanden |
| Browser (Chrome, über lokalen Server) | Oberfläche, Online-Aktualisierung, ODS-/Fabrary-Import, Bearbeiten, Filter; Konsole fehlerfrei |
| Browser über `file://` (Chrome **und** Firefox) | **von Hand zu prüfen** — die Testautomatisierung darf `file://` nicht öffnen |
