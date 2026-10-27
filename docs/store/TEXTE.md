# Store-Texte: App Store und Google Play

Stand 27.10.2026, für **Version 1.0**. In der App spielbar sind
**Doppelkopf (mit Lernpfad), Skat, BroChess, Farbduell, Browort/Clanwort und
die Kartenmanufaktur** (`FREIGABE` in `packages/server/src/games/registry.ts`,
in Produktion begrenzt durch `UMFANG`, `docs/APP-RELEASE.md`). Die
**Partykiste ist in der App nicht mehr da** (Commit „App aufräumen",
22.10.2026) — sie steht deshalb in keinem Text mehr. Alle anderen Spiele
stehen in der App unter „Kommt bald".

Es gibt in der App **keine Käufe** (nur erspielte Münzen, `nurMuenzenInApp`)
und keine Werbung. Anmeldung mit Mail und Passwort, **„Mit Apple anmelden"**
(nativ, `docs/APP-RELEASE.md`) oder als Gast; Google gibt es in der App nicht.

„Kein Tracking" steht nicht mehr in der Beschreibung: Der Server zählt seit
#328 anonyme Tagessummen (`stats_tag`, ohne Konto- oder Gerätekennung). Das
ist kein Tracking im Sinne von Apple, aber ein Satz, über den man streiten
kann, steht besser gar nicht da.

Die Texte beschreiben nur, was in 1.0 wirklich geht. „Weitere Spiele folgen"
steht drin, Namen der Bald-Spiele nicht — sonst verspricht der Store, was
die App nicht hält (Apple 2.3.1).

**Längen prüft ein Skript**, nicht das Auge: `node werkzeug/store/texte-pruefen.mjs`
liest jeden Block unten (Marke `<!-- feld: … max=… -->`) und meldet, was zu
lang ist. Apple zählt die Schlüsselwörter in **Bytes** (ein Umlaut sind zwei),
deshalb stehen sie ohne Umlaute da.

Sprachen: **Deutsch** ist die Hauptsprache, **Englisch** die zweite
(App Store: Lokalisierung „English (U.K.)" oder „English (U.S.)"; Play: `en-US`).

---

## Gemeinsame Angaben

| Feld | Wert |
| --- | --- |
| Support-URL | `https://www.brauweg-spielen.de/rechtliches/impressum.html` — trägt Toms Kontaktangaben (eingetragen 27.10.2026) |
| Marketing-URL (optional) | `https://www.brauweg-spielen.de` |
| Datenschutz-URL | `https://www.brauweg-spielen.de/rechtliches/datenschutz.html` |
| Konto-löschen-URL (nur Play) | `https://www.brauweg-spielen.de/konto-loeschen` (neu, siehe `DATENSCHUTZ-ANGABEN.md`) |
| Kategorie App Store | Spiele — Unterkategorien **Karten** und **Gelegenheitsspiele** |
| Kategorie Google Play | Spiel → **Karten** |
| Preis | kostenlos, keine In-App-Käufe |
| Copyright (Apple) | `2026 Tom Justus Tiedtke` — Toms Name, solange das Konto Individual ist |
| Altersfreigabe | siehe `ALTERSFREIGABE.md`: nach Apples Fragebogen, voraussichtlich 13+ (Robin 27.10.2026, CHECKLISTE C1/C2) |
| Verfügbarkeit | Deutschland, Österreich, Schweiz (Robin, 23.09.2026) — die Texte der App sind nur deutsch |

---

## App Store — Deutsch

<!-- feld: apple.de.name max=30 -->
```text
Brauweg – Doppelkopf & Skat
```

<!-- feld: apple.de.untertitel max=30 -->
```text
Karten, Schach & Worträtsel
```

<!-- feld: apple.de.werbetext max=170 -->
```text
Doppelkopf und Skat mit Freunden oder gegen Bots, Doppelkopf lernen in kurzen Lektionen, dazu Schach, ein tägliches Worträtsel und deine Kartenmanufaktur. Ohne Werbung.
```

<!-- feld: apple.de.schluesselwoerter max=100 bytes -->
```text
Kartenspiel,Stiche,Reizen,Doko,Wortspiel,Wortraetsel,Schach,Lernen,Freunde,Bots,Mehrspieler,Clan
```

