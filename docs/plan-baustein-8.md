# Baustein 8 – Ziele & Saisons: Plan

Branch: `feat/goals-seasons`. Grundlage: Konzept (Version 1.48) – „Ziele, Saisons und Vergleich“, „Besondere Tage im Kalender“, „Datenmodell“ (Ziele & Saisons).

Stand: Plan mit Jonas abgestimmt am 27.11.2026; 8a, 8b und der 8b-Nachtrag (Habits in der Saison) gebaut. Gebaut wird Etappe für Etappe, jeweils mit Test auf Staging.

## Worum es geht

Wofür das gebaut wird: eine erste Saison über rund 6 Monate mit Freunden, mit festen Zielen, wöchentlichem Wiegen und einem Zwischenstand alle 4 Wochen. Die App soll danach ohne Saison weiter nutzbar sein.

Daraus folgen zwei getrennte Dinge:

- **Ziele** sind persönlich. Jede Person kann jederzeit Ziele haben, auch ohne Gruppe und ohne Saison. Der Fortschritt wird immer aus den vorhandenen Daten berechnet.
- **Eine Saison** ist ein Rahmen der Gruppe: Zeitraum, Teilnehmer, Regeln und die Ziele, die für diesen Zeitraum festgeschrieben werden. Trainings, Gewicht und Habits laufen über alle Saisons durch und werden nie zurückgesetzt.

## Etappen

### 8a – Persönliche Ziele (gebaut am 27.11.2026, Staging-Test offen)

- [x] Reiter „Ziele“ unter „Ich“ an erster Stelle; „Einstellungen“ als Zahnrad oben rechts
- [x] Ziel anlegen zum Durchklicken: Zielart → worauf (Übung mit Wiederholungszahl, Habit, Maß) → Startwert (vorgeschlagen) → Ziel → Mindestziel (freiwillig) → Zeitraum (4, 8, 12 Wochen, 6 Monate oder Datum) → Sichtbarkeit → Zusammenfassung. „Rückgängig“ direkt nach dem Anlegen entfernt das Ziel spurlos
- [x] Übersicht: pro Ziel Start → aktuell → Ziel, Balken mit Marke fürs Mindestziel, Status und „auf Kurs / hinter Plan“ in Worten; beendete Ziele hinter „Beendet“
- [x] Detail: Verlauf gegen die Ziellinie (Gewicht, Kraft, Maß) bzw. ein Balken pro Woche (Trainings, Habit); ändern, „Ziel beenden“ mit „Rückgängig“
- [x] Zielarten als Daten: Trainings pro Woche, Körpergewicht, Bestwert an einer Übung, Körpermaß (die Habit-Quote ist seit dem 8b-Nachtrag stillgelegt)
- [x] Änderungen an Ziel und Mindestziel gelten ab heute; vergangene Wochen zählen nach den alten Werten
- [x] Datenbank: `goal_metrics`, `goals`, `goal_versions`; alles berechnet; geschrieben wird nur über Funktionen (eine Stelle, an der 8b sperren und der Admin korrigieren kann); Datenbank-Tests (55)

So wird gerechnet:
- Status mit Mindestziel dreistufig (unter dem Mindestziel / Mindestziel erreicht / Ziel erreicht), ohne zweistufig. Nach dem Enddatum eingefroren.
- Gewicht, Kraft, Maß: aktueller Wert = Durchschnitt über 7 Tage / bester Satz seit dem Start / letzter Zwischenstand seit dem Start. Fortschritt = Anteil des Wegs vom Start zum Ziel. „Auf Kurs“ = mindestens auf der geraden Linie vom Start zum Ziel.
- Kraftziele lauten „110 kg bei 5 Wiederholungen“; Sätze mit anderer Wiederholungszahl werden mit der Formel der Rekorde umgerechnet. Optional nur an einem Gerät.
- Trainings pro Woche: ein Tag mit Training zählt einmal; jede abgeschlossene Woche einzeln; Pausentage verkleinern die Vorgabe wie bei Habits. Eine Woche zählt höchstens bis zum Ziel (mehr zählt nicht extra, kein Ansparen); Status und „auf Kurs“ vergleichen die Summe der so gezählten Trainings mit der Summe der Vorgaben. Eine Woche unter dem Mindestziel lässt sich also nur durch Wochen mit vollem Ziel abfedern. Der Status sagt „Im Schnitt …“; dazu „in x von y Wochen Mindestziel erreicht“.
- Habit-Quote: wie in der Habit-Auswertung, seit dem Start.

