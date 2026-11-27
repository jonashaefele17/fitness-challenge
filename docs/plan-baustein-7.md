# Baustein 7 – Körper: Plan

Branch: `feat/body`. Grundlage: Konzept (Version 1.46) – „Module und Navigation“ (Ich → Körper), „Vergleich“ (Gewicht), „Datenmodell“ (Körper). Der Prototyp zeigt dazu nur drei Stellen: den Reiter „Gewicht“ im Vergleich (Kurve in %), einen Feed-Eintrag zum Gewicht und die Einstellung „Sichtbarkeit: Gewicht nur in %“. Alles andere ist hier neu entworfen.

Stand: Plan mit Jonas abgestimmt am 27.11.2026; 7a und 7b gebaut. Gebaut wird Etappe für Etappe, jeweils mit Test auf Staging.

## Worum es geht

Ein neuer Reiter **Körper** unter „Ich“ mit zwei Rhythmen:

- **Gewicht** – so oft man will, auch täglich. Die Kurve zeigt den Durchschnitt über 7 Tage.
- **Zwischenstand** – alle 4 Wochen: Maße und Fotos in einem Durchgang, damit sich Stände über Monate vergleichen lassen.

Alles ist zuerst privat. Nur das Gewicht kann man mit der Gruppe teilen: nur als Veränderung in %, als Durchschnitt in kg oder mit den Tageswerten. Maße und Fotos bleiben in Version 1 privat.

Das Modul ist persönlich (`src/features/body/`): Es funktioniert ohne Gruppe, die Daten gehören der Person, und die Gruppe hängt sich erst in Etappe 7b an.

## Entschieden (27.11.2026)

- Wiegen an jedem Tag; der Wiegetag ist nur eine freiwillige Erinnerung, die jede Person selbst einstellt. „Morgens nüchtern“ ist ein Hinweistext, kein Pflichtfeld.
- Mehrere Waagen pro Person mit Abgleich gegen eine Hauptwaage.
- Keine Kalender-Marker in diesem Baustein; sie kommen mit den Saisons (Baustein 8). Das Gewicht steht im Tages-Sheet.
- „% seit Start“: solange es keine Saison gibt, die Veränderung im gewählten Zeitraum. „Seit Saisonstart“ kommt mit Baustein 8.
- Maße: Bauch, Taille, Brust, Hüfte, Oberarm, Oberschenkel; einzeln ausblendbar. Kein Körperfettanteil.
- Fotos bleiben im Baustein, als Teil des Zwischenstands; 1600 Pixel an der langen Kante.
- Freigabe pro Gruppe noch nicht: Die Sichtbarkeit des Gewichts gilt für alle Gruppen einer Person.

## Wofür das gebaut wird

Jonas will mit seinen Freunden eine Saison über 6 Monate starten, mit Regeln wie „wöchentlich wiegen“ und „monatlich Maße und Fotos“. Die Saison startet erst, wenn dieser Baustein und Baustein 8 (Ziele & Saisons) fertig sind und die App auf Live umgezogen ist; es gibt keinen Termindruck.

- **Rhythmen sind eine allgemeine Funktion:** „wöchentlich wiegen“ und „Zwischenstand alle 4 Wochen“ sind persönliche Einstellungen und gelten auch ohne Saison, damit die App nach einer Saison weiter nutzbar ist. Eine Saison gibt sie nur vor.
- **Kalender-Marker** für Wiegetag und Zwischenstand kommen mit der Saison, nicht in diesem Baustein.

## 7a – Gewicht (gebaut am 27.11.2026, Staging-Test offen)

- [x] Eintragen: Zahl mit einer Nachkommastelle, vorbelegt mit dem letzten Wert, Schritte −0,1 / +0,1; mehrere Einträge pro Tag möglich, für den Tag zählt der Durchschnitt; ändern und löschen mit „Rückgängig“
- [x] Einstiege: Ich → Körper, Karte auf „Heute“, Tages-Sheet im Kalender (auch zum Nachtragen)
- [x] Waagen: eigene Liste, eine ist die Hauptwaage; Unterschied zur Hauptwaage von Hand oder per Vorschlag aus Tagen, an denen man auf beiden gewogen hat; Kurve und Kennzahlen rechnen mit dem abgeglichenen Wert, der eingegebene bleibt gespeichert. Wer keine oder eine Waage hat, sieht davon nichts und wählt nie eine aus; die Auswahl erscheint erst ab zwei Waagen, vorausgewählt ist die zuletzt benutzte
- [x] Ich → Körper: aktueller Wert (Durchschnitt über 7 Tage), Veränderung im Zeitraum in kg und %, Kurve mit Tageswerten als Punkten und geglätteter Linie, Zeitraum 4 Wochen / 3 Monate / 1 Jahr / Alles, Liste der Einträge
- [x] Erinnerung: freiwillig, Wochentage und Uhrzeit; Push nur einmal am Wiegetag und nur, wenn noch nichts eingetragen ist; Kategorie „Körper“; Antippen öffnet Ich → Körper mit dem Eintragen-Sheet
- [x] Karte auf „Heute“ nur am Wiegetag („heute noch offen“). Verpasst: Sie bleibt als „nachholen“ stehen, bis man sich wiegt (jeder Tag zählt), „Auslassen“ tippt oder der nächste Wiegetag kommt. „Auslassen“ gilt nur auf diesem Gerät
- [x] Datenbank: `scales`, `weigh_ins`, `body_settings`; Abgleich, Glättung und Veränderung berechnet; nur die eigene Person; Datenbank-Tests (60)

