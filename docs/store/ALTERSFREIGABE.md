# Altersfreigabe: Apple und IARC (Google Play)

Stand 23.09.2026, für Version 1.0 (Doppelkopf, Skat, Partykiste mit
Trinkmodus). Jede Antwort ist aus dem Code begründet, nicht aus dem Gefühl.
**Ergebnis: Apple 18+, IARC voraussichtlich USK 16 / PEGI 16** (18 möglich,
siehe unten).

Die Antworten müssen **neu gegeben werden**, sobald sich eine Grundlage
ändert: ein weiteres Spiel wechselt in der App auf `spielbar` (Poker!), der
Rückweg `APP_PARTYKISTE_TRINKMODUS=aus` / `APP_PARTYKISTE_HAERTE_MAX` wird
gesetzt, Clan-Chat oder Bild-Upload gehen in der App an, Push kommt.

---

## Apple — der Fragebogen seit 2025

Apple hat die Stufen 2025 umgestellt: **4+, 9+, 13+, 16+, 18+** (17+ gibt es
nicht mehr). Die neuen Fragen mussten bis 31.01.2026 beantwortet sein, seit
September 2026 kommen Pflichtfragen zu Social Media dazu. Die Inhaltsfragen
haben die Antworten **Keine / Selten (Infrequent) / Häufig (Frequent)**,
Glücksspiel und Lootboxen Ja/Nein. Die Stufe rechnet Apple selbst aus.

Quellen (abgerufen 23.09.2026):
[Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions) ·
[Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating) ·
[Ankündigung 24.07.2025](https://developer.apple.com/news/?id=ks775ehf) ·
[Social-Media-Fragen](https://developer.apple.com/news/?id=tlur8uvi)

Apples Zuordnung für die Fragen, die hier zählen:

| Inhalt | Selten → | Häufig → |
| --- | --- | --- |
| Alkohol, Tabak, Drogen (Konsum oder Bezüge) | 13+ | **18+** |
| Grober Humor / Schimpfwörter | 9+ | 13+ |
| Anzügliche Themen (Mature or Suggestive) | 9+ | 16+ |
| Simuliertes Glücksspiel | 13+ | 18+ |
| Wettbewerbe | 4+ | 13+ |

### In-App Controls

| Frage | Antwort | Warum |
| --- | --- | --- |
| Parental Controls | **Nein** | Es gibt keine Elternfunktion. |
| Age Assurance | **Nein** | Das Geburtsdatum ist eine Selbstangabe (Pflicht ab 16, `MIN_AGE` in `packages/server/src/birthday.ts:10`), Gäste geben keins an. Das ist keine Altersprüfung im Sinne der Frage. |

### Capabilities

| Frage | Antwort | Warum |
| --- | --- | --- |
| Unrestricted Web Access | **Nein** | Die Hülle zeigt nur den gebündelten Client; Impressum und Datenschutz öffnen als Blatt (`docs/APPSTORE.md`, WebAnsicht). Kein freier Browser. |
| User-Generated Content | **Ja** | Anzeigenamen, Clan-Namen und -Motto (`club.name`/`club.motto`, `packages/server/src/db/schema.ts:643,664`), Figurbemalung, Profilbilder, die auf der Webseite hochgeladen wurden, erscheinen auch in der App. Melden und Blockieren gibt es (`packages/server/src/http/melden-routen.ts`). |
| Social Media | **Nein** | Kein Feed, nichts wird weiterverbreitet, verstärkt oder kommentiert. |
| Social Media Disabled for Users Under 13 | entfällt | |
| Messaging and Chat | **Nein** | Clan-Chat ist in der App aus (`packages/client/src/screens/Clan.tsx:280,338`). Am Tisch gibt es nur vorgefertigte Zurufe (`emotes.ts`), keinen freien Text. **Geht der Clan-Chat in der App an: Ja.** |
| Advertising | **Nein** | Kein Werbe-SDK, keine Werbung. |

### Mature Themes

| Frage | Antwort | Warum |
| --- | --- | --- |
| Profanity or Crude Humor | **Häufig** | Partykiste Stufe „derb" (137 Einträge mit `haerte: 3`, z. B. Kategorie „Schimpfwörter", `packages/game-partykiste/src/inhalte/kategorien.ts:101`) und „pikant" („Kneipenniveau, mal anzüglich"). → 13+ |
| Horror/Fear Themes | **Keine** | |
| Alcohol, Tobacco, or Drug Use or References | **Häufig** | Der Trinkmodus ist die Vorgabe der Partykiste (`trinkmodus: an`, `docs/PARTYKISTE.md` Tischoptionen); die Minispielbeschreibungen sagen „Falsch heißt trinken", „Jede Stimme ist ein Schluck". Dazu 16 Kiffer-Einträge auf „pikant" (`niemals.json` n101–n110, `wereher.json` w101–w108). Apple zählt schon Bezüge. → **18+** |

