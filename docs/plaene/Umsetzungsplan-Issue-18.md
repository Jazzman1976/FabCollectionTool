# Umsetzungsplan Issue #18 – Sets aufnehmen ohne leere Zeilen in der CSV

**Issue:** https://github.com/Jazzman1976/FabCollectionTool/issues/18
**Branch:** `feature/18-sets-ohne-leere-zeilen` · **Stand:** 29. September 2026
**Status:** umgesetzt, PR nach `develop`

## Kontext
*Sets aufnehmen* schreibt heute alle Varianten eines Sets als Zeilen mit leeren Mengen in die
`collection.csv`. ○-Lücken (grau) sind Varianten, die es laut Stammdaten gibt, die aber nicht in
der CSV stehen. Sie erscheinen nur für Sets, von denen mindestens eine Zeile in der CSV steht
(`model.withGaps`). Beim Set IAR entstand so eine Mischung: 9 echte leere Zeilen aus dem Stand
`develop`, rund 500 graue Lücken aus dem Branch `usurp-the-shadow-throne`.

Abgestimmt mit Elmar:
- In der CSV stehen **nur relevante Daten, keine leeren Zeilen**.
- *Sets aufnehmen* zeigt die Varianten **standardmäßig nur grau** an und **fragt**, ob sie wie
  bisher als Zeilen mit leeren Mengen aufgenommen werden sollen.
- Erst eine eingetragene Menge oder + schreibt eine Zeile in die CSV.
- **Werden alle Mengen einer Zeile geleert, wird sie wieder grau.** Das gilt nur, wenn sie
  auch keine Notiz, kein abweichendes Playset und keine lokale Änderung (✱) hat.
- Für vorhandene leere Zeilen gibt es einen Befehl **„Leere Zeilen entfernen“**.
- Welche Sets gesammelt werden, steht in einer **Konfigurationsdatei** im Arbeitsordner, nicht
  im Browser.

## Konfigurationsdatei
- Name `<bestand>-config.json` neben `<bestand>.csv` und `<bestand>-log.csv`, also z. B.
  `collection-config.json`. JSON, damit weitere Einstellungen je Bestand später Platz haben:
  `{ "version": 1, "collectedSets": ["IAR", "MST", …] }`.
- Gelesen beim Öffnen, geschrieben zusammen mit dem Bestand, auch beim automatischen Speichern.
  Die Datei wird nur geschrieben, wenn sich ihr Inhalt ändert.
- **Gesammelte Sets** = Sets mit mindestens einer Zeile in der CSV **plus** `collectedSets`.
  Fehlt die Datei, etwa bei einem älteren Bestand, gilt wie heute nur der erste Teil. Die CSV
  und ihre Spaltenfolge bleiben unverändert.
- **Ohne Arbeitsordner** (einzelne Dateien): Die Liste wird in der Kopie des Bestands im Browser
  (IndexedDB) gehalten. Ein Hinweis sagt einmal, dass sie nur mit Arbeitsordner als Datei
  gesichert wird.
- Heute im Browser gespeicherte Einstellungen je Bestand werden geprüft. Was dauerhaft zum
  Bestand gehört, wandert nicht in diesem Issue mit, sondern wird im Plan-Nachtrag
  aufgelistet. Ansichtseinstellungen bleiben im Browser.

## Änderungen
- **Sets aufnehmen** (`app.js` `addSets`): unter der Set-Liste die Wahl
  - „Nur anzeigen (grau) – erst eine Menge nimmt die Karte in den Bestand auf“ (Standard)
  - „Als Zeilen mit leeren Mengen in den Bestand schreiben (wie in der 1.0-Tabelle)“

  Die Wahl wird gemerkt. Bei „nur anzeigen“ landen die Set-Codes in `collectedSets`, die
  Lücken erscheinen sofort, Protokolleintrag „Set aufgenommen“ wie bisher.
