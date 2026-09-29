# Release Notes FabCollectionTool 2

Versionsschema **Major.Minor.Release.Build**. Eine neue Version entsteht als Branch
`release/<Version>` von `develop`. Jede Erweiterung oder Korrektur auf dem Release-Branch erhöht
die dritte Stelle (z. B. 2.2.0.0 → 2.2.1.0). Nach dem Test wird der Branch nach `main`
gemergt (Veröffentlichung als GitHub Page, Tag) und danach zurück nach `develop`.

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
