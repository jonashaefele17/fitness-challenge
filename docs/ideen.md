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

- [ ] Check-in nicht automatisch in den Feed: Muss der tägliche Check-in überhaupt auf der Tageskarte erscheinen, oder nur Trainings, Wiegetag und Meilensteine? Offen, wenn Baustein 6 (Habits) dran ist, gemeinsam entscheiden.

## Feinschliff

- [ ] Optional: Einstellung „App-Farbe: Limette / meine Personenfarbe“ (Ich → Einstellungen). Technisch einfach (Akzent-Token zur Laufzeit setzen, Schriftfarbe auf Knöpfen automatisch hell/dunkel, gedrückt/Glas abgeleitet; App-Icon und Ladebildschirm bleiben Limette). Standard bleibt Limette, weil Personenfarben in Gruppenansichten „diese Person“ bedeuten.
- [ ] Sync-Wolke: kleines Wolken-Symbol (z. B. oben rechts), das zeigt, ob alles gespeichert und die Live-Verbindung (Realtime) steht: Haken = synchron, drehend = speichert gerade (offene Änderungen in der Warteschlange), durchgestrichen = keine Verbindung. Antippen stößt einen Abgleich an (alle Daten neu laden, Realtime neu verbinden). Kein Offline-Modus (siehe Konzept-Entscheidung), nur Anzeige und manueller Anstoß.
- [ ] Pillen-Navigation wie iOS 26: beim Runterscrollen zu einer kompakten Pille zusammenschrumpfen (nur Symbole bzw. aktiver Tab), beim Hochscrollen oder Antippen wieder aufklappen; mit Federanimation, „Bewegung reduzieren“ respektieren. Erst mit echtem langem Inhalt (Feed, Kalender) abstimmen.
- [ ] Bundle nach Tabs aufteilen (Code-Splitting), aktuell ~290 kB gzip.
- [ ] Prüfen, sobald Seiten lang genug zum Scrollen sind: Gleitet die Tab-Linse nach dem Runterscrollen seitlich (Fix `layoutRoot` vom 21.11.2026) statt von unten einzufliegen?

## Training

- [ ] Muskelgruppen-Wochenübersicht („Sätze pro Muskelgruppe diese Woche“) unter Ich → Training bzw. im Wochenrückblick
- [ ] Körper-Grafik (vorne/hinten, Muskeln eingefärbt) wie bei Lyfta – eine Komponente für Übungsdetail und Wochenübersicht
- [ ] Haptik auf dem iPhone: im Web nicht möglich (iOS-Schalter-Trick funktioniert auf iOS 26 nicht); mit nativer App (Capacitor) echte Haptik in `shared/lib/haptics.ts` ergänzen
- [ ] Optional später: Satzpause-Erinnerung per Push (falls doch gewünscht; PWA kann im Hintergrund nicht selbst klingeln)

- [ ] Laufentwicklung (nach hinten gestellt): Lauf-Fokus als Daten wie der Trainingsfokus (Easy Run, Long Run, Tempo, Intervalle …), daraus Pace pro Lauf-Art, km pro Woche, Bestzeiten; unter Ich → Training neben der Kraftentwicklung. Datenmodell offen halten (Distanz, Dauer, Variante sind schon da).
- [ ] Habits direkt vergleichen (nicht nur Erfüllungsquote), wenn beide dieselbe Vorlage nutzen und „mit Werten“ teilen (z. B. Schritte) – zu Baustein 6 klären.

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

## Saisons

### Saison-Rückblick (mit dem Saisons-Baustein bauen, berechnet als `season_recap`)

- [ ] Pro Person: Anzahl Trainings, Gesamtvolumen, neue Rekorde, größte Kraftzuwächse (Anfang → Ende der Saison in %), meisttrainierte Muskelgruppen, Lieblingsgerät, längste Serie; später Habits, Gewicht, erreichte Saisonziele.
- [ ] Gruppe: Auszeichnungen wie „Meiste Trainings“, „Größter Kraftzuwachs“, „Meiste Rekorde“, „Volumen-Monster“. Vergleich über Zuwachs in % (fair unabhängig davon, wer absolut stärker ist); dafür ggf. geschätztes 1RM nur intern.
- [ ] Darstellung wie „Wrapped“: Karten zum Durchwischen, am Saisonende per Push, als Bild teilbar.
