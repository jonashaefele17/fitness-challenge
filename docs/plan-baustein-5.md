# Baustein 5 – Planung: Stand und offene Punkte

Branch: `feat/planning`. Grundlage: Konzept, Abschnitt „Planung, Kalender und Termine“ und „Gemeinsames Training“.

## Erledigt (5a – Planen, persönlich)

- Termine als Training oder Event, einmalig oder wöchentlich an gewählten Tagen (optional bis Datum)
- Tages-Sheet „+“: Planen (Zukunft), Nachtragen (Vergangenheit), heute Auswahl
- Termin-Detail: Training starten (heute), Serie bearbeiten, einzelnen Termin absagen, „Findet doch statt“, Nachholen, Löschen
- „Heute geplant“ im Heute-Tab mit „Starten“; ein daraus gestartetes Training markiert den Termin als erledigt
- Gruppenansicht zeigt die Termine der anderen
- Kalender-Zustände: erledigt gefüllt, geplant als Umriss (verblasst, mit Uhrzeit), abgesagt grau
- Datenbank: `plans`, `plan_skips`, `workouts.plan_id/plan_on`, `plan_occurrences()`

Noch zu tun für 5a: Staging-Test durch Jonas, Feedback einarbeiten.

### Feedback zu 5a (22.11.2026) – umgesetzt am 23.11.2026

- [x] Fokus bei geplanten Trainings angeben; im Kalender als Kürzel unter dem Umriss-Icon
- [x] Vorlagen passend zum Fokus zuerst, die anderen unter „Andere“; wählt man zuerst eine Vorlage, übernimmt der Termin ihren Fokus; ein neuer Fokus behält nur passende Vorlagen
- [x] Mehrere Vorlagen pro Termin: beim Start fragt die App „Welche Vorlage heute?“
- [x] Serie pro Wochentag (Variante A): jeder Wochentag mit eigenem Fokus und eigenen Vorlagen (Mo = Push, Fr = Pull), sonst „wie oben“
- [x] „Nur diesen Termin ändern“: Tag, Uhrzeit, Fokus und Vorlagen eines einzelnen Termins; „Wieder wie in der Serie“ nimmt die Änderung zurück
- Nicht gebaut (bewusst): Vorlagen reihum (Variante B) – nur falls ohne feste Tage trainiert wird

## Offen

### 5b – Einladungen (soziales Modul `invitations`)

Vor dem Bau einen kurzen Plan vorlegen.

- [ ] Teilnehmende aus der Gruppe zu einem Termin einladen (beim Planen und nachträglich)
- [ ] Push an die Eingeladenen
- [ ] Antworten: Zusage, Absage, Vielleicht, andere Zeit vorschlagen
- [ ] Gegenvorschlag: der Besitzer nimmt ihn mit einem Tap an (Termin wird verschoben)
- [ ] Änderung durch den Besitzer (Datum, Zeit, Vorlage, Teilnehmende) → Push, alle bestätigen neu
- [ ] Absagen durch den Besitzer mit Bestätigung, Push an alle
- [ ] „Ich komm mit“: bei einem geplanten Termin einer anderen Person anfragen; die Person nimmt an
- [ ] Kalender (Ich-Ansicht): Avatar-Punkt in Personenfarbe oben rechts am Icon – gefüllt = zugesagt, Ring = offen, „+1“ bei mehreren; wer absagt, verschwindet
- [ ] Gruppenansicht: gemeinsamer Termin in jeder Personenzeile; wer noch nicht zugesagt hat, blasser
- [ ] Tages-Sheet: rechts die Teilnehmer-Avatare mit Status (✓ zugesagt, ? offen, Uhr = anderer Zeitvorschlag, ✗ abgesagt)
- [ ] Glocke/Push springen zum Termin
- [ ] Datenbank-Tests: andere Gruppen sehen nichts, nur Eingeladene antworten, nur der Besitzer ändert

Offene Frage: Gilt eine Einladung bei einer Serie für alle Termine der Serie oder nur für einen?

### 5c – Export

- [ ] Pro Termin „In Kalender übernehmen“: `.ics`-Datei für den Handykalender
- Kalender-Abo (Link, der sich selbst aktualisiert) ist nur eine Idee (`docs/ideen.md`), nicht Teil von Version 1

### 5d – Gemeinsames Live-Training (soziales Modul `live-training`)

Vor dem Bau den Mechanismus klären und einen Plan vorlegen.

- [ ] Start aus einem heutigen Termin mit Teilnehmenden
- [ ] Kein Push „beitreten?“ beim Trainingsstart (entschieden); Beitreten über den Termin bzw. selbst aktiv
- [ ] Gemeinsame Übungsliste; jede Person trägt nur ihre eigenen Sätze ein
- [ ] Die Sätze der anderen live in der Übungskarte sehen
- [ ] Jede Person darf Übungen ergänzen
- [ ] Am Ende hat jede Person ihr eigenes Training, verknüpft als „mit …“; im Feed auf beiden Karten

Offene Frage: Wie fügt man eine Übung **nur für sich** hinzu (ohne sie in die gemeinsame Liste zu setzen)?

## Offene Einschränkung aus 5a

Erledigt: „Nur diesen Termin ändern“ ist gebaut (siehe Feedback oben).
