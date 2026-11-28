# Baustein 8 – Ziele & Saisons: Plan

Branch: `feat/goals-seasons`. Grundlage: Konzept (Version 1.48) – „Ziele, Saisons und Vergleich“, „Besondere Tage im Kalender“, „Datenmodell“ (Ziele & Saisons).

Stand: Plan mit Jonas abgestimmt am 27.11.2026; 8a, 8b, der 8b-Nachtrag (Habits in der Saison) und 8c (Vergleich) gebaut; Staging-Test offen. Gebaut wird Etappe für Etappe, jeweils mit Test auf Staging.

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

### 8c – Vergleich (Plan vom 28.11.2026, mit Jonas abgestimmt; alle drei Etappen gebaut am 28.11.2026, Staging-Test offen)

**Leitgedanke:** Am Handy will man auf einen Blick sehen, wie es bei einem selbst und bei den anderen läuft – nicht jedes Ziel und jede Übung jeder Person in einer Tabelle. Die Saison ist dabei kein eigener Ort, sondern ein Zeitraum: Jede Größe hat genau einen Platz, und solange eine Saison läuft, ist sie als Zeitraum voreingestellt. Genauere Auswertungen (z. B. die Wochenrückschau für den Jour fixe) kommen am PC (Baustein 9, siehe Ideenliste).

**Aufbau**

- Gruppe-Tab: zwei Reiter, **Feed · Vergleich** (bisher Feed · Habits · Gewicht).
- Im Vergleich oben zwei Auswahlen:
  - **Was:** Übersicht · Trainings · Habits · Gewicht · Kraft (wischbare Leiste)
  - **Zeitraum:** Saison · 4 Wochen · 3 Monate · 1 Jahr. „Saison“ gibt es, wenn die Gruppe eine laufende oder beendete Saison hat; solange eine läuft, ist sie voreingestellt, sonst „4 Wochen“.
- Darunter immer dasselbe Muster: **ein Diagramm** mit einer Linie pro Person in ihrer Farbe (Antippen hebt eine Person hervor), **darunter eine Zeile pro Person** mit dem aktuellen Stand. Feste Reihenfolge (ich zuerst), keine Rangliste – Punkte kommen später.

**Die fünf Ansichten**

| Ansicht | Diagramm | Zeile pro Person |
| --- | --- | --- |
| **Übersicht** (nur Zeitraum „Saison“) | Zielfortschritt: Durchschnitt über die Saisonziele mit Start und Ziel (Gewicht, Bestwert, Körpermaß), 0–100 %, ein Punkt pro Woche; dazu die Soll-Linie vom Start zum Ende | Wochenziel Trainings „in x von y Wochen“; ein Punkt pro Saisonziel (Ziel erreicht / auf Kurs / hinter Plan); Habit-Quote über alle Saison-Habits; Saisonregeln („gewogen in 3 von 4 Wochen“, „Zwischenstand 1 von 1“). Antippen öffnet die Person im vorhandenen Teilnehmer-Blatt |
| **Trainings** | Aufsummierte Trainingstage seit Beginn des Zeitraums (ein Tag zählt einmal) | Anzahl Trainingstage; in der Saison zusätzlich das Wochenziel |
| **Habits** | Quote pro Woche. Zeitraum „Saison“: über die Saison-Habits (auch private – nur die Quote). Sonst: über die geteilten Habits | Darunter die vorhandene Habit-Matrix mit Detailvergleich, unverändert |
| **Gewicht** | Wie heute (Veränderung in %), neu mit Zeitraum „Saison“ ab dem eigenen Saisonstart | Wie heute; wer nicht teilt, fehlt |
| **Kraft** (nur Zeitraum „Saison“, nur wenn mindestens zwei Personen ein Kraftziel haben) | Durchschnittliche Steigerung in % seit dem Start über die eigenen Kraftziele | Steigerung in %, Anzahl der Kraftziele |

Was bewusst entfällt: die Liste aller Ziele aller Personen mit Filter nach Zielart, der Vergleich pro Übung (gibt es schon im Übungsverlauf über „Vergleichen mit …“) und eine Heatmap für alle gleichzeitig (gibt es pro Person bei den Habits).

**Sichtbarkeit (unverändert, nur angewendet)**

- Zielfortschritt in % und Status sind für die Gruppe sichtbar, kg und cm nie über diese Ansichten.
- Gewicht: nur wer teilt. Habits außerhalb der Saison: nur geteilte. Saison-Habits: Name, Regel, Quote.
- Die Saisonregeln zählen nur „gemacht / nicht gemacht“ pro Woche, ohne Werte.
- Jede neue Lesefunktion prüft die Mitgliedschaft über die zentralen Hilfsfunktionen; Tests: Gruppe A sieht nichts aus Gruppe B.

