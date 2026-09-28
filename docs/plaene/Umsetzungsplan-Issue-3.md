# Umsetzungsplan Issue #3 – Assistent kündigt die Dateiauswahl nicht an

**Issue:** https://github.com/Jazzman1976/FabCollectionTool/issues/3
**Branch:** `feature/3-assistent-dateiauswahl` · **Stand:** 28. September 2026
**Status:** Plan, Ready

## Kontext
Der Einrichtungsassistent (`app/onboarding.js`) hat drei Schritte:
1. *Wie möchtest du starten?* (neu, 1.0-Tabelle, Fabrary-Export, vorhandener Bestand)
2. *Wo sollen deine Dateien liegen?* mit dem Ordnerdialog des Browsers
3. Der gewählte Weg läuft direkt los: `runWay()` ruft `importOds()`, `importFabrary()` oder
   `open()` auf.

Schritt 3 hat keinen eigenen Dialog. Direkt nach dem Ordnerdialog öffnet sich deshalb ein
zweites Auswahlfenster des Browsers, ohne Ankündigung. Das verwirrt. Dazu kommt: Nach dem
Import meldet die App „Bitte ‚Speichern‘ wählen“. Der Assistent speichert aber gleich selbst und
fragt dafür nach einem Dateinamen. Diese Meldung passt im Assistenten also nicht.

## Änderungen
- **Neuer Dialog für Schritt 3** vor jeder Dateiauswahl, Titel „Einrichtung – Schritt 3 von 3:
  …“, mit Weiter und Abbrechen. Der Text hängt vom Weg ab:
  - *1.0-Tabelle:* „Im nächsten Fenster wählst du die .ods-Datei deines alten
    FabCollectionTool aus. Danach zeigt die Anwendung eine Vorschau, was übernommen wird, und
    legt den Bestand als neue Datei im Arbeitsordner an.“
  - *Fabrary-Export:* ebenso mit „die CSV-Datei, die du bei Fabrary exportiert hast“.
  - *Vorhandener Bestand:* „Im nächsten Fenster wählst du deine collection.csv“. Mit
    Arbeitsordner lautet der Text entsprechend „… aus dem Arbeitsordner“, weil dann die Liste
    der App erscheint und nicht das Fenster des Browsers.
  - *Neu anfangen:* kein zusätzlicher Dialog. Der Dialog „Neuer Bestand“ erklärt sich selbst
    und bekommt nur den Titel mit „Schritt 3 von 3“, falls das ohne Umbau geht.
- **Meldung nach dem Import im Assistenten:** Statt „Bitte ‚Speichern‘ wählen“ sagt die App vor
  der Namensabfrage: „Jetzt legst du den Namen der Bestandsdatei fest.“ Dazu bekommen
  `importOds`/`importFabrary` eine Option, die die bisherige Meldung unterdrückt. Außerhalb des
  Assistenten bleibt alles wie bisher.
- Schritt 2 („Im nächsten Dialog wählst du den Ordner …“) bleibt, wie er ist. Ist schon ein
  Arbeitsordner gewählt, entfällt Schritt 2 wie heute. Schritt 3 heißt dann trotzdem
  „Schritt 3 von 3“.
- `doku.html`: Im Abschnitt „Erste Schritte“ die Schritte des Assistenten kurz nennen, falls sie
  dort beschrieben sind.

## Abnahme
- Chrome über localhost, Assistent über Hilfe → Einrichtung für alle vier Wege. Vor jeder
  Dateiauswahl erscheint der angekündigte Dialog, Abbrechen beendet den Assistenten ohne
  Änderung. Beim ODS-Import folgt nach der Vorschau die Namensabfrage, ohne die Meldung
  „Bitte ‚Speichern‘ wählen“.
- Selbsttest grün.