### Medical or Wellness

| Frage | Antwort | Warum |
| --- | --- | --- |
| Medical or Treatment Information | **Keine** | |
| Health or Wellness Topics | **Keine** | |

### Sexuality or Nudity

| Frage | Antwort | Warum |
| --- | --- | --- |
| Mature or Suggestive Themes | **Häufig** | Auf „derb" ausdrücklich sexuelle Fragen und Kategorien (`mehrheit.ts:95–98`: „Sex lieber morgens oder abends?", `kategorien.ts:102`: „Wörter für Sex"), auf „pikant" Anzügliches. Die Einträge kommen nur auf Wunsch der Runde — ehrlich wäre auch „Selten", aber „Häufig" ändert das Ergebnis nicht (18+ kommt vom Alkohol) und lässt keine Angriffsfläche. → 16+ |
| Sexual Content or Nudity | **Keine** | Keine Bilder, keine Beschreibung sexueller Handlungen — nur Fragen und Kategorien, über die am Tisch geredet wird. |
| Graphic Sexual Content and Nudity | **Keine** | |

### Violence

| Frage | Antwort | Warum |
| --- | --- | --- |
| Cartoon or Fantasy Violence | **Keine** | Die drei Spiele haben keine. (Tafelrunde und Feldherr stehen auf „Bald" — **wechseln sie in die App: neu beantworten.**) |
| Realistic Violence | **Keine** | |
| Prolonged Graphic or Sadistic Realistic Violence | **Keine** | |
| Guns or Other Weapons | **Keine** | |

### Chance-Based Activities

| Frage | Antwort | Warum |
| --- | --- | --- |
| Gambling (Echtgeld) | **Nein** | Nirgends Einsätze mit Geld, keine Käufe in der App. |
| Simulated Gambling | **Keine** | Doppelkopf und Skat werden um Punkte gespielt, nicht um Einsätze. Poker (Spielgeld „BroJetons") steht in der App auf „Bald" und lässt sich nicht starten (`FREIGABE` in `packages/server/src/games/registry.ts:165`). Bus fahren und Königsbecher benutzen Karten, aber ohne Wetteinsatz. **Wechselt Poker in die App: Häufig → 18+.** |
| Contests | **Keine** | Ranglisten und Trophäen ohne Preise. |
| Loot Boxes | **Nein** | Truhen gibt es aus Tagesaufgaben, nie gegen Geld; der Shop ist in der App aus (`zeigeKaufbares` in `GameSelect.tsx:128`). Wer auch hier vorsichtig sein will: „Ja" ergäbe 9+ und ändert das Ergebnis nicht. |

### Ergebnis Apple: **18+**

Getragen allein von „Alkohol häufig". Ohne Trinkmodus und ohne Kiffer-Sprüche
(`APP_PARTYKISTE_TRINKMODUS=aus` und `APP_PARTYKISTE_HAERTE_MAX=1`, siehe
`docs/APP-RELEASE.md` Abschnitt 2) blieben Alkoholbezüge in Texten (Glühwein,
Kater) — „Selten" → 13+, zusammen mit derbem Humor (bei `HAERTE_MAX=1` fällt
auch der weg) wäre die App dann bei **13+**. Das ist der Rückweg, falls Apple
nach 1.4.3 ablehnt.

**Hinweis für Tom beim Ausfüllen:** Apple kann die Stufe „manuell höher
setzen" anbieten — nicht nötig, 18+ ist schon die höchste.

---

## IARC (Google Play „Inhaltsbewertung")

Den Fragebogen füllt man in der Play Console unter *Richtlinien → App-Inhalte
→ Einstufung* aus, Kategorie **Spiel**. Den genauen Wortlaut veröffentlicht
IARC nicht; die Fragen folgen denselben Themen. Unten steht je Thema die
Antwort und der Grund. Quellen:
[Play-Hilfe Einstufung](https://support.google.com/googleplay/android-developer/answer/188189),
[USK im IARC-System](https://usk.de/fuer-unternehmen/spiele-und-apps-pruefen-lassen/spiele-und-apps-im-iarc-system/),
[PEGI Drugs](https://pegi.info/index.php/drugs).

| Thema | Antwort | Warum |
| --- | --- | --- |
| Gewalt | **Nein** | wie oben |
| Angst, Horror | **Nein** | |
| Sexualität / Nacktheit | **Nein** zu Darstellung; **Ja** zu sexuellen Anspielungen/Andeutungen | derb/pikant, siehe Apple „Mature or Suggestive" |
| Glücksspiel | **Nein** (weder echt noch simuliert) | wie oben — **mit Poker in der App: Ja, simuliert** |
| Sprache: Schimpfwörter | **Ja, mild** | die Texte selbst sind zahm (kein Kraftausdruck im Katalog außer „Pornofilm", „Kater"); die Runde soll auf „derb" Schimpfwörter **nennen** |
| Derber Humor | **Ja** | Stufe „derb" |
| Alkohol | **Ja — Bezüge und Aufforderung zum Trinken im Spiel** | Trinkmodus: Wer verliert, trinkt |
| Tabak | **Nein** | |
| Drogen | **Ja — Bezüge** (Cannabis, humoristisch) | 16 Kiffer-Einträge; keine Anleitung, kein Kauf |
| Wird Drogenkonsum verherrlicht / belohnt? | **Nein** | Die Einträge fragen „Wer würde eher bekifft …" — keine Belohnung für Konsum im Spiel |
| Nutzer interagieren / tauschen Inhalte aus | **Ja** | Mehrspieler mit Fremden an öffentlichen Tischen, sichtbare Namen, Clans. Kein Chat in der App. |
| Teilt den Standort | **Nein** | |
| Digitale Käufe | **Nein** | |
| Werbung | **Nein** | |
| Uneingeschränkter Internetzugang | **Nein** | |

### Ergebnis IARC: **USK 16, PEGI 16** (erwartet)

- **PEGI:** Alkohol/Drogen im Spiel ergibt immer 16 oder 18
  ([pegi.info](https://pegi.info/index.php/drugs)); 18 dann, wenn die
  Antworten den Konsum als verherrlichend einstufen.
- **USK:** Vergleichsfall mit „Alkohol und Drogen positiv oder häufig
  dargestellt" bekam 16 ([USK-Titel 58449](https://usk.de/usktitle/58449/));
  bei „unreflektierter Darstellung von Drogenkonsum" ist 18 möglich.
- Dazu die Hinweise **„Nutzerinteraktion"**. Die IARC-Matrix ist nicht
  öffentlich — **die tatsächliche Stufe steht erst nach dem Absenden fest**
  und wird hier nachgetragen.

### Zielgruppe bei Play (App-Inhalte → Zielgruppe)

**Nur „18 und älter"** ankreuzen. Dann greifen die Familienrichtlinien nicht,
und es passt zu Apple 18+. **Widerspruch, den Robin entscheiden muss:** Die
App lässt Konten ab **16** zu (`MIN_AGE = 16`), die Datenschutzerklärung sagt
„ab 16 Jahren". Entweder `MIN_AGE` auf 18 (eine Zeile, aber Bestandskonten
zwischen 16 und 18 bleiben) oder bei Play zusätzlich „16–17" ankreuzen. Mit
Trinkmodus in einer 18+-App ist „ab 18" die ehrliche Linie. Siehe CHECKLISTE.
