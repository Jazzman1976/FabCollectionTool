# Umsetzungsplan FabCollectionTool 2.1.0.0 – Veröffentlichung als GitHub Page

**Grundlage:** `docs/Feedback 2.0.7.0.md`, Stand 2.0.7.0 (Commit c10a74c, Prüfliste 4e4345e)
**Stand:** 25. September 2026 · **Status:** lokal umgesetzt (Pakete 1–6), Paket 7 offen

## Kontext
Die Prüfliste ist abgearbeitet: Daten, Browserprüfung, `file://` und Beobachtungspunkte sind in
Ordnung. Neue Vereinbarung: Eine Commit-Freigabe gilt als erfolgreicher Test im Browser; eine
rückwirkende Bestätigung entfällt. Jetzt soll die Neuentwicklung öffentlich werden: als
**GitHub Page**, automatisch bei jedem Push nach `main` deployt; `main` und `develop` sind
geschützt. Außerdem: Firefox wird nicht mehr unterstützt (Hauptbrowser Chrome), `docs/` wird in
Unterordner sortiert.

Befund: Das Repository `Jazzman1976/FabCollectionTool` ist schon öffentlich; `main`/`develop`
sind ungeschützt; Pages ist nicht eingerichtet; einziger Collaborator ist Elmar; bisher
Git-Flow (`release/1.1.5`, Tags `1.1.3`–`1.1.5`); `develop` liegt 13 Commits hinter
`feature/fabcollectiontool2`, `main` 2 hinter `develop`. Die App nutzt nur relative Pfade und
funktioniert unter `https://jazzman1976.github.io/FabCollectionTool/` (sicherer Kontext →
Dateizugriff und Arbeitsordner in Chrome).

Geklärt (25.09.2026): Git-Flow **feature → develop → main**; Firefox: **Hinweis + Doku**;
Version **2.1.0.0**; Wurzel-`readme.md`: **nur ein Abschnitt oben** mit Link.

Regeln wie bisher; Schritte auf GitHub (PRs, Schutzregeln, Pages) führe ich mit `gh` aus,
**gemergt wird von Elmar**.

## Arbeitspakete

### 1. Version 2.1.0.0
`VERSION`, `FCT.VERSION`, `?v=2.1.0.0` in `index.html`/`doku.html`, `README.md`.

### 2. Firefox nicht mehr unterstützt
- `app/app.js`: Neuer gelber Hinweis beim Start in Browsern ohne Dateizugriff
  (`!FCT.storage.canWriteBack`): „Dieser Browser wird nicht unterstützt: Speichern geht hier
  nur als Download. Empfohlen: Google Chrome (oder Edge).“ – schließbar, einmal je Sitzung.
- Firefox-spezifische Hilfen entfernen: `explainDownload`-Dialog und `DOWNLOAD_HINT`
  (Meldung nach dem Download wird neutral), Firefox-Text im Assistenten
  (`app/onboarding.js`, Schritt 2 → Hinweis „nicht unterstützt, bitte Chrome“). Der
  Download-Notbehelf in `storage.js` bleibt als Code, Kommentar „nicht mehr gepflegt“.
- `doku.html`: Abschnitt „Firefox“ → „Unterstützte Browser“ (Chrome empfohlen, Edge auf
  gleicher Basis; Firefox/Safari nicht unterstützt, Apple-Geräte ungetestet); Erste Schritte
  und Diagnose-Satz anpassen. `README.md` entsprechend.

### 3. `docs/` aufräumen (`git mv`, Historie bleibt)
- `docs/feedback/` – alle `Feedback *.md`
- `docs/plaene/` – alle `Umsetzungsplan-*.md`
- `docs/prueflisten/` – `Pruefliste-2.0.7.0.md`
- `docs/screenshots/` – Screenshots der Neuentwicklung (2.0.2.0 … 2.0.6.2)
- `docs/konzept/` – `Konzept.md`, `Konzept-Neuentwicklung.docx`, `AUDIT.md`,
  `Recherche-Spalten-2.0.4.0.md`
- **Bleiben in `docs/`** (gehören zum alten Tool bzw. werden von ihm/der Wurzel-readme
  referenziert): `screenshot1.jpg`, `screenshot2.jpg`, `cardmarket-irregular-cardnames.json`,
  `example.ods`; dazu `Fabrary Export Beispiel.csv` neben `example.ods` (beides Testdaten des
  Selbsttests).
- Verweise nachziehen: `src/FabCollectionTool2/README.md` (Recherche-Pfad), Workflow, Memory
  (Pläne liegen künftig in `docs/plaene/`). Inhalte alter Pläne bleiben unverändert (Historie).

### 4. GitHub Action für die Page
Neue Datei `.github/workflows/pages.yml`:
- Auslöser: Push auf `main`, zusätzlich manuell (`workflow_dispatch`).
- Job **test**: `actions/checkout@v4`, `actions/setup-node@v4` (Node 20),
  `node tools/selftest.mjs ../../docs/example.ods "../../docs/Fabrary Export Beispiel.csv"` im
  Ordner `src/FabCollectionTool2` – schlägt er fehl, wird nicht deployt.