<!-- feld: apple.de.beschreibung max=4000 -->
```text
Brauweg bringt die Klassiker an den Tisch: Doppelkopf und Skat, online mit Freunden oder gegen Bots – dazu Schach, Farbduell, ein tägliches Worträtsel und deine eigene Kartenmanufaktur.

DOPPELKOPF
• Zu viert oder zu fünft, mit oder ohne Neunen
• Hochzeit, Armut, Soli und Ansagen
• Hausregeln zum Einstellen, etwa Schweinchen, zweite Dulle oder Sonderpunkte für Fuchs, Karlchen und Doppelkopf
• Freie Plätze füllst du mit Bots in drei Stärken

DOPPELKOPF LERNEN
• Ein Lernpfad in kurzen Lektionen – von den Trümpfen bis zur Ansage
• Am Übungstisch zeigt dir das Spiel, welche Karten du legen darfst
• Eine Lektion am Tag hält deine Lernserie am Leben

SKAT
• Reizen, Drücken, Ansagen, Kontra und Re
• Auf Wunsch Ramsch, Schieberamsch und Bock
• Ein Reizrechner hilft beim Einschätzen des Blatts, abgerechnet wird automatisch

BROWORT UND CLANWORT
• Jeden Tag ein neues Wort mit fünf Buchstaben – sechs Versuche
• Halte deine Serie und vergleiche dich mit Freunden
• Im Clan wählt jeden Tag ein Mitglied das Wort, alle anderen raten

KARTENMANUFAKTUR
• Baue deine eigene Kartenfabrik auf: Pressen, Paternoster, Meister und neue Etagen
• Läuft auch weiter, während du weg bist
• Schalte Kartenrücken für deine Sammlung frei

BROCHESS UND FARBDUELL – ZU ZWEIT
• BroChess: Schach online oder gegen den Bot, mit Schachuhr (Bullet, Blitz, Rapid)
• Farbduell: Färbe dein Gebiet um und schlucke, was daran grenzt – in vier Spielarten, eine davon im Nebel

AUSSERDEM
• Sofort loslegen: Bots füllen jeden freien Platz
• Trophäen, Ranglisten, Tagesaufgaben und Truhen
• Freunde und Clans
• Kleide deinen Pinguin ein, sammle Kartenblätter und Tische
• Als Gast spielen ohne Anmeldung – oder mit Konto (E-Mail oder „Mit Apple anmelden"), dann ist dein Stand auf jedem Gerät derselbe, auch auf www.brauweg-spielen.de

Keine Werbung, keine Käufe. Weitere Spiele folgen.

Brauweg braucht eine Internetverbindung.
```

<!-- feld: apple.de.neuheiten max=4000 -->
```text
Die erste Version von Brauweg: Doppelkopf (auch zum Lernen), Skat, BroChess, Farbduell, Browort und die Kartenmanufaktur – online mit Freunden oder gegen Bots. Weitere Spiele folgen.
```

---

## App Store — English

<!-- feld: apple.en.name max=30 -->
```text
Brauweg – Doppelkopf & Skat
```

<!-- feld: apple.en.untertitel max=30 -->
```text
German card games & word fun
```

<!-- feld: apple.en.werbetext max=170 -->
```text
Doppelkopf and Skat with friends or against bots, learn Doppelkopf in short lessons, plus chess, a daily word puzzle and your own card factory. No ads.
```

<!-- feld: apple.en.schluesselwoerter max=100 bytes -->
```text
card game,trick taking,bidding,learn,word game,daily puzzle,chess,friends,bots,multiplayer,german
```

