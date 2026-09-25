# Recherche: Talent-Spalten und weitere Spalten aus den Stammdaten

**Anlass:** `docs/Feedback 2.0.3.0.md`, Abschnitt „Konzeptarbeit und Recherchen“, Punkte 1 und 2
**Stand:** 24. September 2026, erstellt mit 2.0.4.0 · **Zweck:** Grundlage für das Feedback zu
2.0.4.0 und die Planung von 2.0.5.0. Hier wird nur recherchiert und empfohlen; umgesetzt ist davon
noch nichts.

**Datenbasis:** the-fab-cube/flesh-and-blood-cards, Branch `develop`, Commit `e56071b` vom
21.08.2026 – `card.csv` (4.952 Karten) und `card-printing.csv` (16.686 Druckzeilen, zusammengefasst
11.217 Druckvarianten). Zum Abgleich: der eigene Bestand (6.521 Zeilen). Die Zahlen wurden mit
einem Auswertungsskript erhoben, das nicht im Repository liegt.

---

## 1. Talent: eine Spalte oder mehrere?

### Was die Stammdaten hergeben

Die Stammdaten haben **keine eigene Talent-Spalte**. Talente stehen in der Typzeile (`Types`),
zusammen mit Klassen, Kartentypen und Untertypen, z. B. `Earth, Ice, Guardian, Equipment, Arms`.
Die Anwendung erkennt Talente über die Werteliste in `reference/vocab.js` (13 Talente: Light,
Shadow, Elemental, Earth, Ice, Lightning, Draconic, Mystic, Royal, Chaos, Revered, Reviled,
Rosetta) und schreibt heute alle gefundenen Talente mit Leerzeichen in **eine** Spalte `Talent`.

**Karten mit zwei Talenten** gibt es – aber nur **12 von 4.952** (0,24 %), nie mehr als zwei:

| Karte | Typzeile |
|---|---|
| Cindra | Royal, Draconic, Ninja, Hero, Young |
| Cindra, Dracai of Retribution | Royal, Draconic, Ninja, Hero |
| Emperor, Dracai of Aesir | Royal, Draconic, Warrior, Wizard, Hero, Young |
| Fang | Royal, Draconic, Warrior, Hero, Young |
| Fang, Dracai of Blades | Royal, Draconic, Warrior, Hero |
| Crumble to Eternity | Ice, Earth, Action, Aura |
| Gauntlets of the Boreal Domain | Earth, Ice, Guardian, Equipment, Arms |
| Pulse of Candlehold | Earth, Lightning, Action |
| Pulse of Isenloft | Ice, Earth, Defense Reaction |
| Pulse of Volthaven | Lightning, Ice, Instant |
| Regrowth // Shock | Earth, Runeblade, Action, Lightning, Instant (zwei Kartenhälften) |
| Summit, the Unforgiving | Earth, Ice, Guardian, Weapon, Polearm, 1H |

Auffällig:

- **Reihenfolge uneinheitlich:** „Ice, Earth“ und „Earth, Ice“ kommen beide vor. In einer Spalte
  entstehen so zwei verschiedene Werte für dieselbe Kombination (heute „Ice Earth“ und, sobald
  z. B. die Gauntlets im Bestand sind, „Earth Ice“) – und damit zwei Gruppen im Accordeon.
- **Royal** kommt nur zusammen mit Draconic vor (5 Karten).
- Im eigenen Bestand betrifft es **16 Zeilen**: „Royal Draconic“ (8), „Ice Earth“ (3),
  „Earth Lightning“ (3), „Lightning Ice“ (2). Emperor steht dort mit „Draconic“ statt
  „Royal Draconic“ und erscheint deshalb schon heute als Abweichung (≠).
- Karten mit mehr als zwei Klassen oder mehr als zwei Kartentypen gibt es nicht; mehr als drei
  Untertypen nur bei zwei Begleitern (Polly Cranka, Sticky Fingers: `Puffin, Companion, Off-Hand,
  Ally`). Die bestehenden Spalten Class1/2, Type1/2 und Sub1–3 reichen also aus – bis auf diese
  beiden, bei denen der vierte Untertyp heute wegfällt.