Was andere bei einem geteilten Ziel sehen: Gewichtsziel immer Fortschritt in % und Status, kg nur wenn die Gewichts-Sichtbarkeit „Mit kg“ oder „Mit Tageswerten“ ist; Körpermaß nie cm; Habit-Ziel mit Name und Quote des Habits, auch wenn das Habit selbst privat ist.

Entschieden (Jonas, 27.11.2026): Deckelung pro Woche beim Trainingsziel statt freiem Aufholen; Kraftziel bleibt „kg bei x Wiederholungen“.

Bekannte Kleinigkeiten:
- Ein Trainingsziel, das mitten in der Woche beginnt, zeigt für die erste Woche eine verkleinerte Vorgabe („Diese Woche 0 von 2“).
- Ein Maß-Ziel zeigt „Noch keine Werte“, bis der erste Zwischenstand nach dem Start gemacht ist.

Beim Staging-Test prüfen:
- Passen die vier Reiter, findet man die Einstellungen hinter dem Zahnrad?
- Je ein Ziel pro Art anlegen: Stimmen die vorgeschlagenen Startwerte, sind die Räder brauchbar?
- Lesen sich Status und „auf Kurs“ bei echten Daten richtig?
- Detail am iPhone: Blatt hochziehen, Diagramm antippen, Datum wählen

### 8b – Saison: anlegen, Setup, Start, Kalender (gebaut am 27.11.2026, Staging-Test offen)

- [x] Anlegen und Bearbeiten durch den Gruppen-Admin im Reiter „Ziele“ (Zeile „Saison anlegen“): Name, Start, Ende, ab wann das Setup offen ist, Teilnehmer (Standard: alle), Regeln (jede Woche wiegen, Zwischenstand alle x Wochen; Pflicht: Trainings pro Woche). Saisons einer Gruppe überschneiden sich nicht. Nach dem Start ist nur noch der Name änderbar; Absagen mit Rückfrage, die Ziele werden dann wieder normale Ziele
- [x] Saison-Block oben im Reiter „Ziele“: Name, Phase, „Woche x von y“, Tage bis zum Ende, Regeln, eigener Stand; „Alle Teilnehmer“ (Bereit-Stand und Saisonziele der anderen, kommentierbar), „Pause eintragen (krank, Urlaub)“
- [x] Das Setup öffnet sich von selbst: direkt nach dem Anlegen für den Admin und einmal pro Saison und Gerät beim Öffnen der App, solange man nicht bereit ist; danach bleiben die Karte auf „Heute“ und die Zeile im Saison-Block
- [x] Setup zum Durchklicken, jeder Schritt gespeichert, bis zum Start änderbar: Rahmen → Trainingsziel (Pflicht) → weitere Ziele → Habits → Gewicht teilen → Rhythmen → Zusammenfassung mit „Bereit“. Ein schon laufendes eigenes Trainings- oder Habit-Ziel wird übernommen statt verdoppelt
- [x] Saisonziele sind normale persönliche Ziele, an die Saison gehängt: Zeitraum der Saison, für die Gruppe sichtbar, in der Liste mit „Saison“ markiert
- [x] Start: Saisonziele sind fest, sobald die Saison gestartet ist und die Person bereit ist (ändern, beenden, zurücknehmen abgelehnt); private Ziele bleiben frei. Wer zum Start das Pflichtziel hat, aber nie „Bereit“ getippt hat, zählt automatisch als bereit. Wem zum Start ein Pflichtziel fehlt, der holt das Setup danach nach und ist ab „Bereit“ fest; „Bereit“ zurücknehmen geht nur vor dem Start. Korrektur nur durch den Admin, mit Feed-Karte ohne Werte und Mitteilung an die Person
- [x] Später Einstieg: der Admin fügt jemanden nach dem Start hinzu; eigenes Startdatum, eigenes Setup, fest ab „Bereit“. Derselbe Weg gibt jemandem, der das Setup verpasst hat, eine zweite Chance
- [x] Mitteilungen (Kategorie „Saisons“): beim Öffnen des Setups, am Tag vor dem Start um 18 Uhr an alle, die nicht bereit sind, zum Start ab 7 Uhr; jeweils einmal pro Person
- [x] Feed-Karten: Saison angekündigt, Saison gestartet (wird nachgeholt, falls der Starttag verpasst wurde), Ziel korrigiert; abgesagte Saisons sagen „abgesagt“
- [x] Kalender: Marker an der Tageszahl (Fahne für Start, Zielflagge für Ende, Waage für Wiegetag und fälligen Zwischenstand), höchstens einer pro Tag; Gruppenansicht mit Gruppen-Markern an der Datumszeile; Tages-Sheet listet alles unter „Besonderes“. Wiegetage nur ab heute
- [x] „Heute“: Karte „Saison einrichten“ während des Setups, Zeilen für Anstehendes („Morgen Wiegetag“, „Noch 5 Tage bis Saisonende“)
- [x] Sprungziele aus Mitteilungen: Saison (`/ich?saison=…`), Ziel (`/ich?ziel=…`)
- [x] Datenbank: `seasons`, `season_members`, `season_goals`; Phase berechnet; Datenbank-Tests (97)

