import { useEffect, useState } from 'react';

import { ApiError, api, type TischVorschau } from '../../api';
import { t } from '../../i18n';
import { codeNormalisieren, fehlschlagLesen, fehlschlagVergessen } from './einladungslink';

/**
 * Beitreten per Code — die Eingabe, die es bis zum 22.09.2026 nur in
 * Tafelrunde gab (`screens/Tafelrunde.tsx`, Ansicht „Tisch beitreten").
 *
 * Eine eigene Komponente statt einer Abschrift im Menue, weil sie in alle
 * Lobbys soll („Code-Eingabe ueberall", Robin am 22.09.2026) und die anderen
 * Menues gerade umgebaut werden: So ist es in jedem Schirm eine Zeile.
 *
 * `spiel` bremst einen Code, der zu einem anderen Spiel gehoert, VOR dem
 * Beitritt: Sonst saesse man an einem Tafelrunde-Tisch, waehrend der
 * Partykiste-Schirm eine Partykiste-Sicht erwartet, und der Wartesaal bliebe
 * leer. Deshalb erst `tischPerCode`, dann beitreten — zwei Rufe, wie in
 * Tafelrunde, und aus demselben Grund: Ein vertippter Code soll sagen, wohin
 * er fuehrt, statt stumm irgendwo hinzusetzen.
 *
 * Scheiterte davor ein Einladungslink (App.tsx), steht hier sein Code schon
 * drin und darunter der Grund — wer den Link geoeffnet hat, soll sehen, was
 * los ist, statt auf einem leeren Menue zu landen.
 */
export function Beitrittscode({
  spiel,
  onBeigetreten,
}: {
  spiel: string;
  onBeigetreten: (tableId: string) => void;
}): React.JSX.Element {
  const [vorher] = useState(fehlschlagLesen);
  const [code, setCode] = useState(vorher?.code ?? '');
  const [vorschau, setVorschau] = useState<TischVorschau | null>(null);
  const [fehler, setFehler] = useState<string | null>(vorher ? t(vorher.messageKey) : null);
  const [laeuft, setLaeuft] = useState(false);

  /* Der Grund gilt fuer diesen einen Besuch des Menues, nicht fuer den naechsten. */
  useEffect(() => fehlschlagVergessen(), []);

  const rein = codeNormalisieren(code);
  const fertig = rein.length >= 6;

  /* Am normalisierten Code als Zeichenkette, nicht an einem Objekt. */
  useEffect(() => {
    setVorschau(null);
    if (!fertig) return;
    let lebt = true;
    void api
      .tischPerCode(rein)
      .then((v) => {
        if (lebt) setVorschau(v);
      })
      .catch(() => {
        // Man tippt noch. Die Absage kommt beim Beitreten, mit Grund.
      });
    return () => {
      lebt = false;
    };
  }, [rein, fertig]);

  const trittBei = async (): Promise<void> => {
    setFehler(null);
    setLaeuft(true);
    try {
      const tisch = await api.tischPerCode(rein);
      if (tisch.gameId !== spiel) {
        setFehler(`${t('einladung.anderesSpiel')} ${t(`game.${tisch.gameId}`)}.`);
        return;
      }
      const { tableId } = await api.beitretenPerCode(rein);
      onBeigetreten(tableId);
    } catch (err) {
      setFehler(err instanceof ApiError ? t(err.messageKey) : t('einladung.fehlgeschlagen'));
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <form
      className="beitrittscode"
      onSubmit={(e) => {
        e.preventDefault();
        if (fertig && !laeuft) void trittBei();
      }}
    >
      <h2 className="beitrittscode-titel">{t('einladung.eingabeTitel')}</h2>
      <input
        className="beitrittscode-feld"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="CODE"
        aria-label={t('einladung.eingabeAria')}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        maxLength={12}
      />
      {vorschau ? (
        <p className="beitrittscode-vorschau">
          {vorschau.host ? `${t('einladung.tischVon')} ${vorschau.host}` : t('einladung.offenerTisch')}{' '}
          · {vorschau.occupied}/{vorschau.seats} {t('einladung.besetzt')}
        </p>
      ) : null}
      <button className="beitrittscode-knopf" type="submit" disabled={!fertig || laeuft}>
        {t('einladung.beitreten')}
      </button>
      {fehler ? (
        <p className="beitrittscode-fehler" role="alert">
          {fehler}
        </p>
      ) : null}
    </form>
  );
}
