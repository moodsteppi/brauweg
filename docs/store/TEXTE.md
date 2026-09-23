# Store-Texte: App Store und Google Play

Stand 23.09.2026, für **Version 1.0**. In dieser Version spielbar sind
**Doppelkopf, Skat und die Partykiste**; alle anderen Spiele stehen in der
App auf „Bald" (`FREIGABE` in `packages/server/src/games/registry.ts`). Es
gibt in der App **keine Käufe**, keine Werbung und kein Tracking. Anmeldung
mit Mail und Passwort oder als Gast; Google/Apple sind in der App aus.

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
| Support-URL | `https://www.brauweg-spielen.de/rechtliches/impressum.html` — trägt die Kontaktangaben, **sobald die roten Lücken gefüllt sind** (CHECKLISTE) |
| Marketing-URL (optional) | `https://www.brauweg-spielen.de` |
| Datenschutz-URL | `https://www.brauweg-spielen.de/rechtliches/datenschutz.html` |
| Konto-löschen-URL (nur Play) | `https://www.brauweg-spielen.de/konto-loeschen` (neu, siehe `DATENSCHUTZ-ANGABEN.md`) |
| Kategorie App Store | Spiele — Unterkategorien **Karten** und **Gelegenheitsspiele** |
| Kategorie Google Play | Spiel → **Karten** |
| Preis | kostenlos, keine In-App-Käufe |
| Copyright (Apple) | `2026 <NAME WIE IM KONTO>` — Toms Name, solange das Konto Individual ist |
| Altersfreigabe | siehe `ALTERSFREIGABE.md` (erwartet: Apple 18+, IARC USK 16 / PEGI 16) |
| Verfügbarkeit (Vorschlag) | Deutschland, Österreich, Schweiz — die Texte der App sind nur deutsch, siehe CHECKLISTE |

---

## App Store — Deutsch

<!-- feld: apple.de.name max=30 -->
```text
Brauweg – Doppelkopf & Skat
```

<!-- feld: apple.de.untertitel max=30 -->
```text
Karten- und Partyspiele online
```

<!-- feld: apple.de.werbetext max=170 -->
```text
Doppelkopf und Skat mit Freunden oder gegen Bots – und für den Spieleabend die Partykiste mit 15 Minispielen. Ohne Werbung, ohne Käufe.
```

<!-- feld: apple.de.schluesselwoerter max=100 bytes -->
```text
Kartenspiel,Partyspiel,Stiche,Reizen,Quiz,Freunde,Bots,Mehrspieler,Spieleabend,Kneipe,Imposter
```

<!-- feld: apple.de.beschreibung max=4000 -->
```text
Brauweg bringt die Klassiker an den Tisch: Doppelkopf und Skat, online mit Freunden oder gegen Bots – und für Abende mit vielen Leuten die Partykiste.

DOPPELKOPF
• Zu viert oder zu fünft, mit oder ohne Neunen
• Hochzeit, Armut, Soli und Ansagen
• Hausregeln zum Einstellen, etwa Schweinchen, zweite Dulle oder Sonderpunkte für Fuchs, Karlchen und Doppelkopf
• Freie Plätze füllst du mit Bots in drei Stärken

SKAT
• Reizen, Drücken, Ansagen, Kontra und Re
• Auf Wunsch Ramsch, Schieberamsch und Bock
• Ein Reizrechner hilft beim Einschätzen des Blatts, abgerechnet wird automatisch

PARTYKISTE – DAS TURNIER FÜR DEN SPIELEABEND
• 15 Minispiele für 4 bis 12 Leute im selben Raum: Imposter, Allgemeinwissen, Wer bin ich?, Ich hab noch nie, Wer würde eher?, Schätzen, Bombe, Königsbecher und mehr
• Jeder spielt am eigenen Handy mit, geredet wird am Tisch
• Freunde kommen per Code, Link oder QR-Code dazu
• Trinkspiel oder alkoholfrei mit Strafpunkten – das stellt ihr ein
• Inhalte harmlos, pikant oder derb; „derb" gibt es nur, wenn alle mit Konto am Tisch sitzen
• Vier Modi: Turnier, Eskalation, Themenabend und Team

Die Partykiste ist ein Partyspiel für Erwachsene. Wer trinkt, trinkt verantwortungsvoll – oder ihr spielt alkoholfrei.

AUSSERDEM
• Sofort loslegen: Bots füllen jeden freien Platz
• Trophäen, Ranglisten, Tagesaufgaben und Truhen
• Freunde und Clans
• Kartenblätter und Tische nach deinem Geschmack
• Als Gast spielen ohne Anmeldung – oder mit Konto, dann ist dein Stand auf jedem Gerät derselbe, auch auf www.brauweg-spielen.de

Keine Werbung, keine Käufe, kein Tracking. Weitere Spiele folgen.

Brauweg braucht eine Internetverbindung.
```

