# Fitness-Challenge-App – Grundkonzept v1.0

Nov 20, 2026 · @Jonas

Dieses Dokument ist das lebende Grundkonzept der App: Es gilt, bis eine Änderung beschlossen und hier eingetragen ist. Die Architektur ist so angelegt, dass Änderungen am Konzept keinen Umbau der Struktur erzwingen.

## Status und Änderungen

- **Version:** 1.21 (Grundkonzept nach drei Prototyp-Runden, mehrgruppenfähiges Datenmodell, getrennte persönliche und soziale Module)
- **Prototyp:** [Fitness-App Prototyp](https://claude.ai/artifact/7vZXnQ2NEBQz1bKFdpwDZq) (Handy v3 + PC-Dashboard)
- **Regel:** Jede Änderung bekommt eine Zeile im Protokoll und, wenn sie eine Grundsatzfrage betrifft, einen Eintrag unter „Entscheidungen“.

| Datum | Version | Änderung |
| --- | --- | --- |
| 20.11.2026 | 1.0 | Grundkonzept erstellt |
| 20.11.2026 | 1.1 | Datenmodell mehrgruppenfähig (siehe Entscheidungen) |
| 20.11.2026 | 1.2 | Persönliche und soziale Module getrennt (siehe Entscheidungen) |
| 21.11.2026 | 1.3 | Push: Bündeln standardmäßig aus (pro Person einschaltbar, Fenster 3 Min.), Pushes werden sofort ausgelöst |
| 21.11.2026 | 1.5 | Training: Ort pro Trainingsart, vergleichbare Geräte, Varianten, Startkatalog FitX Neuperlach Süd |
| 23.11.2026 | 1.39 | Habit-Challenges aus Version 1 genommen (Wettbewerb über Saisons); 6d = Teilen und Vergleich, Vorlagen veröffentlichen, Wochenzusammenfassung und Meilensteine im Feed; Teilen standardmäßig privat mit Frage beim Anlegen |
| 23.11.2026 | 1.40 | Ein Habit-Katalog (Standard-Vorlagen + geteilte Habits der Gruppe „von X“, übernehmen mit eigenen Zielen, Super-Admin macht daraus Standard); Vergleich als Matrix (Zeile pro Habit, Spalte pro Person, 4-Wochen-Quote) mit Detailvergleich, derselbe auf der Ich-Seite über „Vergleichen mit …“; Feed: Wochenrückblick montags ab 7 Uhr und Meilensteine (7/30/100/365 Tage, 4/12/26/52 Wochen), nur geteilte Habits |
| 24.11.2026 | 1.41 | Sheets wie in iOS-Apps: lange Sheets öffnen auf mittlerer Höhe (60 %), Inhalt hochschieben vergrößert bis voll, runterziehen (Inhalt oben) verkleinert und schließt, kräftiger Wisch schließt; Pillen seitlich, Zahlenrad und Sortier-Griffe behalten ihre Geste; gestapelte Sheets und Sheets mit Eingabeleiste öffnen voll |
| 26.11.2026 | 1.42 | Katalogbilder: Gerätetypen und Übungen bekommen gerenderte 3D-Illustrationen statt eigener Fotos (anatomische Figur, trainierte Muskeln in Akzentfarbe, Nebenmuskeln abgestuft; Geräte vereinfacht nachgebaut); Geräte-Raster zeigt das Gerät allein, die Übung zeigt die Person in der Bewegung; Dateien im öffentlichen Storage-Bucket `catalog`, Pfad in `image_path`; FitX-Katalog ergänzt um Ruderzug, Seithebe-Maschine und drei Übungen; Animationen folgen später |
| 26.11.2026 | 1.43 | Katalog: Laufband und Fahrrad-Ergometer als Gerätetypen mit je einer Übung nach Dauer (im FitX), Hantelbank als eigener Gerätetyp; Bilder für Klimmzugstange, Ringe und Boden / Matte; Rudern in zwei Geräte getrennt (Ruderzug für die Kabelübungen, Rudermaschine nur „Rudern an der Maschine“); versehentlich angelegter Gerätetyp „Bizepscurls am Kabel“ entfernt; Mobility-Bilder nicht in Version 1 (Figur dafür noch zu grob, Neuaufbau in Blender danach) |
| 26.11.2026 | 1.44 | Katalog fürs Home Gym: Übungen für alle großen Muskelgruppen mit Kurzhanteln, Hantelbank, Klimmzugstange, Ringen und Körpergewicht; neu sind Schulterdrücken, Trizepsstrecken über Kopf, Bulgarian Split Squat, Rumänisches Kreuzheben und Wadenheben mit Kurzhanteln, Goblet Squat gibt es auch mit Kurzhanteln; 14 weitere Übungsbilder; die Hantelbank ist doch kein eigener Gerätetyp (Zubehör, ihre Übungen laufen über die Kurzhanteln) |
| 26.11.2026 | 1.45 | Fortschrittsfotos: vor dem Hochladen auf 1600 Pixel an der langen Kante verkleinert (ca. 350 KB statt ca. 200 KB), damit sie auch am PC und beim Hineinzoomen gut aussehen; dazu ein kleines Vorschaubild; höchstens 3 Fotos pro Tag (vorne, Seite, hinten); 1 GB Speicher reicht damit bei 4 Personen rund 4,5 Jahre |
| 27.11.2026 | 1.46 | Körper: Wiegen an jedem Tag möglich, der Wiegetag ist nur noch eine freiwillige Erinnerung pro Person (keine Saisonregel); Kurve mit Durchschnitt über 7 Tage, die Gruppe sieht diesen Durchschnitt statt einzelner Tageswerte; mehrere Waagen pro Person (z. B. Zuhause, Studio) mit Abgleich gegen die Hauptwaage, der Originalwert bleibt gespeichert; kein Waage-Marker im Kalender, das Gewicht steht im Tages-Sheet; Maße (Bauch, Taille, Brust, Hüfte, Oberarm, Oberschenkel, einzeln ausblendbar) und Fortschrittsfotos als gemeinsamer „Zwischenstand“ alle 4 Wochen; Maße und Fotos bleiben in Version 1 privat |
| 27.11.2026 | 1.47 | Körper und Saisons: Rhythmen (wöchentlich wiegen, Zwischenstand alle 4 Wochen) sind persönliche Einstellungen im Körper-Modul und gelten auch ohne Saison; eine Saison kann sie als Regel vorgeben. Kalender-Marker für Wiegetag und Zwischenstand gibt es nur über die Saison, das Körper-Modul selbst setzt keine. Die erste Saison (geplant über 6 Monate, z. B. wöchentlich wiegen, monatlich Maße und Fotos) startet erst, wenn Körper und Saisons gebaut sind und die App auf Live umgezogen ist, damit die Daten dort von Anfang an sauber sind |
| 28.11.2026 | 1.48 | Gewicht in der Gruppe: vier Stufen der Sichtbarkeit pro Person (nur ich / nur % / mit kg als Durchschnitt über 7 Tage / mit Tageswerten), einzustellen unter Ich → Körper statt unter Einstellungen; Feed einmal pro Woche montags statt am Wiegetag; Vergleich als eigener Reiter „Gewicht“ im Gruppe-Tab mit geglätteter Linie pro Person und Tageswerten als blassen Punkten; Uhrzeit des Wiegens wird gespeichert und ist einstellbar; verpasster Wiegetag bleibt auf „Heute“ als „nachholen“ |
| 27.11.2026 | 1.49 | Ziele & Saisons (Baustein 8) festgelegt: Ziele haben Ziel und freiwilliges Mindestziel (Status dreistufig); Pflicht in einer Saison ist nur „Trainings pro Woche“; die Saison verlangt kein geteiltes Gewicht; Regeln „wöchentlich wiegen“ und „Zwischenstand“ zählen in der Konsistenz ohne Werte; Dauer und Setup-Phase legt der Admin pro Saison fest; die Pause aus den Habits gilt auch für Trainingsziel und Saisonregeln; neuer Reiter „Ziele“ unter „Ich“ an erster Stelle mit der laufenden Saison oben, „Einstellungen“ als Zahnrad; Saisonende, Rückblick und Archiv werden während der ersten Saison gebaut. Details in `docs/plan-baustein-8.md` |
| 27.11.2026 | 1.50 | Saisons bekommen Etappen (Standard 4 Wochen, im Takt des Zwischenstands) mit berechnetem Etappenziel, Etappen-Rückblick im Feed und einem Anpassungsfenster von 3 Tagen zu Beginn jeder Etappe, in dem jede Person Ziel und Mindestziel ihrer Saisonziele ändern darf (sichtbar im Feed, gilt ab der neuen Etappe). Das ersetzt die Entscheidung „kein Halbzeit-Fenster“ vom 20.11.2026; außerhalb des Fensters korrigiert weiter nur der Admin. Grund: Über 6 Monate wäre ein unrealistisch gesetztes Ziel sonst monatelang tot |
| 27.11.2026 | 1.51 | Saison-Setup lässt sich nach dem Start nachholen: Saisonziele sind fest, sobald die Saison läuft und die Person bereit ist, nicht mehr für alle am Starttag. Wer das Pflichtziel zum Start schon hat, zählt automatisch als bereit. Das Setup öffnet sich einmal von selbst. Grund: Eine Saison mit Start am selben Tag oder ein verpasstes Setup war eine Sackgasse |
| 27.11.2026 | 1.52 | Habits in der Saison haben keine Prozentquote als Ziel mehr: Das Ziel ist die Regel des Habits selbst, im Setup einstellbar und ab „Bereit“ fest; die Quote ist nur Auswertung. Die Gruppe sieht Name, Regel und Quote. Der Admin gibt eine Regel für 24 Stunden zur Änderung frei, statt sie selbst zu ändern. Die Zielart „Habit-Quote“ entfällt. Mindestziele werden ausdrücklich festgelegt und liegen immer auf der leichteren Seite des Ziels. Umsetzung der Habit-Änderung steht noch aus (siehe Plan Baustein 8) |
| 28.11.2026 | 1.53 | Vergleich neu gefasst: Der Gruppe-Tab hat zwei Reiter (Feed, Vergleich). Im Vergleich wählt man „Was“ (Übersicht, Trainings, Habits, Gewicht, Kraft) und „Zeitraum“; die Saison ist ein Zeitraum (voreingestellt, solange sie läuft), kein eigener Ort. Jede Ansicht zeigt ein Diagramm mit einer Linie pro Person und eine Zeile pro Person. Die Liste aller Ziele aller Personen, der Filter nach Zielart, der Kraftvergleich pro Übung und die Reiter „Ziele“ und „Konsistenz“ entfallen. Grund: am Handy zu unübersichtlich; genaue Auswertungen kommen am PC. Details in `docs/plan-baustein-8.md` (8c) |
| 23.11.2026 | 1.38 | Habit-Auswertung: Übersicht „Diese Woche“ und „Dranbleiben“ (wie im Prototyp), Detail mit drei Kennzahlen in Klartext und Trend; Quoten statt Serien in der Oberfläche, Serien in der Datenbank verzeihend (einmal verpassen unterbricht nicht) |
| 23.11.2026 | 1.37 | Habits (Baustein 6) festgelegt: Ruhetage gestrichen, Pausen mit anteiligem Wochenziel, Supplements als eigenes Checklisten-Habit, Quelle pro Eintrag (Hand/App/extern), Check-in nicht im Feed, gleiche Habits direkt vergleichbar, Aufteilung 6a–6d |
| 23.11.2026 | 1.36 | Kalender-Export: „In Kalender übernehmen“ als `.ics` (einmalige Kopie mit Hinweis), Serie ganz oder nur ein Termin, ohne Erinnerung |
| 23.11.2026 | 1.35 | Gemeinsames Training nach erstem Test: Starten gilt für alle mit Zusage (Info-Push statt Frage), ein Studio für alle (Wechsel gilt für alle), gemeinsame Übungen samt Gerät und Satzstruktur, Beenden jede Person für sich; Glocke in allen Tabs |
| 23.11.2026 | 1.34 | Gemeinsames Live-Training: Start aus einem Termin mit Teilnehmenden, Mitmachen über „Heute mit anderen“ (kein Push), gemeinsame Übungsliste mit „Für alle“-Schalter, Löschen und Sortieren für alle (Übungen mit abgehakten Sätzen bleiben), Sätze der anderen live, „mit …“ im Feed; Reihenfolge in Baustein 5: Live-Training vor .ics-Export |
| 23.11.2026 | 1.33 | Einladungen zu Terminen: Einladung gilt für die ganze Serie, Antwort pro Serie oder pro Termin (Zusage, Vielleicht, Absage, andere Zeit), Vorschlag mit einem Tap übernehmen, „Ich komm mit“ mit Freigabe durch den Besitzer; Änderungen des Besitzers setzen die Antworten zurück |
| 23.11.2026 | 1.32 | Planung: Fokus und mehrere Vorlagen pro Termin (Auswahl beim Start), Serie mit Fokus/Vorlagen pro Wochentag, „Nur diesen Termin ändern“ (Tag, Uhrzeit, Fokus, Vorlagen); im Kalender steht beim geplanten Termin das Fokus-Kürzel |
| 22.11.2026 | 1.31 | Kalender-Zustände: erledigt = gefülltes Icon in der Personenfarbe, geplant = Umriss-Icon leicht verblasst mit Uhrzeit, abgesagt = grau (in der Gruppenansicht mit einem Hauch der Personenfarbe); gefüllte Varianten für alle Trainings-Icons; Mobility-Icon neu als Yoga-„Baum“ (vorher zu nah an Laufen) |
| 22.11.2026 | 1.30 | Planung (5a): Termine als Training oder Event, einmalig oder wöchentlich an gewählten Tagen (optional bis Datum); im Kalender blass mit Uhrzeit, Event mit Stern; Tages-Sheet „+“ = Planen (Zukunft), Nachtragen (Vergangenheit), heute beides; Termin-Detail: Training starten (heute), Bearbeiten (Serie als Ganzes), Absagen (einzelner Termin, grau), Nachholen, Löschen; „Heute geplant“ im Heute-Tab mit „Starten“; die Gruppe sieht die Termine in der Gruppenansicht |
| 21.11.2026 | 1.29 | Bearbeiten: „Fertig“ statt Minimieren-Pfeil; „Änderungen verwerfen“ (mit Rückfrage) setzt das Training auf den Stand vor dem Bearbeiten zurück, Übungen und Sätze behalten ihre Kommentare; wird ein Training, eine Übung, ein Satz oder eine Tageskarte gelöscht, verschwinden auch Kommentare, Reaktionen und Mitteilungen daran |
| 21.11.2026 | 1.28 | Feed (4d): eigene Trainings bearbeiten (derselbe Trainingsbildschirm im Bearbeiten-Modus: Sätze, Übungen, Tag/Uhrzeit/Dauer, Ort, löschen mit Rückfrage) und nachtragen (Tag-Sheet „+“: Art, Uhrzeit, Dauer, optional Vorlage; Übungs-Arten öffnen danach den Bearbeiten-Modus); nachgetragen ist ausdrücklich markiert und benachrichtigt nie; verschobene Trainings wandern auf die Karte ihres neuen Tages |
| 21.11.2026 | 1.27 | Feed: Beitritt als eigene kleine Karte (nicht Teil der Tageskarte); Sortierung als kompakter Umschalter „Neueste | Zuletzt aktiv“ |
| 21.11.2026 | 1.26 | Feed (4c): Glocke und Push springen an die Stelle – Training öffnet sich, Übung im Blick, Satz markiert, Thread mit dem Kommentar offen; Texte nennen das Objekt („hat deinen Satz kommentiert“) |
| 21.11.2026 | 1.25 | Feed (4b): Kommentare und Reaktionen am Training, an jeder Übung und an jedem Satz (Satz = Übung + Satz-Index); Satz antippen öffnet seinen Thread, Sätze mit Kommentaren/Reaktionen sind markiert; gilt in jeder Trainingsansicht (Feed und Kalender) |
| 21.11.2026 | 1.24 | Feed (4a): Tageskarte pro Person, Gruppe und Tag (Trainings per Server-Trigger), Sortierung Neueste/Zuletzt aktiv, Pille „↑ Neue Beiträge“, Leiste „Heute“; nachgetragene Trainings am echten Tag mit „nachgetragen“ und ohne Benachrichtigung; Reaktionen 🔥 💪 👏 😂 😮 ❤️ (Tippen = 🔥, lange drücken = Auswahl, eine pro Person) |
| 21.11.2026 | 1.23 | Trainings der Gruppe lassen sich als eigene Vorlage speichern; „Als Vorlage speichern“ ist eine einklappbare Zeile; Routinen behalten dabei ihre Einstellungen |
| 21.11.2026 | 1.22 | Mobility-Routinen wie ein Mitmach-Video: Ablauf (Übungszeit, Pause, Runden) einmal pro Routine, Übungen per Mehrfachauswahl zusammenklicken und am Griff sortieren; Runden laufen die ganze Liste durch; pro Übung „beidseitig“ mit optionaler Pause zum Seitenwechsel; Übungen bearbeitbar (Name, Ausführung, Muskelgruppen; Animation folgt mit dem Bild-Upload) |
| 21.11.2026 | 1.21 | Eigener Übungskatalog für Mobility; erlaubte Fokusse pro Trainingsart (Mobility: OK, UK, GK); Standard-Trainingsarten als Katalog, jeder blendet aus, was er nicht nutzt; eigene Arten bearbeiten/archivieren |
| 21.11.2026 | 1.20 | Mobility-Player (3f) umgesetzt: geführte Trainingsart, Routinen als Vorlagen mit Pause und beidseitig |
| 21.11.2026 | 1.19 | „Gerät merken?“ in der Zusammenfassung umgesetzt |
| 21.11.2026 | 1.18 | Progression umgesetzt (↑-Vorschlag im Zahlenrad, Zielbereich auf der Karte), neue Bestwerte in der Zusammenfassung; Feed-Karte zum Training bewusst in Baustein 4 (Tageskarten) |
| 21.11.2026 | 1.17 | Vorlagen umgesetzt: Gerätetyp statt Gerät, Wiederholungsbereich pro Übung, Aufwärmsätze, ein Besitzer (andere benutzen/kopieren), Ordnung gegen Chaos, Archiv mit endgültigem Löschen |
| 21.11.2026 | 1.16 | Besondere Tage im Kalender (Saison, Wiegetag, Pause, Ruhetag, eigene Events) als Marker an der Tageszahl; eigene Events als Termin-Art; Ruhetage ohne Einzelklicks (Wochenbewertung, Rhythmus, Zeiträume) |
| 21.11.2026 | 1.15 | Darstellung geplanter Termine und Teilnehmer im Kalender festgelegt (Umriss-Icon, Avatar-Punkt mit Status); Ich-Ansicht in eigener Personenfarbe |
| 21.11.2026 | 1.14 | Kalender: Ich = Monat auf einem Bildschirm, Gruppe = Wochenliste wie iOS-Kalender mit Personenauswahl in einer aufklappenden Pille; Tag als Sheet mit Platz für Planen/Nachtragen; „+“ der Navigation bleibt Starten |
| 21.11.2026 | 1.13 | Trainings-Log als Monatskarte (‹ › und Wischen), Tag antippen zeigt ihn unter der Karte; bei mehreren Trainings am Tag gewinnt das Krafttraining (Icon vorn, Kürzel); Beschriftung leise grau |
| 21.11.2026 | 1.12 | Trainings-Kalender als Trainings-Log: Wochen als Zeilen (neueste oben), jede Zelle zeigt Icon der Trainingsart und Fokus-Kürzel bzw. Distanz; „Gruppe“ macht jede Woche zur Tabelle mit einer Zeile pro Person; Icons als Daten an der Trainingsart, Kürzel am Fokus; Tischtennis als Standardart |
| 21.11.2026 | 1.11 | Navigation nach Fragen getrennt: Training-Tab = Kalender · Vorlagen (was wann), Ich = Training · Habits · Einstellungen (wie entwickle ich mich), Gruppe = Feed · Vergleich; Vergleichbarkeit per Freigabe pro Datenart; „mit jemandem“ markieren schon vor den Einladungen |
| 21.11.2026 | 1.10 | Personenfarbe unter „Ich“ selbst wählbar (nur Farben, die in den eigenen Gruppen frei sind); Farbe 7 und 8 neu (Terrakotta, Senf), weil 7 fast gleich 1 war |
| 21.11.2026 | 1.9 | Übungsverlauf: Freunde zum Vergleich einblendbar (soziales Modul Vergleich) |
| 21.11.2026 | 1.8 | Training: bester Satz nach Lombardi statt Epley (passt zu Double Progression) |
| 21.11.2026 | 1.7 | Training: Übungsverlauf (Kraft- und Volumen-Graph, Rekorde, Trainingsliste); bester Satz wird nach geschätztem 1RM gewertet; eigene Übungszuordnungen entfernbar |
| 21.11.2026 | 1.6 | Training: Gerätetypen (Klassen) mit Übungen, Geräte als Instanzen pro Studio, Übungen pro Gerät ausblendbar, Trainingsfokus (Push, Pull …) als Filter, Schulter in vorne/seitlich/hinten aufgeteilt |
| 21.11.2026 | 1.4 | Training: kein Satzpause-Timer; Messart pro Übung (Gewicht × Wdh., nur Wdh., Dauer); eigene Trainingsarten; Übungskatalog startet leer; Muskelgruppen pro Übung; Mobility-Player als eigene Etappe |

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
| **Training** | Was mache ich wann? Umschalter **Kalender · Vorlagen**. **Ich:** mein Monat auf einem Bildschirm (‹ › und Wischen, „Heute“), 7 volle Spalten, jede Zelle zeigt Datum, Icon der Trainingsart und leises Kürzel (Push, Pull, Beine, OK, UK, GK, Arme bzw. Distanz/Dauer); bei mehreren Trainings gewinnt das Krafttraining. **Gruppe:** die Pille „Gruppe“ klappt auf, Avatare an-/abwählen (gemerkt); sobald jemand gewählt ist, Wochenliste wie im iOS-Kalender (aktuelle Woche oben, nach oben Vergangenheit, nach unten Zukunft), eine Zeile pro Person, läuft hinter der Navigation weiter. **Tag antippen** öffnet ihn als Sheet; dort oben rechts das „+“ zum Planen (Zukunft) bzw. Nachtragen (Vergangenheit), heute beides. Geplante Termine erscheinen als Umriss-Icons in denselben Zellen. Das „+“ der Navigation bleibt immer „Training starten“. |
| **Gruppe** | Avatar-Leiste „Heute“, Feed aus Tageskarten, Reiter „Vergleich“ (Ziele, Konsistenz, Gewicht, Kraft, Dranbleiben), Saison-Archiv kompakt |
| **Ich** | Wie entwickle ich mich? Reiter **Training · Habits · Einstellungen** (später Körper). Training: Ziele oben, dann Kraftentwicklung (meine Übungen → Übungsverlauf), später Laufentwicklung. Habits: Auswertung, Supplements. Einstellungen: Benachrichtigungen, Farbe, Trainingsarten, Heimstudio, Sichtbarkeit pro Datenart, später Studios/Geräte |

- **Start-Button (+):** Trainingsart → Vorlage oder frei → mit wem. Bei Light-Arten (Laufen, Fußball) entfällt Schritt 2.
- **Laufendes Training:** minimierbar als Mini-Leiste über der Navigation, läuft im Hintergrund weiter.
- **Glocke:** in Heute und Gruppe, mit Badge für Ungelesenes.
- **PC:** Dashboard (Kalender aller, Feed-Spalte mit offenem Thread, Gruppe heute, Vergleich), Vorlagen-Editor, Geräte-Katalog, Saison-Archiv, Admin.

## Training

Trainiert wird flexibel: Es gibt keinen vorgegebenen Plan, nur eigene Vorlagen, und jedes Training lässt sich unterwegs verändern.

**Trainingsarten** (als Daten, pro Person wählbar): Studio (z. B. FitX), Home Gym, Mobility, Fußball, Laufen … Studio und Home Gym werden mit Übungen und Sätzen erfasst, die anderen mit Dauer, optional Distanz, Intensität 1–5 und Notiz. Mobility-Routinen laufen geführt ab wie ein Mitmach-Video (umgesetzt): Mobility ist eine Standard-Trainingsart, die als Player läuft; eine Routine ist eine Vorlage dieser Art. Der Ablauf gilt für die ganze Routine (Übungszeit, Pause, Runden; bei mehreren Runden läuft die ganze Liste mehrfach durch), die Übungen werden per Mehrfachauswahl zusammengeklickt und am Griff sortiert; pro Übung nur „beidseitig“ (links, dann rechts) mit optionaler Pause zum Seitenwechsel. Der Player zeigt Übung, Seite, Ausführungs-Hinweis, Countdown-Ring, „Als Nächstes“, schaltet automatisch weiter (Töne in den letzten 5 Sekunden, abschaltbar), hält den Bildschirm an und rechnet mit Uhrzeiten (nach Rückkehr in die App steht er richtig); jede Runde wird als Satz mit Dauer gespeichert. Übungen sind bearbeitbar (Name, Ausführung, Muskelgruppen; wer sie angelegt hat oder der Super-Admin). Animationen/Bilder pro Übung folgen mit dem Bild-Upload auf derselben Übungsseite.

**Geräte und Übungen**

- Übungen sind allgemein (Bankdrücken, Latzug). **Gerätetypen** sind die allgemeine Klasse (Kabelturm, Beinbeuger, Kurzhanteln) mit Bild, Einstellungsfeldern, Standard-Gewichtsstufe, „überall vergleichbar“ und den Übungen, die man daran macht. Ein Startkatalog mit gut 20 Typen ist dabei; neue Typen und Übungen kann jeder ergänzen.
- Ein **Gerät** ist ein Typ in einem Studio (der Kabelturm im FitX Neuperlach Süd): eigener Verlauf, optional eigene Gewichtsstufe. Übungen, die es dort nicht gibt, werden nur an diesem Gerät ausgeblendet („Hier nicht verfügbar“).
- Studio einrichten: einmal die vorhandenen Gerätetypen auswählen (Mehrfachauswahl); danach zeigt das Raster nur diese Geräte.
- Gerätedetails: „Deine Übungen“ (letzte 3 Monate), „Früher gemacht“ (mit „zuletzt vor …“), „Weitere Übungen“ (in der Gruppe häufige zuerst). Hat ein Gerät genau eine Übung, reicht ein Tipp.
- **Trainingsfokus** (als Daten): Push, Pull, Beine, Oberkörper, Unterkörper, Arme, Ganzkörper; eigene aus Muskelgruppen zusammenstellbar. Ein Training kann einen Fokus haben; er filtert die Übungsauswahl nach primären Muskelgruppen („Alle“ zeigt alles). Später auch für Termine und Vorlagen.
- Einstellungen werden pro Person, Gerät und Übung gespeichert (Kabelzug: Trizepsdrücken Höhe 12, Face Pulls Höhe 9).
- Hinzufügen über ein Geräte-Raster mit Bildern; Geräte mit mehreren Übungen öffnen eine Auswahl.
- Der FitX-Katalog hat gerenderte 3D-Illustrationen in einheitlichem Stil (Gerät allein im Raster, Übung mit Person und eingefärbten Muskeln; Werkzeug unter `tools/exercise-renders/`, Modell Z-Anatomy/BodyParts3D, CC BY-SA); andere Studios entstehen nebenbei („Gerät merken?“ nach dem Training).
- „Gerät merken?“ (umgesetzt): Die Zusammenfassung listet Übungen, die in einem Studio ohne Gerät gemacht wurden, mit den Gerätetypen, die diese Übung anbieten; ein Tipp legt das Gerät im Studio an (falls es fehlt) und verknüpft das Training damit.
- Duplikatschutz: Suche vor dem Anlegen, Aliase, Zusammenführen durch den Admin.

**Ablauf im Training**

1. Start aus Termin, Vorlage oder leer.
2. Oben: Übungs-Chips zum Springen; lange drücken und ziehen zum Umsortieren.
3. Pro Übung: Name, Geräteeinstellung, kleine Verlaufskurve der letzten 6 Trainings mit Trend.
4. Sätze: Spalte „vorher“ pro Satz; nur die aktive Zeile hat Stepper (‹ ›, Wischen auf dem Wert, in Gerätestufen); der Haken bestätigt den Satz (kein Satzpause-Timer).
5. Aufwärmsätze („W“) zählen nicht für Volumen, Bestwerte und Vorschläge.
6. Satz nach links wischen = löschen; Übung über „…“ tauschen, Notiz, entfernen – jeweils mit Rückgängig.
7. Unten: ‹ · + Übung (wird hinter der aktiven eingefügt) · Nächste Übung.
8. Menü „…“: Pausieren, Minimieren, Beenden & speichern, Abbrechen & verwerfen (mit Bestätigung).
9. Ende: Zusammenfassung (Dauer, Arbeitssätze, Volumen, Bestwerte), Frage „Vorlage aktualisieren?“, Tageskarte im Feed, Habit „Sport“ hakt sich ab.

**Übungsverlauf:** Pro Übung eine Detailansicht (Antippen der Mini-Kurve, „…“ → Verlauf, ⓘ in der Übungsauswahl): Kraft-Graph (bester Satz pro Training), Volumen-Graph (kg × Wdh. der Arbeitssätze), Rekorde (bester und schwerster Satz, meistes Volumen, meiste Wiederholungen pro Gewicht) und alle Trainings mit Datum, Ort und Sätzen; Zeitraum 3 Monate / 1 Jahr / Alles; bei Maschinen standardmäßig nur dieses Gerät, umschaltbar auf alle. Die Mini-Kurve auf der Karte bleibt ohne Beschriftung. Freunde aus der Gruppe lassen sich in ihrer Personenfarbe dazuschalten (Kraft als Linie, Volumen als Linie über den eigenen Balken), am selben Gerät bzw. bei vergleichbaren Geräten oder „Alle Geräte“; sichtbar ist nur, was die Freigabe erlaubt (soziales Modul Vergleich über einen Steckplatz).

**Progression:** Double Progression (umgesetzt: Wiederholungsbereich aus der Vorlage, bei freien Trainings aus der eigenen letzten Vorlage mit der Übung; ↑ = Gerätestufe des Geräts, sonst 2,5 kg; der Vorschlag steht als Startwert im Zahlenrad, Wiederholungen = unteres Ende des Bereichs; Arbeitssätze übernehmen nie Werte von Aufwärmsätzen). Neue Bestwerte erscheinen in der Zusammenfassung am Trainingsende. Double Progression. Erreicht ein Satz beim letzten Mal das obere Ende des Wiederholungsbereichs, schlägt die App die nächste Gerätestufe vor (↑). Kein RIR, keine aktive Stagnationswarnung – Stagnation zeigt sich ruhig im Verlauf.

**Gemeinsames Training:** Einer startet und lädt ein (Push „beitreten?“), beide haben dieselbe Übungsliste, jeder trägt nur seine eigenen Sätze ein und sieht die des anderen live. Jeder darf Übungen ergänzen. Am Ende hat jeder sein Training, verknüpft als „mit …“.

## Planung, Kalender und Termine

Geplant wird über selbst gebaute Vorlagen und frei gesetzte Termine; ein Ausfall verschiebt nichts und bestraft niemanden.

- **Vorlagen:** eigene Trainings mit Übungen, Ziel-Sätzen und Wiederholungsbereichen; aus einem vergangenen Training speicherbar; Vorlagen anderer lassen sich kopieren.
  - Pro Übung: Gerätetyp (nicht das konkrete Gerät – funktioniert in jedem Studio; fehlt der Typ vor Ort, startet die Übung ohne Gerät mit „Gerät wählen“), Sätze, optionale Aufwärmsätze (vorausgewählt), Wiederholungsbereich (z. B. 8–12) bzw. Zielzeit. Kein Gewicht – das kommt aus dem eigenen Verlauf bzw. der Progression.
  - Eine Vorlage hat genau einen Besitzer, nur er bearbeitet sie. Gruppenmitglieder starten direkt damit (mit eigenen Gewichten) oder „Als eigene kopieren“; „Vorlage aktualisieren?“ fragt am Trainingsende nur den Besitzer, andere bekommen „Als eigene Vorlage speichern?“.
  - Gegen Chaos: zuletzt benutzte zuerst (6 sichtbar, Rest unter „Alle“); beim Start nur Vorlagen der gewählten Trainingsart; beim Speichern Hinweis auf eine Vorlage mit denselben Übungen („diese aktualisieren?“) und Namensvorschlag aus Fokus + Art; 60 Tage unbenutzt → „Lange nicht genutzt“ (eingeklappt); Gruppen-Vorlagen in eigenem, eingeklapptem Bereich und nur, solange ihr Besitzer sie nutzt – einmal benutzt, wandern sie in die eigene Liste.
  - Archivieren statt löschen; im Archiv „Endgültig löschen“ (Trainings bleiben, nur der Verweis fällt weg).
- **Kalender:** Monats- und Wochenansicht, vor und zurück blätterbar; Punkte für erledigt, geplant und „mit jemandem“; „Alle“ blendet die Trainings der anderen ein.
- **Termin:** Datum (beliebig weit voraus), Uhrzeit, Trainingsart, optional Vorlage, Teilnehmer; optional wiederkehrend.
- **Einladung:** Push an die Eingeladenen; Antworten: Zusage, Absage, andere Zeit vorschlagen (Gegenvorschlag mit einem Tap annehmen), vielleicht.
- **Bearbeiten:** Datum, Zeit, Vorlage, Teilnehmer; jede Änderung geht als Push raus, Eingeladene bestätigen neu. Absagen mit Bestätigung.
- **„Ich komm mit“:** auf einen geplanten Termin eines anderen anfragen.
- **Ausfall:** Termin wird grau, „Nachholen“ legt ihn neu an.
- **Eigene Events:** Termin-Art „Event“ ohne Training (z. B. Stadtlauf, Wettkampf, Gruppen-Grillen), für sich oder die Gruppe; gleiche Einladung/Zusage wie Trainings-Termine.
- **Export:** Termin als .ics in den Handykalender.
- Aus einem heutigen Termin startet man direkt das gemeinsame Training.

**Darstellung im Kalender (vorläufig festgelegt):** jede Person in ihrer Personenfarbe, auch man selbst in der Ich-Ansicht. Ein Avatar-Punkt liegt über dem Icon (oben rechts) und braucht keinen eigenen Platz; Raster und Zellengröße ändern sich nicht.

| Zustand | Monatszelle (Ich) |
| --- | --- |
| Erledigt | gefülltes Icon |
| Geplant, allein | Umriss-Icon (leicht transparent) |
| Geplant mit Person, zugesagt | Umriss-Icon + gefüllter Avatar-Punkt der Person |
| Geplant mit Person, offen | Umriss-Icon + Avatar-Punkt als Ring |
| Person hat abgesagt | Punkt verschwindet, Termin bleibt „allein“ |
| Erledigt mit Person | gefülltes Icon + gefüllter Avatar-Punkt |
| Mehrere Personen | ein Punkt + „+1“ |

- **Tages-Sheet:** Zeile mit Uhrzeit, Art, Fokus; rechts die Teilnehmer-Avatare mit Status (✓ zugesagt, ? offen, Uhr = anderer Zeitvorschlag, ✗ abgesagt); antippen öffnet den Termin.
- **Gruppenansicht:** gemeinsamer Termin in beiden Personenzeilen als Umriss-Icon in der jeweiligen Farbe; wer noch nicht zugesagt hat, blasser.

**Besondere Tage im Kalender:** markieren das Datum, nicht die Zelle – der Platz für Trainings (Icon, Kürzel) bleibt frei.

| Art | Quelle | Marker an der Tageszahl | Gilt für |
| --- | --- | --- | --- |
| Saisonende | Saison | Fahne als Ziellinie (hervorgehoben, Ziele fällig) | Gruppe |
| Saisonstart | Saison | Fahne | Gruppe |
| Eigenes Event | Termin-Art „Event“ | kleiner Stern | Gruppe oder Person |
| Wiegetag, Zwischenstand | Saisonregel | Waage | Person |
| Pause (krank, Urlaub) | Saison, als Zeitraum | dünner Strich unter den Tagen | Person |
| Ruhetag | Rhythmus oder einzeln | nur gedämpfte Zahl, kein Symbol | Person |

- Pro Tag höchstens ein Marker, Rangfolge wie in der Tabelle; alles Weitere steht im Tages-Sheet oben unter „Besonderes“ (z. B. „Wiegetag · morgens nüchtern“, „Saisonende · noch 3 Ziele offen“).
- Gruppenansicht: Gruppen-Marker an der Datumszeile der Woche (einmal für alle), persönliche Marker in der Personenzeile.
- „Heute“ zeigt anstehende besondere Tage („Morgen Wiegetag“, „Noch 5 Tage bis Saisonende“).
- Technik: Steckplatz „Tages-Marker“ im Kalender; Saisons, Körper und Planung liefern ihre Marker, wenn sie gebaut werden. Marker werden berechnet, nicht gespeichert (außer eigenen Events).

**Ruhetage – gibt es nicht als eigenes Konzept (entschieden 23.11.2026):**
1. Ein Tag ohne Training ist einfach frei; Sport wird pro Woche bewertet („4× pro Woche“), Streaks und Konsistenz zählen Wochen.
2. Krankheit oder Urlaub einmal als Pause „von – bis“ (Ich → Habits). Tägliche Habits: Pausentage zählen weder dafür noch dagegen und unterbrechen keine Serie. Wochenziele schrumpfen anteilig (4× pro Woche, 3 Tage Pause → 4 × 4/7 aufgerundet = 3×); eine ganze Woche Pause zählt nicht.

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
| Quelle | von Hand (Check-in) · automatisch aus der App (z. B. Sport aus Trainings) · extern (später über einen persönlichen Zugangsschlüssel, z. B. Kurzbefehl); jeder Eintrag merkt sich seine Quelle |
| Ausnahmen | Pausen-Zeiträume (krank, Urlaub) zählen weder dafür noch dagegen; Wochenziele schrumpfen anteilig |
| Fortschritt teilen | privat · nur „erledigt“ · mit Werten |
| Als Vorlage veröffentlichen | ja/nein (landet in der Habit-Bibliothek der Gruppe) |

**Beispiele aus Jonas' Säulen:** Schlaf = Uhrzeit-Paar, Ziel „≥ 7 h und Bett vor 23:15“, morgens · Screen-Time = Dauer, „≤ 2 h“, abends · Ernährung = Auswahl gehalten/teilweise/nicht · Supplements = eigenes Habit als Checkliste mit eigener Erinnerungszeit pro Eintrag · Sport = automatisch aus Trainings, x-mal pro Woche.

**Check-in:** Auf „Heute“ eine Zeile Kacheln mit Status; ein Tap startet den Check-in mit einer Frage pro Bildschirm, automatisch aus den eigenen Habits gebaut und nach Zeitpunkt sortiert. Ziel: unter 20 Sekunden.

**Auswertung (privat, unter Ich → Habits):** passend zum Eingabetyp – Heatmap (Ja/Nein), Linie mit Zielband (Zahl, Dauer), Rhythmus-Grafik (Uhrzeiten), Erfüllungsquote (Checkliste); dazu ein persönlicher Wochenrückblick.

**Einrichten und ändern:** aus einer Vorlagen-Bibliothek wählen oder selbst anlegen (empfohlen 3–7). Änderungen gelten ab dem Tag (versioniert), alte Tage bleiben nach alter Regel bewertet; nicht mehr genutzte Habits werden archiviert, nicht gelöscht.

**Gruppe:** verglichen wird die Erfüllungsquote; nutzen zwei dieselbe Vorlage (z. B. Schritte) und teilen „mit Werten“, auch die Werte direkt. Der tägliche Check-in erscheint nicht im Feed, nur Meilensteine (z. B. „30 Tage am Stück“) und eine Wochenzusammenfassung. Gemeinsame Habit-Challenges sind nicht Teil von Version 1 (der Wettbewerb läuft über Saisons und ihre Ziele); siehe Ideenliste.

**Umsetzung in Teilen:** 6a Baukasten, Vorlagen, Versionierung, Sport automatisch, Pausen, Check-in · 6b Auswertung · 6c Erinnerungen (Check-in, Supplements) · 6d Gruppe (6d-1 Teilen und Vergleich inkl. gleiche Habits direkt · 6d-2 Vorlagen veröffentlichen · 6d-3 Wochenzusammenfassung und Meilensteine im Feed). Teilen ist standardmäßig privat; beim Anlegen fragt die App, ob die Gruppe es sehen soll.

## Ziele, Saisons und Vergleich

Eine Saison ist nur ein Rahmen aus Zeitraum, Teilnehmern und Zielen; Trainings, Gewicht und Habit-Einträge laufen über alle Saisons durch und werden nie zurückgesetzt.

**Ziele (generisch):** Messgröße (Trainings pro Woche, Körpergewicht, Bestwert an einer Übung, Habit-Erfüllung …), Startwert, Zielwert, Zeitraum, Sichtbarkeit, Status. Der Fortschritt wird immer aus den Daten berechnet. Neue Messgrößen kommen ohne Umbau dazu. Welche Zielarten Pflicht sind, ist offen.

**Ablauf einer Saison**

1. **Anlegen:** Admin legt Name, Zeitraum, Setup-Phase, Teilnehmer und Regeln fest (Wiegetag, Pflicht-Zielarten); alle bekommen eine Push.
2. **Setup-Phase:** jeder wählt Habits, setzt Ziele und Sichtbarkeit; Ziele der anderen sind sichtbar und kommentierbar.
3. **Startwerte automatisch (oder manuell wählbar zB bei Gewicht)****:** Gewicht = Durchschnitt der ersten Wiegetage um den Start; Kraft = bester Satz der letzten 4 Wochen, ohne Historie 2 Wochen Messphase.
4. **Start:** Ziele werden festgeschrieben, Feed-Karte „Saison gestartet“.
5. **Laufend:** Saisonziele bleiben innerhalb einer Etappe fest; zu Beginn jeder Etappe (Standard alle 4 Wochen) gibt es ein Anpassungsfenster von 3 Tagen für Ziel und Mindestziel, sichtbar im Feed. Außerhalb davon Korrekturen nur durch den Admin und sichtbar im Feed. Habits sind versioniert änderbar. Private Zusatzziele jederzeit, sie zählen nicht im Vergleich. Pausentage bei Krankheit oder Urlaub zählen weder für noch gegen die Konsistenz. Später Einstieg mit eigenem Startdatum.
6. **Ende:** Schluss-Wiegung mit 2–3 Tagen Spielraum, Stand wird eingefroren, Saison-Rückblick pro Person und Gruppe als Feed-Karte.
7. **Übergang:** Rückschau pro Ziel (verlängern / steigern / beenden) und pro Habit (behalten / anpassen / archivieren) wird zum Entwurf der nächsten Saison; optional Off-Season ohne Wettbewerb.

**Vergleich (Reiter in Gruppe, neben dem Feed)**

Am Handy eine Übersicht, wie es bei einem selbst und bei den anderen läuft; genaue Auswertungen am PC. Die Saison ist ein Zeitraum, kein eigener Ort: Auswahl „Was“ (Übersicht, Trainings, Habits, Gewicht, Kraft) und „Zeitraum“ (Saison, 4 Wochen, 3 Monate, 1 Jahr; die laufende Saison ist voreingestellt). Jede Ansicht zeigt ein Diagramm mit einer Linie pro Person und darunter eine Zeile pro Person. Feste Reihenfolge, keine Rangliste.

- **Übersicht (Saison):** Zielfortschritt als eine Linie pro Person (Durchschnitt über die Saisonziele mit Start und Ziel, 0–100 %, gegen die Soll-Linie); pro Person Wochenziel „in x von y Wochen“, ein Punkt je Saisonziel (erreicht / auf Kurs / hinter Plan), Habit-Quote, Saisonregeln (gewogen, Zwischenstand). Die einzelnen Ziele einer Person stehen in ihrem Detail, nicht in einer Tabelle für alle.
- **Trainings:** aufsummierte Trainingstage im Zeitraum.
- **Habits:** Quote pro Woche (in der Saison über die Saison-Habits, sonst über geteilte Habits); darunter die Matrix mit Detailvergleich.
- **Gewicht:** Veränderung in % seit Beginn des Zeitraums; Sichtbarkeit pro Person (nichts, nur %, kg als Durchschnitt über 7 Tage, mit Tageswerten).
- **Kraft (Saison):** durchschnittliche Steigerung in % über die eigenen Kraftziele. Der Vergleich an derselben Übung bleibt im Übungsverlauf („Vergleichen mit …“), direkt vergleichbar nur am selben Gerät im selben Studio.
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

**Grenzen und Kosten:** Supabase Free reicht laut Abschätzung für Jahre (1 GB Dateien, 500 MB Datenbank; Fotos vor dem Hochladen auf 1600 Pixel an der langen Kante verkleinert, ca. 350 KB). PWA-Grenzen auf dem iPhone: Push nur bei installierter App, keine Vibration, kein Timer im Hintergrund.

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
| Orte & Katalog | locations, device\_types, device\_type\_exercises, devices, device\_hidden\_exercises, exercises, exercise\_aliases, training\_focuses | Gerät = Typ im Studio; Stufe am Typ, am Gerät überschreibbar |
| Einstellungen | user\_device\_settings | pro Person, Gerät, Übung |
| Training | training\_types, templates, template\_items, workouts, workout\_participants, workout\_items, sets | Satz: kg, Wdh., Aufwärm-Flag, erledigt |
| Planung | appointments, appointment\_invites, rest\_days | Status, Gegenvorschlag |
| Social | feed\_events, comments, reactions, mentions, read\_markers | Ziel = Objekttyp + ID (+ Satz-Index) |
| Benachrichtigungen | notifications, notification\_prefs, push\_subscriptions | Kategorien, Bündeln, Ruhezeit |
| Habits | habit\_definitions, habit\_versions, habit\_entries, habit\_templates | Eingabetyp, Regel, gültig ab |
| Ziele & Saisons | seasons, season\_members, goals, goal\_metrics, pauses | Startwert, Zielwert, Status, Admin-Korrektur |
| Körper | scales, weigh\_ins, body\_measurement\_kinds, body\_measurements, progress\_photos, body\_settings | Fotos privat in Storage |
| Berechnet (Views) | personal\_bests, streaks, goal\_progress, comparison, season\_recap | nie gespeichert |

Namen und Felder sind ein Entwurf; das genaue Schema entsteht als erste Migration.

## Umsetzungsreihenfolge innerhalb von Version 1

Version 1 enthält alles in diesem Dokument und geht erst live, wenn sie steht; die Reihenfolge unten ist nur die Bauabfolge, damit jeder Schritt auf dem vorherigen aufsetzt und keine Umwege nötig sind.

1. **Fundament:** Repo, CI, Staging/Live, Design-System (Tokens + Basiskomponenten), Pillen-Navigation, Login + Invite, Profile, Zugriffsregeln + Tests, Backups.
2. **Generische Kerne:** Objekt-Referenzen, Kommentare, Reaktionen, Feed-Events, Benachrichtigungs-Engine mit Push.
3. **Training:** Katalog (Orte, Geräte, Übungen, Stufen, Einstellungen), Trainingsarten, Vorlagen, Trainingsablauf, Light-Eintrag, Progression, Zusammenfassung.
4. **Feed:** Tageskarten, Detail, Kommentare bis Satzebene, Glocke, Sprung an die Stelle.
5. **Planung:** Kalender, Termine, Einladungen mit Gegenvorschlag, „Ich komm mit“, gemeinsames Live-Training, .ics.
6. **Habits:** Baukasten, Vorlagen-Bibliothek, Check-in, Auswertung, Supplements, Teilen und Vergleich, Veröffentlichen, Wochenzusammenfassung im Feed.
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
| 21.11.2026 | Kein Satzpause-Timer im Training |
| 21.11.2026 | Messart hängt an der Übung (Gewicht × Wdh., nur Wdh., Dauer), nicht an der Trainingsart; Trainingsarten sind „mit Übungen“ oder „nur Dauer (± Distanz)“ und pro Person frei anlegbar. Vorgegeben: Studio, Home Gym, Laufen, Fußball |
| 21.11.2026 | Übungskatalog startet leer und wächst nur aus tatsächlich gemachten Übungen (Suche vor Anlegen, Aliase); Übungen haben Muskelgruppen und ein Bild (PNG/WebP mit Transparenz) |
| 21.11.2026 | Mobility-Routinen als geführter Player (Übung, Bild, Countdown, automatisches Weiterschalten) in eigener Etappe nach dem Trainingskern |
| 21.11.2026 | Ort kommt aus der Trainingsart: Studio → Heimstudio, Home Gym → eigener privater Ort, Laufen/Fußball → kein Ort; ändern nur bei Bedarf über „…“ im Training |
| 21.11.2026 | Geräte sind Maschinen (Verlauf nur am selben Gerät) oder „überall vergleichbar“ (Kurzhanteln, Bank, Klimmzugstange: ein Verlauf über alle Orte) |
| 21.11.2026 | Trainingsarten können Varianten haben (Laufen: Outdoor/Laufband, Radfahren: Outdoor/Indoor); Radfahren ist Standardart |
| 21.11.2026 | Gerätetypen als globale Klasse mit Übungen; Geräte sind Instanzen pro Studio mit eigenem Verlauf; fehlende Übungen werden pro Gerät ausgeblendet statt gelöscht (skaliert auf mehrere Studios ohne Doppelpflege) |
| 21.11.2026 | Übungen gehören zu einem Katalog (Kraft oder Mobility), jede Trainingsart nutzt einen davon; Fokusse sind pro Trainingsart einschränkbar (als Daten). Standard-Trainingsarten sind ein Katalog: jeder schaltet unter Ich → Einstellungen aus, was er nicht nutzt |
| 21.11.2026 | Ruhetage muss man nicht eintragen: Sport wird pro Woche bewertet; wer feste Ruhetage hat, stellt einmal einen Rhythmus ein; Krankheit/Urlaub als Zeitraum. Besondere Tage markieren nur die Tageszahl (höchstens ein Marker), Details im Tages-Sheet |
| 21.11.2026 | Planen und Nachtragen gehören an den Tag (Sheet mit „+“), nicht an das „+“ der Navigation; ein Knopf mit wechselnder Bedeutung ist nicht vorhersagbar. Gruppenansicht gleich in der endgültigen Form (iOS-Kalender mit Zukunft), keine Zwischenlösung |
| 21.11.2026 | Kalender als Trainings-Log statt Punkte-Kalender: Was wann trainiert wurde, steht direkt in der Zelle (Icon + Kürzel), kein Monat/Woche-Umschalter und keine Liste daneben; mit Gruppe eine Zeile pro Person. Grund: Punkte zeigen nur „dass“, nicht „was“; nur ein Umschalter pro Bildschirm |
| 21.11.2026 | Navigation nach Fragen: Training-Tab „was wann“ (Kalender, Vorlagen), Ich „wie entwickle ich mich“ (Training · Habits · Einstellungen), Gruppe „wie stehen wir zueinander“ (Feed, Vergleich). Vergleichbar ist alles, was jemand pro Datenart (Training, Habits, Körper) freigibt; Vergleich in den eigenen Ansichten („Vergleichen mit“) und als Übersicht in Gruppe → Vergleich |
| 21.11.2026 | „Bester Satz“ wird nach geschätztem 1RM gewertet (Lombardi: kg × Wdh.^0,1, immer dieselbe Formel), damit mehr Wiederholungen bei gleichem Gewicht als Fortschritt zählen, das Gewicht aber mehr (72,5 × 6 vor 70 × 8; beim Gewichtssprung der Double Progression höchstens eine kleine Delle; Epley verworfen, weil die Linie dort bei jedem Sprung deutlich fällt); angezeigt wird immer der echte Satz, nie die geschätzte Zahl. Kraft und Volumen sind getrennte Graphen (keine zwei Achsen) |
| 21.11.2026 | Trainingsfokus als Daten (Muskelgruppen-Menge), optional am Training; Übungen passen über ihre primären Muskelgruppen. Schulter aufgeteilt in vordere, seitliche, hintere |
| 21.11.2026 | Nachgetragen = mehr als 3 Stunden nach Trainingsende eingetragen: die Karte steht am echten Tag mit „nachgetragen“, es gibt keinen Push und keinen Glocken-Eintrag; Kommentare und Reaktionen darauf benachrichtigen normal |
| 21.11.2026 | Jedes abgeschlossene Training erscheint automatisch im Feed (kein Ausblenden pro Training) |
| 21.11.2026 | Reaktionen als feste Auswahl wie bei iMessage (Daten in reaction_kinds), eine Reaktion pro Person und Stelle |
| 21.11.2026 | Bearbeiten speichert sofort (wie live); „Änderungen verwerfen“ ist die erlaubte Ausnahme mit Rückfrage. Kommentare und Reaktionen werden mit ihrem Objekt gelöscht, nichts zeigt ins Leere |
| 22.11.2026 | Termine (Baustein 5): wiederkehrende Termine gehören zu Version 1; auch allein geplante Termine sieht die Gruppe (Grundlage für „Ich komm mit“) |
| 22.11.2026 | Gemeinsames Live-Training: kein Push „beitreten?“ beim Trainingsstart (man ist dann schon im Studio). Beitreten über den Termin bzw. selbst aktiv |
| 23.11.2026 | Habits: keine Ruhetage; Sport als Wochenziel aus Trainings; Krankheit/Urlaub als Pause (tägliche Habits zählen nicht, Wochenziele anteilig) |
| 23.11.2026 | Habits: Check-in nicht im Feed, nur Meilensteine und Wochenzusammenfassung; gleiche Habits (gleiche Vorlage, „mit Werten“) direkt vergleichbar |
| 23.11.2026 | Habit-Einträge haben eine Quelle (von Hand, aus der App, extern); externe Quellen später über einen persönlichen Zugangsschlüssel |
| 27.11.2026 | Körper: Wiegen an beliebigen Tagen statt nur am Wiegetag; Kurve und Gruppe zeigen den Durchschnitt über 7 Tage. Mehrere Waagen pro Person mit Abgleich gegen eine Hauptwaage. Maße und Fotos als „Zwischenstand“ alle 4 Wochen. Grund: Jonas wiegt sich öfter und auf zwei Waagen; Fotos und Maße ändern sich nur langsam |
| 27.11.2026 | Rhythmen für den Körper (z. B. wöchentlich wiegen, alle 4 Wochen Maße und Fotos) sind eine allgemeine, persönliche Funktion; eine Saison gibt sie nur als Regel für ihre Teilnehmer vor und zeigt sie im Kalender. Grund: Die App soll nach einer Saison weiter nutzbar sein |

**Offen (zu zweit klären)**

- [ ] Gemeinsames Live-Training (5d): gemeinsame Übungsliste, aber auch eigene Übungen nur für sich hinzufügen können – Mechanismus vor 5d festlegen.
- [x] Pflicht pro Saison ist nur „Trainings pro Woche“; alle anderen Ziele wählt jede Person selbst (27.11.2026)
- [x] Dauer und Setup-Phase legt der Admin pro Saison frei fest (27.11.2026)
- [x] Wiegetag: jede Person stellt ihn selbst ein, nur als freiwillige Erinnerung; „morgens nüchtern“ ist ein Hinweis, keine Pflicht (27.11.2026)
- [x] Körper: Kalender-Marker für Wiegetag und Zwischenstand kommen erst mit den Saisons (27.11.2026)
- [ ] Regeln für das spätere Punktesystem
- [ ] Name der App
- [ ] Mehrere Gruppen: Welche persönlichen Daten (Trainings, Gewicht, Habits) sieht welche Gruppe? Freigabe pro Gruppe und Datenart nötig, spätestens mit dem Modul Körper. Bis dahin: sichtbar für alle, mit denen man eine Gruppe teilt.
