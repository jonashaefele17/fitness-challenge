# Ideenliste

Ideen, die nicht im Konzept stehen oder bewusst auf später verschoben sind. Werden erst eingebaut, wenn sie ins Konzept übernommen wurden.

## Mehrere Gruppen (Oberfläche)

Das Datenmodell ist seit 20.11.2026 mehrgruppenfähig; die Oberfläche fehlt noch.

- [ ] Gruppen-Umschalter (aktiven Gruppenkontext wechseln)
- [ ] Gruppen-Admin-Oberfläche (Mitglieder, Rollen, Gruppe bearbeiten)
- [ ] Super-Admin-Ansicht (alle Gruppen verwalten)
- [ ] Invite-Links pro Gruppe in der UI erzeugen und teilen
- [ ] Personenfarben pro Gruppe eindeutig halten (heute fest pro Person; in einer zweiten Gruppe können Farben doppelt vorkommen)

## Login

- [ ] E-Mail-Code als zweite Anmeldemethode für Leute ohne Google-Konto (braucht eigenen Mailversand/SMTP mit Domain)
- [ ] Datenschutzseite in der App + Google-OAuth-App veröffentlichen (dann ohne Testnutzer-Liste)

## Profil

- [ ] Eigenes Profilbild hochladen statt des Google-Bilds (Ich → Einstellungen; Zuschneiden auf Kreis, klein gespeichert in Supabase Storage, Zugriff nur für die eigenen Gruppen); zusammen mit dem Bild-Upload für Geräte bauen.

## Kalender (Baustein 5 – Planung)

- [ ] Kalender-Abo (ICS-Feed) für alle: geheimer, erneuerbarer Link pro Person (Schlüssel nur als Hash gespeichert), Edge Function ohne Login, Schutz über den Schlüssel. Enthält geplante Termine; optional erledigte Trainings und Ruhetage (pro Person einstellbar). Stabile UIDs pro Termin. Hinweis: Google Kalender aktualisiert Abos nur alle paar Stunden (bis ~24 h), Apple schneller.
- [ ] Optional nur für Jonas: Einweg-Sync App → eigener Google-Unterkalender „Training“ über die Google Calendar API (Modul `calendar-sync`). Haken: Kalender-Zugriff ist ein „sensibler“ Google-Scope; im Testmodus laufen die Tokens nach 7 Tagen ab, Veröffentlichen braucht Google-Prüfung. Erst bauen, wenn das ICS-Abo nicht reicht.
- [ ] Später, nur wenn wirklich nötig: Zwei-Wege-Abgleich mit Google Kalender (Konfliktgefahr).

## Eigene Life-App (eigenes Supabase-Konto)

Grundgedanke: An die eigenen Daten kommt man immer ran, und die persönlichen Module lassen sich notfalls solo in eine Life-App übernehmen (Architekturregeln 13–16 in CLAUDE.md).

- [ ] Zugriff aus der Life-App mit eigenem Login auf diese Datenbank (Zeilenschutz gilt), lesen und schreiben nur über ein paar stabile Views/RPCs als offizielle Schnittstelle, nicht direkt auf Tabellen.
- [ ] Vollständiger Datenexport (JSON) pro Person + Import in die Life-App.
- [ ] MCP-Server, damit Claude Einträge machen kann (nutzt dieselben RPCs).
- [ ] Später ggf. Monorepo mit gemeinsamen Paketen für die persönlichen Module.

## Feed / Habits (zu Baustein 6 besprechen)

- [x] Check-in nicht im Feed – entschieden 23.11.2026: nur Meilensteine und Wochenzusammenfassung (Konzept 1.37)
- [ ] Habit-Challenges: jemand startet eine Challenge mit Regel und Zeitraum (z. B. „30 Tage kein Alkohol“), andere treten bei und bekommen dasselbe Habit, Rangliste der erfüllten Tage, Start/Ende im Feed. Aus Version 1 genommen (23.11.2026) – der Wettbewerb läuft erstmal über Saisons.
- [ ] Kalorien: Tageswert eintippen mit Tagesziel und zusätzlich Wochenziel (Summe pro Woche). Tageswert geht schon mit „Zahl mit Einheit“; die Wochensumme wäre eine neue Ziel-Regel. Erst, wenn klar ist, wie Kalorien getrackt werden (Konzept: Ernährung außer Supplements nicht in Version 1).
- [ ] Externe Quellen für Habits: persönlicher Zugangsschlüssel (Einstellungen), der nur Habit-Einträge schreiben darf; z. B. iPhone-Kurzbefehl schickt abends Schritte/Kalorien aus Apple Health. Datenmodell ist vorbereitet (Quelle pro Eintrag, eine Schreib-Funktion).