- **Set nicht mehr sammeln:** Sets aus `collectedSets` ohne Zeile in der CSV erscheinen im
  selben Dialog in einem zweiten Abschnitt und lassen sich dort wieder entfernen. Sonst gäbe es
  für ein versehentlich aufgenommenes Set keinen Weg zurück.
- **Zeile wird wieder grau:** Leert eine Eingabe (Zelle, −, Zeilendialog, Rückgängig) die
  letzte Menge einer Zeile, und die Zeile hat keine Notiz, kein abweichendes Playset und kein
  ✱, wird sie aus dem Bestand genommen und erscheint als ○. Das Protokoll vermerkt „Zurück zu
  ○“, Rückgängig stellt die Zeile wieder her. Ausdrücklich aufgenommene leere Zeilen
  (Zeilenaktion „In den Bestand aufnehmen“, Wahl im Set-Dialog) bleiben, bis sie einmal eine
  Menge hatten.
- **Leere Zeilen entfernen** (Gruppe Bestand): zählt Zeilen ohne Menge, Notiz,
  Playset-Abweichung und ✱, zeigt die Anzahl je Set und entfernt sie nach Rückfrage. Ihre Sets
  kommen in `collectedSets`, damit sie grau sichtbar bleiben. Ein Protokolleintrag entsteht,
  Rückgängig ist möglich.
- `model.js`: gesammelte Sets als Parameter für Lücken, `missingSets`, „Vollständige Sets“;
  Prüfung „leere Zeile“ als Funktion.
- `storage.js`/`app.js`: Konfigurationsdatei lesen und schreiben wie das Protokoll, dazu
  Diagnose-Einträge.
- `doku.html`: Farben und ○ klar beschreiben („grau/○ = steht nicht in deiner CSV“, „grauer
  Hintergrund = Stammdaten-Zelle“), Sets aufnehmen, Leere Zeilen entfernen,
  Konfigurationsdatei im Abschnitt Arbeitsordner.
- `tools/selftest.mjs`: Lücken für Sets nur aus `collectedSets`, „leere Zeile“-Regel,
  Entfernen und Rückgängig, CSV ohne leere Zeilen nach „nur anzeigen“.

## Zusammenspiel mit #17
Der Fabrary-Export nach #17 nimmt alle Varianten von the-fab-cube, unabhängig von der CSV.
Graue Varianten gehen dort mit `0` hinaus. Die beiden Issues berühren sich also nicht.

## Abnahme
- Chrome über localhost mit Arbeitsordner:
  - Set mit „nur anzeigen“ aufnehmen: alles grau, CSV unverändert, `…-config.json` enthält
    das Set.
  - Menge eintragen: Die Zeile steht in der CSV. Menge wieder leeren: wieder grau.
  - „Leere Zeilen entfernen“ mit den IAR-Zeilen, danach Rückgängig.
  - Neu laden: Die grauen Sets sind wieder da.
- Ohne Arbeitsordner: Hinweis erscheint, Sets bleiben nach Neuladen erhalten.
- Selbsttest grün, keine Konsolenfehler.

## Umsetzung und Abweichungen
- `model.js`: `collection.collectedSets` (neu in `create()`), `collectedCodes()`,
  `isEmptyRow()`; `withGaps` hängt die Lücken von Sets ohne Zeilen am Ende an, `missingSets`
  bietet gesammelte Sets nicht mehr an. „Leer“ heißt: genau eine Variante der Stammdaten (keine
  Sprach-Edition, keine unbekannte Nummer), alle Mengen 0 oder leer, und First In,
  Übersetzungen, Peculiarity, Notiz, Overrides (✱, deckt auch ein geändertes Playset ab) und
  Zusatzspalten leer.