<!-- feld: apple.de.neuheiten max=4000 -->
```text
Die erste Version von Brauweg: Doppelkopf, Skat und die Partykiste – online mit Freunden oder gegen Bots. Weitere Spiele folgen.
```

---

## App Store — English

<!-- feld: apple.en.name max=30 -->
```text
Brauweg – Doppelkopf & Skat
```

<!-- feld: apple.en.untertitel max=30 -->
```text
German card games & party fun
```

<!-- feld: apple.en.werbetext max=170 -->
```text
Doppelkopf and Skat with friends or against bots – plus the Party Box, a tournament of 15 mini-games for your game night. No ads, no purchases.
```

<!-- feld: apple.en.schluesselwoerter max=100 bytes -->
```text
card game,party game,trick taking,bidding,trivia,friends,bots,multiplayer,game night,imposter,german
```

<!-- feld: apple.en.beschreibung max=4000 -->
```text
Brauweg brings the German classics to your table: Doppelkopf and Skat, online with friends or against bots – and for evenings with a crowd, the Party Box.

The app is in German. Rules and card names follow the German traditions.

DOPPELKOPF
• Four or five players, with or without nines
• Wedding (Hochzeit), poverty (Armut), solos and announcements
• House rules to choose from, such as Schweinchen, the second Dulle or extra points for Fuchs, Karlchen and Doppelkopf
• Fill empty seats with bots at three skill levels

SKAT
• Bidding, discarding, announcements, Kontra and Re
• Optional Ramsch, Schieberamsch and Bock rounds
• A bidding calculator helps you judge your hand; scoring is automatic

PARTY BOX – THE TOURNAMENT FOR YOUR GAME NIGHT
• 15 mini-games for 4 to 12 people in the same room: Imposter, trivia, Who am I?, Never have I ever, Who would rather?, estimates, the bomb, King's Cup and more
• Everyone plays on their own phone, the talking happens at the table
• Friends join by code, link or QR code
• Drinking game or alcohol-free with penalty points – you decide
• Content mild, spicy or crude; "crude" is only available when everyone at the table has an account
• Four modes: tournament, escalation, theme night and teams

The Party Box is a party game for adults. If you drink, drink responsibly – or play alcohol-free.

ALSO
• Start right away: bots fill every free seat
• Trophies, leaderboards, daily quests and chests
• Friends and clans
• Card decks and tables to suit your taste
• Play as a guest without signing up – or with an account, and your progress follows you to every device, including www.brauweg-spielen.de

No ads, no purchases, no tracking. More games are coming.

Brauweg requires an internet connection.
```

<!-- feld: apple.en.neuheiten max=4000 -->
```text
The first version of Brauweg: Doppelkopf, Skat and the Party Box – online with friends or against bots. More games are coming.
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
Doppelkopf und Skat online oder gegen Bots – dazu die Partykiste für den Abend.
```

Vollständige Beschreibung: **derselbe Text wie `apple.de.beschreibung`**
(Play erlaubt dieselben 4.000 Zeichen). Er steht hier ein zweites Mal, damit
das Prüfskript beide Grenzen einzeln misst; ändert sich einer, ändert sich
der andere mit.

<!-- feld: play.de.beschreibung max=4000 gleich=apple.de.beschreibung -->
```text
Brauweg bringt die Klassiker an den Tisch: Doppelkopf und Skat, online mit Freunden oder gegen Bots – und für Abende mit vielen Leuten die Partykiste.

DOPPELKOPF
• Zu viert oder zu fünft, mit oder ohne Neunen
• Hochzeit, Armut, Soli und Ansagen
• Hausregeln zum Einstellen, etwa Schweinchen, zweite Dulle oder Sonderpunkte für Fuchs, Karlchen und Doppelkopf
• Freie Plätze füllst du mit Bots in drei Stärken

SKAT
• Reizen, Drücken, Ansagen, Kontra und Re
• Auf Wunsch Ramsch, Schieberamsch und Bock
• Ein Reizrechner hilft beim Einschätzen des Blatts, abgerechnet wird automatisch

PARTYKISTE – DAS TURNIER FÜR DEN SPIELEABEND
• 15 Minispiele für 4 bis 12 Leute im selben Raum: Imposter, Allgemeinwissen, Wer bin ich?, Ich hab noch nie, Wer würde eher?, Schätzen, Bombe, Königsbecher und mehr
• Jeder spielt am eigenen Handy mit, geredet wird am Tisch
• Freunde kommen per Code, Link oder QR-Code dazu
• Trinkspiel oder alkoholfrei mit Strafpunkten – das stellt ihr ein
• Inhalte harmlos, pikant oder derb; „derb" gibt es nur, wenn alle mit Konto am Tisch sitzen
• Vier Modi: Turnier, Eskalation, Themenabend und Team

Die Partykiste ist ein Partyspiel für Erwachsene. Wer trinkt, trinkt verantwortungsvoll – oder ihr spielt alkoholfrei.

AUSSERDEM
• Sofort loslegen: Bots füllen jeden freien Platz
• Trophäen, Ranglisten, Tagesaufgaben und Truhen
• Freunde und Clans
• Kartenblätter und Tische nach deinem Geschmack
• Als Gast spielen ohne Anmeldung – oder mit Konto, dann ist dein Stand auf jedem Gerät derselbe, auch auf www.brauweg-spielen.de

Keine Werbung, keine Käufe, kein Tracking. Weitere Spiele folgen.

Brauweg braucht eine Internetverbindung.
```

