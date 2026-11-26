# Baustein 7 – Körper: Plan

Branch: `feat/body`. Grundlage: Konzept (Version 1.46) – „Module und Navigation“ (Ich → Körper), „Vergleich“ (Gewicht), „Datenmodell“ (Körper). Der Prototyp zeigt dazu nur drei Stellen: den Reiter „Gewicht“ im Vergleich (Kurve in %), einen Feed-Eintrag zum Gewicht und die Einstellung „Sichtbarkeit: Gewicht nur in %“. Alles andere ist hier neu entworfen.

Stand: Plan mit Jonas abgestimmt am 27.11.2026, noch nichts gebaut. Gebaut wird Etappe für Etappe, jeweils mit Test auf Staging.

## Worum es geht

Ein neuer Reiter **Körper** unter „Ich“ mit zwei Rhythmen:

- **Gewicht** – so oft man will, auch täglich. Die Kurve zeigt den Durchschnitt über 7 Tage.
- **Zwischenstand** – alle 4 Wochen: Maße und Fotos in einem Durchgang, damit sich Stände über Monate vergleichen lassen.

Alles ist zuerst privat. Nur das Gewicht kann man mit der Gruppe teilen, wahlweise in kg oder nur als Veränderung in %. Maße und Fotos bleiben in Version 1 privat.

Das Modul ist persönlich (`src/features/body/`): Es funktioniert ohne Gruppe, die Daten gehören der Person, und die Gruppe hängt sich erst in Etappe 7b an.

## Entschieden (27.11.2026)

- Wiegen an jedem Tag; der Wiegetag ist nur eine freiwillige Erinnerung, die jede Person selbst einstellt. „Morgens nüchtern“ ist ein Hinweistext, kein Pflichtfeld.
- Mehrere Waagen pro Person mit Abgleich gegen eine Hauptwaage.
- Keine Kalender-Marker in diesem Baustein; sie kommen mit den Saisons (Baustein 8). Das Gewicht steht im Tages-Sheet.
- „% seit Start“: solange es keine Saison gibt, die Veränderung im gewählten Zeitraum. „Seit Saisonstart“ kommt mit Baustein 8.
- Maße: Bauch, Taille, Brust, Hüfte, Oberarm, Oberschenkel; einzeln ausblendbar. Kein Körperfettanteil.
- Fotos bleiben im Baustein, als Teil des Zwischenstands; 1600 Pixel an der langen Kante.
- Freigabe pro Gruppe noch nicht: Die Sichtbarkeit des Gewichts gilt für alle Gruppen einer Person.

## Ziel: Saisonstart Anfang Dezember 2026

Jonas will in der ersten Dezemberwoche eine Saison über 6 Monate mit seinen Freunden starten, mit den Regeln „wöchentlich wiegen“ und „monatlich Maße und Fotos“. Daraus folgt die Reihenfolge:

- **Zum Start muss das Erfassen funktionieren:** Gewicht, Maße und Fotos. Der Stand vom ersten Tag lässt sich später nicht nachholen.
- **Vergleich und Auswertung können danach kommen:** In den ersten 4 Wochen gibt es noch nichts zu vergleichen.
- **Die Saison selbst ist nur ein Rahmen** über durchlaufende Daten (Konzept, „Ziele, Saisons und Vergleich“). Sie kann in Baustein 8 auch nach dem Start angelegt werden, mit dem Startdatum in der Vergangenheit; die Startwerte werden dann aus den schon erfassten Daten berechnet.
- **Rhythmen sind eine allgemeine Funktion:** „wöchentlich wiegen“ und „Zwischenstand alle 4 Wochen“ sind persönliche Einstellungen und gelten auch ohne Saison. Eine Saison gibt sie später nur vor. Kalender-Marker dafür kommen mit der Saison, nicht in diesem Baustein.

## 7a – Gewicht