## Skalierung (erst bei vielen Nutzern)

Für den Pilot nicht nötig; festgehalten am 23.11.2026 beim Echtzeit-Umbau des Live-Trainings.

- [ ] Feed, Kommentare und Mitteilungen von „Postgres Changes“ auf private Broadcast-Kanäle umstellen (z. B. ein Kanal pro Gruppe, wie beim Live-Training `live:<Sitzung>`). Heute prüft Supabase bei jeder Änderung für jeden verbundenen Zuhörer die Zugriffsregeln – bei 2–5 Leuten egal, bei vielen gleichzeitigen Nutzern eine Last für die Datenbank.
- [ ] Live-Training: Meldungen bündeln – eine hinzugefügte Übung wird zu allen kopiert und löst mehrere Meldungen aus, jedes Handy lädt dann kurz mehrmals nach (harmlos).

## Feinschliff

- [ ] Optional: Einstellung „App-Farbe: Limette / meine Personenfarbe“ (Ich → Einstellungen). Technisch einfach (Akzent-Token zur Laufzeit setzen, Schriftfarbe auf Knöpfen automatisch hell/dunkel, gedrückt/Glas abgeleitet; App-Icon und Ladebildschirm bleiben Limette). Standard bleibt Limette, weil Personenfarben in Gruppenansichten „diese Person“ bedeuten.
- [ ] Sync-Wolke: kleines Wolken-Symbol (z. B. oben rechts), das zeigt, ob alles gespeichert und die Live-Verbindung (Realtime) steht: Haken = synchron, drehend = speichert gerade (offene Änderungen in der Warteschlange), durchgestrichen = keine Verbindung. Antippen stößt einen Abgleich an (alle Daten neu laden, Realtime neu verbinden). Kein Offline-Modus (siehe Konzept-Entscheidung), nur Anzeige und manueller Anstoß.
- [ ] Pillen-Navigation wie iOS 26: beim Runterscrollen zu einer kompakten Pille zusammenschrumpfen (nur Symbole bzw. aktiver Tab), beim Hochscrollen oder Antippen wieder aufklappen; mit Federanimation, „Bewegung reduzieren“ respektieren. Erst mit echtem langem Inhalt (Feed, Kalender) abstimmen.
- [ ] Bundle nach Tabs aufteilen (Code-Splitting), aktuell ~290 kB gzip.
- [x] Sheets wie in modernen iOS-Apps (z. B. Claude-App): Das Sheet öffnet in einer mittleren Höhe. Scrollt man im Inhalt nach oben, wächst das Sheet zuerst bis zur maximalen Höhe, erst danach scrollt der Inhalt. Scrollt man nach unten (Inhalt schon ganz oben), wird das Sheet kleiner bis zum Schließen; ein kräftiger Wisch schließt direkt. Stapelung (hinteres Sheet kleiner/dunkler) bleibt. Umsetzung z. B. mit Vaul (baut auf Radix Dialog auf) oder selbst mit Motion. Vorsicht bei Gesten im Sheet: Zahlenrad, Drag & Drop, seitliche Chips, Tastatur. Jedes Sheet auf dem iPhone durchprobieren. Geplant zusammen mit dem ersten Pilot-Feedback (Jonas, 23.11.2026). → Umgesetzt auf feat/sheets (24.11.2026), eigene Lösung mit Motion statt Vaul.
- [ ] Prüfen, sobald Seiten lang genug zum Scrollen sind: Gleitet die Tab-Linse nach dem Runterscrollen seitlich (Fix `layoutRoot` vom 21.11.2026) statt von unten einzufliegen?

## Training

- [ ] „…“-Menü im Training: Nach einer Aktion (Verlauf, Gerät wählen, Notiz …) zurück ins Menü statt ins Training? Vorerst bleibt es wie bei iOS-Aktionsmenüs (Menü schließt sich).

