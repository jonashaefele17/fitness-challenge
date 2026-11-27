# Baustein 8 – Ziele & Saisons: Plan

Branch: `feat/goals-seasons`. Grundlage: Konzept (Version 1.48) – „Ziele, Saisons und Vergleich“, „Besondere Tage im Kalender“, „Datenmodell“ (Ziele & Saisons).

Stand: Plan mit Jonas abgestimmt am 27.11.2026. Gebaut wird Etappe für Etappe, jeweils mit Test auf Staging.

## Worum es geht

Wofür das gebaut wird: eine erste Saison über rund 6 Monate mit Freunden, mit festen Zielen, wöchentlichem Wiegen und einem Zwischenstand alle 4 Wochen. Die App soll danach ohne Saison weiter nutzbar sein.

Daraus folgen zwei getrennte Dinge:

- **Ziele** sind persönlich. Jede Person kann jederzeit Ziele haben, auch ohne Gruppe und ohne Saison. Der Fortschritt wird immer aus den vorhandenen Daten berechnet.
- **Eine Saison** ist ein Rahmen der Gruppe: Zeitraum, Teilnehmer, Regeln und die Ziele, die für diesen Zeitraum festgeschrieben werden. Trainings, Gewicht und Habits laufen über alle Saisons durch und werden nie zurückgesetzt.

## Etappen

### 8a – Persönliche Ziele

- Ein Ziel besteht aus Messgröße, Startwert, Zielwert, optionalem Mindestziel, Zeitraum (von – bis) und Sichtbarkeit.
- Mindestziel und Ziel: Das Mindestziel ist das, worauf man sich festlegt, das Ziel das, was man erreichen will. Status dreistufig: unter dem Mindestziel / Mindestziel erreicht / Ziel erreicht. Wer nur einen Wert setzt, hat ein normales Ziel.
- Ein Ziel auf einem Habit legt sich über dessen Regel: Das Habit sagt, was ein guter Tag ist, das Ziel, an wie viel Prozent der Tage (oder Wochen) man das schaffen will.
- Messgrößen stehen als Daten in einer Tabelle, neue kommen ohne Umbau dazu. Für den Anfang:
  - Trainings pro Woche (Wochenziel, zählt erfüllte Wochen)
  - Körpergewicht (Durchschnitt über 7 Tage)
  - Bestwert an einer Übung
  - Erfüllungsquote eines Habits
  - ein Körpermaß (z. B. Bauchumfang)
- Berechnet, nicht gespeichert: aktueller Wert, Fortschritt in %, Status „auf Kurs / hinter Plan“ gegen die Linie vom Start zum Ziel, „erreicht“.
- Startwert automatisch vorgeschlagen und änderbar: Gewicht = aktueller Durchschnitt, Kraft = bester Satz der letzten 4 Wochen, Maß = letzter Zwischenstand.
- Oberfläche: neuer Reiter „Ziele“ unter „Ich“ an erster Stelle; „Einstellungen“ wandert aus der Reiterleiste in ein Zahnrad oben rechts. Ziel anlegen in wenigen Schritten, Detail mit Verlauf gegen die Ziellinie.
- Änderungen sind versioniert (`valid_from`); archivieren statt löschen.
- Technik: neues persönliches Modul `goals`. Die Werte der Messgrößen kommen aus SQL-Funktionen über Training, Körper und Habits, weil persönliche Module sich im Frontend nicht gegenseitig importieren.

### 8b – Saison: anlegen, Setup, Start, Kalender

- Admin legt an: Name, Zeitraum, Setup-Phase, Teilnehmer, Regeln. Alle Teilnehmer bekommen eine Push.
- Regeln der Saison (als Daten): Wiegen pro Woche, Zwischenstand alle x Wochen, Pflicht-Zielarten.
  - Die Regeln stellen bei den Teilnehmern die persönlichen Rhythmen aus Baustein 7 ein (Wiege-Erinnerung, Zwischenstand-Rhythmus); der Wochentag und die Uhrzeit bleiben persönlich.
- Setup-Phase: jede Person richtet die Saison zum Durchklicken ein, ausgelöst durch die Push und eine Karte auf „Heute“. Die Ziele der anderen sind sichtbar und kommentierbar.
  1. Rahmen (Name, Zeitraum, Teilnehmer, Regeln; nur lesen)
  2. Trainingsziel (Pflicht) mit Mindestziel und Ziel
  3. Weitere Ziele: Zielarten wählen, pro Art ein Bildschirm mit vorgeschlagenem Startwert
  4. Habits: vorhandene ankreuzen, die in der Saison zählen, jeweils mit Quote; neues Habit über den vorhandenen Editor
  5. Gewicht teilen
  6. Rhythmen: Wiegetag und Uhrzeiten der Erinnerungen
  7. Zusammenfassung, „Bereit“
  - Jeder Schritt wird gespeichert (abbrechen und später weitermachen); nur Schritt 2 ist Pflicht; bis zum Saisonstart bleibt alles änderbar.