- Eintragen in unter 10 Sekunden: Zahl mit einer Nachkommastelle, vorbelegt mit dem letzten Wert; die zuletzt benutzte Waage ist vorausgewählt. Mehrere Einträge pro Tag sind möglich (z. B. morgens zuhause, abends im Studio); für den Tag zählt der Durchschnitt. Ändern und löschen mit „Rückgängig“.
- Einstiege: Ich → Körper („+“), Karte auf „Heute“ am Tag der Erinnerung, Tages-Sheet im Kalender (auch zum Nachtragen).
- **Waagen:** eigene Liste (z. B. „Zuhause“, „Studio“), eine ist die Hauptwaage. Abgleich: Hat man sich am selben Tag auf beiden gewogen, schlägt die App den Unterschied vor (z. B. „Studio zeigt 0,6 kg mehr“); man kann ihn auch von Hand eintragen. Kurve und Kennzahlen rechnen mit dem abgeglichenen Wert, der eingegebene Wert bleibt gespeichert. Wer nur eine Waage hat, sieht davon nichts.
- Ich → Körper: aktueller Wert (Durchschnitt über 7 Tage), Veränderung im Zeitraum in kg und %, Kurve mit den einzelnen Messungen als Punkten und der geglätteten Linie; Zeitraum 4 Wochen / 3 Monate / 1 Jahr / Alles; Liste aller Einträge mit Waage.
- Erinnerung: freiwillig, Wochentage und Uhrzeit einstellbar; Push nur, wenn heute noch kein Eintrag da ist; neue Push-Kategorie „Körper“ (als Daten, abschaltbar, Ruhezeit gilt).
- Tages-Sheet im Kalender zeigt das Gewicht des Tages unter „Besonderes“.
- Datenbank: `scales`, `weigh_ins`, `body_settings`; Abgleich, Glättung und Veränderung als SQL-Funktionen berechnet, nicht gespeichert; Zugriffsregeln und Tests (nur die eigene Person).

Beim Staging-Test prüfen: Eingabe auf dem iPhone angenehm? Stimmt der vorgeschlagene Abgleich zwischen deinen zwei Waagen? Kurve nach wenigen Einträgen schon brauchbar?

## 7b – Gewicht in der Gruppe

Dieser Teil liegt in den sozialen Modulen und in `src/app/`; das Körper-Modul selbst kennt keine Gruppe.

- Sichtbarkeit (Ich → Einstellungen → Sichtbarkeit): nichts (Standard) / nur % / kg. Bei „nur %“ liefert die Datenbank anderen keine kg-Werte, sie werden nicht bloß in der Oberfläche versteckt. Andere sehen immer nur den Durchschnitt über 7 Tage, nie einzelne Messungen.
- Feed: einmal pro Woche auf der Tageskarte („Gewicht · −0,4 % diese Woche · −1,8 % in 4 Wochen“), nur wenn geteilt und nur wenn es in der Woche Einträge gab; ausgelöst in der Datenbank, nicht in der App. Einzelne Einträge erzeugen keinen Feed-Eintrag und keine Mitteilung.
- Vergleich (Gruppe → Vergleich → Gewicht): Veränderung in % als Linie pro Person in ihrer Personenfarbe, gemeinsamer Zeitraum; wer nicht teilt, fehlt.
- Tests: „nichts“ sieht niemand, „nur %“ ohne kg, andere Gruppen sehen nichts.

## 7c – Zwischenstand: Maße

- Zwischenstand alle 4 Wochen: Erinnerung per Push (Kategorie „Körper“) und Karte auf „Heute“, bis er erledigt oder für diesmal übersprungen ist. Der Rhythmus ist einstellbar.
- Ein Durchgang wie beim Habit-Check-in: ein Maß pro Bildschirm, vorbelegt mit dem letzten Wert, „Überspringen“ möglich.
- Pro Maß eine kurze Anleitung mit Bild, wo und wie gemessen wird (z. B. „Bauch: auf Nabelhöhe, entspannt, nach dem Ausatmen“; „Oberarm: angespannt, dickste Stelle“; „Oberschenkel: stehend, Mitte zwischen Hüfte und Knie“). Bei Oberarm und Oberschenkel immer dieselbe Seite.
- Maß-Arten als Daten (Tabelle, nicht im Code): Bauch, Taille, Brust, Hüfte, Oberarm, Oberschenkel; jede Person blendet aus, was sie nicht misst.
- Ansicht: pro Maß aktueller Wert, Veränderung seit dem letzten und seit dem ersten Zwischenstand, kleine Kurve; Antippen öffnet den Verlauf.
- Datenbank: `body_measurement_kinds` (global), `body_measurements`; Zugriffsregeln und Tests.