Bekannte Grenzen:
- Teilt jemand sein Gewicht nicht in kg, sieht auch der Admin die kg des Gewichtsziels nicht und kann es nicht korrigieren (bewusst: die Admin-Rolle hebelt die Sichtbarkeit nicht aus).
- Wer die Gruppe verlässt, bleibt Teilnehmer der Saison, bis der Admin ihn entfernt.
- Die Regel „jede Woche wiegen“ zwingt niemanden, einen Wiegetag einzustellen; das Zählen der Regeln kommt mit 8c.

Beim Staging-Test prüfen (am besten zu zweit):
- Saison anlegen, Setup als Teilnehmer komplett durchgehen, „Bereit“
- Sieht man die Ziele der anderen, lässt sich kommentieren?
- Start simulieren (Saison mit Start heute anlegen): Ziele fest, Feed-Karte, Push
- Marker im Kalender lesbar am iPhone? Verdecken sie nichts?
- Drei Blätter übereinander (Teilnehmer → Ziel → Korrektur) am iPhone bedienbar?

### 8b-Nachtrag – Habits in der Saison (entschieden am 27.11.2026, gebaut am 28.11.2026, Staging-Test offen)

**Stand:** gebaut auf `feat/goals-seasons`. Nächster Schritt: Staging-Test (siehe unten), danach 8c.

Gebaut:
- [x] Datenbank: Haken `private.can_edit_habit` im Habit-Modul (`save_habit` und `archive_habit` laufen darüber), Tabelle `season_habits`, `link_season_habit` / `unlink_season_habit`, `open_season_habit_edit`, Lesefunktion `season_habits_overview`, Feed-Ereignis `season_habit_changed`, `habit_rate` stillgelegt (`goal_metrics.offered`); vorhandene Quoten-Ziele archiviert, Quoten-Ziele einer Saison zu Saison-Habits umgewandelt; Datenbank-Tests (30)
- [x] Setup-Schritt „Habits“: Liste mit Haken und Regel; Antippen öffnet die Regel mit „In die Saison“ bzw. „Speichern“ und „Nicht in der Saison“; Zeile „Neues Habit“ (Bibliothek wie unter Ich → Habits)
- [x] Zusammenfassung und Teilnehmer-Blatt zeigen Saison-Habits mit Regel und Quote; Admin-Knopf „Änderung freigeben“
- [x] Saison-Block: Zeile „Schlaf: Regel ändern · Änderbar bis …“, solange eine Regel freigegeben ist
- [x] Feed-Karte „Mia hat ein Saison-Habit angepasst“; Mitteilungen an die Person (Freigabe) und an den Admin (Änderung)
- [x] `habit_rate` aus der Ziele-Oberfläche entfernt

