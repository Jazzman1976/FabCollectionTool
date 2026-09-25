# Prüfliste nach FabCollectionTool 2.0.7.0

**Stand:** 25. September 2026, nach Commit c10a74c (2.0.7.0 gepusht)

## Kontext
Elmar möchte vor der nächsten Version die offenen Punkte sehen. Sie stammen aus den
Abnahme-Abschnitten der Umsetzungspläne 2.0.4.0–2.0.7.0 und aus eigenen Auswertungen seiner
`collection.csv`. Diese Liste liegt im Repo, damit sie in der nächsten Sitzung auffindbar ist.

## 1. Daten in deinem Bestand prüfen (Editiermodus)
Mengen in Foilings, die es laut Stammdaten für diese Variante nicht gibt (orange umrandet):
LGS227 ST=1 · GEM070 ST=1 · ANQ029 RF=1 · EVO038–EVO041 je ST=3 · HVY006 (EN) RF=1 ·
LGS228 RF=1 · HNT010 (EN) CF=1 · SEA174 (EN) CF=1 · AGB002 ST=1.
Entweder Eintragsfehler (Menge ins richtige Foiling verschieben) oder Lücke in den Stammdaten.

## 2. Nur mit echten Browser-Dialogen prüfbar (Chrome/Edge)
- „Neu“: Datei im Arbeitsordner anlegen; „Anderen Ordner …“; ohne Arbeitsordner „Speichern
  unter“ (startet im Ordner des letzten Bestands).
- „Öffnen“ in einem leeren Arbeitsordner: Import- und „Erstes Set“-Wege, „Anderen
  Arbeitsordner auswählen“.
- Einrichtungs-Assistent: alle vier Wege bis „Fertig“ (inkl. Import mit anschließendem
  Speichern).
- Backup-Dialog mit echtem Schreiben (Arbeitsordner, Speichern-Dialog).
- „Übernehmen …“ bei leerem Bestand.
- Automatisches Speichern mit echter Datei (seit 2.0.2.0 offen).

## 3. Firefox
- Einstellung „Jedes Mal nachfragen, wo gespeichert werden soll“: Strg+S ersetzt dieselbe Datei;
  Protokoll `<bestand>-log.csv` vollständig; Diagnose `fct-diagnose.log`.
- Einmaliger Hinweis vor dem ersten Speichern.

## 4. `file://` (Doppelklick auf index.html) in Chrome und Firefox
Kartenbilder, Branch-Wechsel, Design, Arbeitsordner/Autosave (Chrome), Assistent.

## 5. Beobachten
- Bildsymbol/Zeilenhöhe mit deiner Schrift und Bildschirmskalierung (Anlass von 2.0.6.1).
- Scrollen mit der Tastatur nach unten (zentriert seit 2.0.6.0) – stimmig?
- „Scrollen springt zurück“ (seit 2.0.2.0 gemeldet, nie nachstellbar; das Diagnose-Log
  schreibt Sprünge ohne Nutzeraktion mit).
- Gruppen der eigenen Sets („Gemischt“, Abschnitte nach Id).

