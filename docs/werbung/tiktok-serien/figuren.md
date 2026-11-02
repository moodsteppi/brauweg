# TikTok-Figuren — 20 Steckbriefe

Ausgangspunkt ist das BroweGGames-Logo (`packages/client/public/icon-512.png`):
drei Pinguine (rot-orange mit Steuerkreuz auf der Flosse, lila, türkis mit
Spielknöpfen auf der Flosse) und eine Giraffe mit zwei Spielkarten (Herz,
Pik). Dazu kommt der Ritter-Pinguin aus dem alten Brauweg-Schriftzug
(`docs/ASSETS-LOGO.md`). Alle Namen sind neu erfunden. Die Namen aus den
Ads 1–3 (Jule, Tarek, Mira, Lena, Tobi, Sara, Jonas, Basti, Nele, Kalle,
Robin) kommen bewusst nicht vor.

Stil, Bildmaße und Auflagen stehen in `README.md`.

## Übersicht

| Nr. | Name | Art | Rolle in der Serie | Bild (VerseIn-Aufgabe) |
|---:|---|---|---|---|
| 1 | Pelle | Pinguin | Hauptfigur, Grundform | `image_ea6a43d3-1835-44eb-b039-6eca19fed2bd` (mit Wasserzeichen) |
| 2 | Pelle als Ritter | Pinguin | Hauptfigur, Turnier-Auslegung | offen |
| 3 | Pelle auf dem Sofa | Pinguin | Hauptfigur, Alltag | offen |
| 4 | Pelle als Gastgeber | Pinguin | Hauptfigur, Spieleabend | offen |
| 5 | Klein-Pelle | Pinguin (Küken) | Hauptfigur, Rückblenden | offen |
| 6 | Malve | Pinguin | beste Freundin, Strategin | offen |
| 7 | Tjark | Pinguin | bester Freund, Zocker | offen |
| 8 | Gundi | Giraffe | Freundin, ehrliche Haut | offen |
| 9 | Oma Ottilie | Kaiserpinguin | Pelles Oma, Legende | offen |
| 10 | Wenzel | Walross | Regelfuchs | offen |
| 11 | Kira | Möwe | Störenfried | offen |
| 12 | Fiete | Kiebitz | Zuschauer, der reinredet | offen |
| 13 | Hinnerk | Eisbär | gutmütiger Verlierer | offen |
| 14 | Puk | Papageitaucher | filmt alles | offen |
| 15 | Fenja | Polarfuchs | Bluffkönigin | offen |
| 16 | Theo | Schildkröte | langsamster Spieler | offen |
| 17 | Ulla | Schneeeule | Nachteule | offen |
| 18 | Sanna | Seehund | Sportskanone | offen |
| 19 | Paco | Alpaka | der Neue | offen |
| 20 | Oktavia | Krake | spielt an acht Tischen | offen |

---

## Stilblock für jeden Prompt

Wird **vor** jeden Figuren-Prompt gesetzt (englisch, weil die Bildmodelle
damit verlässlicher arbeiten):

