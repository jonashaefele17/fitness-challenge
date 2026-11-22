# Baustein 6 – Habits: Stand und offene Punkte

Branch: `feat/habits`. Grundlage: Konzept, Abschnitt „Habits“ (Version 1.37).

## 6a – Baukasten und Check-in (gebaut am 23.11.2026)

- [x] Habits anlegen: aus der Bibliothek (Sport, Schlaf, Screen-Time, Fokuszeit, Ernährung, Supplements, Schritte, Wasser, Kein Alkohol) oder eigenes (Ja/Nein, Zahl, Dauer, Uhrzeit-Paar, Checkliste)
- [x] Ziel-Regel, Häufigkeit (täglich, Wochentage, x pro Woche), morgens/abends
- [x] Änderungen gelten ab heute (versioniert), frühere Tage nach alter Regel; archivieren mit Rückgängig, wieder aufnehmen
- [x] Sport automatisch aus Trainings, als Wochenziel; kann nicht von Hand eingetragen werden
- [x] Pausen (krank, Urlaub): tägliche Habits zählen nicht, Wochenziele anteilig kleiner
- [x] Jeder Eintrag merkt sich seine Quelle (von Hand / extern); externe Quelle über Zugangsschlüssel kommt später
- [x] Heute: Kacheln mit Status (✓ erfüllt, halber Kreis = teilweise, leer = offen), Wochen-Habits mit „x/y Woche“
- [x] Check-in: eine Frage pro Bildschirm, Ja/Nein und Auswahl mit einem Tipp; „Überspringen“; Abschluss-Anzeige
- [x] Datenbank-Tests (24): Regeln je Typ, Versionen, Sport aus Trainings, Pausen, Archiv, privat

Beim Staging-Test prüfen:
- Check-in unter 20 Sekunden? Reihenfolge morgens → abends passend?
- Schlaf über Mitternacht (z. B. ins Bett 00:20) wird richtig bewertet
- Eingaben auf dem iPhone (Zahlenfelder, Uhrzeit) angenehm genug?

## Heute-Seite neu (Feedback 22.11.2026, gebaut)

- [x] Kopf: Datum, „Hallo Jonas“, Glocke (keine Flamme, Serien gibt es noch nicht)
- [x] Hauptkarte: alle heutigen Termine (eigene und eingeladene) nach Uhrzeit; der nächste groß mit „Details ›“, allen Beteiligten samt Status („Grazon kommt · deine Antwort fehlt“) und kompaktem „Starten“; weitere als Zeilen. Sonst „Läuft gerade · Öffnen“ bzw. „Lust auf Training? · Starten“
- [x] Termin-Detail zeigt die ausgewählte Vorlage mit Übungen, Sätzen und Wiederholungsbereich – auch fremde Vorlagen
- [x] Check-in-Karte wie im Prototyp: ruhige Kacheln (wischbar), „x von y“, dunkler Knopf „Check-in starten“; Zeit per Rad, „‹ Zurück“, feste Höhe
- [x] „Diese Woche“: erledigt gefüllt, geplant als Umriss, Wochenziele (Sport 3/4)
- [x] „Neu für dich“: ungelesene Mitteilungen, „Alle ›“ öffnet die Glocke