- [ ] Muskelgruppen-Wochenübersicht („Sätze pro Muskelgruppe diese Woche“) unter Ich → Training bzw. im Wochenrückblick
- [ ] Körper-Grafik (vorne/hinten, Muskeln eingefärbt) wie bei Lyfta – eine Komponente für Übungsdetail und Wochenübersicht
- [ ] Haptik auf dem iPhone: im Web nicht möglich (iOS-Schalter-Trick funktioniert auf iOS 26 nicht); mit nativer App (Capacitor) echte Haptik in `shared/lib/haptics.ts` ergänzen
- [ ] Optional später: Satzpause-Erinnerung per Push (falls doch gewünscht; PWA kann im Hintergrund nicht selbst klingeln)

- [ ] Laufentwicklung (nach hinten gestellt): Lauf-Fokus als Daten wie der Trainingsfokus (Easy Run, Long Run, Tempo, Intervalle …), daraus Pace pro Lauf-Art, km pro Woche, Bestzeiten; unter Ich → Training neben der Kraftentwicklung. Datenmodell offen halten (Distanz, Dauer, Variante sind schon da).
- [x] Habits direkt vergleichen bei gleicher Vorlage und „mit Werten“ – entschieden 23.11.2026, kommt in 6d

- [ ] Trainingsdaten für Claude (Pläne erstellen, Schwächen erkennen), in dieser Reihenfolge:
  1. **Export „Für KI“** unter Ich → Einstellungen: kompakter Textbericht (letzte 8–12 Wochen: Trainings pro Woche, pro Übung Verlauf des besten Satzes, Volumen pro Muskelgruppe, Fokus-Verteilung, Vorlagen) zum Kopieren in Claude. Volle Kontrolle, keine Kosten.
  2. **MCP-Server** (siehe Life-App): Claude fragt die Daten mit dem eigenen Zugang direkt ab (RLS gilt), optional Schreibrecht für Vorlagen/Termine.
  3. Später ggf. **„Analyse“ in der App** über die Claude-API (Kosten pro Nutzung, Daten über unseren Server) – erst wenn 1/2 sich bewährt haben.

- [ ] Animationen/Bilder pro Mobility-Übung im Player (Jonas legt Routinen selbst an und braucht dafür Hilfe bei den Animationen) – zusammen mit dem Bild-Upload.

### Studio-Ketten (zusammen mit dem Bild-Upload bauen)

- [ ] Tabelle `chains` (Name, Logo); Studios bekommen optional eine Kette (`locations.chain_id`). Beim Anlegen eines Studios Kette auswählen oder neu anlegen; Studios ohne Kette (Home Gym, kleines Studio) bleiben möglich.
- [ ] Logo der Kette (selbst hochgeladen über Supabase Storage, nicht im Repo) anzeigen: Ortswahl, Kopf im Training, später Feed-Karte.
- [ ] Studio einrichten: „Geräte von FitX Neuperlach übernehmen?“ – Geräteliste eines anderen Studios derselben Kette als Vorschlag; danach pro Studio frei hinzufügen/entfernen/ausblenden.
- [ ] Vergleichbarkeit in drei Stufen: überall vergleichbar (Typ, z. B. Kurzhanteln) · in der Kette vergleichbar (Standard für Maschinen: gemeinsamer Verlauf, „Vorher“, Mini-Kurve) · eigenes Gerät.
- [ ] Schalter am Gerät „Eigenes Modell“ (anderes Modell als in den anderen Studios der Kette) → eigener Verlauf; jederzeit umschaltbar, da Verlauf berechnet wird. Studios ohne Kette verhalten sich wie „eigenes Gerät“.
- [ ] Einstellungen (Höhe, Rückenlehne …): bei in der Kette vergleichbaren Geräten die eigene Einstellung vom anderen Studio als Vorschlag übernehmen („aus FitX Ostbahnhof“); bei „Eigenes Modell“ leer starten. Gewichtsstufe bleibt pro Gerät überschreibbar.

## Körper

