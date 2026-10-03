# Release Notes FabCollectionTool 2

Versionsschema **Major.Minor.Release** (seit 2.4.0; bis 2.3.1.0 mit vierter Stelle *Build*,
die nie genutzt wurde). Eine neue Version entsteht als Branch `release/<Version>` von
`develop`. Jede Erweiterung oder Korrektur auf dem Release-Branch erhöht die dritte Stelle
(z. B. 2.4.0 → 2.4.1). Nach dem Test wird der Branch nach `main` gemergt (Veröffentlichung als
GitHub Page, Tag) und danach zurück nach `develop`.

## 2.6.0 – 03.10.2026

### Neu
- **Edition und Sprache getrennt** (#53): `Edition` enthält nur noch *Alpha*, *First* oder
  *Unlimited* und ist bei Sets ohne Editionen leer. Die Sprache steht in der neuen Spalte
  **`Language`** direkt dahinter (EN, DE, FR, ES, IT, JP) und ist nie leer; ohne Angabe gilt
  EN. Beide Spalten lassen sich getrennt filtern.
  - **Bestehende Bestände werden beim Öffnen umgestellt:** Stand in `Edition` eine Sprache,
    wandert sie nach `Language`; alle anderen Zeilen werden EN. Eine Meldung nennt die Zahl
    der Zeilen. Beim nächsten Speichern hat `collection.csv` die neue Spalte
    (`Set, Edition, Language, Id, …`) – **wichtig für externe Tools, die die Datei lesen**.
    Dasselbe gilt für den Import der 1.0-Tabelle.
  - Zeilen aus den Stammdaten (○, *Sets aufnehmen*, Fabrary-Import) sind EN; eine neue Zeile
    übernimmt die Sprache der Zeile darüber.
- **Exklusive Karten erkennen** (#54): Die neue Spalte **Exklusiv** (hinter `First In`) zeigt
  *ja*, wenn es eine Karte nur in einem einzigen Set gibt – kein Reprint, auch nicht als
  Promo. Der Schnellfilter **„Exklusiv (nur in einem Set)“** zeigt nur diese Karten; zusammen
  mit dem Filter `>0` auf *Need (set)* findest du die, die dir noch fehlen. Die große
  Bildansicht nennt die Exklusivität ebenfalls. Die Spalte ist nur Anzeige und steht nicht
  in `collection.csv`.

### Verbessert
- **`First In` kommt aus den Stammdaten** (#51): Die Spalte ist jetzt immer gefüllt – mit dem
  Set-Code des Sets, in dem die Karte zuerst erschien (frühestes Erscheinungsdatum; bei
  gleichem Datum das größere Set, z. B. `MON` vor `CHN`; Sets ohne Datum zuletzt). Bisher
  blieb sie bei Zeilen aus den Stammdaten leer.
  - **Reprints sind hervorgehoben:** Weicht `First In` vom eigenen Set ab, steht der Wert in
    Akzentfarbe und fett; sonst ist er gedämpft.
  - Von Hand eingetragene Werte, die von den Stammdaten abweichen, bleiben erhalten und werden
    als lokale Änderung (✱) markiert. *Stammdaten → Übernehmen …* holt den Stammdatenwert.
  - Folge für den Fabrary-Export: „Extra for trade“ erkennt Reprints jetzt auch in Zeilen,
    deren `First In` bisher leer war.
- **Tastatur springt nicht mehr in die Bildmitte** (#52): Beim Bewegen mit Pfeiltasten, Tab
  oder Bild auf/ab bleibt die Liste stehen, solange die aktive Zelle sichtbar ist, und scrollt
  erst am oberen oder unteren Rand zeilenweise mit. Nur ein Sprung zu einer Zeile außerhalb
  des Bildes (z. B. Klick auf eine Meldung) zeigt sie weiter mittig.
- **Filter und Gliederung hinter Hilfe** (#50): Die Werkzeugleiste ist nur noch eine Leiste.
  Die Gruppen *Filter* und *Gliederung* folgen direkt auf *Hilfe* und brechen erst um, wenn
  der Platz fehlt – die Tabelle bekommt eine Zeile mehr Höhe.

### Geändert
- **Cardmarket-Export:** „Setname und Edition“ hängt nur noch eine echte Edition an (Alpha,
  First, Unlimited). Die Sprache (bisher z. B. „ - EN“) entfällt am Zeilenende.
- ***Leere Zeilen entfernen*** erfasst jetzt auch EN-Zeilen ohne Menge und Notiz sowie Zeilen,
  die außer `First In` nichts Eigenes haben. Zeilen in einer anderen Sprache bleiben immer.
- Das Protokoll nennt die Sprache in der Variante (z. B. „Alpha, EN“).

### Stammdaten
- Vor dem Release geprüft: the-fab-cube `develop` unverändert auf `18b2d9d` vom 30.09.2026.

### Entwicklung
- Selbsttest: neue Prüfungen „First In from reference data“, „Exclusive cards“ und „Edition
  and language“.
- Release Notes aller veröffentlichten 2.x-Versionen stehen zusätzlich in der `README.md` im
  Wurzelordner.

## 2.5.0 – 30.09.2026

### Neu
- **Details und Reprints in der großen Bildansicht** (#26): Neben dem großen Kartenbild (in
  einem schmalen Fenster darunter) stehen jetzt
  - die **Karte**: Typzeile, Cost, Power, Defense, Keywords und wo sie nicht legal ist;
  - **Diese Variante**: Set mit Erscheinungsdatum, Edition, Art Treatment, Seltenheit,
    Artist, Foilings und deine Mengen;
  - **Alle Varianten und Reprints** der Karte aus allen Sets, neueste zuerst, jeweils mit
    deinem Bestand und zusammen im Verhältnis zum Playset. Ein Klick auf eine Kartennummer
    zeigt Bild und Details dieser Variante.
- **Shift+→ / Shift+← ändern Mengen** (#37): In den Spalten ST, RF, CF, GF und Playset zählen
  sie wie Shift+↑ / Shift+↓ bzw. + / − eins hoch oder runter. In anderen Spalten bewegen sie
  weiter den Zellcursor, auf einer Set-Zeile klappen sie weiter alle Gruppen des Sets auf/zu.

### Verbessert
- **← / → beim Bearbeiten** (#39): Wie in Tabellenprogrammen übernehmen die seitlichen
  Pfeiltasten den Wert und springen in die Nachbarzelle, wenn du durch Tippen zu bearbeiten
  begonnen hast. Mit F2 oder Doppelklick bewegen sie zuerst die Einfügemarke und verlassen die
  Zelle erst am Anfang bzw. Ende des Textes.
- **Farbkennung nur im Rechenblock** (#36): Rot (fehlt zum Playset) und Grün (mehr als ein
  Playset) färben nur noch die Spalten *Have (set)* bis *Left (total)*, eingeklappt die Spalte
  Σ. Kartenbild, Typen, Cost … Kartentext bleiben neutral. Der Balken am Zeilenanfang bleibt.
- **Gruppen-Knöpfe links** (#38): Im Set-Kopf liegen Auf/zu-Pfeil, **⊞** und **⊟** jetzt
  zusammen am linken Rand. Der Titel bleibt mittig.
- **Cardmarket: „Set am Zeilenende: nicht anhängen“ auch bei „fehlend je Set“** (#35): Die
  Option war bisher abgeschaltet. Jetzt ist sie wählbar; die Mengen einer Karte aus allen
  gewählten Sets stehen dann zusammengezählt in einer Zeile.

### Korrigiert
- Gruppenzeilen: Beim waagerechten Scrollen blieben Titel und Knöpfe nicht im sichtbaren
  Bereich, sondern wanderten mit der Tabelle aus dem Bild (#38).

### Stammdaten
- the-fab-cube `develop` auf `18b2d9d` vom 30.09.2026 (vorher `e56071b` vom 21.08.2026):
  Power von Hyper Inflation (Yellow 3, Blue 2), Fähigkeitstext von Redwood Hammer, Keyword
  „Go again“ bei Meganetic Lockwave und Hyper Scrapper; die Variante FAB407 Gold Foil hat
  the-fab-cube entfernt.

### Entwicklung
- **Fester Ort für den aktuellen Fabrary-Export** (#31): `.ignore/ressources/fabrary-export.csv`
  (von Git ignoriert, auch per `.gitignore` der Repository). Selbsttest und
  `tools/build-fabrary-map.mjs` nehmen die Datei automatisch; `--fabrary-current` nur noch für
  eine andere Datei. Ohne Datei (z. B. in der Action) werden diese Prüfungen übersprungen.
- Selbsttest: neue Prüfungen „Cardmarket per set without set name“ und „Card reprints“.

## 2.4.0 – 29.09.2026

### Neu
- **Set-Gruppen gemeinsam auf- und zuklappen** (#27): Im Kopf jedes Sets öffnet **⊞** das
  Set mit allen Talent/Class-Gruppen darunter, **⊟** schließt alle Gruppen und lässt das Set
  offen – wie die Gliederung 3 bzw. 2, aber nur für dieses Set. Auf der Set-Zeile geht das
  auch mit **Shift+→** / **Shift+←**. Der Zustand wird gemerkt wie jedes Auf- und Zuklappen.

### Verbessert
- **Leere Abweichungen sichtbar** (#25): Ein leeres Feld, das von den Stammdaten abweicht,
  zeigt in der Tabelle **„[leer]“** in der Farbe der Markierung (orange, lokal geändert
  violett). Im Zeilendialog steht „[leer]“ in der Spalte *Stammdaten*, wenn dort nichts steht,
  und als Platzhalter eines geleerten Felds. „[leer]“ ist nur eine Anzeige: Es wird nie
  gespeichert, kopiert, gesucht oder exportiert.

### Entwicklung
- **Versionsnummer dreistellig**: *Major.Minor.Release*, die ungenutzte Build-Stelle entfällt.
- `CLAUDE.md` im Wurzelordner hält die Arbeitsregeln fest (Sprache, Code, Board, GitFlow,
  Release, Selbsttest), damit jede Sitzung – auch ein Cloud-Agent – gleich arbeitet.
- Stammdaten vor dem Release geprüft: the-fab-cube `develop` unverändert auf `e56071b`.

## 2.3.1.0 – 29.09.2026

### Korrigiert
- **Veröffentlichung von 2.3.0.0**: Die GitHub Action hat die Page nicht erneuert, weil drei
  Prüfungen des Selbsttests einen aktuellen Fabrary-Export brauchten, den die Action nicht hat
  (er liegt bewusst nicht im Repository). Die App selbst ist unverändert. Diese Version
  enthält alles aus 2.3.0.0.

### Entwicklung
- Selbsttest: Die Prüfungen der Fabrary-Zuordnung an einem aktuellen Fabrary-Export laufen
  nur noch mit `--fabrary-current <Datei>` (vor einem Release) und werden sonst übersprungen.
  Die Prüfung der eigenen Zuordnung braucht keine Fabrary-Datei mehr und läuft auch in der
  Action.

## 2.3.0.0 – 29.09.2026

### Neu
- **Fabrary-Export aus the-fab-cube** (#17): Der Export enthält jetzt **alle Karten** aus den
  Stammdaten, jede Variante in jedem Foiling, das es gibt, aus allen Sets. Karten, die du nicht
  hast, stehen mit **0** darin, damit Fabrary sie als fehlend anzeigt. Das mitgelieferte
  Fabrary-Skelett entfällt. Bestandszeilen, deren Variante die Stammdaten nicht kennen, nennt
  der Bericht.
- **Fabrary-Zuordnung** (#17): Wo Fabrary anders benennt – Set-Namen, alle Treatments einer
  Variante („Alternate Art, Alternate Border, Extended Art“), Identifier ohne Punkte –, schreibt
  der Export Fabrarys Namen. Dafür bringt die App eine Zuordnung mit, erzeugt aus einem
  aktuellen Fabrary-Export. Karten wie ANQ006 (Fyendal's Spring Tunic) oder „Argh… Smash!“, die
  Fabrary bisher nicht erkannte, kommen jetzt an.
  - *Export → Zuordnung …* zeigt die Zuordnung je Set und je Variante. Eigene Einträge gehen
    vor und stehen in der Konfigurationsdatei des Bestands.
  - *Mit Fabrary-Export abgleichen …* liest eine Sammlungs-CSV von Fabrary und zeigt nur die
    Abweichungen zur geltenden Zuordnung: eindeutige angehakt, unklare zur Auswahl.
- **Sets aufnehmen ohne leere Zeilen** (#18): Die Varianten eines aufgenommenen Sets stehen
  standardmäßig nur grau (○) in der Tabelle. Erst eine Menge schreibt eine Zeile in die
  Bestandsdatei. Wie bisher als Zeilen mit leeren Mengen aufzunehmen, ist im Dialog wählbar
  (die Wahl wird gemerkt).
  - Werden alle Mengen einer Zeile geleert und hat sie sonst nichts Eigenes (Notiz,
    abweichendes Playset, lokale Änderung ✱), wird sie wieder grau.
  - *Bestand → Leere Zeilen entfernen …* räumt vorhandene leere Zeilen auf; ihre Sets bleiben
    gesammelt, Rückgängig ist möglich.
  - Sets, die du ohne Zeilen sammelst, lassen sich im Dialog *Sets aufnehmen* wieder aufgeben.
- **Konfigurationsdatei** (#18): `<bestand>-config.json` neben Bestand und Protokoll hält, was
  nicht in die CSV gehört: die ohne Zeilen gesammelten Sets und die eigene Fabrary-Zuordnung.
  Ohne Arbeitsordner merkt sich das nur der Browser.

### Verbessert
- **Einrichtungsassistent** (#3): Er kündigt an, welche Datei im nächsten Fenster gewählt wird,
  bevor sich das Dateifenster des Browsers öffnet, und nach einem Import das Speichern.
- **Doku zu den Stammdaten**: Abschnitt „Online geladen oder mitgeliefert“ erklärt, woher die
  Kartendaten kommen und was ohne Internet gilt.

### Entwicklung
- Stammdaten vor dem Release geprüft: the-fab-cube `develop` steht unverändert auf Commit
  `e56071b` (21.08.2026).
- Neues Wartungsskript `tools/build-fabrary-map.mjs` erzeugt die Fabrary-Zuordnung aus einem
  Fabrary-Export. Der Selbsttest prüft sie an einem aktuellen Fabrary-Export, der wie alle
  eigenen Daten außerhalb des Repositorys liegt.
- Pläne stehen nur noch als Kommentar im Issue, Abweichungen und Abnahme in der
  PR-Beschreibung. Neue Branches heißen `feature/issue-<n>-<kurzname>`.

## 2.2.0.0 – 28.09.2026

### Neu
- **Export nach Cardmarket** (#7): Der Button *Export → Cardmarket* erzeugt eine Wants-Liste
  der Karten, die für ein Playset noch fehlen. Sie wird bei Cardmarket unter Wants → „Add Deck
  List“ eingefügt. Im Dialog wählbar:
  - ein Set oder mehrere Sets zusammen, jeweils mit Anzahl der fehlenden Karten
  - Seltenheiten
  - Menge: fehlend gesamt oder je Set
  - Setname und Edition am Zeilenende
  - nur die Zeilen der aktuellen Ansicht
  
  Das Format entspricht dem des ersten Tools. Karten mit gleichem Namen und Pitch zählen
  zusammen, auch mit CC Label. Den Pitch schreibt der Export nur bei Karten, die es in
  mehreren Pitches gibt.
- **Pitch-Farben** (#4): Ein farbiger Punkt vor Red, Yellow, Blue und Purple, in der Tabelle
  und in der Filterliste der Spalte, im hellen und im dunklen Design.

### Korrigiert
- **Pitch „4“ heißt „Purple“** (#4): Lila Karten des neuesten Sets kamen mit dem Wert „4“ in
  Stammdaten und Bestand. Bestände und 1.0-Tabellen mit „4“ werden beim Laden umgestellt, dazu
  erscheint eine Info-Meldung.

### Entwicklung
- Arbeit über das Projekt-Board: Issues auf *Approved* sind freigegeben. Jedes Issue bekommt
  einen eigenen `feature/`-Branch mit PR nach `develop`.
- Eine GitHub Action schließt beim Merge nach `develop` die Issues, die im PR in einer eigenen
  Zeile mit „Closes“ genannt sind. Das Board setzt sie dann auf *Done*.

## 2.1.0.0 – 25.09.2026
Erste öffentliche Version als GitHub Page (<https://jazzman1976.github.io/FabCollectionTool/>).
Unterstützt wird Chrome (und Edge), Firefox nicht mehr.