### 6b – Auswertung (Ich → Habits) – erste Version gebaut am 23.11.2026
- [x] Übersicht: „Letzte Woche“ (Gesamtquote, am besten, ausbaufähig), Karte pro Habit mit Quote der letzten 4 Wochen, Serie, letzte 14 Tage als Striche; „Habits verwalten“ öffnet die Verwaltung
- [x] Detail mit Zeitraum 4 Wochen / 3 Monate, Quote, Serie, längste Serie
- [x] Grafik je Typ: Heatmap (Ja/Nein, Auswahl), Linie mit Zielband (Zahl, Dauer), Nachtbalken mit Zielzeit (Schlaf), Wochenbalken gegen Ziel (Sport, x pro Woche), Anteil pro Punkt (Checkliste); Antippen zeigt den Wert
- [x] Kennzahlen in der Datenbank berechnet (habit_stats), nicht gespeichert; Pausen unterbrechen keine Serie
- [x] Überarbeitet nach Recherche und Prototyp (23.11.2026): Übersicht „Diese Woche“ (Mo–So pro Habit, „5/7“ bzw. „3/4“, letzte Woche „x von y“) und „Dranbleiben · letzte 4 Wochen“ (28 Kästchen, Quote, Trend ↑ ↓ =); Detail beginnt mit drei Kennzahlen in Klartext (z. B. Ø Schlaf · Ø ins Bett · im Ziel) und Trend gegenüber dem Zeitraum davor
- [x] Entschieden: Quoten statt Serien in der Oberfläche (Jonas). Die Datenbank rechnet Serien „verzeihend“ (einmal verpassen unterbricht nicht, zweimal hintereinander schon) – für spätere Meilensteine im Feed (6d)
- Später verfeinern (nach Pilot): Achsenbeschriftung, Wochenrückblick als Push/Feed (6d)

### 6c – Erinnerungen (gebaut am 23.11.2026)
- [x] Check-in-Erinnerung morgens/abends (Habits verwalten → Erinnerungen): Push nur, wenn Habits dieses Zeitpunkts noch offen sind („Check-in: noch offen – Screen-Time, Fokuszeit“)
- [x] Supplements: Uhrzeit pro Punkt im Checklisten-Editor; Push nur, wenn der Punkt heute noch nicht abgehakt ist
- [x] Höchstens einmal pro Tag, nie in Pausen, nie mehr als 2 Stunden zu spät; Zeitplan alle 5 Minuten in der Datenbank; Ruhezeit gilt wie bei allen Pushes
- [x] Eine Erinnerungszeit einzustellen schaltet die Kategorie automatisch ein
- [x] Antippen öffnet „Heute“ mit dem Check-in direkt beim Habit
- [x] Datenbank-Tests (10)

Beim Staging-Test prüfen: Kommt die Push zur eingestellten Zeit (max. 5 Minuten später)? Supplement-Zeit setzen und nicht abhaken.

### 6d – Gruppe
6d-1 Teilen und Vergleich
- [x] Teilen pro Habit: privat (Standard) / nur erledigt / mit Werten; im Editor „Wer sieht das?“
- [x] Gruppe-Tab „Feed · Habits“: Matrix – Zeile pro Habit (gleiche Vorlage oder vom selben übernommen), Spalte pro Person, 4-Wochen-Quote mit Balken in Personenfarbe; bis 5 Personen ohne Scrollen
- [x] Antippen: Detailvergleich nach Art – Kennzahlen nebeneinander; Zahl/Dauer als Linien übereinander, Schlaf als Nächte je Person auf gemeinsamer Achse, Checkliste pro Punkt; dazu Erfüllt-Verlauf je Person in ihrer Farbe; derselbe im Habit-Detail auf der Ich-Seite über „Vergleichen mit …“
- [x] Datenbank-Tests: privat sieht niemand, „nur erledigt“ ohne Werte, andere Gruppen nichts

6d-2 Ein Katalog
- [x] Bibliothek = Standard-Vorlagen + geteilte eigene Habits der Gruppe („· von Grazon“); übernehmen mit eigenen Zielen (merkt sich die Herkunft)
- [x] Super-Admin: „Als Standard übernehmen“ – Original und Kopien hängen danach an der Vorlage, alle Werte bleiben

6d-3 Feed
- [x] Wochenrückblick montags ab 7 Uhr auf der Tageskarte (nur geteilte Habits, Zahlen live gerechnet)
- [x] Meilensteine 7/30/100/365 Tage bzw. 4/12/26/52 Wochen, je Habit einmal; kein täglicher Check-in

Nicht in Version 1: Habit-Challenges (Wettbewerb über Saisons, Baustein 8) – siehe Ideenliste
