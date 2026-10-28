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
| `fabrary-map.js` | Fabrary-Zuordnung: `sets` (Set-Code → Fabrary-Setname) und `variants` (Schlüssel `Kartennummer\|Edition\|Foiling\|Treatments\|Identifier` → abweichende `identifier`, `set`, `treatment`) | `tools/build-fabrary-map.mjs` aus einem Sammlungsexport von Fabrary (lokal unter `.ignore/ressources/fabrary-export.csv`, nie im Repository) |
| `cardmarket-map.js` | Cardmarket-Zuordnung: `expansions` (Cardmarket-Expansion → `[Set-Code, Edition, Status]`) und `printings` (Schlüssel `Kartennummer\|Edition\|Foiling\|Art Treatment` → `[Cardmarket-Produkt-ID, Status]`) | `tools/build-cardmarket-map.mjs` aus dem öffentlichen Produktkatalog und der Preisliste von Cardmarket (nie im Repository) |
| `vocab.js` | Wertelisten und Code-Tabellen | von Hand gepflegt |

**Aktueller Stand:** the-fab-cube/flesh-and-blood-cards, Branch `develop`, Commit
`18b2d9d74e2f57a025bb62820bf35a13477a895b` vom 30.09.2026; erzeugt am 30.09.2026.

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
   `.ignore/ressources/fabrary-export.csv` (Wurzelordner der Repository) ablegen; eine ältere
   Datei dort einfach überschreiben. Der Ordner ist von Git ignoriert, denn die Datei enthält
   die eigene Sammlung mit Mengen.
2. Im Ordner `src/FabCollectionTool2` ausführen: `node tools/build-fabrary-map.mjs`
   (nimmt die Datei am festen Ort; eine andere Datei lässt sich als Argument angeben).
   Das Skript nennt unklare Fälle und Varianten, die es bei Fabrary nicht gibt; unklare
   bleiben draußen und lassen sich in der App je Bestand zuordnen.
3. Selbsttest ausführen (`node tools/selftest.mjs …`; er nimmt die Datei am festen Ort
   automatisch, eine andere per `--fabrary-current`): „Fabrary mapping meets Fabrary's
   export“ und „Fabrary comparison with the shipped mapping“ müssen grün sein.

### Cardmarket-Zuordnung erneuern

Cardmarket führt Karten nur mit Name und Expansion, ohne Kartennummer und Variante.
`cardmarket-map.js` ordnet deshalb jedem Printing (Kartennummer, Edition, Foiling, Art Treatment)
seine Cardmarket-Produkt-ID zu (Issue #93). Quellen sind nur der öffentliche Produktkatalog und
die öffentliche Preisliste von Cardmarket (`products_singles_16.json`, `price_guide_16.json`)
und die Stammdaten; keine Daten anderer Plattformen, kein Abrufen von Cardmarket-Seiten.
**Wann:** wenn ein neues Set erschienen ist, nachdem die Stammdaten erneuert wurden, und wenn
Korrekturen aus der App übernommen werden sollen.

1. Im Ordner `src/FabCollectionTool2` ausführen: `node tools/build-cardmarket-map.mjs`.
   Das Skript lädt Katalog und Preisliste selbst von Cardmarket (nur gelesen, nie
   gespeichert). Eigene Dateien gehen mit `--catalogue <datei>` und `--prices <datei>`.
2. Korrekturen aus der App übernehmen: `--local <Arbeitsordner>/cardmarket-prices.json`. Das
   Skript liest daraus nur den Teil `corrections` und übernimmt nur die geprüften
   (`confirmed`); ungeprüft eingetragene IDs (`manual`) nennt es im Bericht.
3. Den Bericht ansehen: Abdeckung je Set (sicher / geschätzt / offen), Expansions ohne Set,
   Editionen über den Preis, offene Fälle, übernommene Korrekturen und Widersprüche.
4. Selbsttest ausführen („Cardmarket mapping …“ muss grün sein).

**Regeln** (in `app/cardmarket-map.js`):

- **Expansion → Set:** das Set mit der größten Ähnlichkeit der Kartennamen (gemeinsame Namen
  geteilt durch alle Namen beider Seiten), wenn mindestens 80 % der Namen der Expansion im Set
  vorkommen und kein anderes Set gleich ähnlich ist. Hat ein Set eine Edition, bekommt sie die
  ähnlichste Expansion; weitere stehen im Bericht.
- **Editionen:** Gibt es zu einem Set mit Alpha bzw. First und Unlimited zwei Expansions, ist
  die mit den überwiegend billigeren Karten (mindestens 80 % der gleichnamigen Karten)
  Unlimited, denn Alpha und First sind seltene Sammlereditionen. Status `price`.
- **Printings:** Produkte einer Expansion mit gleichem Namen und Pitch gegen die Varianten der Karte
  im Set und in der Edition. Ein Produkt und eine Variante: `unique`. Gleich viele Produkte wie
  Varianten, alle mit derselben Kartennummer und jede in einem anderen Foiling: nach Preis
  (avg30, sonst trend, sonst low) aufsteigend in der Reihenfolge Standard < Rainbow < Cold <
  Gold, Status `price`. Das Art Treatment darf mit dem Foiling wechseln (z. B. Rainbow Foil mit
  Alternate Text, Cold Foil mit Extended Art). Alles andere bleibt offen.
- **Status:** `unique` und `confirmed` (Produkt und Preis von einem Menschen auf Cardmarket
  nachgesehen) gelten als sicher; `price` und `manual` (ID von Hand eingetragen, ungeprüft)
  als geschätzt. Eine eingetragene ID allein ist keine Prüfung. Expansions: `auto`, `price`,
  `manual`.
- Einträge `confirmed` und `manual` (auch Expansions mit `manual`) ersetzt das Skript nie;
  weicht eine Korrektur davon ab, steht sie im Bericht als Widerspruch. Aus `--local`
  übernimmt es nur geprüfte Korrekturen (`confirmed`); ungeprüfte stehen nur im Bericht. Eine
  Produkt-ID gehört zu genau einem Schlüssel.
- Das Schema hat `version: 1` und bleibt stabil; neue Felder kommen nur hinzu.