- Job **deploy** (needs test): `actions/configure-pages@v5`,
  `actions/upload-pages-artifact@v3` mit `path: src/FabCollectionTool2`,
  `actions/deploy-pages@v4`; Rechte `pages: write`, `id-token: write`, `contents: read`;
  Umgebung `github-pages`; `concurrency: pages`.
- Arbeitsdateien (`collection.csv`, Logs) sind per `.gitignore` nie im Repo und damit nie auf
  der Page.

### 5. Wurzel-`readme.md` und Tool-README
- Wurzel-`readme.md`: oben kurzer Abschnitt „FabCollectionTool 2 – im Browser“ mit Link zur
  Page und zu `src/FabCollectionTool2/`; Rest zum alten Tool unverändert.
- `src/FabCollectionTool2/README.md`: Link zur Page, „Unterstützte Browser“, Deployment über
  die Action. Repo-Beschreibung/Homepage-URL per `gh repo edit --homepage` auf die Page.

### 6. Selbsttest, Commit, Push
Selbsttest grün; Plan als `docs/plaene/Umsetzungsplan-2.1.0.0.md`, Feedback nach
`docs/feedback/`; Commit und Push auf `feature/fabcollectiontool2` (auf Zuruf, wie immer).

### 7. GitHub-Einrichtung und Release (nach Elmars Zuruf, mit `gh`)
1. **Pages einschalten** mit Quelle „GitHub Actions“
   (`gh api -X POST repos/Jazzman1976/FabCollectionTool/pages -f build_type=workflow`).
2. **PR 1** `feature/fabcollectiontool2` → `develop` („FabCollectionTool 2.1.0.0“), Beschreibung
   mit Überblick der Versionen 2.0.0.0–2.1.0.0 und Link auf die Pläne. **Elmar merged.**
3. **PR 2** `develop` → `main` („Release 2.1.0.0“). **Elmar merged** → die Action deployt.
   Danach Tag `2.1.0.0` auf `main` (Schema wie `1.1.5`) auf Zuruf.
4. **Schutz für `main` und `develop`** (Branch-Protection, erst nach den Merges, damit nichts
   blockiert): Änderungen nur per Pull Request, kein Force-Push, kein Löschen; keine
   Pflicht-Freigabe durch Reviewer (sonst könnte Elmar allein nicht mergen); Admins (Elmar)
   dürfen die Regeln umgehen. Da Elmar der einzige mit Schreibrecht ist, kann nur er mergen.
5. Prüfen: Action-Lauf grün, Page unter `https://jazzman1976.github.io/FabCollectionTool/`
   lädt (Version 2.1.0.0, Stammdaten online, Kartenbilder, Doku-Link), Schutzregeln per
   `gh api …/protection` sichtbar.

## Kritische Dateien
`app/app.js`, `app/onboarding.js`, `app/storage.js` (Kommentar), `doku.html`, `README.md`,
`index.html`, Versionsdateien, neu `.github/workflows/pages.yml`, Wurzel-`readme.md`
(nur Abschnitt oben), `docs/` (Verschiebungen).

## Prüfung
- Selbsttest lokal grün; `git status` zeigt die Verschiebungen als Umbenennungen.
- Chrome über `localhost`: kein Hinweis; ein Browser ohne Dateizugriff (per Skript
  `canWriteBack=false` simuliert nicht möglich → Sichtprüfung des Codes, Firefox bei Elmar
  optional); Assistent und Speichern ohne Firefox-Texte.
- Nach dem Release: Action-Lauf grün, Page erreichbar und funktionsfähig, Schutzregeln aktiv.

## Abweichungen und Befunde bei der Umsetzung
- Die Wurzel-`readme.md` ist englisch; der neue Abschnitt oben ist deshalb ebenfalls englisch
  („FabCollectionTool 2 – in the browser“ mit Link zur Page, danach „FabCollectionTool 1“ als
  Überschrift für den unveränderten Rest).
- Der Firefox-Hinweis erscheint bei jedem Start in Browsern ohne Dateizugriff und ist
  schließbar; die Statuszeile sagt dort „Dieser Browser wird nicht unterstützt …“.
- `docs/`: Die Verschiebungen laufen über `git mv` (als Umbenennungen sichtbar). Im
  Wurzelordner bleiben `screenshot1.jpg`, `screenshot2.jpg` (Wurzel-readme),
  `cardmarket-irregular-cardnames.json`, `example.ods` (altes Tool, Selbsttest) und
  `Fabrary Export Beispiel.csv` (Selbsttest, Pfad im Workflow).

## Abnahme lokal (25.09.2026)
- Selbsttest: 35 Prüfungen grün, mit genau den Pfaden der Action.
- Chrome über `localhost`: Version 2.1.0.0, kein Browser-Hinweis (Dateizugriff vorhanden),
  keine Konsolenfehler.