**So wird gerechnet**

- Zielfortschritt einer Person in einer Woche: Mittelwert des Fortschritts (Anteil des Wegs vom Start zum Ziel, auf 0–100 % begrenzt) ihrer Saisonziele der Art Gewicht, Bestwert, Körpermaß am Wochenende. Wer kein solches Ziel hat, hat keine Linie; Trainings und Habits stehen in ihren eigenen Ansichten und als Zahlen in der Zeile.
- „Gewogen“ in einer Woche: mindestens ein Wiege-Eintrag in der Kalenderwoche. „Zwischenstand“: ein nicht übersprungener Zwischenstand im fälligen Abschnitt. Pausenwochen zählen nicht mit.
- Habit-Quote pro Woche: wie in der Habit-Auswertung (Pausen und offene Tage zählen nicht), über alle betroffenen Habits der Person gemittelt.
- Kraft: je Kraftziel (aktueller Wert − Startwert) / Startwert, dann der Mittelwert.

**Technik**

- Modulgrenzen: `comparison` und `seasons` sind beide sozial und importieren sich nicht gegenseitig. Der Vergleichs-Bildschirm wird deshalb in `src/app/` zusammengesetzt (`src/app/compare/`): Auswahl „Was“ und „Zeitraum“ dort, die Ansichten kommen aus `comparison` (Trainings, Habits, Gewicht) und aus `seasons` (Übersicht, Kraft, Saison-Habit-Quote). Der Zeitraum „Saison“ geht als Von-/Bis-Datum in die `comparison`-Ansichten – `comparison` weiß nichts von Saisons.
- Das Linien-Diagramm aus `WeightComparison` (`PercentChart`) wird zu einem allgemeinen Baustein in `src/shared/ui/` (Linien mit Farbe und Name, Antippen, optionale Soll-Linie, y-Achse in % oder als Anzahl). Zweiter und dritter echter Anwendungsfall, also kein Baustein auf Vorrat.
- Neue Lesefunktionen (alles berechnet, nichts gespeichert), jeweils mit Datenbank-Tests:
  - `group_training_days(group, from, to, time_zone)` – Trainingstage pro Person (`comparison`)
  - `group_habit_weeks(group, from, to, today, time_zone)` – Quote pro Person und Woche über geteilte Habits (`comparison`)
  - `season_overview(season, today, time_zone)` – pro Person: Wochenziel x von y, Status je Saisonziel, Habit-Quote, Regeln (`seasons`)
  - `season_progress_weeks(season, today, time_zone)` – Zielfortschritt und Kraftsteigerung pro Person und Woche, Habit-Quote der Saison-Habits pro Woche (`seasons`)
- Gruppenbezogene Queries nehmen die `group_id` aus `useActiveGroup()` und haben sie im Query-Key.

**Etappen**

1. **8c-1 Umbau und Trainings (gebaut am 28.11.2026, Staging-Test offen):** Reiter Feed · Vergleich, Auswahl „Was“ und „Zeitraum“ (inklusive „Saison“), gemeinsames Diagramm in `shared/ui`, Gewicht und Habits ziehen unverändert um (Gewicht mit Zeitraum „Saison“), neue Ansicht „Trainings“.
2. **8c-2 Übersicht:** `season_overview` und der Zielfortschritt, Zeile pro Person, Antippen öffnet das Teilnehmer-Blatt bei dieser Person.
3. **8c-3 Habit-Kurve und Kraft:** Quote pro Woche (Saison-Habits und geteilte Habits), Ansicht „Kraft“.

Jede Etappe ist für sich nutzbar und wird einzeln auf Staging getestet. Umfang: 8c-1 mittel, 8c-2 mittel, 8c-3 klein bis mittel.

**Stand 8c-1 – so gebaut, beim Staging-Test prüfen**

