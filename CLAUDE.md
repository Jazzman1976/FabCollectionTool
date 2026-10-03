# CLAUDE.md – Arbeitsregeln für dieses Repository

Gilt für jede Claude-Sitzung, lokal wie in der Cloud (auch für geplante Agenten). Der
Maintainer ist **Elmar** (GitHub `Jazzman1976`). Er entscheidet, merged und veröffentlicht.

## Projekt
- **FabCollectionTool 2** (`src/FabCollectionTool2/`): statische Web-App (klassische Skripte,
  keine Module, kein Build) zur Verwaltung einer Flesh-and-Blood-Sammlung. Veröffentlicht als
  GitHub Page: <https://jazzman1976.github.io/FabCollectionTool/>. Aufbau, Dateien und
  Wartung stehen in `src/FabCollectionTool2/README.md`.
- `src/FabCollectionTool/` ist das alte Tool 1.0 (C#), nur noch Referenz.
- Unterstützter Browser: **Chrome** (Edge mit). Kein Firefox, keine Firefox-Workarounds.

## Sprache und Code
- **Code und Code-Kommentare englisch, alles andere deutsch** (Doku, Issues, PRs, Pläne,
  Release Notes, Oberfläche).
- Jeder logische Block beginnt mit einem kurzen Kommentar, was er tut. **Höchstens 100
  Zeichen pro Zeile** (der Selbsttest prüft das; generierte Daten in `reference/` ausgenommen).
- Lesbarkeit vor Kürze; so einfach wie möglich, so komplex wie nötig. Code so schreiben wie der
  umgebende Code.

## Fachliche Regeln
- **the-fab-cube ist die Quelle der Wahrheit** für Karten, Varianten und Foilings
  (`reference/*.js`, online aus the-fab-cube `develop`). Nur Varianten ausgeben, die es dort gibt.
- Fragen zu Talent, Klasse, Typ, Untertyp: im Regelwerk nachsehen, nicht raten
  (<https://rules.fabtcg.com/txt/latest/en-fab-cr.txt>, Typzeile nach Regel 2.14.1).
- Kartenbestandteile (Metatyp, Talent, Klasse, Typ, Untertyp …) bekommen je eine eigene,
  gespeicherte Spalte in der Reihenfolge der Karte.
- Die Spaltenfolge von `collection.csv` ist **genau** die der Tabelle (`model.COLUMNS`, ohne
  berechnete Spalten). Keine „nur Anzeige“-Umsortierung; die Reihenfolge darf sich aber mit
  der Ansicht ändern (alte Dateien werden über die Spaltennamen gelesen).
- **`collection.csv` ist keine Quelle für externe Tools.** Sie kann als Quelle herhalten, es
  gibt aber keine bekannten Abhängigkeiten, und wir supporten das nicht. Für unterstützte
  externe Tools gibt es stets eine eigene Exportdatei, die aus dem Bestand aufbereitet wird.
- In der Bestands-CSV nur relevante Daten, keine leeren Zeilen. Was dauerhaft zum Bestand gehört,
  aber nicht in die CSV passt, kommt in `<bestand>-config.json` im Arbeitsordner, nicht in
  Browser-Speicher (der ist nur für Ansichtseinstellungen).
- Fabrary-Export: *Have* nie leer (0 = fehlt). Wo Fabrary anders benennt, gilt die
  Fabrary-Zuordnung (`reference/fabrary-map.js` plus eigene Einträge in der Konfigurationsdatei).
  **Fabrarys Import ersetzt die ganze Sammlung** – Test-Dateien nie ins echte Konto.
- **Eigene Daten des Nutzers nie ins Repository** (Sammlung, Fabrary-Exporte mit Mengen,
  Quelldateien von the-fab-cube). Das Repository ist öffentlich. Ausnahme sind die vorhandenen
  Selbsttest-Daten in `docs/` (`example.ods`, `Fabrary Export Beispiel.csv`).

## Arbeitsablauf (GitHub-Projekt-Board + GitFlow)
Board: <https://github.com/users/Jazzman1976/projects/1>, Spalten Backlog, Approved, Ready,
Ready for dev, Changes requested, In progress, In review, Done, Closed. Remote heißt lokal
`github`, in der Cloud `origin`.

- **Done** = Entwicklung fertig und nach `develop` gemergt, aber noch nicht veröffentlicht.
  Das Issue bleibt **offen**.
- **Closed** = wirklich zu Ende: veröffentlicht, abgelehnt oder nicht reproduzierbar. Spalte
  „Closed“ und geschlossenes Issue gehören zusammen (abgelehnt: „Close as not planned“).
- **Changes requested** = Elmar hat beim Test in *In review* etwas gefunden; was zu ändern
  ist, steht als Kommentar im PR oder Issue.

1. **Approved** = Elmar hat das Issue freigegeben. Issue samt Bildern und Code lesen, offene
   Fragen klären.
2. **Plan nur als Kommentar im Issue** (keine Plan-Dateien mehr; `docs/plaene/` ist Archiv).
   Überschrift „## Umsetzungsplan“, darin: Branch-Name, Ursache bzw. Ausgangslage, Änderungen
   (Dateien, Verhalten), Nicht im Umfang, Abnahme. Überschneidungen mit anderen offenen Issues
   prüfen; echte Abhängigkeit als GitHub „Blocked by“ setzen und im Plan nennen. Dann Board
   **Ready** (= keine offenen Fragen).
3. Elmar reviewt und schiebt auf **Ready for dev**. **Erst dann umsetzen.**
4. **Branch** von aktuellem `develop`: `feature/issue-<n>-<kurzname>`, alles klein
   (ohne Issue `feature/<kurzname>`) → Board **In progress**.
5. Umsetzen, Selbsttest, Chrome-Check über localhost. Commit, Branch pushen, **PR nach
   `develop`** mit einer eigenen Zeile `Closes #<n>` (nie Beispielzeilen dieser Form in
   PR-Texte schreiben). In die PR-Beschreibung: **Umsetzung und Abweichungen** vom Plan und
   **Ergebnis der Abnahme**. Board **In review**.
6. **Elmar testet.** Fällt etwas auf, setzt er **Changes requested** und kommentiert; dann
   auf demselben Branch nachbessern (Board **In progress**), pushen, PR-Beschreibung
   ergänzen, Board wieder **In review**.
7. **Elmar merged** und setzt das Issue auf **Done** (oder meldet den Merge, dann setzt Claude
   es). Die Action `note-merge-on-develop.yml` vermerkt den Merge im Issue; das Issue bleibt
   offen bis zum Release.
8. Nach jedem Merge `develop` per Merge (kein Rebase, kein Force-Push) in offene
   Feature-Branches holen.

- Label **„in development“** gehört an jedes Issue mit Status außer Backlog und Closed – auch
  an Done, denn das Release steht noch aus.
- **`develop` und `main` werden nie gelöscht**, nie direkt beschrieben (nur per PR), nie
  force-gepusht. Aufräumen: nur `feature/`-Branches, die nachweislich gemergt sind.
- Merges nach `develop` oder `main` macht nur Elmar. Einzige Ausnahme: der Release-Abschluss
  nach Elmars ausdrücklicher Freigabe (siehe Release).
- Elmars Zusage „kann committed werden“ zählt als erfolgreicher Browsertest; keine
  „offen bei Elmar“-Listen.

## Release (Atlassian GitFlow)
- Versionsschema **Major.Minor.Release** (dreistellig seit 2.4.0, z. B. `2.4.0`).
- `release/<Major.Minor.0>` von `develop`. **Erst dort** Versionsnummer (`VERSION`,
  `FCT.VERSION` in `app/core.js`, alle `?v=` in `index.html` und `doku.html`, README-Titel)
  und Release Notes (`src/FabCollectionTool2/RELEASE-NOTES.md`).
- Vorher prüfen: Stammdaten-Stand gegen the-fab-cube `develop` (`reference/README.md`).
- Jede Korrektur auf dem Release-Branch erhöht die dritte Stelle (2.4.0 → 2.4.1).
  Fehler nach der Veröffentlichung: `hotfix/<Version>` von `main`.
- PR `release/<Version>` → `main` öffnen und Elmar Bescheid geben. Er testet final.
- **Release-Abschluss: nur nach Elmars ausdrücklicher Freigabe für genau dieses Release, nie
  selbstständig.** Mit der Freigabe sind alle Tests durch; dann erledigt Claude ohne weitere
  Rückfrage genau diese Schritte:
  1. PR `release/<Version>` → `main` mergen (die Action `pages.yml` testet und veröffentlicht).
  2. PR `release/<Version>` → `develop` öffnen und mergen.
  3. Tag `<Version>` (annotiert) auf den Merge-Commit auf `main` setzen.
  4. Den Release-Branch löschen (GitHub und lokal).
  5. Aufräumen: alle weiteren Branches außer `develop` und `main` löschen, die sicher gelöscht
     werden können (nachweislich gemergt), auf GitHub und lokal. Was nicht gemergt ist, bleibt
     und wird genannt.
  6. Alle Issues mit Board-Status *Done* sind damit veröffentlicht: Issue schließen, Board
     **Closed**, Label „in development“ entfernen.
- Gemergt wird über die PRs (Merge-Commit, kein Force-Push, kein direkter Push). SourceTrees
  „Finish Release“ passt nicht dazu: Es merged lokal und scheitert am Push auf die geschützten
  Branches.

## Selbsttest
Im Ordner `src/FabCollectionTool2`:

```
node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export Beispiel.csv"
```

So ruft ihn auch die Action `pages.yml` vor jeder Veröffentlichung auf – Änderungen am
Selbsttest immer auch so prüfen.

**Aktueller Fabrary-Export:** fester lokaler Ort `.ignore/ressources/fabrary-export.csv`
(von Git ignoriert, nie committen; daneben `readme.md`). Liegt die Datei dort, prüfen Selbsttest
und `tools/build-fabrary-map.mjs` die Fabrary-Zuordnung automatisch damit; fehlt sie (Action,
Cloud), werden diese Prüfungen übersprungen. Vor jedem Release die Datei mit dem neuesten
Sammlungsexport aus Fabrary überschreiben. `--fabrary-current <Datei>` nur für eine andere Datei.

## Geplanter Planungs-Agent
Ein geplanter Cloud-Agent darf **nur planen**: für Issues auf *Approved* ohne Kommentar
„## Umsetzungsplan“ den Plan nach Schritt 2 kommentieren, das Label „in development“ setzen und
auf **Ready** schieben. Hat er Fragen, schreibt er sie als Kommentar (Überschrift
„## Rückfragen zum Umsetzungsplan“) und lässt das Issue auf *Approved*; beim nächsten Lauf
plant er erst, wenn Elmar geantwortet hat. Er legt **keine Branches, Commits oder PRs** an und
ändert keine anderen Issues.
