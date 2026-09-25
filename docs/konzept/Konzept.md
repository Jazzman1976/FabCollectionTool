# Konzept Feedback
Bezug auf Konzept Version 1.1.5

## CSV als Format für eigene Daten
Finde ich eine gute Idee weil man das sauber committen und maschinell besser lesen kann.

Negativ ist aber, dass man jetzt nur noch über ein Tool darin arbeiten kann. Theoretisch könnte man das auch manuell bearbeiten, aber das ist nicht praktisch. Andere CSV Tools können auch bearbeiten aber zerlegen oft das CSV Format ungewollt oder ergänzen es nicht sinnvoll.

Mit gefällt, dass es simpel ist und ausreicht und das man sofort mit dem Tool arbeiten kann ohne was installieren oder einrichten zu müssen.

## Eine statische Web Anwendung als UI
Finde ich super weil nur ein Browser gebraucht wird. Das setze ich mal heute als gesetzt voraus.

## Zur Ausgangslage
In der heutigen Lösung sind mir folgende Dinge wichtig:

1. Man kann sehr gut nach einer Karte suchen weil man viel filtern und ausblenden kann

2. Man kann sehr gut verschiedene Druck-Arten auseinander halten weil alles notwendige dafür direkt tabellenartig untereinander steht

3. Man kann es recht einfach manuell bearbeiten und erweitern

In der heutigen Lösung stört mich:

1. Sehr große Datei die man schlecht sichern kann.

2. Fehler zerlegen die Berechnungen und man findet sie nicht.

3. Komplizierte Parser

4. Export dauert lange

5. Keine automatischen Updates mit neuen Karten und Sets

6. Keine zusätzlichen Komfort und QoL Features in der Calc Datei leicht möglich

7. Wächst zu groß, kommt an sein Limit

In der heutigen Lösung finde ich nicht so schlimm:

1. Manuelles Einpflegen von Daten ist nicht so dramatisch weil ich alles kopieren kann aus sicheren Quellen für die Kartentexte

2. Mapping über Index ist nicht so schlimm weil ich diesen ja genau kenne und anpassen kann. Die Calc Datei ändere ja auch nur ich selber.

3. Die Berechnungen in der Calc Datei waren nur um das etwas besser sichtbar zu machen was einem noch so fehlt oder wie viel man abgeben kann. So konnte ich über eine Farbkennung die Dinge leichter identifizieren direkt in der Calc Datei. Die Berechnung habe ich nur hin und wieder angestoßen wenn ich sie mal brauchte.

# Die Anwendung und was da wichtig ist

Wenn wir das neu machen ist mir folgendes wichtig:

- Soll auf allen gängigen Plattformen problemlos laufen

- Gute Lesbarkeit für Mensch und Maschine

- Änderungen können gesichert werden, nicht nur in der Code Repo sondern auch lokal

- Alles was der lokale User so tut sollte nie in der Code Repo landen. Die Repo soll nur das Tool selber enthalten. Alles was lokal dann produziert wird bleibt lokal. So kann man die Repo nutzen um das allen Leuten zugänglich zu machen ohne Userdaten drin

- Es sollte eine solide Backup Funktion enthalten sein, damit man seinen Stand nicht verlieren kann. Dies sollte zur Sicherheit auch in der Cloud landen. Das sollte zumindest optional angeboten werden. Theoretisch könnte man das ja auch in OneDrive betreiben wodurch ein Backup in der Cloud ja schon gehen würde. Aber das kann man eben nicht voraussetzen da viele Leute auch nicht so Technik affin sind.

- Möglichkeit das Tool regelmäßig zu updaten mit dem neuesten Stand

- Sicherer Export in die vier Systeme. Insbesondere Fabrary und Cardmarket.

- Nice to have: Cardmarket optimiert in allen Dingen die relevant dafür sind, z.B. Preise von Cardmarket. In Deutschland arbeiten alle verstärkt damit. Was konkret wir hier machen können ist aber zu evaluieren, da wir keinen API Zugang bekommen werden und es kaum ausgelesen werden kann. Ideen sind hier sehr willkommen.

- Es soll leicht editierbar sein

- eine sehr übersichtliche und leichte Navigation beim Bearbeiten des Bestandes an Karten

- Der Bestand sollte sich leicht importieren lassen aus anderen Systemen, insbesondere aus Fabrary. Das wäre ein neues Feature was es bisher nicht gibt.

- Auch ein Import aus dem jetzigen Calc File in das neue System soll definitiv integriert werden um auf das neue System umsteigen zu können

- TCGplayer sollte nur am Rande supported werden, da dies in Deutschland kaum eine Rolle spielt. Es wäre interessant um Preistendenzen zu erkennen oder Verfügbarkeiten aber mehr auch nicht. Viel interessanter wären diese Daten aber von Cardmarket.

- Fabrary ist mit Abstand das wichtigste der Exporte. Danach Cardmarket.

# Code Guidelines

- Jeder logische Block im Code soll mit einem Kommentar eingeleitet werden der kurz erklärt was der Block tut

- Nach maximal 100 Zeichen soll immer umgebrochen werden. Grund: Bessere Lesbarkeit in schmaleren IDE Fenstern oder bei Pull Requests Code Vergleichen.

- Sprache in der Entwicklung einschließlich der Code Kommentare ist englisch

- Dokumentation außerhalb des Codes ist deutsch, inkl. der .md Files für maschinelles Lesen und Informationen für KI Systeme

- Wartbarkeit und Lesbarkeit ist wichtiger als Code Komplexität

- So einfach wie möglich, so komlex wie nötig. Short and Simple. Keine Raketenwissenschaften.

