# Altersfreigabe: Apple und IARC (Google Play)

Stand 27.10.2026, für Version 1.0. Jede Antwort ist aus dem Code begründet,
nicht aus dem Gefühl.

**Was sich seit dem 23.09.2026 geändert hat:** Die Partykiste (Trinkmodus,
Stufen „pikant"/„derb", Kiffer-Einträge) ist **in der App nicht mehr
erreichbar** (`partykiste: { web: 'spielbar', app: 'bald' }` in
`packages/server/src/games/registry.ts`, Commit „App aufräumen", 22.10.2026;
in der App nirgends sichtbar). Sie trug allein die frühere Einstufung 18+.
In der App spielbar sind jetzt:

- **Doppelkopf, Skat** — Kartenspiele um Punkte
- **Farbduell** (Filler), **BroChess** — Brettspiele zu zweit
- **Doppelkopf lernen** (Lernpfad), **Browort** und **Clanwort**
  (Wortratespiel), **Kartenmanufaktur** (Aufbauspiel allein)

Produktion schaltet das über `UMFANG`
(`doppelkopf,skat,filler,brochess,kartenmanufaktur,browort,clanwort,lernpfad`,
`docs/APP-RELEASE.md`).

**Ergebnis: Apple 4+ aus dem Fragebogen, IARC voraussichtlich USK 0 / PEGI 3
mit Hinweis „Nutzerinteraktion".** Dazu steht eine Entscheidung offen
(CHECKLISTE, Altersgrenze): Konten gibt es weiter erst **ab 18** (`MIN_AGE`
in `packages/server/src/birthday.ts`). Siehe „Freigabe und Mindestalter" unten.

Die Antworten müssen **neu gegeben werden**, sobald sich eine Grundlage
ändert: ein weiteres Spiel wechselt in der App auf `spielbar` (Poker =
simuliertes Glücksspiel, Partykiste = Alkohol), Clan-Chat oder Bild-Upload
gehen in der App an, Edelsteine/Käufe kommen in die App.

---

## Apple — der Fragebogen seit 2025

Stufen **4+, 9+, 13+, 16+, 18+**. Inhaltsfragen: **Keine / Selten / Häufig**,
Glücksspiel und Lootboxen Ja/Nein. Die Stufe rechnet Apple aus.

