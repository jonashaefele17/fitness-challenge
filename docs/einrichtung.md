# Einrichtung und Betrieb

Alles, was außerhalb des Codes eingerichtet werden muss, und die wichtigsten Abläufe. Technische Details stehen in der [README](../README.md).

## Übersicht der Umgebungen

| Umgebung | Supabase-Projekt | App-Adresse |
| --- | --- | --- |
| Lokal | Docker (`npm run db:start`) | http://localhost:5173 |
| Staging | `gcrgdvhvmxvqlmwlrian` | https://jonashaefele17.github.io/fitness-challenge/ |
| Live | `wslctqiuwyqzgsbwvjmy` | noch offen |

## Einmalige Einrichtung

### Erledigt (20.11.2026)

- [x] Docker Desktop mit WSL 2
- [x] Supabase: zwei Projekte; Google-Provider in beiden aktiv; URL Configuration bei Staging
- [x] Google Cloud: Projekt `fitness-challenge`, Zustimmungsbildschirm im Testmodus, OAuth-Client `supabase`
- [x] GitHub: Pages-Quelle „GitHub Actions“, Environment `staging` (Variablen + `STAGING_DB_URL`), Repo-Secrets `LIVE_DB_URL` und `BACKUP_PASSPHRASE`

### Noch offen

1. **E-Mail-Login in Supabase abschalten** (Staging und Live): Authentication → Sign In / Providers → Email → deaktivieren. Wir nutzen nur Google; so kann sich niemand per E-Mail/Passwort ein Konto anlegen.
2. **Google-Schlüssel für lokal:** `supabase/.env.example` nach `supabase/.env` kopieren und Client-ID und Clientschlüssel eintragen. Die Datei ist in `.gitignore`. Danach `npm run db:stop` und `npm run db:start`.
3. **Bootstrap-Code erzeugen** (siehe unten), bevor der Branch gemergt wird.
4. **Nach dem ersten Deployment:** Settings → Environments → `github-pages` → Deployment branches auf „No restriction“ stellen, damit Feature-Branches vor dem Merge auf Staging getestet werden können.

## Bootstrap-Code (erster Admin)

Die erste Gruppe „Fitness Challenge“ und ein Einmal-Code für dich (Admin + Super-Admin) kommen per Migration in die Datenbank. Im Repo steht nur der Hash des Codes, nie der Code selbst.

```
npm run invite -- bootstrap
```

- Schreibt `supabase/migrations/20261120000100_seed_first_group.sql` und zeigt den Code **einmal** an → sofort in den Passwort-Manager.
- Der Code funktioniert einmal pro Supabase-Projekt (Staging und später Live).
- Den Namen der Gruppe kannst du später ändern.

## Lokal entwickeln

Voraussetzung: Docker Desktop läuft.

```
npm install
npm run db:start          # startet Supabase lokal, spielt Migrationen + seed.sql ein
cp .env.example .env.local  # dann VITE_SUPABASE_PUBLISHABLE_KEY aus der Ausgabe von db:start eintragen
npm run dev               # http://localhost:5173
```

- **Anmelden lokal:** „Mit Google anmelden“ (wenn `supabase/.env` gefüllt ist) oder „Dev-Login (nur lokal)“ mit beliebiger E-Mail. Der Code landet in Mailpit: http://127.0.0.1:54324
- **Lokale Invite-Codes** (aus `supabase/seed.sql`): `DEV-ADMIN` (Admin), `DEV-INVITE` (Mitglied), `DEV-OTHER` (zweite Gruppe zum Testen).
- **Datenbank ansehen:** Supabase Studio unter http://127.0.0.1:54323
- **Alles zurücksetzen:** `npm run db:reset`

### Vor jedem Commit

```
npm run lint
npm run typecheck
npm test
npm run test:rls     # Zugriffsregeln, braucht die lokale Datenbank
```

### Datenbank ändern

1. `npx supabase migration new <name>` legt eine neue Datei in `supabase/migrations/` an.
2. SQL schreiben (Tabelle + RLS-Policies + Test in `supabase/tests/`).
3. `npm run db:reset` und `npm run test:rls`.
4. `npm run db:types` erzeugt die TypeScript-Typen neu.

Nie Tabellen im Supabase-Dashboard anlegen oder ändern – die CI prüft, dass Typen und Migrationen zusammenpassen.

## Auf Staging bringen

- **Automatisch** bei jedem Push auf `main`: Migrationen einspielen → App bauen → GitHub Pages.
- **Feature-Branch testen:** GitHub → Actions → „Deploy staging“ → „Run workflow“ → Branch wählen.
- Hinweis: Migrationen eines Feature-Branches landen dabei schon in der Staging-Datenbank.

## App aufs iPhone

1. In **Safari** https://jonashaefele17.github.io/fitness-challenge/ öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**.
3. App vom Home-Bildschirm öffnen und mit Google anmelden.
4. Beim ersten Mal den Invite-Code eingeben.

Updates kommen automatisch: Nach einem Deployment die App einmal schließen und neu öffnen.

## Jemanden einladen

Solange es keine Admin-Oberfläche gibt:

1. **Google:** Google Cloud → Google Auth Platform → Zielgruppe → „Add users“ → Google-Konto der Person eintragen (nötig, solange die App im Testmodus ist).
2. **Code erzeugen:**
   ```
   npm run invite -- new --label "Max"
   ```
   Optionen: `--admin` (Admin-Rolle), `--uses 3` (mehrfach nutzbar), `--days 30` (Gültigkeit, Standard 14).
3. Die ausgegebene SQL-Zeile im **SQL-Editor des Supabase-Projekts** ausführen (enthält nur den Hash).
4. Den Code der Person schicken.

## Backups

- Jeden Sonntag 03:00 UTC exportiert die Action „Weekly database export“ Staging und Live (Rollen, Schema, Daten), verschlüsselt mit `BACKUP_PASSPHRASE`, 90 Tage aufbewahrt.
- Manuell starten: Actions → „Weekly database export“ → „Run workflow“.
- Herunterladen: im jeweiligen Lauf unten unter „Artifacts“.

### Backup wiederherstellen

```
gpg -d staging-2026-11-22.tar.gz.gpg | tar -xz     # fragt nach BACKUP_PASSPHRASE
psql "<DB-URL des Zielprojekts>" -f roles.sql
psql "<DB-URL des Zielprojekts>" -f schema.sql
psql "<DB-URL des Zielprojekts>" -c "SET session_replication_role = replica" -f data.sql
```

Am besten zuerst in ein leeres Projekt oder lokal einspielen und prüfen.

### Pausieren

Supabase Free pausiert Projekte nach 7 Tagen ohne Aktivität. Ob der wöchentliche Export als Aktivität zählt, ist nicht garantiert. Ein pausiertes Projekt lässt sich im Dashboard mit einem Klick wieder starten.
