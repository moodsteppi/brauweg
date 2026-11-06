/**
 * Schaukasten des Zauberer-Tisches.
 *
 * Zeichnet den ECHTEN Tisch (`ZaubererTisch`) mit erfundenen Sichten
 * (`faelle.ts`), ohne Server und ohne Anmeldung. Entstanden mit der englischen
 * Fassung des Tisches (Projekt „BroweGGames Language"): Die Ansage, die
 * Trumpfwahl und die blinde Runde sieht man am echten Tisch erst mitten in
 * einer Partie — und die Sichtprobe kann nicht klicken.
 *
 * Aufruf in der Entwicklung: `npm run dev:client`, dann
 * http://localhost:5173/zauberer-schaukasten.html?fall=gebot&sprache=en
 *
 *   fall    gebot (Vorgabe) · trumpf · spiel · blind · runde · tafel · pause
 *   sprache de · en — ohne Angabe gilt, was eingestellt ist
 *
 * Ein Tipp schickt nichts ab.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../styles.css';
import { deckForGame } from '../../decks';
import { setzeSprachwahl } from '../../i18n';
import { istSprache } from '../../i18n/sprachen';
import { Punktetafel, Rundenblatt, ZaubererTisch } from '../../screens/WizardTable';
import { GESCHICHTE, SITZE, verbindungFuer } from './faelle';

const suche = new URLSearchParams(location.search);
const sprache = suche.get('sprache');
if (istSprache(sprache)) setzeSprachwahl(sprache);
const fall = suche.get('fall') ?? 'gebot';

const nichts = (): void => undefined;
const verbindung = verbindungFuer(fall);
const nameOf = (seat: number): string => SITZE[seat]?.displayName ?? `Bot ${seat + 1}`;
const sitze = SITZE.map((s) => s.seat);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ZaubererTisch
      tableId="schaukasten"
      deck={deckForGame('wizard', null)}
      szene="stube"
      onShowProfile={nichts}
      onLeave={nichts}
      verbindung={verbindung}
    />
    {fall === 'runde' && (
      <Rundenblatt runde={GESCHICHTE[3]!} seats={sitze} nameOf={nameOf} onClose={nichts} />
    )}
    {fall === 'tafel' && (
      <Punktetafel
        history={GESCHICHTE}
        seats={sitze}
        scores={verbindung.view!.view.scores}
        nameOf={nameOf}
        onClose={nichts}
      />
    )}
  </StrictMode>,
);