<!-- feld: apple.en.beschreibung max=4000 -->
```text
Brauweg brings the German classics to your table: Doppelkopf and Skat, online with friends or against bots – plus chess, Farbduell, a daily word puzzle and your own card factory.

The app is in German. Rules and card names follow the German traditions.

DOPPELKOPF
• Four or five players, with or without nines
• Wedding (Hochzeit), poverty (Armut), solos and announcements
• House rules to choose from, such as Schweinchen, the second Dulle or extra points for Fuchs, Karlchen and Doppelkopf
• Fill empty seats with bots at three skill levels

LEARN DOPPELKOPF
• A learning path in short lessons – from trumps to announcements
• At the practice table the game shows you which cards you may play
• One lesson a day keeps your learning streak alive

SKAT
• Bidding, discarding, announcements, Kontra and Re
• Optional Ramsch, Schieberamsch and Bock rounds
• A bidding calculator helps you judge your hand; scoring is automatic

BROWORT AND CLANWORT
• A new five-letter word every day – six tries
• Keep your streak and compare with friends
• In your clan, one member picks the word each day and everyone else guesses

CARD FACTORY
• Build your own card factory: presses, a paternoster lift, masters and new floors
• Keeps working while you are away
• Unlock card backs for your collection

BROCHESS AND FARBDUELL – HEAD TO HEAD
• BroChess: chess online or against the bot, with a chess clock (bullet, blitz, rapid)
• Farbduell: recolour your territory and swallow whatever touches it – four modes, one of them in fog of war

ALSO
• Start right away: bots fill every free seat
• Trophies, leaderboards, daily quests and chests
• Friends and clans
• Dress up your penguin, collect card decks and tables
• Play as a guest without signing up – or with an account (email or Sign in with Apple), and your progress follows you to every device, including www.brauweg-spielen.de

No ads, no purchases. More games are coming.

Brauweg requires an internet connection.
```

<!-- feld: apple.en.neuheiten max=4000 -->
```text
The first version of Brauweg: Doppelkopf (with lessons), Skat, BroChess, Farbduell, Browort and the card factory – online with friends or against bots. More games are coming.
```

---

## Google Play — Deutsch

Titel wie der App-Store-Name. Play verbietet Preis- und Rangangaben im Titel
(„kostenlos", „Nr. 1") — steht hier nicht drin.

<!-- feld: play.de.titel max=30 -->
```text
Brauweg – Doppelkopf & Skat
```

<!-- feld: play.de.kurz max=80 -->
```text
Doppelkopf und Skat online oder gegen Bots – dazu Schach, Worträtsel und mehr.
```

Vollständige Beschreibung: **derselbe Text wie `apple.de.beschreibung`**
(Play erlaubt dieselben 4.000 Zeichen). Er steht hier ein zweites Mal, damit
das Prüfskript beide Grenzen einzeln misst; ändert sich einer, ändert sich
der andere mit.

<!-- feld: play.de.beschreibung max=4000 gleich=apple.de.beschreibung -->
```text
Brauweg bringt die Klassiker an den Tisch: Doppelkopf und Skat, online mit Freunden oder gegen Bots – dazu Schach, Farbduell, ein tägliches Worträtsel und deine eigene Kartenmanufaktur.

DOPPELKOPF
• Zu viert oder zu fünft, mit oder ohne Neunen
• Hochzeit, Armut, Soli und Ansagen
• Hausregeln zum Einstellen, etwa Schweinchen, zweite Dulle oder Sonderpunkte für Fuchs, Karlchen und Doppelkopf
• Freie Plätze füllst du mit Bots in drei Stärken

DOPPELKOPF LERNEN
• Ein Lernpfad in kurzen Lektionen – von den Trümpfen bis zur Ansage
• Am Übungstisch zeigt dir das Spiel, welche Karten du legen darfst
• Eine Lektion am Tag hält deine Lernserie am Leben

SKAT
• Reizen, Drücken, Ansagen, Kontra und Re
• Auf Wunsch Ramsch, Schieberamsch und Bock
• Ein Reizrechner hilft beim Einschätzen des Blatts, abgerechnet wird automatisch

BROWORT UND CLANWORT
• Jeden Tag ein neues Wort mit fünf Buchstaben – sechs Versuche
• Halte deine Serie und vergleiche dich mit Freunden
• Im Clan wählt jeden Tag ein Mitglied das Wort, alle anderen raten

KARTENMANUFAKTUR
• Baue deine eigene Kartenfabrik auf: Pressen, Paternoster, Meister und neue Etagen
• Läuft auch weiter, während du weg bist
• Schalte Kartenrücken für deine Sammlung frei

BROCHESS UND FARBDUELL – ZU ZWEIT
• BroChess: Schach online oder gegen den Bot, mit Schachuhr (Bullet, Blitz, Rapid)
• Farbduell: Färbe dein Gebiet um und schlucke, was daran grenzt – in vier Spielarten, eine davon im Nebel

AUSSERDEM
• Sofort loslegen: Bots füllen jeden freien Platz
• Trophäen, Ranglisten, Tagesaufgaben und Truhen
• Freunde und Clans
• Kleide deinen Pinguin ein, sammle Kartenblätter und Tische
• Als Gast spielen ohne Anmeldung – oder mit Konto (E-Mail oder „Mit Apple anmelden"), dann ist dein Stand auf jedem Gerät derselbe, auch auf www.brauweg-spielen.de

Keine Werbung, keine Käufe. Weitere Spiele folgen.

Brauweg braucht eine Internetverbindung.
```