## 7d – Zwischenstand: Fotos

- Der Durchgang aus 7c bekommt am Ende den Schritt „Fotos“: bis zu 3 in festen Posen (vorne, Seite, hinten), aufnehmen oder aus der Mediathek wählen; überspringbar. Beim Aufnehmen liegt das letzte Foto derselben Pose halb durchsichtig darüber, damit Abstand und Haltung gleich bleiben – falls die Kamera im Browser das auf dem iPhone zulässt, sonst nur als Vorschau daneben.
- Verkleinern auf dem Handy vor dem Hochladen: 1600 Pixel an der langen Kante (ca. 350 KB), dazu ein Vorschaubild mit ca. 20 KB. Das Original verlässt das Handy nie. Aufnahmeort und andere Kamera-Angaben werden dabei entfernt.
- Ansicht: Zwischenstände als Reihe nach Datum mit Vorschaubildern; Antippen zeigt das Foto groß mit Zoom.
- Vergleich: zwei Zwischenstände nebeneinander oder mit Schieberegler übereinander, je Pose; darunter Gewicht und Maße beider Stände mit der Veränderung.
- Löschen mit „Rückgängig“; nach Ablauf wird die Datei wirklich aus dem Speicher entfernt.
- Speicher: privater Bucket, ein Ordner pro Person; nur die Person selbst kann lesen und schreiben, auch der Super-Admin sieht in der App nichts. Tests dafür, inklusive „Person aus derselben Gruppe sieht nichts“.
- Beim Bauen messen: Erzeugt das iPhone beim Verkleinern WebP oder nur JPEG, und wie groß werden echte Fotos? Bei 3 Fotos alle 4 Wochen sind es pro Person nur rund 14 MB im Jahr; der Speicher ist damit kein Thema mehr.

Beim Staging-Test prüfen: Hochladen im Mobilfunk schnell genug? Qualität am Handy und am PC in Ordnung? Fotos im Hochformat richtig herum? Ist der ganze Zwischenstand in wenigen Minuten machbar?

## Nicht in diesem Baustein

- Gewichtsziele und „Ziel zu 45 % erreicht“ (Baustein 8, Ziele); „seit Saisonstart“ und Startwert aus den ersten Messungen (Baustein 8, Saisons).
- Gewicht im PC-Dashboard (Baustein 9).
- Eigenes Profilbild und Bild-Upload für Geräte (Ideenliste). Das Verkleinern aus 7d wird so gebaut, dass es dafür wiederverwendbar ist, sobald der zweite Anwendungsfall kommt.
- Anbindung an Waagen oder Apple Health, Körperfettanteil, Körpergewicht automatisch bei Klimmzügen und Dips mitrechnen: nicht im Konzept, bei Interesse auf die Ideenliste.

## Reihenfolge und Umfang

Wegen des Saisonstarts wird nicht streng 7a → 7d gebaut, sondern erst alles zum Erfassen:

1. **7a Gewicht** – eintragen, Waagen, Kurve, Erinnerung
2. **7c und 7d, nur Erfassen** – Zwischenstand mit Maßen und Fotos eintragen und ansehen
3. **7b Gewicht in der Gruppe** – Sichtbarkeit, Feed, Vergleich
4. **7c und 7d, Rest** – Verläufe der Maße, Foto-Vergleich mit Schieberegler

Schritt 1 und 2 sollen bis zum Saisonstart auf Staging getestet sein; 3 und 4 folgen in den Wochen danach, dann Baustein 8 (Saison anlegen, Regeln, Marker, Ziele). Nach jedem Schritt: Typen neu erzeugen, Lint, Typecheck, Tests, dann Staging.