- Einige neue Wörter der Typzeilen stehen noch in keiner Werteliste (Puffin, Scurv, Arakni,
  High Seas, Invocation). Sie landen derzeit als Untertyp; `vocab.js` sollte sie bei Gelegenheit
  einordnen.

### Auswirkungen je Lösung

| | A: eine Spalte wie bisher | B: Talent1 / Talent2 (wie Class1/2) | C: eine Spalte, Häkchenfilter nach Einzel-Talent |
|---|---|---|---|
| Datenmodell / CSV | unverändert | neue Spalte `Talent2`; „Ice Earth“ wird zu `Talent1=Ice`, `Talent2=Earth` | unverändert |
| Häkchenfilter „Earth“ findet „Ice Earth“ | nein (nur als eigener Wert) | ja, über beide Spalten getrennt | ja (Filter zerlegt den Wert) |
| Accordeon-Gruppen | „Ice Earth“ und „Earth Ice“ getrennt | wie heute (Gruppe aus Talent1+Talent2+Klassen); Reihenfolge normalisierbar | wie A |
| Übereinstimmung mit Class1/2-Logik | nein | **ja** | nein |
| Fabrary-Import/-Export | nicht betroffen (Fabrary kennt kein Talent) | nicht betroffen | nicht betroffen |
| Übergang alter Dateien | – | beim Laden zerlegen (wie der Playset-Übergang, ohne Werte zu verlieren) | – |
| Aufwand | – | mittel: Modell, Typzerlegung, Übergang, Auswahllisten, Gruppierung, Selbsttest | klein bis mittel: nur Filterlogik |

### Empfehlung

**B: zwei Spalten `Talent1` und `Talent2`**, genau wie bei Class und Type. Das passt zur Logik der
übrigen Spalten, jede Zelle enthält genau einen gültigen Wert (Auswahlliste statt Freitext), und
der Häkchenfilter funktioniert ohne Sonderfall. Dazu eine feste Reihenfolge (z. B. die der
Werteliste), damit „Ice/Earth“ und „Earth/Ice“ nicht zwei Gruppen ergeben. Da `Talent2` fast immer
leer ist, bleibt sie in der Standardansicht ausgeblendet oder schmal.

Offene Frage für Elmar: Soll die Gruppierung „Set › Talent Class“ bei zwei Talenten beide nennen
(„Royal Draconic Ninja“, wie heute) oder nur das erste?

---

## 2. Welche weiteren Spalten wären sinnvoll?

Bewertet wurden alle Spalten von `card.csv` (je Karte) und `card-printing.csv` (je Druck), die die
Anwendung heute nicht zeigt. Füllgrad = Anteil der Karten bzw. Drucke mit einem Wert.

### Je Karte (`card.csv`)

| Spalte | Füllgrad | Beispiele | Nutzen für die Sammlung | Bewertung |
|---|---|---|---|---|
| Cost | 80 % | 0, 1, 2, 3 | Deckbau, Filtern nach Kosten | **sinnvoll** (optional) |
| Power | 43 % | 3, 4, 5 | Deckbau, Suche nach Angriffen | **sinnvoll** (optional) |
| Defense | 82 % | 3, 2 | Deckbau, Ausrüstung vergleichen | **sinnvoll** (optional) |
| Health | 4 % | 20, 40 | nur Helden (Young 20 / Adult 40) | eher nicht (gering gefüllt) |
| Intelligence | 3 % | 4 | nur Helden | eher nicht |
| Arcane | 6 % | 1, 2, 3 | Arcane Barrier/-Schaden | eher nicht |
| Card Keywords | 63 % | Go again (924), Blade Break, Boost, Blood Debt, Stealth | Suche und Filter nach Mechaniken; enthält auch „Legendary“ | **sinnvoll** (optional, Filter „enthält“) |
| Traits | 0,2 % | Agent of Chaos, Specialization | – | nein |
| Abilities and Effects, Ability/Granted/Removed/Interacts with Keywords | 0–14 % | Instant, Go again | Regeldetails | nein |
| Functional Text | 99 % | „When this hits, draw a card.“ | Regeltext; als Spalte zu lang, aber nützlich für die **Suche** und im Kartenbild bereits sichtbar | nur für die Suche |
| Type Text | 100 % | „Generic Action - Attack“ | doppelt zu Talent/Class/Type/Sub | nein |
| Card Played Horizontally | 0,3 % | Yes | – | nein |
| Blitz / CC / LL Legal | 3 % | nur „No“ | welche Karten verboten sind (leer = erlaubt) | **sinnvoll als ein Feld „Verboten in“** |
| Silver Age Legal, Commoner Legal | 22 % / 46 % | meist „No“ | Formate mit Seltenheitsregeln | im selben Feld |