Für die Saison (Baustein 8) vorgemerkt: „wöchentlich wiegen“ zählt pro Woche, nicht pro Tag – erfüllt, wenn es in der Woche mindestens einen Eintrag gibt.

Beim Staging-Test prüfen:
- Eingabe auf dem iPhone angenehm (Zahlenfeld, Sheet mit Tastatur)?
- Passen die vier Reiter unter „Ich“ (Training · Habits · Körper · Einstellungen) in der Breite? Die Beschriftung ist dafür etwas kleiner geworden; sonst „Einstellungen“ als Zahnrad
- Kurve nach wenigen Einträgen brauchbar? Mit vielen Einträgen nicht zu dicht?
- Erinnerung kommt zur eingestellten Zeit, Antippen landet beim Eintragen
- Zwei Waagen anlegen, Unterschied eintragen, Hauptwaage wechseln

## 7b – Gewicht in der Gruppe (gebaut am 28.11.2026, Staging-Test offen)

- [x] Sichtbarkeit unter Ich → Körper → „Sichtbarkeit“, vier Stufen, eine Einstellung für alle Gruppen: Nur ich (Standard) / Nur % / Mit kg (Durchschnitt über 7 Tage) / Mit Tageswerten (zusätzlich der ungeglättete Wert jedes Tages)
- [x] Die Datenbank liefert anderen nur, was die Stufe erlaubt; bei „Nur %“ keinen kg-Wert. Mehrere Einträge eines Tages, ihre Uhrzeit, die Waagen und die Anzahl der Einträge sieht nie jemand außer der Person selbst
- [x] Feed: montags ab 7 Uhr eine Zeile auf der Tageskarte („Gewicht · −0,4 % letzte Woche · −1,8 % in 4 Wochen“, mit kg zusätzlich „−0,3 kg“), nur wenn geteilt und in der Woche gewogen; Zahlen live gerechnet. Einzelne Einträge erzeugen nichts, keine Mitteilung
- [x] Gruppe → Gewicht (dritter Reiter neben Feed und Habits): eine geglättete Linie pro Person in ihrer Farbe, Veränderung in % seit dem ersten Eintrag im Zeitraum (4 Wochen / 3 Monate / 1 Jahr); Tageswerte als blasse Punkte bei allen, die sie teilen; darunter pro Person die Veränderung und, wenn geteilt, der aktuelle Durchschnitt in kg. Man sieht sich selbst so, wie die anderen einen sehen
- [x] Wer nicht teilt, fehlt; eigener Hinweis „Du teilst dein Gewicht nicht“ mit Sprung zur Einstellung
- [x] Tageskarten, deren Inhalt leer ist (z. B. nachdem jemand auf „Nur ich“ gestellt hat), werden nicht mehr als leere Hülle angezeigt – gilt auch für den Habit-Wochenrückblick
- [x] Datenbank-Tests (77): jede Stufe, andere Gruppen sehen nichts, zurück auf „Nur ich“ verbirgt alles

Bekannte Grenze: Aus der geglätteten kg-Kurve lassen sich die Tageswerte ungefähr zurückrechnen, und man sieht, an welchen Tagen sich jemand gewogen hat. Bewusst so gelassen (Jonas, 28.11.2026); wer das nicht will, teilt nur % oder nichts.

Beim Staging-Test prüfen:
- Zu zweit: Stufe wechseln und beim anderen nachsehen, was ankommt (Reiter „Gewicht“, Montagskarte)
- Montagskarte erscheint am Montag nach 7 Uhr
- Linien und Punkte bei 3 Monaten und 1 Jahr lesbar?

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

7a → 7b → 7c → 7d, jede Etappe für sich nutzbar. 7a und 7d sind die großen Teile (7a wegen Waagen-Abgleich und Erinnerung, 7d wegen Speicher und Bildverarbeitung), 7b ist mittel, 7c klein bis mittel. Nach jeder Etappe: Typen neu erzeugen, Lint, Typecheck, Tests, dann Staging.

Danach: Baustein 8 (Ziele & Saisons), dann Umzug auf Live, dann Start der ersten Saison.
