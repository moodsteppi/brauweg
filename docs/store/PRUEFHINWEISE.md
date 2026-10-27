# Hinweise für die Prüfer (App Review Information)

App Store Connect → Version → *App-Review-Informationen*. Für Google Play
dieselben Angaben unter *App-Inhalte → App-Zugriff* („Alle oder einige
Funktionen sind eingeschränkt" → Anmeldedaten angeben). Die Hinweise sind
**englisch**, weil beide Prüfteams englisch lesen; die App selbst ist
deutsch.

**Kein Passwort in dieses Repository.** Zugangsdaten stehen nur im
Passwortmanager und in den Store-Formularen.

---

## Das Prüfkonto anlegen (Robin, einmal vor der ersten Einreichung)

1. In der **Produktion** (www.brauweg-spielen.de oder die App) ein Konto mit
   einer Adresse anlegen, die jemand von uns liest, z. B.
   `<PRUEFKONTO-ADRESSE>` — bestätigen über den Link in der Mail.
   Geburtsdatum: ein Tag, der das Konto volljährig macht.
2. Die Adresse in Railway (Produktion) zu `STAFF_EMAILS` hinzufügen und neu
   deployen. Dann ist es ein **Testkonto**: Es besitzt alles, was man haben
   kann (`isStaff`, `packages/server/src/db/schema.ts` beim Feld `isStaff`) —
   die Prüfer sehen jedes Kartenblatt und jedes Themenpaket, ohne dass
   irgendwo eine Kaufhürde steht. **Nebenwirkung:** Meldungen gehen per Mail
   auch an diese Adresse (`melden-routen.ts`) — sie muss also gelesen werden.
3. Passwort (mind. 12 Zeichen) in den Passwortmanager, dann in beide
   Formulare. Der Einladungscode ist seit der Öffnung **nicht** mehr nötig
   (`registerSchema` in `packages/server/src/http/app.ts`).
4. Nach jeder Einreichung einmal anmelden und prüfen, dass das Konto noch
   geht — ein gesperrtes oder gelöschtes Prüfkonto ist ein sicherer
   Ablehnungsgrund (Apple 2.1).

| Feld | Wert |
| --- | --- |
| Anmeldung erforderlich | Ja (oder „Ohne Konto spielen", siehe unten) |
| Benutzername | `<PRUEFKONTO-ADRESSE>` |
| Passwort | `<AUS DEM PASSWORTMANAGER>` |
| Kontakt (Apple) | **Tom** (Kontoinhaber): Tom Justus Tiedtke, 0175 8508411, tom@broweg.de |

---

## Notes (zum Einfügen)

Stand 27.10.2026, belegt am Code auf staging `7599bdd` (nach #330). Wege und
Beschriftungen sind wörtlich aus dem Client; vor dem Einreichen einmal in
TestFlight nachklicken.

```text
Thank you for reviewing Brauweg.

SIGN-IN
Use the demo account above ("Mit E-Mail weiter"). Alternatively tap "Ohne Konto spielen" (play without an account) on the sign-in screen, enter any display name and tap "Spielen" – a guest account is created, no e-mail needed. Sign in with Apple is the black tile with the Apple logo on the same screen; on first use we only ask for the date of birth. The app needs an internet connection; it talks to our own server at www.brauweg-spielen.de.

The app is in German. Tabs at the bottom: Profil, Spiele, Start, Sammlung, Clan. Version 1.0 contains the card games Doppelkopf and Skat, the board games Farbduell and BroChess, and three solo games: "Doppelkopf lernen" (a tutorial), Browort (word of the day) and Kartenmanufaktur (a small building game). There are no in-app purchases and no ads.

PLAYING WITHOUT OTHER PEOPLE
Every game can be played alone against bots:
- Doppelkopf: tab "Spiele" > "Kartenspiele" > Doppelkopf > "Zum Spiel" > "Tisch erstellen". Choose "Privat" under "Für wen" so nobody else joins, then "Tisch erstellen". At the table tap "+ Bot" on each free seat; the game starts when all four seats are filled. Shortcut: "Doppelkopf lernen" > "Übungsrunde spielen" starts a round against three bots.
- Skat: same way (Skat is always played by three; "3 Spieler" is preselected). Fill both free seats with "+ Bot".
- Farbduell: tab "Spiele" > "Denken" > Farbduell > "Zum Spiel" > "Gegen Bot spielen".
- BroChess: tab "Spiele" > "Denken" > BroChess > "Zum Spiel" > "Gegen Bot spielen" > "Partie starten".
- Browort and Kartenmanufaktur: cards on the "Start" tab, or tab "Spiele" > section "Allein".

COMING SOON
Under "Spiele" > "Kommt bald" we list card games we are working on. They cannot be started; players can vote for them ("Dafür"). Nothing there is sold or unlocked.

CLANS
Tab "Clan": search and join a clan or tap "Clan gründen". Inside a clan there is "Clanwort", a daily word puzzle: one member picks a word from our server's word list, everybody else guesses. There is no chat in clans in the app.

REPORT AND BLOCK
Tap a player's name at a Doppelkopf, Skat or BroChess table (or find them via "Profil" > "Freunde" > "Spieler suchen…") to open their profile. At the very bottom: "Melden oder blockieren". The sheet offers "Blockieren" and reporting with a reason. Reports reach our moderation by e-mail and are reviewed within 24 hours. Blocking takes effect immediately: the two players are no longer seated together at public tables and any friendship ends. There is no free-text chat in the app; at card tables players can only send fixed reactions ("Zuruf").

ACCOUNT DELETION
Tab "Profil", scroll to the very bottom, section "Konto": "Konto löschen". Confirmation by password; accounts without a password (e.g. Sign in with Apple) get a code by e-mail; guests type the word LÖSCHEN. Then "Endgültig löschen". Deletion is immediate. Without the app: https://www.brauweg-spielen.de/konto-loeschen

VIRTUAL CURRENCY
Coins ("Münzen") are earned by playing (daily quests, chests, Browort) and can only be spent on cosmetics such as card designs, table designs and clothes for the penguin avatar. They have no real-money value and cannot be bought.
```

Die Zeile **„reviewed within 24 hours"** bleibt: Tom, Inhaber des
Developer-Kontos, bearbeitet die Meldungen binnen 24 Stunden (Robin,
23.09.2026, CHECKLISTE C7). Fällt das weg, die Zeile streichen — eine falsche
Zusage ist schlimmer als keine.

---

## Warum diese Hinweise so sind

- **Bots zuerst.** Kartenspiele scheitern in der Prüfung am häufigsten
  daran, dass der Prüfer allein in einer leeren Lobby steht und „App
  funktioniert nicht" meldet (`docs/APPSTORE.md`, Testzugang). „Privat"
  verhindert, dass ein Fremder den Prüfertisch betritt.
- **„Kommt bald" erklärt.** Apple lehnt Platzhalter ab (2.1, 2.2). Die Liste
  ist eine Abstimmung, kein unfertiger Inhalt, und das sagen wir vorher.
- **Clanwort mit Wortliste.** Die Wahl ist nur aus der Wortliste des Servers
  möglich (`ERLAUBT`, `packages/server/src/browort/woerter.ts`), kein
  freier Text. Dass darunter Wörter wie BIERE sind, steht in der
  Altersfreigabe (13+).
- **Melden/Blockieren mit Ort.** Apple 1.2 verlangt beides und einen
  Menschen, der reagiert. Der Ort muss so beschrieben sein, dass ein Prüfer
  ihn ohne Suchen findet. Am Farbduell-Tisch gibt es keinen Profil-Link,
  deshalb ist er nicht genannt.
- **Partykiste, Trinkmodus, 18+ und Edelsteine sind raus** (Stand 1.0): Die
  Partykiste ist in der App nicht erreichbar (seit 22.10.2026), Edelsteine
  sind in der App ausgeblendet (`laufzeit.ts`). Die alten Absätze dazu
  gehören nicht mehr in die Hinweise.
