# Feedback 2.0.7.0

## Offene Punkte nach Prüfliste 2.0.7.0

### 1. Daten in deinem Bestand

Es ist OK so wie es ist. Es ist egal warum das so ist, es zählt allein, dass man das bearbeiten kann um es zu korrigieren. Die aktuelle Umsetzung ist gut.

### 2. Überprüfung im Browser

Es ist davon auszugehen, dass alle Änderungen vor einem Push immer erst im Browser von Elmar geprüft worden waren.
Die Zusage zum Commit ist als Erfolgreicher Test zu bewerten.
Fall später doch noch Probleme auffalen werden diese erneut gemeldet und angegangen.
Eine rückwirkende Bestätigung für Umsetzungen kann entfallen.

### 3. Firefox

Wenn wir bei unserem aktuellen Plan bleiben, dass man die App ohne Server direkt im Filesystem oder als GitHub Page öffnen kann sollten wir den Support für den Firefox aufgeben. Mir reicht es wenn das im Chrome funktioniert. Da ich keine Apple Geräte habe ist ein Test mit Apple Devices noch ausstehend. Aber der Main Support sollte auf dem Chrome Browser liegen. Der Rest ist erstmal Nebensache.

### 4. file://

Ich habe keine Probleme damit bemerkt bisher. Ich gehe daher davon aus, dass alles funktioniert.

### 5. Beobachten

Alle Punkte sind in Ordnung und funktionieren. Sollte noch was auffallen sage ich das.

## Organisatorisches

Bitte schiebe im docs Ordner Dokumente gleicher Art in neue Unterordner damit es übersichtlicher wird.

## To Do

Ich möchte, dass wir einen Pull Request mit dem aktuellen Stand machen. Ich möchte das dann gerne als GitHub Page veröffentlichen. Der Main und der Develop Branch sollen geschützt werden, so dass nur ich etwas dort hinein mergen kann. Eine GitHub Action soll bei einem Push in den Main Branch automatisch die GitHub Page mit der neuen Version deployen.