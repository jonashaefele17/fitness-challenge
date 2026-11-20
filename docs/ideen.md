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

## Feinschliff

- [ ] Pillen-Navigation wie iOS 26: beim Runterscrollen zu einer kompakten Pille zusammenschrumpfen (nur Symbole bzw. aktiver Tab), beim Hochscrollen oder Antippen wieder aufklappen; mit Federanimation, „Bewegung reduzieren“ respektieren. Erst mit echtem langem Inhalt (Feed, Kalender) abstimmen.
- [ ] Bundle nach Tabs aufteilen (Code-Splitting), aktuell ~290 kB gzip.
- [ ] Prüfen, sobald Seiten lang genug zum Scrollen sind: Gleitet die Tab-Linse nach dem Runterscrollen seitlich (Fix `layoutRoot` vom 21.11.2026) statt von unten einzufliegen?
