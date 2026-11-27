# Baustein 7 – Körper: Plan

Branch: `feat/body`. Grundlage: Konzept (Version 1.46) – „Module und Navigation“ (Ich → Körper), „Vergleich“ (Gewicht), „Datenmodell“ (Körper). Der Prototyp zeigt dazu nur drei Stellen: den Reiter „Gewicht“ im Vergleich (Kurve in %), einen Feed-Eintrag zum Gewicht und die Einstellung „Sichtbarkeit: Gewicht nur in %“. Alles andere ist hier neu entworfen.

Stand: Plan mit Jonas abgestimmt am 27.11.2026; 7a bis 7d gebaut, Staging-Test von 7b bis 7d offen. Gebaut wird Etappe für Etappe, jeweils mit Test auf Staging.

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

## 7c – Zwischenstand: Maße (gebaut am 28.11.2026, Staging-Test offen)

- [x] Rhythmus unter Ich → Körper → „Zwischenstand“: aus / alle 2, 4, 6 oder 8 Wochen, Erinnerung per Push mit Uhrzeit (abschaltbar), welche Maße man misst. Ohne Rhythmus keine Erinnerung; eintragen geht jederzeit
- [x] Der erste Zwischenstand ist fällig, sobald der Rhythmus eingeschaltet wird (Ausgangsstand); danach jeweils so viele Wochen nach dem letzten
- [x] Fällig: eine Push pro Zyklus, kein Nachhaken; Karte auf „Heute“ mit „Starten“ und „Auslassen“. Auslassen verschiebt um einen Zyklus und gilt auf allen Geräten
- [x] Ablauf: ein Maß pro Bildschirm mit Messanleitung, Rad in 0,5-cm-Schritten, vorbelegt mit dem letzten Wert (grau, bis man dreht); „Weiter“ übernimmt den angezeigten Wert, „Überspringen“ lässt das Maß aus, „Zurück“; am Ende eine Zusammenfassung mit den Veränderungen und „Speichern“ mit „Rückgängig“. Schließen mit eingegebenen Werten fragt „Verwerfen?“
- [x] Nachtragen: Datum oben im Ablauf wählbar; ein bestehender Zwischenstand öffnet sich in der Zusammenfassung zum Ändern oder Löschen
- [x] Maße als Daten: Bauch, Taille, Brust, Hüfte, Oberarm, Oberschenkel, einzeln ausblendbar (bereits gemessene Werte bleiben erhalten)
- [x] Ich → Körper: pro Maß aktueller Wert, Veränderung seit dem letzten und seit dem ersten Zwischenstand, kleine Kurve; Antippen zeigt den Verlauf mit Messanleitung; „Alle Zwischenstände“ als Liste
- [x] Datenbank: `body_measurement_kinds`, `body_checkins`, `body_measurements`; Fälligkeit und Veränderungen berechnet; nur die eigene Person; Datenbank-Tests (59)

Abweichung vom Plan: Die Messanleitung ist vorerst nur Text. Bilder (Figur mit markierter Messstelle im Stil der Katalogbilder) kommen später aus dem Render-Werkzeug; das Bildfeld ist vorbereitet.

Beim Staging-Test prüfen:
- Rhythmus einschalten: Karte auf „Heute“ erscheint, erster Zwischenstand fällig
- Ablauf auf dem iPhone: Rad, Tippen zum Eingeben, Datum wählen
- Sind die Messanleitungen verständlich genug ohne Bild?
- Erinnerung kommt zur Uhrzeit, Antippen öffnet den Ablauf

## 7d – Zwischenstand: Fotos (gebaut am 27.11.2026, Staging-Test offen)