- Im Reiter „Ziele“ steht die laufende Saison ganz oben: Name, Woche x von y, Tage bis zum Ende, Regeln und der eigene Stand dazu; darunter die Saisonziele, dann die privaten Ziele. Dort auch „Pause eintragen (krank, Urlaub)“.
- Start: Ziele werden festgeschrieben, Feed-Karte „Saison gestartet“. Danach Korrekturen nur durch den Admin, sichtbar im Feed. Private Zusatzziele bleiben jederzeit möglich und zählen nicht im Vergleich.
- Später Einstieg mit eigenem Startdatum.
- Kalender-Marker an der Tageszahl (berechnet, nicht gespeichert): Saisonstart und Saisonende als Fahne, Wiegetag und Zwischenstand als Waage. Pro Tag höchstens ein Marker; alles Weitere im Tages-Sheet unter „Besonderes“. Der Platz für Trainings bleibt frei.
- „Heute“ zeigt Anstehendes: „Morgen Wiegetag“, „Noch 5 Tage bis Saisonende“.
- Technik: neues soziales Modul `seasons` (`seasons`, `season_members`, Regeln); Saisonziele sind persönliche Ziele mit Verweis auf die Saison, der in der sozialen Schicht liegt.

### 8c – Vergleich in der Saison

- Gruppe → Reiter „Ziele“: pro Person alle Saisonziele mit Start → aktuell → Ziel, Fortschritt in %, Status; Filter nach Zielart.
- Gruppe → Reiter „Konsistenz“: Wochenziel erfüllt in %, Serien, Heatmap „Dranbleiben“; darin auch die Saisonregeln (in wie vielen Wochen gewogen, Zwischenstände gemacht).
- Gewicht: zusätzlich der Zeitraum „Seit Saisonstart“ im vorhandenen Reiter.
- Kraft: Steigerung in % seit Start pro Übung.
- Der Gruppe-Tab hat dann fünf bis sechs Reiter; die Auswahl muss dafür umgebaut werden (z. B. Feed und „Vergleich“ mit Unterauswahl).

### 8d – Saisonende, Rückblick, Archiv

- Schluss-Wiegung mit 2–3 Tagen Spielraum, Stand wird eingefroren.
- Saison-Rückblick pro Person und Gruppe als Feed-Karte (Inhalte siehe Ideenliste „Saison-Rückblick“).
- Übergang: Rückschau pro Ziel (verlängern / steigern / beenden) als Entwurf der nächsten Saison.
- Saison-Archiv im Gruppe-Tab.

## Nicht in diesem Baustein

- Punkte (Konzept: kommen zum Schluss, Regeln offen).
- Habit-Challenges (Ideenliste).
- PC-Ansicht der Saisons und Saison-Verwaltung am PC (Baustein 9).
- Saisons vorschlagen durch Teilnehmer; vorerst legt nur der Admin an.
- Eigene Events im Kalender (Termin-Art „Event“).

## Entschieden (Jonas, 27.11.2026)

- Mindestziel und Ziel als zwei Werte pro Ziel (Mindestziel freiwillig).
- Pflicht in einer Saison ist nur „Trainings pro Woche“; alle anderen Ziele wählt jede Person selbst.
- Die Saison verlangt nicht, das Gewicht zu teilen. Sie fragt beim Setup einmal danach; wer nicht teilt, fehlt im Gewichtsvergleich.
- Die Regeln „wöchentlich wiegen“ und „Zwischenstand alle x Wochen“ zählen in der Konsistenz („in x von y Wochen gewogen“), ohne Werte zu zeigen.
- Dauer und Setup-Phase legt der Admin pro Saison fest.
- 8d (Saisonende, Rückblick, Archiv) wird zurückgehalten und während der ersten Saison gebaut.
- Pausen: Die Pause aus den Habits (krank, Urlaub, von – bis) gilt auch für das Trainingsziel und die Saisonregeln; eingetragen wird sie im Reiter „Ziele“.
- Der Reiter heißt „Ziele“, nicht „Saison“, damit er ohne laufende Saison nicht leer ist.

## Reihenfolge und Umfang

8a → 8b → 8c, jede Etappe für sich nutzbar; 8d je nach Frage 6. 8a und 8b sind groß, 8c mittel bis groß (wegen des Umbaus der Reiter), 8d mittel. Nach jeder Etappe: Typen neu erzeugen, Lint, Typecheck, Tests, dann Staging.

Danach: Umzug auf Live, Start der ersten Saison.