### Je Druck (`card-printing.csv`)

| Spalte | Füllgrad | Beispiele | Nutzen für die Sammlung | Bewertung |
|---|---|---|---|---|
| Artists | 100 % | Carlos Cruchaga, Faizal Fikri | Sammeln nach Künstlern, Unterscheidung von Alternate Arts | **sinnvoll** (optional) |
| Flavor Text | 14 % | Stimmungstext | im Kartenbild sichtbar | nein |
| Expansion Slot | 1,7 % | Yes | markiert Karten aus dem Sonderplatz eines Boosters | eher nicht |
| TCGPlayer ID | 94 % | 247879 | Grundlage für Preislinks / spätere Exporte (TCGplayer steht als offener Punkt in der README) | später, zusammen mit Preisen/Exporten |
| Image URL | 100 % | – | seit 2.0.4.0 für die Kartenbilder genutzt | erledigt |
| Image Rotation Degrees | 0,2 % | 270 | Querformat-Karten richtig drehen | für die Kartenbilder, bei Bedarf |

### Aus den Set-Daten

| Spalte | Nutzen | Bewertung |
|---|---|---|
| Erscheinungsdatum des Sets | Sortieren/Filtern nach Alter, schon heute für die Set-Reihenfolge geladen | **sinnvoll** (optional) |

### Vorschlag

Als **ausblendbare Stammdatenspalten** (Standard ausgeblendet, über „Spalten“ einblendbar,
Häkchen- bzw. Zahlenfilter) kämen in Frage:

1. **Cost**, **Power**, **Defense** – kurz, gut gefüllt, nützlich zum Filtern.
2. **Card Keywords** – Filter „enthält“, z. B. alle Karten mit „Go again“.
3. **Artist** – für Alternate Arts und Künstler-Sammlungen.
4. **Verboten in** – ein zusammengefasstes Feld aus den Legalitäts-Spalten (z. B. „CC, Blitz“).
5. **Erscheinungsdatum** des Sets.

Dazu: **Functional Text** in die Suche aufnehmen (ohne eigene Spalte).

**Wichtige Entscheidung vorab:** Diese Werte kommen vollständig aus den Stammdaten und ändern sich
nicht durch den Nutzer. Es gibt zwei Wege:

- **Nur anzeigen** (wie die Spalte „Typen (Stammdaten)“): nicht in `collection.csv`, immer aktuell,
  keine Abweichungen möglich. Nachteil: In externen Tools fehlen sie.
- **Mitspeichern** (wie Rarity oder Pitch): in `collection.csv` in der Reihenfolge der Tabelle,
  im Editiermodus änderbar, mit Abweichungsprüfung. Nachteil: breitere Datei, mehr Abweichungen
  bei Datenkorrekturen.

Empfehlung: **nur anzeigen**, weil diese Spalten reine Nachschlage-Informationen sind – mit der
Möglichkeit, einzelne später mitzuspeichern, falls sie in externen Tools gebraucht werden.

---

## 3. Abgleich mit dem offiziellen Regelwerk

**Quelle:** Comprehensive Rules auf https://rules.fabtcg.com/en/ (Textfassung
`https://rules.fabtcg.com/txt/latest/en-fab-cr.txt`), abgerufen am 24.09.2026. **Nachtrag zu
2.0.4.0**, angeregt von Elmar.