- [x] Schritt „Fotos“ am Ende des Ablaufs: bis zu 3 in festen Posen (Vorne, Seite, Hinten), „Aufnehmen“ (iPhone-Kamera) oder „Aus Mediathek“; überspringbar. Das letzte Foto derselben Pose steht mit Datum als Vorlage daneben
- [x] Verkleinern auf dem Handy vor dem Hochladen: 1600 Pixel an der langen Kante, dazu ein Vorschaubild mit 320 Pixeln; immer JPEG. Das Original verlässt das Handy nie; Aufnahmeort und Kamera-Angaben fallen beim Verkleinern weg
- [x] Ein Zwischenstand lässt sich auch nur mit Fotos speichern (mindestens ein Maß oder ein Foto). Speichern zeigt den Fortschritt beim Hochladen; „Rückgängig“ nimmt auch die Fotos zurück
- [x] Ich → Körper → Zwischenstand → Zeile „Fotos“: Zwischenstände nach Datum mit Vorschaubildern; Antippen zeigt das Foto groß mit Zoom (Doppeltipp, zwei Finger), Wischen zwischen den Posen, Löschen mit „Rückgängig“
- [x] Vergleichen: zwei Zwischenstände wählen, je Pose nebeneinander oder mit Schieberegler; darunter Gewicht (Durchschnitt über 7 Tage) und Maße beider Stände mit der Veränderung
- [x] Löschen: erst nur markiert, damit „Rückgängig“ geht; nach 2 Minuten entfernt die App die Dateien wirklich aus dem Speicher, und zusätzlich beim nächsten Öffnen von „Körper“. Ein gelöschter Zwischenstand nimmt seine Fotos mit
- [x] Speicher: privater Bucket, ein Ordner pro Person; nur die Person selbst kann lesen und schreiben, auch Gruppen-Admins und der Super-Admin sehen nichts. Datenbank-Tests (67), inklusive „Person aus derselben Gruppe sieht nichts“

Abweichungen vom Plan:
- Keine eigene Kamera-Ansicht mit dem letzten Foto halb durchsichtig darüber (Jonas, 27.11.2026); steht auf der Ideenliste.
- Immer JPEG statt WebP: Safari liefert beim Verkleinern statt WebP stillschweigend PNG.

Bekannte Grenzen:
- Wird die App genau zwischen Hochladen und Eintragen beendet, bleibt eine Datei ohne Eintrag im Speicher liegen (unsichtbar, nur für die Person selbst erreichbar).
- Ein Konto löschen gibt es noch nicht; dabei müssten die Dateien eigens entfernt werden.

Beim Staging-Test prüfen (alles nur am echten iPhone zu sehen):
- „Aufnehmen“ und „Aus Mediathek“: öffnen sich Kamera und Mediathek, erscheint die Vorschau auch bei HEIC-Fotos?
- Fotos im Hochformat richtig herum? Qualität am Handy und am PC in Ordnung? Wie groß werden echte Fotos?
- Drei Fotos nacheinander: bleibt die App flüssig, Hochladen im Mobilfunk schnell genug?
- Großansicht: Zoomen und Verschieben, ohne dass die ganze Seite zoomt; Schließen-Knopf nicht unter der Notch
- Schieberegler im Vergleich lässt sich ziehen, ohne dass das Blatt mitgeht
- Ist der ganze Zwischenstand in wenigen Minuten machbar?

## Nicht in diesem Baustein

- Gewichtsziele und „Ziel zu 45 % erreicht“ (Baustein 8, Ziele); „seit Saisonstart“ und Startwert aus den ersten Messungen (Baustein 8, Saisons).
- Gewicht im PC-Dashboard (Baustein 9).
- Eigenes Profilbild und Bild-Upload für Geräte (Ideenliste). Das Verkleinern aus 7d wird so gebaut, dass es dafür wiederverwendbar ist, sobald der zweite Anwendungsfall kommt.
- Anbindung an Waagen oder Apple Health, Körperfettanteil, Körpergewicht automatisch bei Klimmzügen und Dips mitrechnen: nicht im Konzept, bei Interesse auf die Ideenliste.

## Reihenfolge und Umfang

7a → 7b → 7c → 7d, jede Etappe für sich nutzbar. 7a und 7d sind die großen Teile (7a wegen Waagen-Abgleich und Erinnerung, 7d wegen Speicher und Bildverarbeitung), 7b ist mittel, 7c klein bis mittel. Nach jeder Etappe: Typen neu erzeugen, Lint, Typecheck, Tests, dann Staging.

Danach: Baustein 8 (Ziele & Saisons), dann Umzug auf Live, dann Start der ersten Saison.
