# Fitness-Challenge-App – Grundkonzept v1.0

Nov 20, 2026 · @Jonas

Dieses Dokument ist das lebende Grundkonzept der App: Es gilt, bis eine Änderung beschlossen und hier eingetragen ist. Die Architektur ist so angelegt, dass Änderungen am Konzept keinen Umbau der Struktur erzwingen.

## Status und Änderungen

- **Version:** 1.3 (Grundkonzept nach drei Prototyp-Runden, mehrgruppenfähiges Datenmodell, getrennte persönliche und soziale Module)
- **Prototyp:** [Fitness-App Prototyp](https://claude.ai/artifact/7vZXnQ2NEBQz1bKFdpwDZq) (Handy v3 + PC-Dashboard)
- **Regel:** Jede Änderung bekommt eine Zeile im Protokoll und, wenn sie eine Grundsatzfrage betrifft, einen Eintrag unter „Entscheidungen“.

| Datum | Version | Änderung |
| --- | --- | --- |
| 20.11.2026 | 1.0 | Grundkonzept erstellt |
| 20.11.2026 | 1.1 | Datenmodell mehrgruppenfähig (siehe Entscheidungen) |
| 20.11.2026 | 1.2 | Persönliche und soziale Module getrennt (siehe Entscheidungen) |
| 21.11.2026 | 1.3 | Push: Bündeln standardmäßig aus (pro Person einschaltbar, Fenster 3 Min.), Pushes werden sofort ausgelöst |

## Vision und Kernschleife

Eine eigene PWA für eine kleine Gruppe von Freunden (2–5 Personen), die gemeinsam trainieren, Fortschritt sichtbar machen und sich gegenseitig motivieren – und die Challenge nutzen, um ihr Leben umzukrempeln. Handy zum Eintragen, PC zum Auswerten und Verwalten, kostenlos betrieben.

Die Kernschleife, auf die alles ausgerichtet ist:

1. **Planen** – eigene Vorlagen und Termine, Partner einladen
2. **Trainieren** – allein oder gemeinsam, Eintragen in wenigen Taps
3. **Sichtbar machen** – Tageskarte im Feed, Fortschritt in % am eigenen Ziel
4. **Reagieren** – Kommentare bis auf Satzebene, Reaktionen
5. **Wiederkommen** – Benachrichtigungen, Streaks, Saison-Ziele

**Was die App besonders macht:** Geräte mit Einstellungen und Gewichtsstufen, gemeinsames Training, Kommentare überall ohne die Übersicht zu stören (wie in der früheren Excel-Datei), faire Vergleiche trotz unterschiedlicher Sportarten und Studios.

## Nutzer, Kreise und Rollen

Es gibt drei Kreise und zwei Nutzungsarten; Zugang nur für Bekannte über Google-Login plus Invite-Code.

| Kreis | Wer | Was dort geteilt wird |
| --- | --- | --- |
| Challenge / Saison | alle Teilnehmer (2–5) | Feed, Gewicht in %, Ziele, Vergleich |
| Trainingsgruppe | beliebige Teilmenge, z. B. Jonas + Kumpel | gemeinsame Vorlagen, Termine, gemeinsames Training |
| Ad hoc | jede Person der Challenge | Einladung zu einem einzelnen Training oder Termin |

**Nutzungsarten**

- **Power:** Übungen, Sätze, Geräte, Einstellungen, Progression – für alle, die im Studio genau tracken.
- **Light:** ein Tap „Training erledigt“ mit Art und Dauer (Laufen 45 min, Fußball) – damit auch Leute dabeibleiben, die wenig tracken wollen. Beides zählt gleich für Feed, Streaks und Ziele.

**Rollen**

- **Admin (Jonas):** legt Saisons an, verwaltet Einladungen, führt doppelte Übungen zusammen, nimmt Korrekturen an Saisonzielen vor.
- **Teilnehmer:** alles andere; Saisons können vorgeschlagen werden, der Admin bestätigt.

**Orte und Studios:** Jeder legt ein Heimstudio fest (z. B. FitX, McFit). Geräte gehören zu einem Studio; wer keine Geräte anlegt, nutzt die allgemeine Übungsliste.

## Module und Navigation

Am Handy gibt es vier Tabs in einer schwebenden Pillen-Leiste und daneben einen runden Start-Button; am PC dieselben Inhalte als Dashboard.

| Tab | Inhalt |
| --- | --- |
| **Heute** | Heute geplant (Termin, mit wem), Tages-Check-in als 5 Kacheln, „Neu für dich“, Glocke mit Mitteilungen, Streak |
| **Training** | Kalender Monat/Woche, beliebig blätterbar, Filter „Nur ich / Alle“, Tagesdetail mit „An diesem Tag planen“, eigene Vorlagen |
| **Gruppe** | Avatar-Leiste „Heute“, Feed aus Tageskarten, Reiter „Vergleich“ (Ziele, Konsistenz, Gewicht, Kraft, Dranbleiben), Saison-Archiv kompakt |
| **Ich** | Training (Kraftverlauf, Ziele), Habits (Auswertung, Supplements), Einstellungen (Benachrichtigungen, Trainingsarten, Geräte, Sichtbarkeit) |

- **Start-Button (+):** Trainingsart → Vorlage oder frei → mit wem. Bei Light-Arten (Laufen, Fußball) entfällt Schritt 2.
- **Laufendes Training:** minimierbar als Mini-Leiste über der Navigation, läuft im Hintergrund weiter.
- **Glocke:** in Heute und Gruppe, mit Badge für Ungelesenes.
- **PC:** Dashboard (Kalender aller, Feed-Spalte mit offenem Thread, Gruppe heute, Vergleich), Vorlagen-Editor, Geräte-Katalog, Saison-Archiv, Admin.

## Training

Trainiert wird flexibel: Es gibt keinen vorgegebenen Plan, nur eigene Vorlagen, und jedes Training lässt sich unterwegs verändern.

**Trainingsarten** (als Daten, pro Person wählbar): Studio (z. B. FitX), Home Gym, Mobility, Fußball, Laufen … Studio und Home Gym werden mit Übungen und Sätzen erfasst, die anderen mit Dauer, optional Distanz, Intensität 1–5 und Notiz. Mobility-Routinen laufen mit Timer ab.

**Geräte und Übungen**

- Übungen sind allgemein (Bankdrücken, Latzug); Geräte gehören zu einem Studio und haben Foto, Gewichtsstufen (z. B. 5 kg, 2,5 kg) und eine oder mehrere Übungen.
- Einstellungen werden pro Person, Gerät und Übung gespeichert (Kabelzug: Trizepsdrücken Höhe 12, Face Pulls Höhe 9).
- Hinzufügen über ein Geräte-Raster mit Bildern; Geräte mit mehreren Übungen öffnen eine Auswahl.
- FitX-Katalog legt Jonas mit eigenen Fotos an (einheitlicher Bildstil); andere Studios entstehen nebenbei („Gerät merken?“ nach dem Training).
- Duplikatschutz: Suche vor dem Anlegen, Aliase, Zusammenführen durch den Admin.

**Ablauf im Training**

1. Start aus Termin, Vorlage oder leer.
2. Oben: Übungs-Chips zum Springen; lange drücken und ziehen zum Umsortieren.
3. Pro Übung: Name, Geräteeinstellung, kleine Verlaufskurve der letzten 6 Trainings mit Trend.
4. Sätze: Spalte „vorher“ pro Satz; nur die aktive Zeile hat Stepper (‹ ›, Wischen auf dem Wert, in Gerätestufen); der Haken bestätigt und startet die Satzpause.
5. Aufwärmsätze („W“) zählen nicht für Volumen, Bestwerte und Vorschläge.
6. Satz nach links wischen = löschen; Übung über „…“ tauschen, Notiz, entfernen – jeweils mit Rückgängig.
7. Unten: ‹ · + Übung (wird hinter der aktiven eingefügt) · Nächste Übung.
8. Menü „…“: Pausieren, Minimieren, Beenden & speichern, Abbrechen & verwerfen (mit Bestätigung).
9. Ende: Zusammenfassung (Dauer, Arbeitssätze, Volumen, Bestwerte), Frage „Vorlage aktualisieren?“, Tageskarte im Feed, Habit „Sport“ hakt sich ab.

**Progression:** Double Progression. Erreicht ein Satz beim letzten Mal das obere Ende des Wiederholungsbereichs, schlägt die App die nächste Gerätestufe vor (↑). Kein RIR, keine aktive Stagnationswarnung – Stagnation zeigt sich ruhig im Verlauf.

**Gemeinsames Training:** Einer startet und lädt ein (Push „beitreten?“), beide haben dieselbe Übungsliste, jeder trägt nur seine eigenen Sätze ein und sieht die des anderen live. Jeder darf Übungen ergänzen. Am Ende hat jeder sein Training, verknüpft als „mit …“.

## Planung, Kalender und Termine

Geplant wird über selbst gebaute Vorlagen und frei gesetzte Termine; ein Ausfall verschiebt nichts und bestraft niemanden.

- **Vorlagen:** eigene Trainings mit Übungen, Ziel-Sätzen und Wiederholungsbereichen; aus einem vergangenen Training speicherbar; Vorlagen anderer lassen sich kopieren.
- **Kalender:** Monats- und Wochenansicht, vor und zurück blätterbar; Punkte für erledigt, geplant und „mit jemandem“; „Alle“ blendet die Trainings der anderen ein.
- **Termin:** Datum (beliebig weit voraus), Uhrzeit, Trainingsart, optional Vorlage, Teilnehmer; optional wiederkehrend.
- **Einladung:** Push an die Eingeladenen; Antworten: Zusage, Absage, andere Zeit vorschlagen (Gegenvorschlag mit einem Tap annehmen), vielleicht.
- **Bearbeiten:** Datum, Zeit, Vorlage, Teilnehmer; jede Änderung geht als Push raus, Eingeladene bestätigen neu. Absagen mit Bestätigung.
- **„Ich komm mit“:** auf einen geplanten Termin eines anderen anfragen.
- **Ausfall:** Termin wird grau, „Nachholen“ legt ihn neu an. Geplante Ruhetage kommen ebenfalls in den Kalender.
- **Export:** Termin als .ics in den Handykalender.
- Aus einem heutigen Termin startet man direkt das gemeinsame Training.

## Feed, Kommentare und Benachrichtigungen

Der Feed ist das, was die Gruppe antreibt: Man kann überall kommentieren, ohne dass die Übersicht leidet, und bekommt mit, wo etwas Neues steht.

**Feed**

- Eine **Tageskarte pro Person und Tag** bündelt Training, Wiegetag, Check-in-Status und Meilensteine.
- Karte antippen → Detail mit allen Übungen und Sätzen.
- Sortierung „Neueste“ (Standard) oder „Zuletzt aktiv“; Karten springen nicht von selbst nach oben.
- Endloses Scrollen (ca. 15 Karten pro Ladevorgang), Pille „↑ neue Beiträge“, Sprung zu einem Datum aus dem Kalender.
- Weitere Karten: Wochenrückblick, Saisonstart, Saison-Rückblick, Ziel erreicht, geteilte Vorlage.

**Kommentare**

- Kommentierbar ist jedes Objekt: Tag, Training, Übung, Satz, Ziel, Habit-Tag, Rückblick.
- Sichtbar ist nur eine kleine Sprechblase mit Zahl an der Stelle (wie das Excel-Eck); rot bei Neuem.
- Thread mit Antworten und @Erwähnungen; die Karte zeigt „4 · 2 neu“ und eine Vorschauzeile.
- Reaktionen (Feuer) zusätzlich zu Kommentaren.

**Mitteilungen und Push**

- **Glocke:** listet alles, was dich betrifft; ein Tap springt genau an die Stelle (Übung aufgeklappt, Satz markiert, Thread offen).
- **Push** standardmäßig an: Besitzer des kommentierten Objekts, Thread-Teilnehmer, @Erwähnte.
- **Einstellungen pro Person:** Voreinstellungen Nur Wichtiges / Standard / Alles, darunter 8 Kategorien einzeln (Kommentare auf meine Einträge, Antworten, Erwähnungen, Reaktionen, alle Aktivitäten, Termine, Check-in-Erinnerung, Supplements), dazu Bündeln (3 Min., standardmäßig aus) und Ruhezeit 22–7 Uhr.
- **Technik:** Web Push über Supabase Edge Function; iPhone nur bei installierter App. Der Sprung an die Stelle läuft über ein lokal gemerktes Sprungziel, weil iOS Adressen aus Push-Klicks nicht zuverlässig öffnet. Badge-Zahl am App-Symbol.

## Habits

Habits sind ein Baukasten: Jeder definiert seine eigenen, Jonas' 5 Säulen (Sport, Screen-Time, Schlaf, Fokuszeit, Ernährung) sind nur eine Konfiguration davon.

| Baustein | Auswahl |
| --- | --- |
| Name | frei |
| Eingabetyp | Ja/Nein · Zahl mit Einheit · Dauer · Uhrzeit-Paar (Bett/Auf) · Auswahl · Checkliste |
| Ziel-Regel | mindestens / höchstens / zwischen / vor einer Uhrzeit |
| Häufigkeit | täglich · bestimmte Wochentage · x-mal pro Woche |
| Zeitpunkt | morgens / abends (Reihenfolge im Check-in, Erinnerung) |
| Automatisch | optional aus der App, z. B. Sport aus Trainings |
| Ausnahmen | z. B. geplanter Ruhetag zählt als erfüllt |
| Fortschritt teilen | privat · nur „erledigt“ · mit Werten |
| Als Vorlage veröffentlichen | ja/nein (landet in der Habit-Bibliothek der Gruppe) |

**Beispiele aus Jonas' Säulen:** Schlaf = Uhrzeit-Paar, Ziel „≥ 7 h und Bett vor 23:15“, morgens · Screen-Time = Dauer, „≤ 2 h“, abends · Ernährung = Auswahl gehalten/teilweise/nicht plus Checkliste Supplements mit eigener Erinnerungszeit pro Eintrag · Sport = automatisch, Ruhetag zählt.

**Check-in:** Auf „Heute“ eine Zeile Kacheln mit Status; ein Tap startet den Check-in mit einer Frage pro Bildschirm, automatisch aus den eigenen Habits gebaut und nach Zeitpunkt sortiert. Ziel: unter 20 Sekunden.

**Auswertung (privat, unter Ich → Habits):** passend zum Eingabetyp – Heatmap (Ja/Nein), Linie mit Zielband (Zahl, Dauer), Rhythmus-Grafik (Uhrzeiten), Erfüllungsquote (Checkliste); dazu ein persönlicher Wochenrückblick.

**Einrichten und ändern:** aus einer Vorlagen-Bibliothek wählen oder selbst anlegen (empfohlen 3–7). Änderungen gelten ab dem Tag (versioniert), alte Tage bleiben nach alter Regel bewertet; nicht mehr genutzte Habits werden archiviert, nicht gelöscht.

**Gruppe:** verglichen wird nur die Erfüllungsquote, nie der Inhalt. Optional gemeinsame Habit-Challenges (z. B. 30 Tage kein Alkohol), bei denen alle dieselbe Regel haben.

## Ziele, Saisons und Vergleich

Eine Saison ist nur ein Rahmen aus Zeitraum, Teilnehmern und Zielen; Trainings, Gewicht und Habit-Einträge laufen über alle Saisons durch und werden nie zurückgesetzt.

**Ziele (generisch):** Messgröße (Trainings pro Woche, Körpergewicht, Bestwert an einer Übung, Habit-Erfüllung …), Startwert, Zielwert, Zeitraum, Sichtbarkeit, Status. Der Fortschritt wird immer aus den Daten berechnet. Neue Messgrößen kommen ohne Umbau dazu. Welche Zielarten Pflicht sind, ist offen.

**Ablauf einer Saison**

1. **Anlegen:** Admin legt Name, Zeitraum, Setup-Phase, Teilnehmer und Regeln fest (Wiegetag, Pflicht-Zielarten); alle bekommen eine Push.
2. **Setup-Phase:** jeder wählt Habits, setzt Ziele und Sichtbarkeit; Ziele der anderen sind sichtbar und kommentierbar.
3. **Startwerte automatisch (oder manuell wählbar zB bei Gewicht)****:** Gewicht = Durchschnitt der ersten Wiegetage um den Start; Kraft = bester Satz der letzten 4 Wochen, ohne Historie 2 Wochen Messphase.
4. **Start:** Ziele werden festgeschrieben, Feed-Karte „Saison gestartet“.
5. **Laufend:** Saisonziele bleiben fest (kein Halbzeit-Fenster); Korrekturen nur durch den Admin und sichtbar im Feed. Habits sind versioniert änderbar. Private Zusatzziele jederzeit, sie zählen nicht im Vergleich. Pausentage bei Krankheit oder Urlaub zählen weder für noch gegen die Konsistenz. Später Einstieg mit eigenem Startdatum.
6. **Ende:** Schluss-Wiegung mit 2–3 Tagen Spielraum, Stand wird eingefroren, Saison-Rückblick pro Person und Gruppe als Feed-Karte.
7. **Übergang:** Rückschau pro Ziel (verlängern / steigern / beenden) und pro Habit (behalten / anpassen / archivieren) wird zum Entwurf der nächsten Saison; optional Off-Season ohne Wettbewerb.

**Vergleich (Reiter in Gruppe)**

- **Ziele:** pro Person alle Saisonziele mit Start → aktuell → Ziel, Fortschritt in %, Status „auf Kurs / hinter Plan“ (gegen die Linie vom Start zum Ziel), Filter nach Zielart, Saison-Auswahl.
- **Konsistenz:** Wochenziel erfüllt in %, Streaks, Heatmap „Dranbleiben“.
- **Gewicht:** Veränderung in % seit Start; Sichtbarkeit pro Person (kg, nur %, nichts).
- **Kraft:** Steigerung in % seit Start pro Übung, jeder an seinen eigenen Geräten; direkter Vergleich nur am selben Gerät im selben Studio.
- **Habits:** nur Erfüllungsquote, für wer teilt.
- **Punkte:** kommen zum Schluss, eher für Konsistenz als für Ergebnisse.

## PC-Ansicht und Admin

Am PC wird ausgewertet, geplant und verwaltet; eingetragen wird am Handy. Es ist dieselbe App mit breiterem Layout, kein zweites Frontend.

- **Dashboard:** großer Monatskalender mit den Einträgen aller und Kommentar-Sprechblasen; Feed als feste rechte Spalte, oben der gerade offene Thread; darunter Gruppe heute, Wochenziel und Gewicht.
- **Vorlagen-Editor:** Drag & Drop, eigener Plan neben dem eines anderen, „In meine Vorlagen kopieren“.
- **Geräte-Katalog:** Tabelle mit Gerät, Übungen, Stufen, Einstellungen, Bildstatus; Fotos gesammelt hochladen.
- **Saisons:** Übersicht aller Saisons (Zeitraum, Teilnehmer, Ziele erreicht, Gruppenziel); Detail mit Abschlusstabelle, Graphen, Bestwerten, meistkommentierten Momenten, Rückblick; Saisons miteinander vergleichen.
- **Admin:** Saisons anlegen und Regeln setzen, Saisonvorschläge bestätigen, Einladungen und Invite-Codes, Übungen zusammenführen, Korrekturen an Saisonzielen.
- **Export:** CSV der eigenen Daten.

## Technik und Architektur

Der Grundsatz: Das Datenmodell ist generisch, die Oberfläche nur so groß wie gebraucht – so lässt sich erweitern und ändern, ohne die Struktur umzuwerfen.

&#91;embedded content: Architektur · 5 Schichten\]

Neue Features hängen sich an die Kerne an; nur die Datenschicht spricht mit Supabase, deshalb bleiben Änderungen lokal.

**Stack (kostenlos)**

| Ebene | Wahl |
| --- | --- |
| Frontend | React + TypeScript + Vite, als PWA |
| Hosting | GitHub Pages, Deployment per GitHub Actions |
| Backend | Supabase: Postgres, Google-Login, Realtime, Storage, Edge Functions + Cron (Push) |
| Daten im Client | TanStack Query (Caching, sofortige Reaktion, Hintergrund-Speichern) |
| UI | Tailwind + Radix-Bausteine, eigenes Design-System |
| Animation / Gesten | Motion, dnd-kit (langes Drücken + Ziehen) |
| Tests | Vitest (Logik), Tests für Zugriffsregeln |

**Architektur-Regeln**

1. **Ordner nach Features:** training, kalender, feed, kommentare, habits, ziele, saisons, benachrichtigungen, admin – jedes mit eigenen Typen, Hooks, Komponenten; Module sprechen nur über definierte Schnittstellen.
2. **Generische Bausteine:** Kommentare und Reaktionen hängen an „irgendeinem Objekt“; Feed-Events = Typ + Daten; Benachrichtigungen = Ereignis + Regel + Einstellung; Ziele = Messgröße + Regel; Habits = Definition + Eingabetyp.
3. **Einstellungen als Daten:** Trainingsarten, Eingabetypen, Habit-Vorlagen, Push-Kategorien, Messgrößen stehen in Tabellen.
4. **Berechnen statt speichern:** Fortschritt, Bestwerte, Streaks, Vergleich, Rückblicke, Punkte als SQL-Views/Funktionen; Regeländerungen wirken korrekt rückwirkend.
5. **Versionierung:** Habit-Definitionen und Ziele mit „gültig ab“.
6. **Migrationen im Git + generierte TypeScript-Typen:** der Compiler zeigt jede betroffene Stelle.
7. **Eine Datenschicht:** die Oberfläche spricht nie direkt mit Supabase, nur über Hooks pro Feature.
8. **Feature-Schalter** pro Modul, Staging- und Live-Projekt, wöchentlicher Datenbank-Export (Free-Tier hat keine Backups), Fehler-Monitoring, Feedback-Button.
9. **Sicherheit:** Row Level Security für jede Tabelle, standardmäßig privat, mit eigenen Tests.

**Grenzen und Kosten:** Supabase Free reicht laut Abschätzung für Jahre (1 GB Dateien, 500 MB Datenbank; Bilder vor dem Hochladen auf ca. 200 KB verkleinert). PWA-Grenzen auf dem iPhone: Push nur bei installierter App, keine Vibration, kein Timer im Hintergrund.

**Option für später – Capacitor:** verpackt dieselbe Web-App als native iOS/Android-App und erschließt Haptik, lokale Benachrichtigungen u. a. Kosten: Apple Developer Program 99 USD pro Jahr für TestFlight, Build für iOS braucht einen Mac oder einen Cloud-Build. Die Architektur bleibt dafür offen.

**Später möglich:** Claude-Anbindung über einen MCP-Server (Einträge per Chat), Ernährung als eigenes Modul.

## Design und Interaktion

Die App soll sich wie eine smoothe native iPhone-App anfühlen und Spaß machen; man soll nicht merken, dass es eine Web-App ist.

- **Look:** dunkles Design (gut lesbar im Studio), Limettengrün als Akzent, feste Personenfarben; Systemschrift (SF Pro), große ruhige Typografie, viel Weißraum; Safe Areas für Notch und Home-Leiste.
- **Design-System zuerst:** Tokens für Farben, Abstände, Radien, Schrift und Animationswerte; Komponenten wie Card, Sheet, Chip, Stepper, Sprechblase, Pillen-Navigation. Ein Look-Update passiert an einer Stelle.
- **Bewegung:** Tabwechsel, Sheets mit Federwirkung und Wegziehen, weich nachrückende Listen beim Verschieben, Abhak-Animation, kleiner Effekt bei Bestwerten; „Bewegung reduzieren“ wird respektiert.
- **Tempo:** jede Aktion wirkt sofort, gespeichert wird im Hintergrund; Platzhalter in Form der Inhalte statt Spinner.
- **Eintragen im Studio:** höchstens 2–3 Taps pro Satz, einhändig, Tippflächen ≥ 44 px, Rückgängig statt Bestätigungsdialog (außer bei Verwerfen und Absagen).
- **Onboarding:** in 60 Sekunden – Homescreen-Installation, Push erlauben, Heimstudio, Trainingsarten, erste Habits.
- **Feinschliff in eigenen Durchgängen** nach jedem größeren Baustein, damit er die Kernfunktionen nicht ausbremst.
- **Gerätebilder:** aus Jonas' FitX-Fotos in einheitlichem Stil; 3D-Modelle später möglich (Bildfeld pro Gerät ist vorbereitet).

## Datenmodell im Überblick

Die Tabellen sind nach Modulen gruppiert; die generischen Bausteine (Kommentare, Reaktionen, Events, Benachrichtigungen) zeigen über Objekttyp + ID auf beliebige Einträge.

| Modul | Tabellen (Auswahl) | Hinweis |
| --- | --- | --- |
| Kern | profiles, groups, group\_members, invites | Rollen (Admin), Heimstudio, Sichtbarkeit |
| Orte & Katalog | locations, devices, exercises, device\_exercises, exercise\_aliases | Gewichtsstufen am Gerät, Bild-URL |
| Einstellungen | user\_device\_settings | pro Person, Gerät, Übung |
| Training | training\_types, templates, template\_items, workouts, workout\_participants, workout\_items, sets | Satz: kg, Wdh., Aufwärm-Flag, erledigt |
| Planung | appointments, appointment\_invites, rest\_days | Status, Gegenvorschlag |
| Social | feed\_events, comments, reactions, mentions, read\_markers | Ziel = Objekttyp + ID (+ Satz-Index) |
| Benachrichtigungen | notifications, notification\_prefs, push\_subscriptions | Kategorien, Bündeln, Ruhezeit |
| Habits | habit\_definitions, habit\_versions, habit\_entries, habit\_templates | Eingabetyp, Regel, gültig ab |
| Ziele & Saisons | seasons, season\_members, goals, goal\_metrics, pauses | Startwert, Zielwert, Status, Admin-Korrektur |
| Körper | weigh\_ins, body\_measurements, progress\_photos | Fotos privat in Storage |
| Berechnet (Views) | personal\_bests, streaks, goal\_progress, comparison, season\_recap | nie gespeichert |

Namen und Felder sind ein Entwurf; das genaue Schema entsteht als erste Migration.

## Umsetzungsreihenfolge innerhalb von Version 1

Version 1 enthält alles in diesem Dokument und geht erst live, wenn sie steht; die Reihenfolge unten ist nur die Bauabfolge, damit jeder Schritt auf dem vorherigen aufsetzt und keine Umwege nötig sind.

1. **Fundament:** Repo, CI, Staging/Live, Design-System (Tokens + Basiskomponenten), Pillen-Navigation, Login + Invite, Profile, Zugriffsregeln + Tests, Backups.
2. **Generische Kerne:** Objekt-Referenzen, Kommentare, Reaktionen, Feed-Events, Benachrichtigungs-Engine mit Push.
3. **Training:** Katalog (Orte, Geräte, Übungen, Stufen, Einstellungen), Trainingsarten, Vorlagen, Trainingsablauf, Light-Eintrag, Progression, Zusammenfassung.
4. **Feed:** Tageskarten, Detail, Kommentare bis Satzebene, Glocke, Sprung an die Stelle.
5. **Planung:** Kalender, Termine, Einladungen mit Gegenvorschlag, „Ich komm mit“, .ics, gemeinsames Live-Training.
6. **Habits:** Baukasten, Vorlagen-Bibliothek, Check-in, Auswertung, Supplements, Veröffentlichen, Habit-Challenges.
7. **Körper:** Wiegetag, Gewicht in %, Maße, Fortschrittsfotos.
8. **Ziele & Saisons:** Ziel-Engine, Saison-Lebenszyklus, Vergleich, Rückblicke, Archiv.
9. **PC & Admin:** Dashboard, Vorlagen-Editor, Geräte-Katalog, Saison-Verwaltung, Export.
10. **Feinschliff & Test:** Animationen, Leer-Zustände, Onboarding, Testbetrieb zu zweit, dann Saison 1 festlegen.
11. **Zum Schluss:** Punktesystem.

## Risiken und Gegenmaßnahmen

Das größte Risiko ist der Umfang für eine Person am Feierabend; das wird bewusst in Kauf genommen („solange es dauert“), aber mit Disziplin gesteuert.

| Risiko | Gegenmaßnahme |
| --- | --- |
| Umfang zieht sich, Motivation sinkt | Bauabfolge oben, fertige Schritte zu zweit nutzen und testen, neue Ideen auf eine Ideenliste statt sofort in den Code |
| Framework statt App | Datenmodell generisch, Oberfläche nur für echte Fälle |
| Kleine Gruppe, Feed bleibt leer | Light-Modus mit einem Tap, Gruppenziel, Wochenrückblick |
| Einstiegshürde iPhone (Homescreen, Push) | geführtes Onboarding, notfalls gemeinsam installieren |
| PWA-Grenzen (Hintergrund, Vibration, Push-Sprünge) | Erwartung klar, Umwege eingebaut, Capacitor als Option |
| Zu viele Benachrichtigungen | gute Standards, Bündeln, Ruhezeit, Push nur an Beteiligte |
| Feinschliff frisst Zeit | Design-System ab Tag 1, Feinschliff in eigenen Durchgängen |
| Datenqualität (Duplikate, Geräte je Studio) | Suche vor Anlegen, Aliase, Zusammenführen, Historie pro Gerät |
| Datenschutz (Gewicht, Fotos, Habits) | Row Level Security mit Tests, standardmäßig privat |
| Datenverlust (Free-Tier ohne Backup) | wöchentlicher Export per GitHub Action, Staging für Migrationen |
| Selbstauskunft, Schummeln bei Punkten | freundschaftlich halten, Punkte eher für Konsistenz |

## Entscheidungen und offene Punkte

**Entschieden**

| Datum | Entscheidung |
| --- | --- |
| 20.11.2026 | Version 1 enthält den vollen Umfang, keine künstliche Trennung; Dauer ist zweitrangig |
| 20.11.2026 | Saison 1 wird erst festgelegt, wenn die App steht |
| 20.11.2026 | Kein Halbzeit-Fenster; Korrekturen an Saisonzielen nur durch den Admin |
| 20.11.2026 | Keine festen Trainingspläne, nur eigene Vorlagen und Termine; Planung über Wochen und Monate |
| 20.11.2026 | Kein RIR; Gewichtsstufen pro Gerät; Stagnation ohne aktive Warnung |
| 20.11.2026 | Home Gym ist eine eigene Trainingsart; Fußball, Laufen usw. ebenso |
| 20.11.2026 | Kein Offline-Modus nötig; laufendes Training wird lokal zwischengespeichert |
| 20.11.2026 | Habits pro Person frei definierbar; Vergleich nur über Erfüllungsquote |
| 20.11.2026 | Ernährung (außer Supplements) nicht in Version 1 |
| 20.11.2026 | Punktesystem zum Schluss |
| 20.11.2026 | Datenmodell von Anfang an mehrgruppenfähig; Oberfläche für mehrere Gruppen in späterer Ausbaustufe |
| 20.11.2026 | Persönliche Module (Training, Habits, Körper, Ziele) funktionieren ohne Gruppe und sind samt Datenbank in eine eigene Solo-/Life-App übernehmbar; die soziale Schicht hängt sich nur von außen an. Regeln mit Folgen (Feed, Push, Habit abhaken) laufen in der Datenbank, nicht nur in der Oberfläche |

**Offen (zu zweit klären)**

- [ ] Welche Zielarten sind pro Saison Pflicht (Verhalten, Gewicht, Kraft, Habit)?
- [ ] Dauer und Rhythmus der Saisons (fest, z. B. 2 Monate, oder jedes Mal frei)?
- [ ] Wiegetag: welcher Wochentag, morgens nüchtern?
- [ ] Regeln für das spätere Punktesystem
- [ ] Name der App
- [ ] Mehrere Gruppen: Welche persönlichen Daten (Trainings, Gewicht, Habits) sieht welche Gruppe? Freigabe pro Gruppe und Datenart nötig, spätestens mit dem Modul Körper. Bis dahin: sichtbar für alle, mit denen man eine Gruppe teilt.
