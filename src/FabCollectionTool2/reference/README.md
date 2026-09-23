# Stammdaten

Die Dateien in diesem Ordner sind **generiert** (außer `vocab.js`) und werden als klassische
Skripte geladen, weil Seiten über `file://` keine Dateien per `fetch()` lesen dürfen.
Jede Datei enthält einen Datensatz pro Zeile, damit Git-Diffs lesbar bleiben. Datenzeilen
dürfen länger als 100 Zeichen sein; die Zeilenlängen-Regel gilt für handgeschriebenen Code.

| Datei | Inhalt | Herkunft |
|---|---|---|
| `sets.js` | `[Set-Code, Name, Erscheinungsdatum]` | the-fab-cube `set.csv` und `set-printing.csv` (frühestes Datum je Set) |
| `cards.js` | `[Karten-ID, Name, Pitch, Typzeile]` | the-fab-cube `card.csv` |
| `printings.js` | `[Kartennummer, Set-Code, Edition, Art Treatment, Rarity, Foilings, Karten-ID]` | the-fab-cube `card-printing.csv` |
| `fabrary-skeleton.js` | Identitätsspalten jeder Fabrary-Zeile, **ohne Mengen** | Fabrary-Sammlungsexport |
| `info.js` | Herkunft, Commit, Stand, Fabrary-Kopfzeile | Build-Skript |
| `vocab.js` | Wertelisten und Code-Tabellen | von Hand gepflegt |

**Aktueller Stand:** the-fab-cube/flesh-and-blood-cards, Branch `develop`, Commit
`e56071b41b6e784b652eeada1ff86e6d8538f554` vom 21.08.2026; erzeugt am 23.09.2026.

Die Anwendung lädt `set.csv`, `set-printing.csv`, `card.csv` und `card-printing.csv` beim Start
zusätzlich online und verwendet sie, wenn das gelingt. Die mitgelieferten Dateien sind der Rückfall ohne Internet.
Beide Wege nutzen dieselbe Umwandlung (`app/reference-transform.js`).

## Erneuern

1. Die vier Quelldateien aus `csvs/english/` des Datensatzes in einen Ordner **außerhalb** des
   Repositorys laden.
2. Einen aktuellen Sammlungsexport aus Fabrary bereitstellen. Er enthält persönliche Mengen.
   Das Build-Skript übernimmt davon nur die acht Identitätsspalten; die Mengen landen nie
   im Repository.
3. Im Ordner `src/FabCollectionTool2` ausführen:
   `node tools/build-reference.mjs <Quellordner> <fabrary-export.csv> <Commit> <Datum>`
4. Mit `node tools/selftest.mjs … <Quellordner>` prüfen und den Stand oben in dieser Datei
   anpassen.
