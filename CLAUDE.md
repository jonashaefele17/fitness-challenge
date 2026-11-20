# Fitness-Challenge-App – Projektregeln

Diese Datei gilt für jede Sitzung in diesem Repository. Das fachliche Konzept steht in `docs/konzept.md`. Bei Widerspruch gilt das Konzept. Änderungen am Konzept werden dort im Änderungsprotokoll eingetragen, nicht nur im Code umgesetzt.

## Sprache
- Kommunikation mit Jonas: Deutsch.
- Markdown-Dateien, die Jonas lesen soll (Konzept, Pläne, Ideenliste, Einrichtungs-Anleitungen): hauptsächlich Deutsch.
- Oberfläche (UI-Texte): Deutsch.
- Code, Bezeichner, Kommentare im Code, Commits und die technische Doku (README, Code-Doku, Architektur-Notizen): Englisch.

## Stack
- React + TypeScript (strict) + Vite, als PWA (vite-plugin-pwa)
- Tailwind CSS mit eigenen Design-Tokens, Radix-Primitives für Dialoge, Menüs usw.
- Motion für Animationen, dnd-kit für Drag & Drop
- TanStack Query für alle Serverdaten
- Supabase: Postgres, Auth (Google + Invite-Code), Realtime, Storage, Edge Functions (Push, Cron)
- Vitest für Logik-Tests, eigene Tests für Row Level Security
- Hosting: GitHub Pages über GitHub Actions; zwei Supabase-Projekte (staging, live)
- Paketmanager: npm

## Architektur – nicht verhandelbar
1. **Feature-Ordner** unter `src/features/<name>/` (z. B. training, calendar, feed, comments, habits, goals, seasons, notifications, admin). Jedes Feature hat eigene `api/` (Hooks), `components/`, `types.ts`, `index.ts`. Andere Features importieren nur über `index.ts`.
2. **Gemeinsames** liegt in `src/shared/` (ui-Komponenten, design-tokens, lib, hooks). Kein Feature-Code in `shared`.
3. **Datenschicht:** Komponenten sprechen nie direkt mit Supabase. Zugriff nur über Hooks in `features/<name>/api/` (TanStack Query). Der Supabase-Client liegt in `src/shared/lib/supabase.ts`.
4. **Generische Bausteine:** Kommentare, Reaktionen, Feed-Events und Benachrichtigungen referenzieren Objekte über `target_type` + `target_id` (+ optional Satz-Index). Neue kommentierbare Dinge brauchen keinen Umbau.
5. **Einstellungen als Daten:** Trainingsarten, Habit-Eingabetypen, Habit-Vorlagen, Push-Kategorien, Ziel-Messgrößen stehen in Tabellen, nicht als Konstanten im Code.
6. **Berechnen statt speichern:** Fortschritt, Bestwerte, Streaks, Vergleiche, Rückblicke, Punkte als SQL-Views oder -Funktionen.
7. **Versionierung:** Habit-Definitionen und Ziele haben `valid_from`; alte Einträge werden nach ihrer damaligen Regel bewertet. Archivieren statt löschen.
8. **Datenbank nur über Migrationen** (`supabase/migrations/`), nie per Hand im Dashboard. Nach jeder Migration Typen neu erzeugen (`src/shared/types/database.ts`).
9. **Row Level Security** auf jeder Tabelle. Standard: privat. Jede neue Tabelle bekommt Policies und einen RLS-Test.
10. **Feature-Schalter** für halbfertige Module.
11. **Optimistic UI:** Aktionen wirken sofort in der Oberfläche, gespeichert wird im Hintergrund, mit Rückgängig statt Bestätigungsdialog (außer bei Verwerfen und Absagen).
12. **Mehrgruppen-fähig:** Das Datenmodell unterstützt von Anfang an mehrere Freundesgruppen (Mandanten); die Oberfläche dafür kommt später.
    - `groups` + `group_members` sind die Grundlage; eine Person kann in mehreren Gruppen sein (n:m).
    - Rollen pro Mitgliedschaft in `group_members.role`: `admin` | `member`. Zusätzlich `profiles.is_super_admin` für Jonas (nicht vom Nutzer selbst änderbar).
    - Invites gehören zu einer Gruppe (`invites.group_id`); wer einen Code einlöst, landet in genau dieser Gruppe.
    - Gruppenbezogene Tabellen haben `group_id` (z. B. seasons, feed_events, comments, reactions, appointments, habit_challenges, saisonbezogene goals).
    - Persönliche Daten gehören der Person, nicht der Gruppe (workouts, sets, weigh_ins, habit_entries …). Sichtbarkeit für Gruppen läuft über Freigaben/Policies, nicht über eine `group_id` am Datensatz.
    - Globale Daten ohne `group_id`: Übungskatalog, Studios, Geräte, Trainingsarten, Habit-Vorlagen.
    - RLS prüft Mitgliedschaft nur über zentrale SQL-Hilfsfunktionen (`is_group_member(group_id)`, `is_group_admin(group_id)` …), nie hart auf „die eine Gruppe“. RLS-Tests decken ab: Nutzer aus Gruppe A sieht nichts aus Gruppe B.
    - Frontend: aktiver Gruppenkontext über `useActiveGroup()` (liefert vorerst die erste/einzige Gruppe). Gruppenbezogene Queries nehmen die `group_id` daraus und haben sie im Query-Key; nie hart codiert.

## Design
- Ziel: fühlt sich an wie eine native iPhone-App. Dunkles Design, Akzent Limettengrün `#C8F25A`, Personenfarben fest pro Nutzer.
- Alle Farben, Abstände, Radien, Schriftgrößen und Animationswerte kommen aus den Design-Tokens (`src/shared/design-tokens/`). Keine Hex-Werte oder Magic Numbers in Komponenten.
- Schrift: System-Font-Stack (SF Pro auf Apple-Geräten).
- Tippflächen mindestens 44 px. Safe Areas beachten.
- `prefers-reduced-motion` respektieren.
- Referenz für Abläufe und Layout: Prototyp unter https://claude.ai/artifact/7vZXnQ2NEBQz1bKFdpwDZq (nur Struktur, nicht Pixel).

## Arbeitsweise
- Gebaut wird in der Reihenfolge aus `docs/konzept.md` (Abschnitt „Umsetzungsreihenfolge“). Ein Baustein pro Branch, Merge nach Test auf Staging.
- Vor größeren Änderungen kurz den Plan nennen und auf Jonas' OK warten.
- Neue Ideen, die nicht im Konzept stehen: in `docs/ideen.md` notieren, nicht einfach einbauen.
- Keine Secrets ins Repo. Lokale Werte in `.env.local` (steht in `.gitignore`); `.env.example` pflegen.
- Commits klein und beschreibend (Conventional Commits).
- Vor jedem Commit: `npm run lint`, `npm run typecheck`, `npm test`.

## Grenzen, die bekannt sind
- iPhone-PWA: Push nur bei installierter App; keine Vibration; kein Timer im Hintergrund; Sprung aus Push-Klicks per lokal gemerktem Ziel absichern.
- Supabase Free: keine automatischen Backups (wöchentlicher Export per GitHub Action), Projekte pausieren nach 7 Tagen ohne Aktivität.