- „Was“ ist eine wischbare Leiste aus Chips, „Zeitraum“ eine Auswahl darunter. Bei „Habits“ gibt es keinen Zeitraum (die Matrix rechnet weiter mit 4 Wochen, bis 8c-3).
- „Saison“ gibt es als Zeitraum, sobald die Saison gestartet ist. Sie zählt für alle ab dem Saisonstart der Gruppe – wer später eingestiegen ist, hat keinen eigenen Beginn im Diagramm.
- Wer im Zeitraum nicht trainiert hat, steht trotzdem da (flache Linie, „0 Tage“).
- Die Auswahl (Was, Zeitraum) beginnt nach einem Wechsel zum Feed wieder bei der Voreinstellung.
- Antippen zeigt die Werte aller Personen an dem Tag; eine einzelne Person hervorheben kommt mit 8c-2.
- Nebenbei behoben: Wer sein Gewicht „mit Tageswerten“ teilt, bekam fälschlich den Hinweis „Du teilst dein Gewicht nicht“.
- Prüfen: Wirken die drei Bedienreihen untereinander (Feed/Vergleich, Was, Zeitraum) am iPhone zu dicht?

**Stand 8c-2 (Übersicht) – so gebaut**

- „Übersicht“ ist der erste Punkt und voreingestellt, solange eine Saison läuft; es gibt sie nur mit einer gestarteten Saison.
- Der Zielfortschritt rechnet mit allen Saisonzielen, die Start und Ziel haben – also auch mit Kraftzielen. Ein Ziel ohne Messwert zählt als 0 %. Jede Linie beginnt am eigenen Saisonstart.
- Hervorheben über die Namens-Knöpfe unter dem Diagramm (bewusst grau statt grün); Antippen einer Zeile öffnet das Teilnehmer-Blatt mit dieser Person oben.
- Punkte je Saisonziel: gefüllt grün = Ziel erreicht, grüner Ring = auf Kurs, orange = hinter Plan, grauer Ring = noch kein Stand.
- „Gewogen x/y“ und „Zwischenstand x/y“: Eine Woche bzw. ein Abschnitt zählt mit, sobald er vorbei ist oder sobald er erledigt ist. Ganz pausierte Wochen zählen nicht.
- Mit beiden Saisonregeln hat eine Zeile drei kleine Textzeilen.
- Hat jemand zwei Trainingsziele in der Saison, zählt für „Wochenziel“ nur das erste.

**Stand 8c-3 (Habit-Kurve, Kraft) – so gebaut**

- Habits: über der Matrix das Diagramm „Quote pro Woche“, ein Punkt pro Kalenderwoche. Zeitraum „Saison“: Saison-Habits (auch private, nur die Quote); sonst die geteilten Habits. Die Matrix darunter zeigt weiter die geteilten Habits der letzten 4 Wochen – ein Satz unter dem Diagramm sagt das.
- Ein Wochen-Habit zählt in der laufenden Woche mit 100 %, sobald es geschafft ist, vorher gar nicht (wie in der Habit-Auswertung und in der Übersicht).
- Kraft: eigener Punkt, nur mit gestarteter Saison und mindestens zwei Personen mit Kraftziel. Linie = mittlere Steigerung in % über die eigenen Kraftziele (bester Satz seit dem Start gegen den Startwert); Zeile pro Person mit „+5,8 %“ und Anzahl der Kraftziele. Nur Prozentwerte, keine kg und keine Übungsnamen.
- Die Leiste „Was“ hat jetzt fünf Punkte; „Kraft“ ist rechts angeschnitten und rückt beim Antippen ins Bild.

**Beim Staging-Test von 8c prüfen**

- Neue Migrationen: `20261204100000` bis `20261206100200` (fünf Dateien).
- Übersicht: Stimmen „Wochenziel in x von y Wochen“, die Punkte und die Habit-Quote mit dem überein, was du bei dir unter Ich → Ziele siehst?
- Diagramme: Antippen und Ziehen am iPhone, Hervorheben einer Person, Lesbarkeit bei allen Teilnehmern.
- Leiste „Was“: Ist erkennbar, dass sie sich wischen lässt? Wirken die Bedienreihen zu dicht?
- Habits im Zeitraum „Saison“: Ist verständlich, dass Diagramm (Saison-Habits) und Matrix (geteilte Habits, 4 Wochen) Verschiedenes zeigen?
- Kraft: erscheint erst mit zwei Personen mit Kraftziel – passt die Schwelle?

**Beim Bauen an echten Daten prüfen**

- Liest sich die Zielfortschritt-Kurve in den ersten zwei Wochen sinnvoll (alle nahe 0 %)?
- Fünf Auswahlpunkte plus vier Zeiträume auf 375 px: passt die wischbare Leiste, oder braucht es eine andere Auswahl?
- Linien von 6 und mehr Personen: bleibt das Diagramm lesbar, reicht das Hervorheben per Antippen?

### 8d – Saisonende, Rückblick, Archiv

