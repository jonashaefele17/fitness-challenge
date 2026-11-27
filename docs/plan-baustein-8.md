# Baustein 8 – Ziele & Saisons: Plan

Branch: `feat/goals-seasons`. Grundlage: Konzept (Version 1.48) – „Ziele, Saisons und Vergleich“, „Besondere Tage im Kalender“, „Datenmodell“ (Ziele & Saisons).

Stand: Entwurf vom 27.11.2026, noch nicht mit Jonas abgestimmt. Die Fragen unter „Offen“ müssen vor dem Bauen entschieden sein.

## Worum es geht

Wofür das gebaut wird: eine erste Saison über rund 6 Monate mit Freunden, mit festen Zielen, wöchentlichem Wiegen und einem Zwischenstand alle 4 Wochen. Die App soll danach ohne Saison weiter nutzbar sein.

Daraus folgen zwei getrennte Dinge:

- **Ziele** sind persönlich. Jede Person kann jederzeit Ziele haben, auch ohne Gruppe und ohne Saison. Der Fortschritt wird immer aus den vorhandenen Daten berechnet.
- **Eine Saison** ist ein Rahmen der Gruppe: Zeitraum, Teilnehmer, Regeln und die Ziele, die für diesen Zeitraum festgeschrieben werden. Trainings, Gewicht und Habits laufen über alle Saisons durch und werden nie zurückgesetzt.

## Etappen

### 8a – Persönliche Ziele

- Ein Ziel besteht aus Messgröße, Startwert, Zielwert, Zeitraum (von – bis) und Sichtbarkeit.
- Messgrößen stehen als Daten in einer Tabelle, neue kommen ohne Umbau dazu. Für den Anfang:
  - Trainings pro Woche (Wochenziel, zählt erfüllte Wochen)
  - Körpergewicht (Durchschnitt über 7 Tage)
  - Bestwert an einer Übung
  - Erfüllungsquote eines Habits
  - ein Körpermaß (z. B. Bauchumfang)
- Berechnet, nicht gespeichert: aktueller Wert, Fortschritt in %, Status „auf Kurs / hinter Plan“ gegen die Linie vom Start zum Ziel, „erreicht“.
- Startwert automatisch vorgeschlagen und änderbar: Gewicht = aktueller Durchschnitt, Kraft = bester Satz der letzten 4 Wochen, Maß = letzter Zwischenstand.
- Oberfläche: Ziele unter „Ich“ (siehe offene Frage 5), Ziel anlegen in wenigen Schritten, Detail mit Verlauf gegen die Ziellinie.
- Änderungen sind versioniert (`valid_from`); archivieren statt löschen.
- Technik: neues persönliches Modul `goals`. Die Werte der Messgrößen kommen aus SQL-Funktionen über Training, Körper und Habits, weil persönliche Module sich im Frontend nicht gegenseitig importieren.

### 8b – Saison: anlegen, Setup, Start, Kalender

- Admin legt an: Name, Zeitraum, Setup-Phase, Teilnehmer, Regeln. Alle Teilnehmer bekommen eine Push.
- Regeln der Saison (als Daten): Wiegen pro Woche, Zwischenstand alle x Wochen, Pflicht-Zielarten.
  - Die Regeln stellen bei den Teilnehmern die persönlichen Rhythmen aus Baustein 7 ein (Wiege-Erinnerung, Zwischenstand-Rhythmus); der Wochentag und die Uhrzeit bleiben persönlich.
- Setup-Phase: jede Person setzt ihre Saisonziele und ihre Sichtbarkeit. Die Ziele der anderen sind sichtbar und kommentierbar.
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

## Offen – vor dem Bauen entscheiden

1. **Pflicht-Zielarten:** Muss jede Person in der Saison bestimmte Ziele haben (z. B. ein Gewichtsziel, ein Trainingsziel), oder ist alles freiwillig? Vorschlag: Pflicht ist nur „Trainings pro Woche“; alles andere wählt jeder selbst.
2. **Gewicht in der Saison:** Das Gewicht ist standardmäßig privat. Soll eine Saison verlangen, dass man es mindestens in % teilt? Vorschlag: nein; die Saison fragt beim Setup einmal danach, wer nicht teilt, fehlt im Gewichtsvergleich.
3. **Wie zählen die Regeln:** Sind „wöchentlich wiegen“ und „Zwischenstand alle 4 Wochen“ nur Erinnerung und Marker, oder zählen sie sichtbar für die Gruppe (Konsistenz)? Vorschlag: sie zählen in der Konsistenz als „in x von y Wochen gewogen“, ohne Werte zu zeigen.
4. **Pausen:** Krankheit und Urlaub gibt es schon bei den Habits. Vorschlag: dieselbe Pause gilt auch für Trainingsziel und Saisonregeln, keine zweite Art von Pause.
5. **Wo die Ziele stehen:** Das Konzept sieht sie oben unter Ich → Training vor. Ziele betreffen aber auch Gewicht, Maße und Habits. Vorschlag: ein eigener Reiter „Ziele“ unter „Ich“ an erster Stelle.
6. **Umfang vor dem Start der ersten Saison:** 8d wird erst am Saisonende gebraucht. Vorschlag: 8a bis 8c bauen, auf Live umziehen, Saison starten, 8d während der Saison bauen. Die Daten bleiben dabei sauber, weil 8d nur rechnet und nichts nachträglich umbaut.
7. **Dauer und Setup-Phase:** Beides pro Saison frei wählbar (Vorschlag), oder feste Längen?

## Reihenfolge und Umfang

8a → 8b → 8c, jede Etappe für sich nutzbar; 8d je nach Frage 6. 8a und 8b sind groß, 8c mittel bis groß (wegen des Umbaus der Reiter), 8d mittel. Nach jeder Etappe: Typen neu erzeugen, Lint, Typecheck, Tests, dann Staging.

Danach: Umzug auf Live, Start der ersten Saison.