- [ ] Waagen-Abgleich ohne denselben Tag: Der Vorschlag für den Unterschied zweier Waagen zählt auch aufeinanderfolgende Tage (letzter Morgen am einen Ort, erster Morgen am anderen) und erscheint erst ab etwa drei Wechseln („Aus 4 Wechseln: ca. +0,6 kg“). Anlass: Jonas' Waagen stehen 150 km auseinander. Bis dahin: Unterschied von Hand eintragen oder ohne Abgleich nutzen.
- [ ] Bilder zur Messanleitung der Maße (Figur mit markierter Messstelle, aus dem Render-Werkzeug der Katalogbilder); das Feld `image_path` an den Maß-Arten ist vorbereitet.
- [ ] Eigene Kamera-Ansicht für die Zwischenstand-Fotos, bei der das letzte Foto derselben Pose halb durchsichtig über dem Kamerabild liegt. Bewusst nicht in 7d gebaut (Jonas, 27.11.2026): auf dem iPhone der wackligste Teil, und das letzte Foto als Vorlage daneben reicht vorerst. Erst wieder aufgreifen, wenn die Fotos nach ein paar Zwischenständen zu unterschiedlich ausfallen.
- [ ] Punkte in der Gewichtskurve je Waage unterscheidbar, damit Sprünge beim Ortswechsel erklärbar sind.

## Saisons

### Saison-Rückblick (mit dem Saisons-Baustein bauen, berechnet als `season_recap`)

- [ ] Pro Person: Anzahl Trainings, Gesamtvolumen, neue Rekorde, größte Kraftzuwächse (Anfang → Ende der Saison in %), meisttrainierte Muskelgruppen, Lieblingsgerät, längste Serie; später Habits, Gewicht, erreichte Saisonziele.
- [ ] Gruppe: Auszeichnungen wie „Meiste Trainings“, „Größter Kraftzuwachs“, „Meiste Rekorde“, „Volumen-Monster“. Vergleich über Zuwachs in % (fair unabhängig davon, wer absolut stärker ist); dafür ggf. geschätztes 1RM nur intern.
- [ ] Darstellung wie „Wrapped“: Karten zum Durchwischen, am Saisonende per Push, als Bild teilbar.

## KI-Coach (MCP, nur lesen)

Besprochen am 24.11.2026. Ziel: ein Personal Trainer mit Zeit, der alle eigenen Daten kennt – Einschätzung statt Eintragen: Was läuft gut, was schlecht? Wie entwickle ich mich? Welche Muskelgruppe kommt zu kurz, welche Übung sollte ich einbauen, was kann ich verbessern – mit konkreten Vorschlägen.

- [ ] Weg A (empfohlen): eigener MCP-Server als Supabase Edge Function, **nur lesend**, mit den Rechten der Person (RLS: eigene Daten und was andere teilen). Genutzt in der Claude-App als Gespräch – keine API-Kosten, nichts kann verändert werden.
- [ ] Zugang: persönlicher Zugangsschlüssel pro Person (gehasht gespeichert, widerrufbar, nur Lesen) für Claude Code/Desktop; für einen claude.ai-Konnektor wäre OAuth nötig – vorher prüfen, was Supabase dafür anbietet.
- [ ] Werkzeuge (ca. 8): Überblick (Trainingsarten, Studio, Geräte) · Trainings im Zeitraum · Verlauf einer Übung (Lombardi-Schätzung, Volumen) · Bestwerte · Sätze pro Muskelgruppe und Woche · Übungskatalog fürs eigene Studio (mit Muskelgruppen) · Habits-Zusammenfassung (Schlaf, Schritte, Ernährung → Erholung) · Pläne.
- [ ] Neue SQL-Funktion „Sätze pro Muskelgruppe pro Woche“ (deckt sich mit der Muskelgruppen-Wochenübersicht unter Training – bekommt die App gleich mit).
- [ ] Coach-Anleitung im MCP (Prompt/Ressource): wie die Zahlen gemeint sind – Lombardi-Schätzung, Messart pro Übung, Gerätestufen, verzeihende Serien, Quoten.
- [ ] Datenlücken für bessere Ratschläge: eigene Ziele (Ziele-Modul), Körpergewicht/Maße (Körper-Modul), wie schwer sich ein Satz angefühlt hat (RPE/RIR, bisher nicht erfasst); Verletzungen und Vorlieben bleiben Gesprächsstoff.
- [ ] Später Weg B obendrauf: Coach-Kommentar in der App (z. B. montags im Wochenrückblick) über die Claude API – kostet pro Aufruf.
- [ ] Offizieller Supabase-MCP-Server nur für Entwicklung auf Staging (Admin-Zugriff aufs ganze Projekt), nie mit Live-Daten.