- Schluss-Wiegung mit 2–3 Tagen Spielraum, Stand wird eingefroren.
- Saison-Rückblick pro Person und Gruppe als Feed-Karte (Inhalte siehe Ideenliste „Saison-Rückblick“).
- Übergang: Rückschau pro Ziel (verlängern / steigern / beenden) als Entwurf der nächsten Saison.
- Saison-Archiv im Gruppe-Tab.

### 8e – Etappen (Plan vom 28.11.2026, mit Jonas abgestimmt; noch nicht gebaut)

**Wozu:** Über 6 Monate wäre ein falsch gesetztes Ziel monatelang tot. Etappen teilen die Saison in Abschnitte mit einem greifbaren Zwischenziel und einem kurzen Fenster zum Nachjustieren. Gebaut wird jetzt; was sich im Betrieb als unpassend zeigt, wird nachgebessert.

**Was eine Etappe ist**

- Eine Saison hat Etappen fester Länge, Standard 4 Wochen (ganze Wochen ab dem Saisonstart, damit Wochenziele nicht zerschnitten werden; die letzte Etappe kann kürzer sein). Der Admin legt die Länge beim Anlegen fest (2 bis 8 Wochen), änderbar bis zum Start. Bestehende Saisons bekommen 4 Wochen.
- Wer später einsteigt, läuft im Etappenraster der Saison mit; seine erste Etappe ist entsprechend kürzer.
- **Etappenziel, berechnet:** bei Gewicht, Kraft und Körpermaß der Wert der Ziellinie am Etappenende („bis 24.12.: 83,3 kg“); bei Trainings die Vorgabe pro Woche über die Wochen der Etappe; bei Habits die Regel selbst.

**Die Ziellinie: Stützpunkte statt einer Geraden**

- Die Ziellinie eines Ziels mit Start und Ziel besteht aus geraden Stücken zwischen Stützpunkten (Datum und Wert). Ohne Stützpunkte ist sie wie heute die Gerade vom Start zum Ziel.
- Ändert jemand sein Ziel, knickt die Linie an diesem Tag: Sie läuft bis dahin auf das alte Ziel zu und ab dort auf das neue. Kein Sprung, weil die neue Linie dort weitergeht, wo die alte an dem Tag stand. Das gilt für alle Ziele mit Start und Ziel, auch für private ohne Saison.
- „Auf Kurs“, das Etappenziel und das Diagramm lesen alle dieselbe Linie.

**Anpassungsfenster**

- In den ersten 3 Tagen jeder Etappe ab der zweiten darf jede Person bei ihren Saisonzielen Ziel und Mindestziel ändern (alle Zielarten) und bei ihren Saison-Habits die Regel. Startwert und Zeitraum bleiben fest.
- Die Änderung gilt ab Beginn der neuen Etappe; vergangene Wochen und Tage zählen nach den alten Werten.
- Sie steht im Feed („Mia hat ihr Saisonziel angepasst“, Werte so maskiert wie sonst) – einmal pro Ziel bzw. Habit und Fenster, auch wenn man in den 3 Tagen mehrmals nachstellt.
- Außerhalb des Fensters bleibt alles wie heute: Ziele korrigiert nur der Admin, eine Habit-Regel gibt er für 24 Stunden frei.
- Zum Etappenbeginn bekommen alle Teilnehmer eine Mitteilung (Kategorie „Saisons“): „Etappe 2 beginnt · 3 Tage zum Anpassen“.

**Etappen-Rückblick**

- Am Tag nach dem Etappenende (ab 7 Uhr) eine Feed-Karte pro Person: „Etappe 1 geschafft“ mit einer Zeile je Saisonziel – Etappenziel erreicht oder nicht, Stand – und der Quote der Saison-Habits in der Etappe. Maskiert wie sonst (kein kg ohne Freigabe, nie cm). Knapp gehalten; die ausführliche Rückschau kommt am PC (Ideenliste).

**Eigene Etappenziele (freiwillig, versteckt)**

- Normalfall bleibt automatisch: Niemand muss pro Etappe etwas eingeben.
- Im Detail eines Saisonziels mit Start und Ziel (Gewicht, Kraft, Körpermaß) gibt es eine ruhige Zeile „Etappenziele selbst festlegen“: die Liste der Etappen mit den automatischen Werten, jeder einzeln überschreibbar; „Zurück auf automatisch“ setzt alles wieder gerade.
- Jeder Wert liegt zwischen Start und Ziel. Fest ab „Bereit“ wie das Ziel selbst; im Anpassungsfenster lassen sich die Werte der kommenden Etappen ändern.
- Wer eigene Etappenziele hat und im Fenster das Ziel ändert, wählt: „Neu aufteilen“ (die restlichen Etappen gleichmäßig auf das neue Ziel) oder „Meine Etappenziele behalten“. Beim Behalten bleiben die Werte der kommenden Etappen stehen, die noch zwischen dem heutigen Stand der Linie und dem neuen Ziel liegen; die übrigen werden automatisch gesetzt, und die App nennt sie. Nachstellen geht im selben Fenster.
- Nur die Ziellinie: Das Mindestziel bleibt ein Wert für die ganze Saison. Nicht für Trainings und Habits.