## Google Play — English

<!-- feld: play.en.titel max=30 -->
```text
Brauweg – Doppelkopf & Skat
```

<!-- feld: play.en.kurz max=80 -->
```text
Doppelkopf and Skat online or against bots – plus chess, word puzzles and more.
```

<!-- feld: play.en.beschreibung max=4000 gleich=apple.en.beschreibung -->
```text
Brauweg brings the German classics to your table: Doppelkopf and Skat, online with friends or against bots – plus chess, Farbduell, a daily word puzzle and your own card factory.

The app is in German. Rules and card names follow the German traditions.

DOPPELKOPF
• Four or five players, with or without nines
• Wedding (Hochzeit), poverty (Armut), solos and announcements
• House rules to choose from, such as Schweinchen, the second Dulle or extra points for Fuchs, Karlchen and Doppelkopf
• Fill empty seats with bots at three skill levels

LEARN DOPPELKOPF
• A learning path in short lessons – from trumps to announcements
• At the practice table the game shows you which cards you may play
• One lesson a day keeps your learning streak alive

SKAT
• Bidding, discarding, announcements, Kontra and Re
• Optional Ramsch, Schieberamsch and Bock rounds
• A bidding calculator helps you judge your hand; scoring is automatic

BROWORT AND CLANWORT
• A new five-letter word every day – six tries
• Keep your streak and compare with friends
• In your clan, one member picks the word each day and everyone else guesses

CARD FACTORY
• Build your own card factory: presses, a paternoster lift, masters and new floors
• Keeps working while you are away
• Unlock card backs for your collection

BROCHESS AND FARBDUELL – HEAD TO HEAD
• BroChess: chess online or against the bot, with a chess clock (bullet, blitz, rapid)
• Farbduell: recolour your territory and swallow whatever touches it – four modes, one of them in fog of war

ALSO
• Start right away: bots fill every free seat
• Trophies, leaderboards, daily quests and chests
• Friends and clans
• Dress up your penguin, collect card decks and tables
• Play as a guest without signing up – or with an account (email or Sign in with Apple), and your progress follows you to every device, including www.brauweg-spielen.de

No ads, no purchases. More games are coming.

Brauweg requires an internet connection.
```

---

## Warum die Texte so sind

- **Name mit Spielen.** „Brauweg" allein findet niemand; „Doppelkopf" und
  „Skat" sind die Wörter, nach denen gesucht wird. Apple und Play werten
  Wörter aus dem Namen ohnehin — deshalb stehen sie **nicht** noch einmal
  in den Schlüsselwörtern (Apple: keine Wiederholung von App-Name und
  Firmenname).
- **Kein „Trinkspiel" mehr.** Das Suchwort (Robin, 23.09.2026) gehörte zur
  Partykiste. Die ist in der App nicht mehr erreichbar; ein Suchwort für
  etwas, das die App nicht hat, wäre Apple 2.3.7 (irreführende Metadaten).
- **„Doko" als Suchwort.** So sucht, wer Doppelkopf spielt. „Doppelkopf"
  selbst steht im Namen und wird deshalb nicht wiederholt.
- **Keine Marken Dritter.** Nicht „Wizard", nicht „Kosmos", nicht
  „Wordle" — Browort ist ein Wortratespiel, kein Nachbau einer Marke, und
  heißt im Text auch nicht so.
- **„Mit Apple anmelden" im Text.** Seit PR #330 gibt es den Weg in der
  App; erst mit diesem Build darf er in der Beschreibung stehen.
- **„Die App ist auf Deutsch"** steht in der englischen Beschreibung, weil
  der Client nur deutsche Texte hat — ein englischer Käufer soll das vorher
  wissen, nicht aus einer Ein-Stern-Bewertung.