Die Stammdaten differenzieren tatsächlich nicht: Sie liefern nur die Typzeile. Das Regelwerk legt
aber fest, wie eine Typzeile aufgebaut ist (2.14.1: `[Metatypen] [Supertypen] [Typ] — [Untertypen]`)
und welche Schlüsselwörter es gibt. Supertypen sind entweder Klasse oder Talent (2.11.6). Damit
lässt sich jedes Wort eindeutig einordnen, statt es nur über die Werteliste zu erraten.

| Regel | Liste im Regelwerk | Abweichung zu `reference/vocab.js` |
|---|---|---|
| 2.11.6a Klassen | Adjudicator, Assassin, Bard, Brute, Guardian, Illusionist, Mechanologist, Merchant, Necromancer, Ninja, Pirate, Ranger, Runeblade, Shapeshifter, Thief, Warrior, Wizard (17) | `vocab.js` führt zusätzlich **Pit-Fighter** – laut 2.10.6b ein **Untertyp** („Guardian, Hero, Pit-Fighter“, 5 Helden). **Generic** heißt laut 2.14.1a „keine Supertypen“; als Anzeigewert bleibt es sinnvoll. |
| 2.11.6b Talente | Chaos, Draconic, Earth, Elemental, Ice, Light, Lightning, Mystic, Revered, Reviled, Royal, Shadow (12) | `vocab.js` führt zusätzlich **Rosetta** – laut 2.6.6 kein Talent, sondern ein **Set-Metatyp** („Rosetta, Macro“). |
| 2.15.6a Typen | Action, Attack Reaction, Block, Companion, Defense Reaction, Demi-Hero, Equipment, Hero, Instant, Macro, Mentor, Resource, Token, Weapon | **Companion** fehlt in `vocab.js` und landet heute als Untertyp. **Event** („Event, Equipment, Head“) ist im Regelwerk kein Typ, gehört eher zu den Metatypen. |
| 2.10.6a/b Untertypen | vollständige Listen, u. a. Invocation, Ally, Off-Hand, Pit-Fighter, Young | Untertypen erkennt die App heute als Rest; die Liste taugt zur Prüfung. |
| 2.6.6 Metatypen | Hero-Metatypen (Moniker eines Helden) und Set-Metatypen (Set-Name); **keine feste Liste** | Neue Wörter aus Abschnitt 1 einordnen: Rosetta, High Seas (Set), vermutlich Puffin, Scurv (Held, „Puffin, Companion, Off-Hand, Ally“). Braucht eine eigene Liste in `vocab.js`. |

**Folgen für 2.0.5.0** (umgesetzt in 2.0.5.0, siehe `docs/Umsetzungsplan-2.0.5.0.md`):

- `vocab.js` an das Regelwerk angleichen: Pit-Fighter → Untertyp, Rosetta → Metatyp, Companion →
  Typ, Event klären; neue Liste `metatypes`.
- Metatypen nicht mehr als Untertyp ablegen – ob sie eine eigene Spalte bekommen oder nur angezeigt
  werden, ist eine offene Frage für Elmar.
- Die Empfehlung **B (Talent1/Talent2)** aus Abschnitt 1 bleibt; das Regelwerk bestätigt, dass
  Talente eine feste, kleine Liste sind. Die feste Reihenfolge kann die des Regelwerks sein
  (alphabetisch).
- Der Selbsttest sollte prüfen, dass jedes Wort jeder Typzeile genau einer Liste zugeordnet wird.

### Aufbau der Typzeile (Regel 2.14.1)

Das Regelwerk legt auch fest, **wie** die Typzeile auf der Karte steht:

```
[METATYPEN] [SUPERTYPEN] [TYP] [— UNTERTYPEN]
```

- 2.14.1a: Steht als Supertyp „Generic“, hat die Karte keine Supertypen.
- 2.14.1b: Hybridkarten schreiben die Supertypen als `[SUPERTYPEN-1] / [SUPERTYPEN-2]`
  (z. B. „Brute / Warrior Action - Attack“).