**Darstellung**

- Saison-Block: „Etappe 2 von 6 · bis 24.12.“; im Fenster eine Zeile „Ziele anpassen · noch 2 Tage“, die zu den eigenen Saisonzielen und -Habits führt.
- Zielkarte und Zieldetail: Zeile „Etappe 2 von 6 · bis 24.12.: 83,3 kg“; im Diagramm die Etappengrenzen als feine Marken und eine Marke an jeder Anpassung (Antippen: „Ziel angepasst: 80 → 82 kg“).
- Übersicht im Vergleich: Die gemeinsame Soll-Linie bleibt die Gerade (Anteil der vergangenen Zeit). Springt die Linie einer Person, weil sie ihr Ziel angepasst hat, sitzt dort ein kleiner Punkt (Antippen: „Ziel angepasst“). Etappengrenzen als feine Marken auf der Zeitachse.

**Technik**

- Persönliche Schicht (Ziele-Modul, ohne Bezug auf Saisons): Tabelle für Stützpunkte eines Ziels (`goal_waypoints`: Ziel, Datum, Wert), eine zentrale Funktion für den Wert der Linie an einem Tag (Stützpunkte plus Knick bei Zieländerungen), auf die `goal_figures` und `goal_history` umgestellt werden. Schreiben nur über Funktionen, die `private.can_edit_goal` fragen.
- Saison-Schicht: `seasons.stage_weeks`; die Etappen einer Saison als berechnete Lesefunktion (Nummer, von, bis, Fenster offen bis); `private.can_edit_goal` und `private.can_edit_habit` lassen im Fenster die eigene Änderung zu (Start und Zeitraum bleiben gesperrt); Feed-Ereignisse `season_goal_adjusted` und `season_stage_recap`; der stündliche Saison-Job schickt die Mitteilung zum Etappenbeginn und postet den Rückblick, je einmal.
- Alles berechnet, nichts gespeichert außer den Stützpunkten und der Etappenlänge. Datenbank-Tests je Funktion, inklusive „Gruppe A sieht nichts aus Gruppe B“ und der Maskierung.

**Etappen im Bau** (jede für sich nutzbar)

1. **8e-1 Etappen und Ziellinie:** Etappenlänge beim Anlegen, Etappen berechnet, Ziellinie mit Stützpunkten und Knick, Etappenziel in Zielkarte, Zieldetail und Saison-Block, Etappenmarken in den Diagrammen.
2. **8e-2 Fenster und Rückblick:** Anpassungsfenster für Ziele und Habits, Feed-Karte „angepasst“, Mitteilung zum Etappenbeginn, Etappen-Rückblick, Marken an Anpassungen (Zieldiagramm und Übersicht).
3. **8e-3 Eigene Etappenziele:** die Zeile im Zieldetail mit der Liste der Etappen.

Umfang: 8e-1 mittel bis groß (die Ziellinie ist der Kern), 8e-2 mittel, 8e-3 klein bis mittel.

**Nicht in 8e**

- Eigene Mindestziele pro Etappe, eigene Etappenziele bei Trainings und Habits.
- Etappen als Marker im Kalender.
- Unterschiedlich lange Etappen innerhalb einer Saison.

## Nicht in diesem Baustein

- Punkte (Konzept: kommen zum Schluss, Regeln offen).
- Habit-Challenges (Ideenliste).
- PC-Ansicht der Saisons und Saison-Verwaltung am PC (Baustein 9); dort auch die Wochenrückschau im Vergleich für den Jour fixe (Ideenliste).
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

8a → 8b → 8c (in drei Etappen 8c-1 bis 8c-3) → 8e, jede Etappe für sich nutzbar; 8d während der ersten Saison. 8a und 8b sind groß, 8c mittel bis groß (wegen des Umbaus der Reiter), 8d mittel. Nach jeder Etappe: Typen neu erzeugen, Lint, Typecheck, Tests, dann Staging.

Danach: Umzug auf Live, Start der ersten Saison.