Nebenbei entschieden (bitte beim Test prüfen):
- Auch während einer Freigabe lässt sich ein Saison-Habit nicht archivieren – die Freigabe gilt nur für die Regel.
- Ändert die Person die Regel, bekommt der Admin, der freigegeben hat, eine Mitteilung.
- Nach dem Saisonende bleibt die Verknüpfung erhalten (für den Rückblick in 8d); das Habit ist trotzdem wieder frei.
- Wer das Habit sieht (Nur ich / Erledigt / Mit Werten), bleibt auch bei einem festen Saison-Habit änderbar.

Beim Staging-Test prüfen:
- Setup: Habit in die Saison nehmen und dabei die Regel ändern; ein neues Habit direkt im Setup anlegen
- Nach „Bereit“ unter Ich → Habits die Regel ändern: Meldung „Dieses Habit ist in der laufenden Saison fest.“
- Als Admin „Änderung freigeben“, als Person die Zeile im Saison-Block nutzen; Feed-Karte und Push prüfen
- Liest sich die Quote im Teilnehmer-Blatt richtig?

Ursprünglicher Plan:

Entschieden mit Jonas:
- Ein Habit bekommt in der Saison keine Prozentquote als Ziel. Das Ziel ist die Regel des Habits selbst (z. B. Schlaf mindestens 7 h, im Bett vor 23:00; Screentime höchstens 2 h). Die Quote ist nur Auswertung und erscheint im Vergleich unter „Konsistenz“ (8c).
- Setup-Schritt „Habits“: Habits anhaken, die in der Saison zählen, bei jedem die Regel direkt einstellen; ein neues Habit lässt sich dort anlegen.
- Die Gruppe sieht bei Saison-Habits Name, Regel und Quote, auch wenn das Habit privat ist. Einzelne Tageswerte bleiben nach der Freigabe des Habits.
- Ab „Bereit“ (und laufender Saison) ist die Regel eines Saison-Habits fest, wie die Saisonziele. Nach Saisonende oder Absage ist sie wieder frei.
- Der Admin ändert kein fremdes Habit. Er gibt die Regel für 24 Stunden zur Änderung frei; die Person ändert selbst, einmal, und die Änderung steht im Feed. Derselbe Mechanismus trägt später das Etappen-Fenster (8e).
- Die Zielart „Habit-Quote“ (`habit_rate`) entfällt ganz, auch bei privaten Zielen. Vorhandene Quoten-Ziele (nur Testdaten) werden archiviert; hing eines an einer Saison, wird daraus ein Saison-Habit.

Bauplan Datenbank und Hooks (nur neue Migrationen nach `20261202100000`, bestehende nie ändern):
- Persönliche Migration: Haken `private.can_edit_habit(habit_id)` (Standard: Besitzer). Jede Änderung an der Definition (neue Version) und das Archivieren laufen darüber; Freigabe-Stufe, Erinnerungen und Pausen bleiben frei. Muster: `private.can_edit_goal` aus der Ziele-Migration, das die Saison-Migration ersetzt.
- Saison-Migration: Tabelle `season_habits` (season_id, user_id, habit_id, created_at, `edit_open_until`), RLS wie `season_goals`, Schreiben nur über RPCs. `link_season_habit` / `unlink_season_habit` (nur Besitzer, nur solange nicht fest – `private.season_member_locked`). `private.can_edit_habit` ersetzen: falsch, wenn das Habit an einer laufenden Saison hängt, in der die Person fest ist, außer `edit_open_until > now()`. `open_season_habit_edit` (nur Gruppen-Admin, 24 h, Mitteilung an die Person, Kategorie „Saisons“). Ändert die Person dann die Regel: Feed-Ereignis `season_habit_changed`, Freigabe verbraucht. Lesefunktion `season_habits_overview(season, today, time_zone)`: je Teilnehmer und Habit Name, Regelfelder, gezählt, erfüllt, Quote ab Saison- bzw. eigenem Start, mit den vorhandenen Bewertungskernen (Pausen wie in der Habit-Statistik), `locked`, `edit_open_until`. Teilnehmer entfernen und Absagen räumen die Verknüpfungen auf.
- `habit_rate` stilllegen (nicht mehr angeboten, `create_goal` lehnt ab), Tests anpassen.
- Tests in `supabase/tests/season_habits.test.sql`: Verknüpfen, Sperre, Ändern und Archivieren abgelehnt bzw. nach Ende erlaubt, Admin-Freigabe mit genau einer Änderung und Feed-Karte, Quote an einem festen Beispiel mit Pause, Sichtbarkeit (Gruppe A sieht nichts aus Gruppe B).
- Danach `npm run db:types`; Hooks in `src/features/seasons/` (`useSeasonHabits`, `useLinkSeasonHabit`, `useUnlinkSeasonHabit`, `useOpenSeasonHabitEdit`); `src/features/habits/index.ts` exportiert, was das Setup braucht (meine aktiven Habits, Regel als Text aus `habitText.ts`, Editor); Fehlertext „Dieses Habit ist in der laufenden Saison fest.“

