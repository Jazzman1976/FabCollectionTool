# Stammdaten

Die Dateien in diesem Ordner sind **generiert** (außer `vocab.js`) und werden als klassische
Skripte geladen, weil Seiten über `file://` keine Dateien per `fetch()` lesen dürfen.
Jede Datei enthält einen Datensatz pro Zeile, damit Git-Diffs lesbar bleiben. Datenzeilen
dürfen länger als 100 Zeichen sein; die Zeilenlängen-Regel gilt für handgeschriebenen Code.

| Datei | Inhalt | Herkunft |
|---|---|---|
| `sets.js` | `[Set-Code, Name, Erscheinungsdatum]` | the-fab-cube `set.csv` und `set-printing.csv` (frühestes Datum je Set) |
| `cards.js` | `[Karten-ID, Name, Pitch, Typzeile, L = Legendary, Cost, Power, Defense, Card Keywords, Kartentext, gedruckte Typzeile, nicht legal in]` | the-fab-cube `card.csv` (Legendary aus `Card Keywords`, „nicht legal in“ aus den Legal-Spalten) |
| `printings.js` | `[Kartennummer, Set-Code, Edition, Art Treatment, Rarity, Foilings, Karten-ID, Bild, Artists]` | the-fab-cube `card-printing.csv` (Bild: Dateiname des üblichen Speicherorts oder volle URL, des einfachsten Foilings) |
| `info.js` | Herkunft, Commit, Stand | Build-Skript |
| `fabrary-map.js` | Fabrary-Zuordnung: `sets` (Set-Code → Fabrary-Setname) und `variants` (Schlüssel `Kartennummer\|Edition\|Foiling\|Treatments\|Identifier` → abweichende `identifier`, `set`, `treatment`) | `tools/build-fabrary-map.mjs` aus einem Sammlungsexport von Fabrary (`docs/fabrary/`) |
| `vocab.js` | Wertelisten und Code-Tabellen | von Hand gepflegt |

**Aktueller Stand:** the-fab-cube/flesh-and-blood-cards, Branch `develop`, Commit
`e56071b41b6e784b652eeada1ff86e6d8538f554` vom 21.08.2026; erzeugt am 25.09.2026.

Die Anwendung lädt `set.csv`, `set-printing.csv`, `card.csv` und `card-printing.csv` beim Start
zusätzlich online (aus dem in der App gewählten Branch, Standard `develop`) und verwendet sie, wenn das gelingt. Die mitgelieferten Dateien sind der Rückfall ohne Internet.
Beide Wege nutzen dieselbe Umwandlung (`app/reference-transform.js`).

## Erneuern

the-fab-cube ist die Quelle der Wahrheit; auch der Fabrary-Export entsteht allein aus diesen
Daten (Issue #17), ein Fabrary-Export wird dafür nicht gebraucht.

**Wann:** vor jedem Release. Liegt der Commit oben hinter dem aktuellen Commit von
the-fab-cube `develop`, werden die Dateien auf einem Feature-Branch erneuert und per PR nach
`develop` gebracht, damit sie vor dem Release mitgetestet werden.

1. Die vier Quelldateien aus `csvs/english/` des Datensatzes in einen Ordner **außerhalb** des
   Repositorys laden.
2. Im Ordner `src/FabCollectionTool2` ausführen:
   `node tools/build-reference.mjs <Quellordner> <Commit> <Datum>`
3. Mit `node tools/selftest.mjs … <Quellordner>` prüfen und den Stand oben in dieser Datei
   anpassen.

### Fabrary-Zuordnung erneuern

Fabrary nennt manche Sets, Identifier und Treatments anders; der Export schreibt dort Fabrarys
Namen (`fabrary-map.js`). **Wann:** vor jedem Release, und nachdem die Stammdaten erneuert
wurden.

1. In Fabrary die Sammlung als CSV herunterladen und als
   `docs/fabrary/Fabrary-Export <JJJJ-MM-TT>.csv` ablegen (ältere Datei entfernen, Pfad im
   Selbsttest anpassen).
2. Im Ordner `src/FabCollectionTool2` ausführen:
   `node tools/build-fabrary-map.mjs "../../docs/fabrary/Fabrary-Export <JJJJ-MM-TT>.csv"`.
   Das Skript nennt unklare Fälle und Varianten, die es bei Fabrary nicht gibt; unklare
   bleiben draußen und lassen sich in der App je Bestand zuordnen.
3. Selbsttest ausführen: „Fabrary mapping meets Fabrary's export“ muss grün sein.