Quellen (abgerufen 23.09.2026):
[Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions) ·
[Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating) ·
[Ankündigung 24.07.2025](https://developer.apple.com/news/?id=ks775ehf) ·
[Social-Media-Fragen](https://developer.apple.com/news/?id=tlur8uvi)

### In-App Controls

| Frage | Antwort | Warum |
| --- | --- | --- |
| Parental Controls | **Nein** | Es gibt keine Elternfunktion. |
| Age Assurance | **Nein** | Das Geburtsdatum ist eine Selbstangabe (Pflicht ab 18 für Konten, `MIN_AGE`), Gäste geben keins an. Keine Altersprüfung im Sinne der Frage. |

### Capabilities

| Frage | Antwort | Warum |
| --- | --- | --- |
| Unrestricted Web Access | **Nein** | Die Hülle zeigt nur den gebündelten Client; Impressum und Datenschutz öffnen als Blatt (`docs/APPSTORE.md`). |
| User-Generated Content | **Ja** | Anzeigenamen, Clan-Name und -Motto, Figurbemalung, auf der Webseite hochgeladene Profilbilder erscheinen auch in der App; im Clanwort wählt ein Mitglied das Wort (nur aus der Wortliste des Servers, `wortGueltig` in `packages/server/src/browort/woerter.ts`). Melden und Blockieren gibt es (`packages/server/src/http/melden-routen.ts`). |
| Social Media | **Nein** | Kein Feed, nichts wird weiterverbreitet oder kommentiert. |
| Messaging and Chat | **Nein** | Clan-Chat ist in der App aus (`mitChat = !inApp && …` in `packages/client/src/screens/Clan.tsx`). Am Tisch nur vorgefertigte Zurufe (`emotes.ts`). **Geht der Clan-Chat in der App an: Ja.** |
| Advertising | **Nein** | Kein Werbe-SDK, keine Werbung. |

### Mature Themes

| Frage | Antwort | Warum |
| --- | --- | --- |
| Profanity or Crude Humor | **Keine** | Die Kartenspiele haben keine Texte dieser Art; die Browort-Lösungen sind „ohne Anstößiges" ausgewählt (`LOESUNGEN`, `woerter.ts`). |
| Horror/Fear Themes | **Keine** | |
| Alcohol, Tobacco, or Drug Use or References | **Keine** — wenn `BIERE` aus der Browort-Lösungsliste fliegt | Partykiste nicht in der App; Lernpfad (`packages/game-doppelkopf/src/lernen.ts`) und Kartenmanufaktur ohne Bezüge (Suche nach Bier/Kneipe/Schnaps/Prost/Kater, 27.10.2026). **Aber:** `LOESUNGEN` in `packages/server/src/browort/woerter.ts` enthält `BIERE` — als Tageswort ein Alkoholbezug, ehrlich „Selten" → **13+**. Wort aus `LOESUNGEN` nehmen (in `ERLAUBT` darf es bleiben, Raten ist kein Bezug der App), dann „Keine". `KATER` ist das Tier und bleibt. |

### Medical or Wellness

| Frage | Antwort | Warum |
| --- | --- | --- |
| Medical or Treatment Information | **Keine** | |
| Health or Wellness Topics | **Keine** | |

### Sexuality or Nudity

| Frage | Antwort | Warum |
| --- | --- | --- |
| Mature or Suggestive Themes | **Keine** | Die anzüglichen Partykiste-Inhalte sind in der App nicht erreichbar. |
| Sexual Content or Nudity | **Keine** | |
| Graphic Sexual Content and Nudity | **Keine** | |

### Violence

| Frage | Antwort | Warum |
| --- | --- | --- |
| Cartoon or Fantasy Violence | **Keine** | Keins der Spiele hat Kampf. (Tafelrunde, Feldherr: „Bald" — **wechseln sie in die App: neu beantworten.**) |
| Realistic Violence | **Keine** | |
| Prolonged Graphic or Sadistic Realistic Violence | **Keine** | |
| Guns or Other Weapons | **Keine** | |

### Chance-Based Activities

| Frage | Antwort | Warum |
| --- | --- | --- |
| Gambling (Echtgeld) | **Nein** | Keine Einsätze, keine Käufe in der App. |
| Simulated Gambling | **Keine** | Doppelkopf und Skat um Punkte. Poker steht in der App auf „Bald". **Wechselt Poker in die App: Häufig → 18+.** |
| Contests | **Keine** | Ranglisten und Trophäen ohne Preise. |
| Loot Boxes | **Nein** | Truhen gibt es aus Tagesaufgaben und dem Trophäenweg, nie gegen Geld; in der App wird nur mit erspielten Münzen gekauft (`nurMuenzenInApp`, `mitEdelsteinen()` in `packages/client/src/laufzeit.ts`). Vorsichtiger: „Ja" ergäbe 9+. |

### Ergebnis Apple: **4+** (mit „Loot Boxes: Ja" 9+; solange `BIERE` Tageswort sein kann 13+)

---

## Freigabe und Mindestalter

Die Store-Stufe und die Altersgrenze der Konten sind zwei Dinge:

- **Store-Stufe** sagt, was die Inhalte vertragen. Ohne Partykiste: 4+.
- **`MIN_AGE = 18`** sagt, wer ein Konto anlegen darf. Gäste spielen ohne
  Altersangabe.

Eine 4+-App, die bei der Registrierung „mindestens 18" verlangt, ist
erlaubt, wirkt aber widersprüchlich — und die Datenschutzerklärung sagt „ab
18". Drei Wege (**Robin entscheidet**, CHECKLISTE):

1. **18 bleibt, Stufe manuell auf 18+ setzen.** Apple bietet beim Ausfüllen
   an, die Stufe höher zu setzen. Konsistent mit `MIN_AGE`, Datenschutz und
   der Webseite (dort gibt es die Partykiste). Kostet Reichweite.
2. **18 bleibt, Stufe 4+/9+.** Inhaltlich richtig, die Altersgrenze bleibt
   eine Hausregel. Prüfer fragen selten danach.
3. **`MIN_AGE` auf 16 senken** (DSGVO-Einwilligungsalter in Deutschland),
   Stufe 4+/9+. Braucht eine Änderung an `birthday.ts`, Texten und
   Datenschutzerklärung — und die Webseite hat die Partykiste mit Trinkmodus.

Vorschlag: **Weg 1**, solange Web und App dieselben Konten teilen und die
Partykiste im Web ab 18 bleibt.

---

## IARC (Google Play „Inhaltsbewertung")

Play Console → *Richtlinien → App-Inhalte → Einstufung*, Kategorie **Spiel**.
Gilt erst, wenn die Android-App eingereicht wird. Quellen:
[Play-Hilfe Einstufung](https://support.google.com/googleplay/android-developer/answer/188189),
[USK im IARC-System](https://usk.de/fuer-unternehmen/spiele-und-apps-pruefen-lassen/spiele-und-apps-im-iarc-system/).

| Thema | Antwort | Warum |
| --- | --- | --- |
| Gewalt | **Nein** | |
| Angst, Horror | **Nein** | |
| Sexualität / Nacktheit | **Nein** | |
| Glücksspiel | **Nein** | **mit Poker: Ja, simuliert** |
| Sprache: Schimpfwörter | **Nein** | |
| Derber Humor | **Nein** | |
| Alkohol, Tabak, Drogen | **Nein** | Partykiste nicht in der App |
| Nutzer interagieren / tauschen Inhalte aus | **Ja** | Mehrspieler mit Fremden, sichtbare Namen, Clans. Kein Chat in der App. |
| Teilt den Standort | **Nein** | |
| Digitale Käufe | **Nein** | |
| Werbung | **Nein** | |
| Uneingeschränkter Internetzugang | **Nein** | |

### Ergebnis IARC: **USK 0 / PEGI 3** (erwartet), Hinweis „Nutzerinteraktion"

Die tatsächliche Stufe steht erst nach dem Absenden fest und wird hier
nachgetragen (CHECKLISTE).

### Zielgruppe bei Play (App-Inhalte → Zielgruppe)

Hängt an der Entscheidung oben. Mit `MIN_AGE = 18`: **nur „18 und älter"**
ankreuzen — dann greifen die Familienrichtlinien nicht. Wer jüngere
Zielgruppen ankreuzt, muss die Familienrichtlinien erfüllen.