Damit ergibt sich die Zuordnung eines Wortes aus seiner **Position** und nicht nur aus einer
Werteliste. Geprüft wurde das gegen `card.csv` (the-fab-cube, `develop`, 4.952 Karten):

**Zwei Spalten mit der Typzeile.** Die Stammdaten haben neben `Types` (von der App genutzt,
kommagetrennt) auch `Type Text`, die gedruckte Typzeile genau im Format 2.14.1. Der Trenner ist
immer ` - `, Hybridkarten haben ` / `, zweiseitige Karten ` // `. Beispiele:

| `Type Text` | `Types` |
|---|---|
| Guardian Hero - Pit-Fighter | Guardian, Hero, Pit-Fighter |
| Puffin Companion - Off-Hand Ally | Puffin, Companion, Off-Hand, Ally |
| High Seas Macro - Landmark | High Seas, Macro, Landmark |
| Omens of the Third Age Macro | Omens of the Third Age, Macro |
| Royal Draconic Ninja Hero - Young | Royal, Draconic, Ninja, Hero, Young |
| Assassin / Ninja Equipment - Arms | Assassin, Ninja, Equipment, Arms |

`Types` enthält dieselben Wörter **in derselben Reihenfolge** (Metatypen, Supertypen, Typ,
Untertypen), nur ohne Strich. Mehrteilige Metatypen bleiben dort ein Eintrag („High Seas“,
„Omens of the Third Age“). `Types` ist außerdem sauberer: `Type Text` enthält Tippfehler
(„Nina“, „Warror“, „Warior“, „Gaurdian“ bei 4 Karten) und vereinzelt Kommas.

**Gefundene Metatypen** (Wörter vor den Supertypen, die weder Klasse, Talent noch Typ sind):
Event (26 Karten), Rosetta, High Seas, Omens of the Third Age (Set-Metatypen) sowie Arakni,
Puffin, Scurv (Hero-Metatypen, also Moniker eines Helden nach 2.7.3).

**Ausnahmen:**

- 21 Tokens haben keinen Typ, z. B. „Light - Angel Ally“ oder „Draconic Illusionist - Dragon Ally“.
  Hier trennt nur der Strich in `Type Text` Supertypen und Untertypen.
- 21 Karten haben nur „Event“ als Typzeile.
- „Den of the Spider“ und „Lair of the Spider“ haben laut `Type Text` zwei Typen („Action
  Defense Reaction - Trap“); in `Types` fehlt „Action“.
- Zwei Klassen gibt es als Hybrid („Assassin / Ninja“) und ohne Hybrid (Emperor: „Royal Draconic
  Warrior Wizard Hero“). Für Class1/Class2 ist das egal; ob der Unterschied angezeigt werden soll,
  ist offen.

**Empfohlene Erkennungsregel für 2.0.5.0** (`splitTypes` in `app/model.js`):

1. Geschlossene Listen aus dem Regelwerk: Typen (2.15.6a), Klassen (2.11.6a), Talente (2.11.6b),
   dazu „Generic“.
2. `Types` weiter als Quelle nutzen, aber nach Position zerlegen:
   - alles **vor dem ersten Typ**, das Klasse oder Talent ist, ist Supertyp;
   - alles andere **vor dem ersten Typ** ist Metatyp;
   - alles **nach dem letzten Typ** ist Untertyp.
3. Hat eine Karte keinen Typ, entscheidet der Strich in `Type Text`, wo die Untertypen beginnen.
4. Ein unbekanntes Wort an einer Stelle, an der nur Listenwerte stehen dürfen, wird als Hinweis
   gemeldet: So fallen neue Klassen oder Talente in den Stammdaten sofort auf, statt still als
   Untertyp zu landen.

Damit lösen sich die Fehler aus der Tabelle oben von selbst: Pit-Fighter steht hinter dem Typ und
ist Untertyp, Rosetta steht davor und ist Metatyp. In der Typenliste muss nur Companion ergänzt
und Event gestrichen werden.