> Adult animated sitcom cartoon style, thick uniform black outlines with a
> slightly wobbly hand-drawn feel, flat colors with one hard cel-shadow
> step, no gradients, big round googly eyes with small pupils, slightly
> uneven, exaggerated proportions, large head, thin limbs. Full-body
> character, centered, three-quarter view facing the viewer, plain flat
> warm light grey background (#EDE6DA), no text, no letters, no logo, no
> watermark. Original character design.

Negativ-Prompt (wo das Modell einen hat):

> text, letters, writing, logo, watermark, checkerboard background,
> transparency grid, lab coat, spiky hair, portal, alcohol, bottle,
> cigarette, money, banknotes, brand logos, smartphone brand, realistic,
> 3d render, photo, gradient shading

---

## 1 — Pelle (Grundform)

- **Name:** Pelle
- **Art:** Pinguin (der rot-orange Pinguin aus dem Logo)
- **Charakter:** Ein übermotivierter Optimist, der jeden Abend zum
  Spieleabend erklärt und fest daran glaubt, dass er diesmal gewinnt.
- **Rolle beim Kartenspiel:** Er macht den Tisch auf und schickt den Link
  herum — ohne ihn spielt niemand, aber er verliert erstaunlich oft.
- **Stimme (ElevenLabs):** Hell, schnell und etwas atemlos, ein junger
  Erwachsener, der vor Begeisterung über seine eigenen Sätze stolpert.
- **Bild-Prompt:** A short chubby penguin with a red-orange back and
  flippers, cream-white belly and face, bright orange beak and feet, a small
  white plus-shaped gamepad cross printed on his left flipper, huge eager
  eyes, wide grin, holding a fan of three playing cards (heart and spade
  symbols only) in one flipper and waving with the other.

## 2 — Pelle als Ritter

- **Name:** Pelle (Auslegung „Ritter")
- **Art:** Pinguin
- **Charakter:** Derselbe Pelle, der sich beim Turnier für einen edlen
  Ritter hält und jede Runde wie eine Schlacht ankündigt.
- **Rolle beim Kartenspiel:** Taucht bei Turnieren, Trophäen und Siegen
  auf — die Episode, in der er endlich gewinnt (oder es nur glaubt).
- **Stimme (ElevenLabs):** Pelles Stimme, aber künstlich tief und
  feierlich, mit übertriebenem Pathos, das nach zwei Wörtern wieder
  umkippt.
- **Bild-Prompt:** The same red-orange penguin (same body shape, same
  gamepad cross on the flipper) wearing a shiny light-silver knight helmet
  with an open visor, a bright blue feather plume on top and warm gold ear
  pieces, puffing out his chest, holding a single oversized playing card
  (heart symbol) like a shield.

## 3 — Pelle auf dem Sofa

- **Name:** Pelle (Auslegung „Sofa")
- **Art:** Pinguin
- **Charakter:** Pelle im Feierabendmodus: verstrubbelt, im Kapuzenpulli,
  aber sofort hellwach, sobald jemand „Runde?" schreibt.
- **Rolle beim Kartenspiel:** Der Einstieg vieler Folgen — er liegt
  gelangweilt herum, das Handy brummt, und der Abend beginnt.
- **Stimme (ElevenLabs):** Pelles Stimme, verschlafen und nuschelig, die
  innerhalb eines Satzes in die volle Begeisterung hochfährt.
- **Bild-Prompt:** The same red-orange penguin slouched on a lumpy purple
  couch, wearing an oversized plain teal hoodie with no print, feathers on
  his head ruffled, half-closed sleepy eyes, holding a plain generic
  smartphone with the screen facing away from the viewer, a crumpled
  blanket and a bowl of popcorn beside him.

## 4 — Pelle als Gastgeber

- **Name:** Pelle (Auslegung „Gastgeber")
- **Art:** Pinguin
- **Charakter:** Pelle, der sich für seinen Spieleabend schick macht und
  dabei viel zu viel Wert auf Snacks und Sitzordnung legt.
- **Rolle beim Kartenspiel:** Der Gastgeber am echten Tisch — verteilt
  Plätze, erklärt Regeln, die keiner hören will, und wird dann
  ausgerechnet im ersten Stich erwischt.
- **Stimme (ElevenLabs):** Pelles Stimme, aufgesetzt höflich wie ein
  Kellner im feinen Restaurant, mit hörbarem Grinsen.
- **Bild-Prompt:** The same red-orange penguin wearing a too-small navy
  blue blazer and a crooked orange bow tie, standing proudly, holding a
  tray with a bowl of crisps and a deck of cards in one flipper, the other
  flipper making an inviting gesture.

## 5 — Klein-Pelle

- **Name:** Klein-Pelle
- **Art:** Pinguinküken
- **Charakter:** Pelle als flauschiges Küken, das schon damals Oma
  Ottilie beim Kartenspielen über die Schulter geschaut hat.
- **Rolle beim Kartenspiel:** Rückblenden — „wie alles anfing"; hält die
  Karten noch verkehrt herum und gewinnt trotzdem.
- **Stimme (ElevenLabs):** Ein sehr hohes, piepsiges Kinderstimmchen mit
  Lispeln, neugierig und ohne Pause fragend.
- **Bild-Prompt:** A tiny fluffy penguin chick version of the red-orange
  penguin: round fuzzy grey-orange down feathers, oversized head, enormous
  shining eyes, tiny orange beak, holding a single playing card upside
  down with both flippers, standing on tiptoes.

## 6 — Malve

- **Name:** Malve
- **Art:** Pinguin (der lila Pinguin aus dem Logo)
- **Charakter:** Kühle Analytikerin, die nie die Stimme hebt und einen
  Spielzug drei Runden im Voraus kommen sieht.
- **Rolle beim Kartenspiel:** Die Strategin — zählt Karten, gewinnt leise
  und rollt die Augen, wenn Pelle „Re" sagt.
- **Stimme (ElevenLabs):** Ruhige, trockene Frauenstimme, mittlere Tonlage,
  jedes Wort sitzt, ein Hauch Spott am Satzende.
- **Bild-Prompt:** A tall slim penguin with a deep violet-purple back and
  head, cream-white belly, orange beak, half-lidded unimpressed eyes, one
  eyebrow raised, wearing round thin glasses, holding her cards close to
  her chest so nobody can see them, arms crossed.

## 7 — Tjark

- **Name:** Tjark
- **Art:** Pinguin (der türkise Pinguin aus dem Logo)
- **Charakter:** Lauter Draufgänger, der jedes Risiko eingeht, weil er
  Langeweile schlimmer findet als Verlieren.
- **Rolle beim Kartenspiel:** Der Zocker — sagt jedes Spiel an, reizt zu
  hoch, und wenn es klappt, tanzt er auf dem Tisch.
- **Stimme (ElevenLabs):** Laute, leicht raue Kumpelstimme, männlich, mit
  norddeutschem Einschlag und viel Lachen in den Sätzen.
- **Bild-Prompt:** A stocky penguin with a bright teal back and flippers,
  cream-white belly, four round white game-controller buttons printed on
  one flipper, orange beak, wild excited eyes, a cocky wide grin, slamming
  a playing card (spade symbol) down with great force, one foot raised.

## 8 — Gundi

- **Name:** Gundi
- **Art:** Giraffe (die Giraffe aus dem Logo)
- **Charakter:** Herzensgute, grundehrliche Giraffe, die jeden Verdacht
  persönlich nimmt.
- **Rolle beim Kartenspiel:** Der Running Gag: Mit ihrem langen Hals
  könnte sie in alle Blätter schauen — sie tut es nie, wird aber in jeder
  Folge verdächtigt.
- **Stimme (ElevenLabs):** Warme, weiche Frauenstimme, etwas langsam, mit
  hörbarer Empörung, wenn man ihr etwas unterstellt.
- **Bild-Prompt:** A friendly giraffe with warm golden-yellow fur and
  rich brown patches, cream muzzle, two stubby horns with dark knobs,
  extremely long neck bent so her head is looking away on purpose with
  eyes squeezed shut, holding two playing cards (one heart, one spade)
  primly in her front hoof, sitting on a too-small stool.

## 9 — Oma Ottilie

- **Name:** Ottilie („Oma Ottilie")
- **Art:** Kaiserpinguin
- **Charakter:** Pelles Großmutter, die seit sechzig Jahren Doppelkopf
  spielt und jeden am Tisch mit einem einzigen Blick einschüchtert.
- **Rolle beim Kartenspiel:** Die Legende — taucht auf, wenn die Jüngeren
  einen Streit über eine Regel haben, und entscheidet ihn. Gewinnt fast
  immer.
- **Stimme (ElevenLabs):** Alte, knarzige, sehr bestimmte Frauenstimme mit
  langen Pausen und einem überraschend frechen Kichern.
- **Bild-Prompt:** An old emperor penguin lady, large and round, with
  grey-black back, pale yellow-orange neck patches, cream belly, thick
  knitted lilac cardigan, pearl necklace, small round reading glasses on
  the tip of her beak, one eyebrow raised menacingly, holding a perfectly
  tidy fan of cards, sitting upright in a floral armchair.

## 10 — Wenzel

- **Name:** Wenzel
- **Art:** Walross
- **Charakter:** Pedantischer, aber gutmütiger Regelfuchs, der jede
  Ausnahme auswendig kennt und sie gern ungefragt vorträgt.
- **Rolle beim Kartenspiel:** Schiedsrichter wider Willen — wird gerufen,
  wenn keiner weiter weiß, und schlägt im dicken Regelbuch nach.
- **Stimme (ElevenLabs):** Tiefe, brummige Männerstimme, gemächlich, mit
  belehrendem Unterton und einem Räuspern vor jedem Satz.
- **Bild-Prompt:** A big rotund walrus with wrinkly pinkish-brown skin,
  long ivory tusks, a bushy grey moustache, tiny round spectacles, a
  plain brown knitted vest, holding a huge thick book with a blank cover
  open in his flippers, one flipper raised with a pointing gesture.

## 11 — Kira

- **Name:** Kira
- **Art:** Möwe
- **Charakter:** Freche, gierige Möwe, die nie eingeladen ist und trotzdem
  in jeder Folge auftaucht.
- **Rolle beim Kartenspiel:** Der Störenfried — klaut Snacks, manchmal
  eine Karte, und kreischt im ungünstigsten Moment.
- **Stimme (ElevenLabs):** Schrille, kratzige Frauenstimme, sehr schnell,
  mit Lachern, die wie Kreischen klingen.
- **Bild-Prompt:** A scruffy seagull with white and pale grey feathers,
  yellow beak with a red dot, mismatched eyes (one bigger than the other),
  a mischievous grin, a single playing card stolen in her beak, a potato
  chip stuck to her head feathers, wings spread mid-hop.

## 12 — Fiete

- **Name:** Fiete
- **Art:** Kiebitz
- **Charakter:** Ein Besserwisser, der selbst nie mitspielt, aber jedem
  ungefragt sagt, was er hätte legen sollen — ein Kiebitz, der kiebitzt.
- **Rolle beim Kartenspiel:** Der Zuschauer hinter der Schulter;
  kommentiert jede Folge aus dem Off und verrät manchmal versehentlich
  Blätter.
- **Stimme (ElevenLabs):** Näselnde, nervöse Männerstimme mittlerer
  Tonlage, flüsternd-aufgeregt wie ein Sportkommentator kurz vor dem Tor.
- **Bild-Prompt:** A small lapwing bird with glossy dark green-black back,
  white face and belly, a long thin wispy crest on his head, peeking over
  the edge of something with wide nosy eyes, one wing pointing as if
  giving advice, leaning forward on thin pink legs.

## 13 — Hinnerk

- **Name:** Hinnerk
- **Art:** Eisbär
- **Charakter:** Ein sanfter Riese mit unerschütterlich guter Laune, den
  kein Verlust aus der Ruhe bringt.
- **Rolle beim Kartenspiel:** Der ewige Verlierer, der sich trotzdem über
  jede Runde freut — und genau deshalb immer wieder eingeladen wird.
- **Stimme (ElevenLabs):** Sehr tiefe, langsame, warme Männerstimme, die
  immer nach Lächeln klingt.
- **Bild-Prompt:** A huge fluffy polar bear with cream-white fur, small
  black eyes, a big black nose, a broad happy smile, wearing a cozy red
  knitted scarf, holding tiny playing cards that look miniature in his
  enormous paws, sitting cross-legged.

## 14 — Puk

- **Name:** Puk
- **Art:** Papageitaucher
- **Charakter:** Quirlige Selbstdarstellerin, für die ein Abend erst
  zählt, wenn er gefilmt ist.
- **Rolle beim Kartenspiel:** Die Kamera in der Gruppe — filmt die besten
  Momente und ist damit die Brücke zu den TikTok-Clips selbst.
- **Stimme (ElevenLabs):** Hohe, fröhliche Frauenstimme mit
  Influencer-Singsang, betont jedes dritte Wort.
- **Bild-Prompt:** A small puffin with a black back, white face and
  belly, a big colorful striped beak (orange, yellow, grey), bright orange
  feet, holding a plain generic phone on a selfie stick with the screen
  facing away from the viewer, posing with a wink and a peace-sign wing.

## 15 — Fenja

- **Name:** Fenja
- **Art:** Polarfuchs
- **Charakter:** Charmante, unlesbare Bluffkönigin, die immer lächelt —
  ob sie ein gutes oder ein grauenhaftes Blatt hat.
- **Rolle beim Kartenspiel:** Die Pokerspielerin der Gruppe; niemand weiß
  je, ob sie blufft, und genau das macht jede Runde mit ihr spannend.
- **Stimme (ElevenLabs):** Samtige, tiefe Frauenstimme, leise und
  verschmitzt, mit kurzen bedeutungsvollen Pausen.
- **Bild-Prompt:** A sleek arctic fox with snow-white fur, a big fluffy
  tail curled around her, narrow amber eyes, a sly closed-mouth smile,
  holding two cards face down under one paw and tapping them with a claw,
  wearing a thin plain dark-green scarf.

## 16 — Theo

- **Name:** Theo
- **Art:** Schildkröte
- **Charakter:** Gemütlicher Grübler, der jeden Zug von allen Seiten
  bedenkt, während alle anderen einschlafen.
- **Rolle beim Kartenspiel:** Der Langsamste am Tisch — der Gag mit der
  ablaufenden Zugzeit, bei dem am Ende der Bot für ihn spielt.
- **Stimme (ElevenLabs):** Ältere, extrem langsame Männerstimme mit
  langen „Hmmm"-Pausen mitten im Satz.
- **Bild-Prompt:** A small old tortoise with an olive-green patterned
  shell, wrinkly grey-green skin, droopy heavy eyelids, deep in thought,
  holding one card hovering above the table without putting it down, a
  tiny hourglass beside him.

## 17 — Ulla

- **Name:** Ulla
- **Art:** Schneeeule
- **Charakter:** Nachtaktive Grüblerin, die um drei Uhr früh am besten
  spielt und morgens nicht ansprechbar ist.
- **Rolle beim Kartenspiel:** Taucht in den Nachtfolgen auf — wer um
  Mitternacht noch einen Tisch sucht, findet sie.
- **Stimme (ElevenLabs):** Ruhige, leicht heisere Frauenstimme, sehr
  wach und flüsternd, als wolle sie niemanden wecken.
- **Bild-Prompt:** A round snowy owl with white feathers speckled with
  black, enormous glowing yellow eyes wide open, a tiny black beak,
  wearing a nightcap with a pompom, holding a fan of cards close to her
  face, perched on the back of a chair, a crescent moon shape behind her
  as a simple flat shape.

## 18 — Sanna

- **Name:** Sanna
- **Art:** Seehund
- **Charakter:** Ehrgeizige Sportskanone, die aus jedem Spiel einen
  Wettkampf macht und Ausreden nicht gelten lässt.
- **Rolle beim Kartenspiel:** Die Sportliche, die zwischen den Kartenrunden
  zum Minigolf und zu den schnellen Spielen wechselt.
- **Stimme (ElevenLabs):** Kräftige, klare junge Frauenstimme, motivierend
  wie eine Trainerin, mit Pfiff in der Stimme.
- **Bild-Prompt:** A sleek harbor seal with silvery grey spotted fur, big
  dark shiny eyes, long whiskers, wearing a plain sporty headband and a
  whistle around her neck, balancing a golf ball on her nose while holding
  a mini golf putter in one flipper.

## 19 — Paco

- **Name:** Paco
- **Art:** Alpaka
- **Charakter:** Liebenswert ahnungsloser Neuling, der keine Regel kennt
  und trotzdem mit Anfängerglück gewinnt.
- **Rolle beim Kartenspiel:** Der Neue in der Gruppe — durch ihn wird in
  den Folgen erklärt, wie einfach der Einstieg ist.
- **Stimme (ElevenLabs):** Freundliche, etwas verwirrte Männerstimme mit
  leichtem Lispeln, jeder Satz klingt wie eine Frage.
- **Bild-Prompt:** A fluffy alpaca with a huge round cloud of cream-white
  wool on his head, light caramel body, long neck, big confused eyes,
  buck teeth, holding his cards the wrong way round with the backs facing
  himself, a question-mark-shaped tuft of wool on top (shape only, no
  text).

## 20 — Oktavia

- **Name:** Oktavia
- **Art:** Krake
- **Charakter:** Hyperaktive Vielspielerin, die nie bei nur einer Sache
  bleiben kann.
- **Rolle beim Kartenspiel:** Spielt an acht Tischen gleichzeitig, mit
  jedem Arm einer — die Figur für „acht Spieler an einem Tisch" und für
  die vielen Spiele von BroweGGames.
- **Stimme (ElevenLabs):** Schnelle, sprudelnde Frauenstimme mit hoher
  Tonlage, die mehrere Gedanken in einen Satz packt.
- **Bild-Prompt:** A cheerful octopus with coral-pink skin and lighter
  suction cups, big excited eyes, a wide smile, each of her eight
  tentacles holding a different small playing card or card fan, tentacles
  spreading out in every direction, slightly floating above the ground.
