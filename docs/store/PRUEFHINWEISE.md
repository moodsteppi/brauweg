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
| Kontakt (Apple) | Vorname, Name, Telefon, Mail von **Tom** (Kontoinhaber) |

---

## Notes (zum Einfügen)

```text
Thank you for reviewing Brauweg.

SIGN-IN
Use the demo account above. Alternatively tap "Ohne Konto spielen" (play without an account) on the sign-in screen – a guest account is created with one tap, no e-mail needed. The app needs an internet connection; it talks to our own server at www.brauweg-spielen.de.

The app is in German. Version 1.0 contains three games: Doppelkopf, Skat and the Partykiste (party box). All other tiles in the game list are marked "Bald" (coming soon) and cannot be started. There are no in-app purchases and no ads.

PLAYING WITHOUT OTHER PEOPLE
Every game can be played alone against bots:
- Doppelkopf: "Spielauswahl" > Doppelkopf > "Tisch erstellen" > "Tisch erstellen", then tap "+ Bot" on each free seat. The game starts when all four seats are filled.
- Skat: same way; choose "3 Spieler" and add two bots.
- Partykiste: "Spielauswahl" > Partykiste > "Gegen Bots" > "Los". The party box is meant for 4–12 people in the same room, each on their own phone; bots fill the seats so you can see every mini-game alone.

PARTYKISTE – A PARTY GAME FOR ADULTS
The party box has a drinking-game mode. At the top of its menu there is a switch "Trinkspiel / Alkoholfrei" (drinking game / alcohol-free). Alcohol-free counts penalty points instead of sips and removes all drinking references from the instructions. No content text tells players to drink; sips only come from the score. Content intensity is chosen separately ("harmlos / pikant / derb" = mild / spicy / crude); "derb" is only available when no guest account is at the table. The app is rated 18+.

REPORT AND BLOCK
Tap a player's name at the table to open their profile; there you find "Melden" (report) and "Blockieren" (block). In the Partykiste waiting room the same sheet opens from each player. Reports reach our moderation by e-mail and are reviewed within 24 hours. Blocking takes effect immediately: the two players are no longer seated together at public tables and any friendship ends. There is no free-text chat in the app.

ACCOUNT DELETION
Profile tab ("Profil"), scroll to the very bottom: "Konto löschen". Confirmation by password; accounts without a password get a code by e-mail; guests type the word LÖSCHEN. Deletion is immediate. Without the app: https://www.brauweg-spielen.de/konto-loeschen

VIRTUAL CURRENCY
Coins and gems are in-game currency without real-money value. They are earned by playing (daily quests, chests) and cannot be bought in the app.
```

Die Zeile **„reviewed within 24 hours"** bleibt: Tom, Inhaber des
Developer-Kontos, bearbeitet die Meldungen binnen 24 Stunden (Robin,
23.09.2026, CHECKLISTE C8). Fällt das weg, die Zeile streichen — eine falsche
Zusage ist schlimmer als keine.

---

## Warum diese Hinweise so sind

- **Bots zuerst.** Kartenspiele scheitern in der Prüfung am häufigsten
  daran, dass der Prüfer allein in einer leeren Lobby steht und „App
  funktioniert nicht" meldet (`docs/APPSTORE.md`, Testzugang).
- **„3 Spieler" bei Skat ausdrücklich.** Ohne diese Wahl scheitert heute das
  Anlegen des ersten Skat-Tischs („Diese Spielerzahl gibt es bei diesem Spiel
  nicht", CHECKLISTE Punkt A1). Ist das behoben, darf der Satz bleiben — er
  schadet nicht.
- **Alkoholfrei-Schalter und 18+ in einem Absatz.** Apple 1.4.3 verbietet
  Apps, die zu übermäßigem Alkoholkonsum anstiften. Wir sagen deshalb
  zuerst, was es gibt, dann, wie man es abschaltet, und dass kein Text zum
  Trinken auffordert (`test/inhalte.test.ts` im Paket `game-partykiste`
  hält das fest). Robin kennt das Risiko; der Rückweg ohne neuen Build steht
  in `docs/APP-RELEASE.md` Abschnitt 2.
- **Melden/Blockieren mit Ort.** Apple 1.2 verlangt beides und einen
  Menschen, der reagiert. Der Ort muss so beschrieben sein, dass ein Prüfer
  ihn ohne Suchen findet.
