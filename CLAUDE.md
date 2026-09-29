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
  berechnete Spalten) – externe Tools lesen die Datei. Keine „nur Anzeige“-Umsortierung.
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
Ready for dev, In progress, In review, Done. Remote heißt lokal `github`, in der Cloud `origin`.

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
6. **Elmar testet und merged.** Eine Action schließt die Issues, das Board setzt Done.
7. Nach jedem Merge `develop` per Merge (kein Rebase, kein Force-Push) in offene
   Feature-Branches holen.

- Label **„in development“** gehört an jedes Issue mit Status außer Backlog und Done.
- **`develop` und `main` werden nie gelöscht**, nie direkt beschrieben (nur per PR), nie
  force-gepusht. Aufräumen: nur `feature/`-Branches, die nachweislich gemergt sind.
- Merges nach `develop` oder `main` macht nur Elmar.
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
- PR nach `main` (Elmar merged, die Action `pages.yml` testet und veröffentlicht), Tag
  `<Version>` (annotiert) auf `main`, danach PR `main` → `develop`.

## Selbsttest
Im Ordner `src/FabCollectionTool2`:

```
node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export Beispiel.csv"
```

So ruft ihn auch die Action `pages.yml` vor jeder Veröffentlichung auf – Änderungen am
Selbsttest immer auch so prüfen. Vor einem Release zusätzlich
`--fabrary-current <aktueller Fabrary-Export.csv>` (Datei liegt außerhalb des Repositorys).

## Geplanter Planungs-Agent
Ein geplanter Cloud-Agent darf **nur planen**: für Issues auf *Approved* ohne Kommentar
„## Umsetzungsplan“ den Plan nach Schritt 2 kommentieren, das Label „in development“ setzen und
auf **Ready** schieben. Hat er Fragen, schreibt er sie als Kommentar (Überschrift
„## Rückfragen zum Umsetzungsplan“) und lässt das Issue auf *Approved*; beim nächsten Lauf
plant er erst, wenn Elmar geantwortet hat. Er legt **keine Branches, Commits oder PRs** an und
ändert keine anderen Issues.
