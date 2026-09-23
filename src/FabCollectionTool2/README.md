# FabCollectionTool 2.0.2.0

Verwaltung einer Flesh-and-Blood-Kartensammlung im Browser. Keine Installation, kein Server,
keine Abhängigkeiten.

## Start

`index.html` in diesem Ordner per Doppelklick im Browser öffnen (Chrome, Edge oder Firefox).
Das funktioniert direkt aus dem Repository-Checkout über `file://`.

Beim Start lädt die Anwendung automatisch die aktuellen Stammdaten (Karten, Drucke, Sets) aus
dem offenen Datensatz [the-fab-cube/flesh-and-blood-cards](https://github.com/the-fab-cube/flesh-and-blood-cards).
Ohne Internet oder bei einem Fehler arbeitet sie mit den mitgelieferten Stammdaten weiter. Die
Gruppe **Stammdaten** in der Werkzeugleiste zeigt, welche verwendet werden (online oder
mitgeliefert, Stand des Datensatzes, Ladezeit). *Aktualisieren* lädt sie jederzeit neu, *Info*
zeigt Herkunft, Umfang und den letzten Fehler.

## Bedienung

| Bereich | Funktion |
|---|---|
| **Bestand** | *Neu*, *Öffnen* (`collection.csv`), *Speichern* (Strg+S), *Backup* (Kopie mit Zeitstempel) |
| **Import** | *ODS*: das alte Calc-File übernehmen · *Fabrary*: einen Fabrary-Export übernehmen |
| **Export** | *Fabrary*: Importdatei für Fabrary erzeugen |
| **Stammdaten** | Stand, *Aktualisieren*, *Übernehmen …* (je Karte), *Info* |
| **Ansicht** | Schriftgröße, Position der Meldungen (unten, links, rechts), *Editiermodus* |
| **Filter** | Suche, Schnellfilter, *Spalten*, *Filter zurücksetzen* |
| **Gliederung** | Gruppierung, Reihenfolge der Sets, Gliederungsebenen **1** / **2** / **3** |

### Vollständige Sets

Jedes Set, das im Bestand vorkommt, wird **vollständig** angezeigt: Drucke aus den Stammdaten,
die noch fehlen (z. B. First Edition, Extended Art), stehen als Zeile mit **○** an ihrer Stelle
im Set. Sobald dort eine Menge eingetragen oder ＋ gedrückt wird, gehören sie zum Bestand. Sets,
die im Bestand gar nicht vorkommen, werden nicht aufgefüllt. Der Schnellfilter *Nur Bestand*
blendet die fehlenden Drucke aus, *Noch nicht im Bestand* zeigt nur sie.

### Tastatur (wie in LibreOffice)

| Taste | Wirkung |
|---|---|
| Pfeiltasten, Tab / Shift+Tab | Zellcursor bewegen (Tab springt am Zeilenende in die nächste Zeile) |
| Pos1 / Ende, Strg+Pos1 / Strg+Ende, Bild↑ / Bild↓ | Zeilenanfang/-ende, Tabellenanfang/-ende, seitenweise |
| Zahl oder Buchstabe tippen | Bearbeiten beginnt und ersetzt den Wert |
| F2 / Doppelklick | Bearbeiten mit dem bisherigen Wert |
| Enter | Wert übernehmen und eine Zeile nach unten (auch ohne Bearbeiten) |
| Esc | Bearbeiten abbrechen |
| Entf / Rück | Zelle leeren |
| Shift+↑ / Shift+↓ | Menge +1 / −1 (ST, RF, CF, GF, Playset) |
| auf einer Gruppenzeile: Enter / Leertaste, → / ← | auf- oder zuklappen, öffnen, schließen |

Die Knöpfe **−** und **+** erscheinen in der aktiven Mengenzelle. Verlassen der Zelle übernimmt
den Wert.

### Weitere Bedienung

- **Farben der Zellen:** weiß mit blauem Rahmen = eigene Eingabe (Playset, ST, RF, CF, GF,
  Note); grau = aus den Stammdaten (gesperrt); dunkler grau = berechnet (Have/Need/Left).
- **Statusspalte** ganz links: **≠** die Zeile weicht von den Stammdaten ab (Tooltip nennt
  genau was, Klick öffnet die Zeile), **✱** lokal geändert, **○** noch nicht im Bestand,
  **?** Kartennummer unbekannt. Abweichende Zellen sind gestrichelt unterstrichen.
- **Zeilenaktionen** am Ende jeder Zeile (bleiben beim seitlichen Scrollen sichtbar):
  ✎ alle Felder bearbeiten, ＋ neue Zeile darunter (übernimmt Set, Talent und Klassen),
  Kopieren, Kopie darunter einfügen (ohne Mengen, z. B. für eine weitere Sprache), Löschen.
- **Zeilendialog (✎ oder Klick auf ≠):** alle Felder mit dem Stammdatenwert daneben;
  *Abweichungen übernehmen* setzt die abweichenden Werte, *Alles zurücksetzen* auch die lokal
  geänderten. Feste Werte werden aus Listen gewählt.
- **Editiermodus:** macht auch die Stammdaten- und Identitätsspalten (Name, Rarity, Talent,
  Edition, Id, …) bearbeitbar (gelb hinterlegt); Spalten mit festen Werten (Edition, Rarity,
  Pitch, Talent, Class, Type, Sub, Set, …) bieten eine **Auswahlliste** statt Tippen. Weicht
  ein Wert danach von den Stammdaten ab, gilt er als **lokal geändert** (violette Ecke).
- **Stammdaten übernehmen:** *Übernehmen …* listet **jede abweichende Karte** mit ihren
  Abweichungen, nach Set gruppiert. Angehakte Karten übernehmen alle ihre abweichenden Werte;
  nichts ist vorausgewählt (*Alle* / *Keine*, Häkchen je Set). Lokal geänderte Werte bleiben
  unberührt. **Der Bestand selbst ändert sich dabei nie:** Mengen, Playset, Notiz,
  Kartennummer, Edition und Art Treatment werden vor und nach dem Übernehmen verglichen; bei
  einer Abweichung wird alles zurückgenommen.
- **Gruppen (Accordeon):** wie in der ODS nach Set (Titel mit Set-Code, z. B. „Monarch (MON)“)
  und darunter nach Talent/Klasse; zu Beginn ist alles zugeklappt. **1** zeigt nur die Sets,
  **2** öffnet die Sets mit ihren Talent/Klasse-Gruppen, **3** öffnet alles. Sets stehen nach
  Erscheinungsdatum (Sets ohne Datum, z. B. Promos, zuerst) oder alphabetisch. Bei Suche oder
  Filter sind alle Gruppen mit Treffern offen. Sortieren wirkt innerhalb der Gruppen.
- **Suchen und Filtern:** Das Suchfeld durchsucht Name, übersetzte Namen, Id, Set und Notiz.
  Unter jeder Spaltenüberschrift steht ein Filter: Text = „enthält“, `=Text` = genau, `=` = leer,
  `!Text` = enthält nicht; bei Zahlen `3`, `>0`, `<3`, `>=2`, `!=0`.
  Ein Klick auf die Überschrift sortiert (auf-, absteigend, aus); ⇅ zeigt, dass eine Spalte
  sortierbar ist, ▲/▼ die aktive Sortierung. Ohne gewählte Spalte stehen die Zeilen nach
  Kartennummer (AGB001, AGB002, …); fehlende Drucke stehen dadurch an ihrer Stelle.
- **Schnellfilter:** nur Bestand, im Besitz, fehlt zum Playset (gesamt oder je Set),
  überzählig, noch nicht im Bestand, weicht von den Stammdaten ab, auffällige Zeilen.
- **Spalten** blendet Spalten ein und aus. *Standard wiederherstellen* stellt die
  Standardansicht her. Alle Menüs und Dialoge schließen bei Klick daneben oder mit *Esc*.
- **Zeilenfarben:** roter Balken am Zeilenanfang und rot getönte Rechenspalten = zum Playset
  fehlen noch Karten (über alle Sets); grün = mehr als ein Playset in diesem Set.

Die Spalten *Have (this)*, *Have/Need/Left (set)*, *Have/Need/Left (total)* rechnet die Anwendung
selbst; „set“ bezieht sich auf dieselbe Kartennummer, „total“ auf dieselbe Karte
(Name, Pitch, Peculiarity) über alle Sets.

## Einstellungen

Sichtbare Spalten, Schriftgröße, Position der Meldungen, Gruppierung und Set-Reihenfolge merkt
sich der Browser
(localStorage). Das sind **nur Ansichtseinstellungen, nie Bestandsdaten**. Sperrt der Browser
den Speicher, gelten nach dem Neuladen einfach wieder die Standardwerte.

## Änderungsprotokoll

Jede Änderung am Bestand (Zellwert, − / +, Einfügen, Kopie einfügen, Löschen, Zurücksetzen,
Stammdaten übernehmen, Import) wird mit Zeit, Karte, Variante, Spalte, altem und neuem Wert
festgehalten. Der Reiter **Protokoll** neben *Meldungen* zeigt die neuesten Einträge.

Beim Speichern werden die neuen Einträge an die Protokolldatei `<bestand>-log.csv` angehängt
(Spalten `Time, Action, Id, Name, Variant, Column, Old, New`):

- **Chrome und Edge** fragen **einmal** nach der Protokolldatei (beim ersten *Speichern* oder
  über den Knopf *Protokolldatei festlegen* in der Statuszeile). Die bisherige Datei wählen;
  die neuen Einträge werden angehängt, auch wenn der Browser „Ersetzen“ anbietet. Die Wahl
  wird wie der Bestand gemerkt (auch über einen Neustart); der Browser gibt die Protokolldatei
  zusammen mit dem Bestand frei. Danach speichert das automatische Speichern das Protokoll mit.
- **Firefox** lädt bei jedem Speichern eine Datei `<bestand>-log-JJJJMMTT-HHMMSS.csv` mit den
  neuen Einträgen herunter.

## Speichern und Backup

Das Original des Bestands ist die Datei, die du öffnest und speicherst. Zusätzlich hält der
Browser eine **Kopie**, damit der Bestand beim nächsten Start sofort da ist.

- **Bestand sofort beim Start:** Nach jedem Laden, Speichern und jeder Änderung legt die
  Anwendung eine Kopie des Bestands im Browser ab (IndexedDB), in Chrome/Edge zusammen mit
  dem Verweis auf die Datei und der Autosave-Entscheidung. Beim nächsten Start wird die Kopie
  sofort angezeigt — auch mit Änderungen, die noch nicht gespeichert waren.
- **Mit der Datei verbinden (Chrome und Edge):** Erlaubt der Browser den Dateizugriff noch
  (z. B. „Bei jedem Besuch zulassen“), verbindet sich die Anwendung von selbst. Sonst fragt der
  Browser bei der **ersten Änderung** „Änderungen speichern?“ — er darf das nur direkt nach
  einem Klick oder Tastendruck. Alternativ oben *Mit Datei verbinden* oder in der Statuszeile
  *Automatisch speichern: jetzt erlauben*. Ist die Datei unverändert,
  bleibt die Kopie und das automatische Speichern übernimmt. Wurde die Datei inzwischen
  woanders geändert, gilt die Datei; nur wenn die Kopie eigene, ungespeicherte Änderungen hat,
  fragt die Anwendung, welche Fassung gelten soll. *Kopie vergessen* löscht die Kopie.
- Sperrt der Browser den Speicher (z. B. privates Fenster), startet die Anwendung leer.
- **Chrome und Edge speichern automatisch:** Nach jeder Änderung (1,5 s Ruhe) wird die
  geöffnete Datei geschrieben. Bei jedem *neuen* Bestand (einer anderen Datei als zuletzt)
  fragt die Anwendung, ob sie automatisch speichern soll; für den zuletzt geöffneten Bestand
  gilt die gemerkte Antwort. Mit „Ja“ fragt danach der Browser
  selbst „Änderungen speichern?“ („Save changes?“) — das ist nur die **Erlaubnis** für das
  automatische Speichern, es wird dabei noch nichts gespeichert. Diese Browserfrage kommt aus
  Sicherheitsgründen nach jedem Öffnen wieder; ein Hinweisbalken erklärt sie dann. Der Knopf
  *Automatisch speichern: an/aus* in der Statuszeile ändert die Entscheidung jederzeit.
  Nach einem Import beginnt das automatische Speichern mit dem ersten *Speichern*.
  Die Statuszeile zeigt „automatisch gespeichert HH:MM:SS“ oder einen Fehler in Rot. Nach dem
  ersten automatischen Speichern bietet eine Meldung an, den **Stand beim Öffnen als Backup**
  zu sichern.
- **Firefox** kann nicht automatisch speichern; *Speichern* (Strg+S) legt einen Download im
  Download-Ordner ab. Tipp: In den Firefox-Einstellungen
  „Jedes Mal nachfragen, wo gespeichert werden soll“ aktivieren, dann lässt sich der Ort wählen.
- **Backup** legt eine Kopie `…-backup-JJJJMMTT-HHMMSS.csv` an.
- **Cloud-Backup:** Die Datei (und die Backups) einfach in einem OneDrive-, Dropbox- oder
  Google-Drive-Ordner ablegen. Das ist optional; die Anwendung setzt keinen Cloud-Dienst voraus.
- Beim Schließen mit ungespeicherten Änderungen fragt der Browser nach.

**Nutzerdaten gehören nicht ins Repository.** Die `.gitignore` in diesem Ordner schließt `*.csv`
und `*.ods` aus; den Bestand am besten ganz außerhalb des Checkouts ablegen.

## Umstieg vom Calc-File

1. *Import → ODS* und das alte `.ods` wählen.
2. Die Vorschau zeigt, was übernommen wird: erkannte Tabelle, übersprungene Formelspalten und
   Zwischenüberschriften, unbekannte Spalten (werden als Zusatzspalten mitgeführt),
   Kartennummern ohne Stammdaten, abweichende Namen.
3. *Übernehmen*, dann *Speichern* als `collection.csv`.

Die Spalten werden über ihre Überschriften zugeordnet, nicht über ihre Position. Die Reihenfolge
im Calc-File ist daher egal, und es gibt keine Spaltenbegrenzung.

## Dateiformate

### `collection.csv` (eigener Bestand)

CSV nach RFC 4180, UTF-8, jedes Feld in Anführungszeichen, eine Zeile je Druckvariante:

```
Set,Edition,Id,First In,Rarity,Talent,Class1,Class2,Type1,Type2,Sub1,Sub2,Sub3,Name,
Translated Name,Backside Name,Translated Backside Name,Pitch,Peculiarity,Art Treatment,
Playset,ST,RF,CF,GF,Note,Overrides
```

(im Original eine Zeile). `ST`, `RF`, `CF`, `GF` sind die Mengen je Foiling (Standard, Rainbow,
Cold, Gold). `Edition` ist eine Edition (`Alpha`, `First`, `Unlimited`) oder eine Sprache (`EN`,
`DE`, …). Alle Werte bleiben so erhalten, wie sie in der Datei stehen; ungültige Zahlen werden
gemeldet und rot markiert, aber nicht verändert. Zusätzliche Spalten bleiben erhalten.
`Overrides` listet (mit `;` getrennt) die Stammdatenspalten einer Zeile, die bewusst lokal
geändert wurden. Dateien von 2.0.0.0 ohne diese Spalte lassen sich weiter öffnen.

### Fabrary

- **Import:** der Sammlungsexport aus Fabrary. Zeilen mit Menge werden zu Bestand; die
  Foilings werden zu `ST`/`RF`/`CF`/`GF` zusammengefasst.
- **Export:** Fabrarys eigene Zeilen (das „Skelett“ in `reference/fabrary-skeleton.js`) werden
  zeichengenau übernommen, nur die Mengen werden eingetragen. Sprachvarianten werden
  zusammengezählt, „Micro Text Box“ wird zu „Extended Art“. „Extra for trade“ wird nach den
  Regeln des alten Tools berechnet. Drucke, die das Skelett nicht kennt, werden im Protokoll
  gemeldet und nicht geraten.

## Grenzen dieser Fassung

- Ohne *Speichern* (oder automatisches Speichern) stehen Änderungen nur in der Kopie im
  Browser, nicht in der Datei. Die Kopie ist kein Backup: Browserdaten löschen entfernt sie.
- Imports ersetzen den geöffneten Bestand (kein Zusammenführen).
- Das Fabrary-Skelett wird mitgeliefert und nicht online aktualisiert. Ganz neue Drucke
  exportiert erst eine neuere Fassung des Skeletts (siehe `reference/README.md`).
- Cardmarket, Dragon Shield und TCGplayer folgen später.

## Wartung

Für Entwickler; Node.js 18 oder neuer. Die Anwendung selbst braucht kein Node.js.

- `tools/build-reference.mjs`: erzeugt `reference/*.js` neu (siehe `reference/README.md`).
- `tools/selftest.mjs`: automatische Prüfungen (CSV, ODS-Import, Fabrary-Import/-Export,
  Round-Trip, Skelett ohne Mengen, Typzeilen-Zerlegung, `Overrides`, Stammdatenabgleich,
  Gruppen, Änderungsprotokoll, Erscheinungsdaten, Lückenfüllung, Übernehmen ohne Änderung
  des Bestands, Wertelisten, Zeilenlänge):
  `node tools/selftest.mjs <altes.ods> <fabrary-export.csv> [Ordner mit Quell-CSVs]`