## Google Play — English

<!-- feld: play.en.titel max=30 -->
```text
Brauweg – Doppelkopf & Skat
```

<!-- feld: play.en.kurz max=80 -->
```text
Doppelkopf and Skat online or against bots – plus the Party Box for game night.
```

<!-- feld: play.en.beschreibung max=4000 gleich=apple.en.beschreibung -->
```text
Brauweg brings the German classics to your table: Doppelkopf and Skat, online with friends or against bots – and for evenings with a crowd, the Party Box.

The app is in German. Rules and card names follow the German traditions.

DOPPELKOPF
• Four or five players, with or without nines
• Wedding (Hochzeit), poverty (Armut), solos and announcements
• House rules to choose from, such as Schweinchen, the second Dulle or extra points for Fuchs, Karlchen and Doppelkopf
• Fill empty seats with bots at three skill levels

SKAT
• Bidding, discarding, announcements, Kontra and Re
• Optional Ramsch, Schieberamsch and Bock rounds
• A bidding calculator helps you judge your hand; scoring is automatic

PARTY BOX – THE TOURNAMENT FOR YOUR GAME NIGHT
• 15 mini-games for 4 to 12 people in the same room: Imposter, trivia, Who am I?, Never have I ever, Who would rather?, estimates, the bomb, King's Cup and more
• Everyone plays on their own phone, the talking happens at the table
• Friends join by code, link or QR code
• Drinking game or alcohol-free with penalty points – you decide
• Content mild, spicy or crude; "crude" is only available when everyone at the table has an account
• Four modes: tournament, escalation, theme night and teams

The Party Box is a party game for adults. If you drink, drink responsibly – or play alcohol-free.

ALSO
• Start right away: bots fill every free seat
• Trophies, leaderboards, daily quests and chests
• Friends and clans
• Card decks and tables to suit your taste
• Play as a guest without signing up – or with an account, and your progress follows you to every device, including www.brauweg-spielen.de

No ads, no purchases, no tracking. More games are coming.

Brauweg requires an internet connection.
```

---

## Warum die Texte so sind

- **Name mit Spielen.** „Brauweg" allein findet niemand; „Doppelkopf" und
  „Skat" sind die Wörter, nach denen gesucht wird. Apple und Play werten
  Wörter aus dem Namen ohnehin — deshalb stehen sie **nicht** noch einmal
  in den Schlüsselwörtern (Apple: keine Wiederholung von App-Name und
  Firmenname).
- **Kein „Trinkspiel" in Schlüsselwörtern, Name oder Werbetext.** Der
  Trinkmodus steht ehrlich in der Beschreibung, dazu der Alkoholfrei-Schalter
  und der Hinweis „für Erwachsene". Als Suchwort zöge es die Aufmerksamkeit
  genau auf Apples Richtlinie 1.4.3 (Anstiftung zu übermäßigem
  Alkoholkonsum). Will Robin es trotzdem als Suchwort: `Trinkspiel` ersetzt
  `Kneipe` (passt in die 100 Bytes).
- **Keine Marken Dritter.** Nicht „Wizard", nicht „Kosmos", keine
  Fernsehsendung. Die Minispielnamen („Wer bin ich?", „Ich hab noch nie",
  „Königsbecher") sind Gattungsnamen von Partyspielen, keine Marken.
  „Imposter" ebenfalls — bewusst **nicht** „Among Us".
- **„15 Minispiele".** So viele liefert das Modul (`MINISPIELE` in
  `packages/game-partykiste/src/regeln.ts`). Die Kachel in der Spielauswahl
  sagt heute „9 Minispiele" und der Menütext „Zwölf Minispiele" — beides
  veraltet, siehe CHECKLISTE.
- **„derb nur mit Konto am Tisch".** So kappt der Server
  (`INHALTS_HAERTE_GAST_MAX`, `docs/PARTYKISTE.md`). „Ab 18 geprüft" wäre
  falsch: Ein Konto bestätigt nur ein selbst angegebenes Geburtsdatum ab 16
  (`MIN_AGE` in `packages/server/src/birthday.ts`), ein Gast gar keins.
- **„Die App ist auf Deutsch"** steht in der englischen Beschreibung, weil
  der Client nur deutsche Texte hat — ein englischer Käufer soll das vorher
  wissen, nicht aus einer Ein-Stern-Bewertung.
