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

## Offen

### 6b – Auswertung (Ich → Habits)
- [ ] Heatmap (Ja/Nein), Linie mit Zielband (Zahl, Dauer), Rhythmus (Uhrzeiten), Erfüllungsquote (Checkliste)
- [ ] Streak, Wochenrückblick

### 6c – Erinnerungen
- [ ] Check-in-Erinnerung (Push)
- [ ] Supplements: Erinnerungszeit pro Eintrag

### 6d – Gruppe
- [ ] Teilen pro Habit: privat / nur erledigt / mit Werten
- [ ] Vergleich der Erfüllungsquote; gleiche Vorlage + „mit Werten“ → Werte direkt vergleichen
- [ ] Eigene Habits als Vorlage für die Gruppe veröffentlichen
- [ ] Habit-Challenges (gleiche Regel für alle)
- [ ] Meilensteine und Wochenzusammenfassung im Feed (kein täglicher Check-in)