- `app.js`:
  - Konfigurationsdatei: `configName`, `loadConfig`, `saveConfig`, `applyConfig`. Gelesen beim
    Öffnen und beim Neuladen nach einer Änderung außerhalb, geschrieben nach Speichern und
    automatischem Speichern (nur bei geändertem Inhalt). Die Kopie im Browser trägt die Werte
    mit (`config`).
  - Regel „wieder grau“: `changeCell` merkt eine verschwundene Menge vor, `releaseEmptied`
    entscheidet nach allen Änderungen der Aktion (Zelle, −, Zeilendialog, Rückgängig).
    Protokolleintrag „Zurück zu ○“. Das Protokoll findet dafür auch graue Zeilen, damit
    Rückgängig geht.
  - Sets aufnehmen: Wahl „Nur anzeigen (grau)“ / „Als Zeilen“ (gemerkt als `addSetsMode`),
    Abschnitt „Gesammelt ohne Zeilen (grau)“ zum Aufgeben.
  - „Leere Zeilen entfernen …“ (Gruppe Bestand) mit Zahl je Set; Rückgängig über den Knopf im
    Hinweis danach (Protokolleinträge ohne Spalte haben keinen Rückgängig-Knopf).
- **Zusätzlich (nicht im Plan):** Wird die letzte Zeile eines Sets grau (Leeren oder
  „Löschen“), bleibt das Set gesammelt (`keepCollected`). Vorher verschwand das Set beim
  Löschen der letzten Zeile ganz, obwohl „ein Set bleibt immer vollständig“ gilt. Die Doku zu
  Löschen ist angepasst.
- Einstellungen je Bestand im Browser geprüft: Die gemerkte Ansicht (offene Gruppen, Position)
  ist Ansicht und bleibt im Browser; die Autosave-Entscheidung hängt am Datei-Handle und kann
  nicht in eine Datei. Weitere Kandidaten für die Konfigurationsdatei gibt es derzeit nicht.
- `doku.html`: grauer Hintergrund vs. graue Zeile mit ○, ○ = „nicht in deiner Bestandsdatei“,
  Vollständige Sets mit der Regel „wieder grau“, Sets aufnehmen mit beiden Arten und dem
  Aufgeben, neuer Abschnitt „Leere Zeilen entfernen“, `collection-config.json` in der Tabelle
  des Arbeitsordners, Löschen der letzten Zeile.
- Selbsttest: zwei neue Prüfungen („Sets collected without rows“, „Empty rows“).

## Ergebnis der Abnahme (29.09.2026)
- Selbsttest grün.
- Chrome über localhost mit einem echten Arbeitsordner (privates Dateisystem des Browsers statt
  Ordnerdialog), neuer Bestand, automatisches Speichern an:
  - Set ARC „Nur anzeigen“: 508 graue Varianten, `collection.csv` nur Kopfzeile,
    `collection-config.json` = `["ARC"]`.
  - Menge 1 in RF eingetragen: Zeile weiß, CSV 2 Zeilen. Menge gelöscht: Zeile wieder grau,
    Auswahl bleibt, CSV 1 Zeile, Protokoll „Zurück zu ○“. Rückgängig im Protokoll: Zeile wieder
    da, CSV 2 Zeilen.
  - Set MPA „Als Zeilen“: 9 leere Zeilen. „Leere Zeilen entfernen“: Dialog nennt MPA 9 Zeilen,
    danach grau; Rückgängig im Hinweis stellt sie her; erneut entfernt. Wahl „Als Zeilen“
    gemerkt. Konfiguration `["ARC","MPA"]`.
  - Konfigurationsdatei von außen auf `["ARC"]` geändert, Seite neu geladen (Stand aus der
    Kopie: ARC + MPA), dann Öffnen aus dem Ordner: nur noch ARC – die Datei wird gelesen.
  - MPA wieder „nur anzeigen“ aufgenommen und im Abschnitt „Gesammelt ohne Zeilen“
    aufgegeben: graue Zeilen weg, Konfiguration `["ARC"]`.
  - Keine Fehler im Diagnose-Log.
- Nicht im Browser geprüft: der Hinweis ohne Arbeitsordner, − bis 0 und der Zeilendialog (sie
  laufen über dieselbe Stelle `releaseEmptied` wie das Leeren einer Zelle).