Bauplan Oberfläche:
- `SeasonSetupFlow.tsx`, Schritt „Habits“: das Quoten-Blatt (`HabitQuotaSheet`) weg; Liste der Habits mit Haken und Regel als Text, Antippen öffnet Regel bearbeiten und „In die Saison“ / „Nicht in der Saison“; Zeile „Neues Habit“.
- Teilnehmer-Blatt und Zusammenfassung zeigen Saison-Habits mit Regel und Quote; Admin-Zeile „Änderung freigeben“.
- Feed-Karte und Push-Text für `season_habit_changed`.
- `habit_rate` aus der Ziele-Oberfläche entfernen.

Arbeitsweise wie bisher: Umsetzung an einen Opus-Unteragenten geben (erst Datenbank, prüfen, committen; dann Oberfläche mit Screenshots bei 375 px), vor jedem Commit Lint, Typecheck, Tests, `npm run test:rls` auf frisch zurückgesetzter Datenbank.

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

### 8e – Etappen

Entschieden mit Jonas am 27.11.2026; Darstellung und die Frage der eigenen Etappenziele noch offen (siehe unten).

- Eine Saison hat Etappen fester Länge, Standard 4 Wochen (im Takt des Zwischenstands; ganze Wochen, damit Wochenziele nicht zerschnitten werden). Der Admin legt die Länge beim Anlegen fest.
- Etappenziel, berechnet: bei Gewicht, Kraft und Maßen der Wert der Ziellinie am Etappenende („bis 24.12.: 83,3 kg“); bei Trainings und Habits die Vorgabe über die Wochen der Etappe.
- Etappen-Rückblick als Feed-Karte pro Person am Etappenende: Etappenziel erreicht oder nicht, Stand je Saisonziel (mit derselben Maskierung wie sonst).
- Anpassungsfenster: in den ersten 3 Tagen einer neuen Etappe darf jede Person Ziel und Mindestziel ihrer Saisonziele ändern (alle Zielarten). Die Änderung gilt ab der neuen Etappe, vergangene Wochen zählen nach den alten Werten, und sie steht für alle im Feed. Startwert und Zeitraum bleiben fest. Außerhalb des Fensters korrigiert weiter nur der Admin.
- Nach einer Anpassung knickt die Ziellinie an der Etappengrenze: Sie läuft vom bisherigen Sollwert an diesem Tag zum neuen Ziel.

Offen:
- Eigene Etappenziele bei Gewicht, Kraft und Maßen (z. B. am Anfang schneller abnehmen): Etappenziele automatisch auf der geraden Linie, aber einzeln überschreibbar? Die Ziellinie wäre dann stückweise gerade.
- Darstellung in der Übersicht (Vorschlag: Zeile „Etappe 2 von 6 · bis 24.12.: 83,3 kg“ in der Zielkarte, Etappengrenzen als Marken im Diagramm, „Etappe x von y“ im Saison-Block).

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

8a → 8b → 8c → 8e, jede Etappe für sich nutzbar; 8d während der ersten Saison. 8a und 8b sind groß, 8c mittel bis groß (wegen des Umbaus der Reiter), 8d mittel. Nach jeder Etappe: Typen neu erzeugen, Lint, Typecheck, Tests, dann Staging.

Danach: Umzug auf Live, Start der ersten Saison.
