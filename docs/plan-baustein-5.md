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

Reihenfolge getauscht (Jonas, 23.11.2026): erst Live-Training (5c), dann Export (5d). Stand nach 5b (`feat/planning`) ist die saubere Version fürs Pilotprojekt; 5c entsteht auf einem eigenen Branch.

### 5b – Einladungen (soziales Modul `invitations`) – gebaut am 23.11.2026

- [x] Teilnehmende aus der Gruppe einladen: beim Planen („Mit wem?“) und nachträglich im Termin („Leute einladen“ / „Einladung ändern“)
- [x] Mitteilung (Glocke + Push, Kategorie „Termine“) an die Eingeladenen
- [x] Antworten: Zusage, Vielleicht, Absage; bei einer Serie wahlweise „Dieser Termin“ oder „Alle Termine“
- [x] Andere Zeit vorschlagen (pro Termin); der Besitzer tippt „Übernehmen“, der Termin wird verschoben
- [x] Änderung durch den Besitzer (Tag, Zeit, Fokus, Vorlagen, Art) → Mitteilung, alle bestätigen neu
- [x] Absagen eines Termins und Löschen der Serie → Mitteilung an alle
- [x] „Ich komm mit“ bei einem Termin einer anderen Person; der Besitzer wählt „Mitnehmen“ oder „Lieber nicht“
- [x] Kalender (Ich-Ansicht): Punkt in Personenfarbe oben rechts am Icon – gefüllt = zugesagt, Ring = offen, „+n“ bei mehreren; wer absagt, verschwindet. Termine, zu denen ich eingeladen bin, stehen auch in meinem Kalender (ab heute)
- [x] Gruppenansicht: gemeinsamer Termin in jeder Personenzeile; wer noch nicht zugesagt hat, blasser
- [x] Tages-Sheet: rechts die Avatare mit Status (✓ zugesagt, ? offen/vielleicht, Uhr = anderer Zeitvorschlag, ✗ abgesagt)
- [x] Glocke/Push springen zum nächsten Termin des Plans (Training-Tab)
- [x] Datenbank-Tests: andere Gruppen sehen nichts, nur Eingeladene antworten, nur der Besitzer ändert (22 Tests)

Entschieden: Eine Einladung gilt für die ganze Serie; absagen oder eine andere Zeit vorschlagen geht pro Termin.

Bewusst noch nicht drin (kommt mit 5c): Termine anderer, zu denen ich eingeladen bin, unter „Heute geplant“ mit „Starten“ – das gemeinsame Starten gehört zum Live-Training.

Beim Staging-Test prüfen: Nach „Übernehmen“ zeigt das offene Termin-Detail noch die alte Zeit, bis man es neu öffnet.

### 5c – Gemeinsames Live-Training (soziales Modul `live-training`) – gebaut am 23.11.2026, Branch `feat/live-training`

- [x] Start aus einem heutigen Termin mit Teilnehmenden: wer startet, startet ein gemeinsames Training
- [x] Kein Push „beitreten?“ (entschieden); im Heute-Tab „Heute mit anderen“: „Mitmachen“, solange jemand trainiert, sonst „Starten“ (auch als Eingeladene/r)
- [x] Gemeinsame Übungsliste; jede Person trägt nur ihre eigenen Sätze ein
- [x] Die Sätze der anderen live über der Übungskarte (in Echtzeit über einen privaten Kanal pro gemeinsamem Training; alle 30 Sekunden zusätzlich nachgeladen, falls etwas verpasst wurde)
- [x] Jede Person darf Übungen ergänzen; Schalter „Für alle“ im Übungs-Picker (aus = nur für mich)
- [x] Löschen und Sortieren wirken für alle; gelöscht wird bei den anderen nur, wer noch keine abgehakten Sätze darin hat; „Rückgängig“ bringt die Übung bei allen zurück
- [x] Am Ende hat jede Person ihr eigenes Training; im Feed steht „mit …“ unter dem Training
- [x] Datenbank-Tests (22): Teilen, nur für mich, Sortieren, Löschen mit/ohne Sätze, Zurückholen, nicht Eingeladene, andere Gruppen, Ende der Sitzung

Entschieden (Jonas): Löschen und Sortieren gelten für alle (nicht nur für einen selbst).

Beim Staging-Test prüfen:
- Zu zweit gleichzeitig trainieren: neue, gelöschte und verschobene Übungen und Sätze kommen sofort beim anderen an (auch nach App im Hintergrund)
- Feed-Karte „mit …“ (im Browser noch nicht geprüft)
- Eigene Trainingsarten des Besitzers: Mitmachen geht nur bei Standard-Trainingsarten (Studio, Laufen …)

### 5d – Export

- [ ] Pro Termin „In Kalender übernehmen“: `.ics`-Datei für den Handykalender
- Kalender-Abo (Link, der sich selbst aktualisiert) ist nur eine Idee (`docs/ideen.md`), nicht Teil von Version 1

## Offene Einschränkung aus 5a

Erledigt: „Nur diesen Termin ändern“ ist gebaut (siehe Feedback oben).
