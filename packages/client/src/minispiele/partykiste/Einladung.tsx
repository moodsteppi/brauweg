import { useEffect, useMemo, useState } from 'react';

import { api } from '../../api';
import { t } from '../../i18n';
import { einladungsLink } from './einladungslink';
import { qrMatrix, qrPfad, type QrMatrix } from './qr';

/**
 * Die Einladung im Wartesaal: Code gross, Link teilen, QR-Code.
 *
 * Seit dem 22.09.2026. Bis dahin hatte jeder Tisch einen Beitrittscode, aber
 * die Partykiste zeigte ihn nirgends — fuer ein Spiel, das vier bis zwoelf
 * Leute im selben Raum am Handy spielen, war „Online spielen und hoffen, dass
 * alle am selben offenen Tisch landen" der einzige Weg. Jetzt drei, weil am
 * Tisch drei Lagen vorkommen: Der Code wird vorgelesen (wer sein Handy schon
 * offen hat), der Link geht in den Gruppenchat (wer noch unterwegs ist), der
 * QR-Code wird ueber den Tisch gescannt (alle anderen).
 *
 * Der Code kommt nicht als Eigenschaft herein, sondern wird geholt: Im
 * Partykiste-Wartesaal kennt die Lobby ihren Tisch nicht, und den Bildschirm
 * darum herum baut gerade ein anderer Zweig um. Ohne `tischId` nimmt die
 * Einladung deshalb den wartenden Tisch des eigenen Kontos (`activeTable`) —
 * aber nur, wenn er zu `spiel` gehoert und wartet: `activeTableFor` stellt
 * laufende Tische nach vorn, und eine Einladung an eine fremde, laufende
 * Partie waere schlimmer als gar keine.
 *
 * Solange nichts feststeht, zeigt sie nichts — kein Platzhalter, der nach
 * Fehler aussieht (siehe CLAUDE.md, „Kein `<img>` auf eine Datei …").
 */
export function Einladung({
  spiel,
  tischId,
}: {
  spiel: string;
  tischId?: string | null;
}): React.JSX.Element | null {
  const [code, setCode] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<'kopiert' | 'nichtKopiert' | null>(null);

  /* An Zeichenketten gehaengt, nicht an ein Objekt — sonst holte der Effekt
     bei jedem Serverfunk der Lobby den Code neu (siehe CLAUDE.md). */
  useEffect(() => {
    let lebt = true;
    void (async () => {
      try {
        let id = tischId ?? null;
        if (!id) {
          const aktiv = (await api.me()).activeTable;
          if (!aktiv || aktiv.gameId !== spiel || aktiv.status !== 'waiting') return;
          id = aktiv.tableId;
        }
        const { table } = await api.tischMitCode(id);
        if (lebt && table.status === 'waiting' && table.joinCode) setCode(table.joinCode);
      } catch {
        /* Ohne Code keine Einladung. „Online spielen" geht trotzdem. */
      }
    })();
    return () => {
      lebt = false;
    };
  }, [spiel, tischId]);

  /* Der Hinweis nach dem Kopieren verschwindet von selbst: Er ist eine
     Bestaetigung, keine Meldung, die jemand wegklicken muss. */
  useEffect(() => {
    if (!hinweis) return;
    const uhr = window.setTimeout(() => setHinweis(null), 4000);
    return () => window.clearTimeout(uhr);
  }, [hinweis]);

  const link = code ? einladungsLink(code) : null;
  const matrix = useMemo<QrMatrix | null>(() => {
    if (!link) return null;
    try {
      return qrMatrix(link);
    } catch {
      // Zu lang fuer Version 10 — bei einer Adresse mit sechsstelligem Code
      // nicht moeglich, aber dann steht der Link als Text da, nicht ein
      // halber Code.
      return null;
    }
  }, [link]);

  if (!code || !link) return null;

  const teile = async (): Promise<void> => {
    setHinweis(null);
    /*
     * Zuerst das Teilen des Geraets: Am Handy oeffnet es direkt WhatsApp,
     * Signal oder die Nachrichten, und genau dahin soll der Link. Bricht der
     * Nutzer ab, ist das kein Fehler und auch kein Grund zu kopieren. Jeder
     * andere Fehler (Desktop-Browser ohne Freigabe, iframe) faellt aufs
     * Kopieren zurueck.
     */
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: t('einladung.teilenTitel'),
          text: `${t('einladung.teilenText')} ${code}`,
          url: link,
        });
        return;
      } catch (fehler) {
        if (fehler instanceof DOMException && fehler.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setHinweis('kopiert');
    } catch {
      // Keine Zwischenablage (unsicherer Ursprung, altes WebView): Der Link
      // steht darunter als Text und laesst sich von Hand markieren.
      setHinweis('nichtKopiert');
    }
  };

  const rand = 4;
  return (
    <section className="einladung" aria-label={t('einladung.titel')}>
      <h2 className="einladung-titel">{t('einladung.titel')}</h2>
      {/* Vorgelesen wird Zeichen fuer Zeichen — der Bildschirmleser soll es
          genauso sagen und nicht „K7X9MQ" als Wort versuchen. */}
      <p className="einladung-code" aria-label={`${t('einladung.codeAria')} ${code.split('').join(' ')}`}>
        {code}
      </p>
      {matrix ? (
        <svg
          className="einladung-qr"
          role="img"
          aria-label={t('einladung.qrAria')}
          viewBox={`${-rand} ${-rand} ${matrix.length + 2 * rand} ${matrix.length + 2 * rand}`}
          shapeRendering="crispEdges"
        >
          {/* Heller Grund mit Ruhezone, auch auf dunklem Tisch: Viele
              Kamera-Apps finden einen hellen Code auf dunklem Grund nicht. */}
          <rect
            x={-rand}
            y={-rand}
            width={matrix.length + 2 * rand}
            height={matrix.length + 2 * rand}
            fill="#fff"
          />
          <path d={qrPfad(matrix)} fill="#000" />
        </svg>
      ) : null}
      <button className="einladung-teilen" type="button" onClick={() => void teile()}>
        {t('einladung.teilen')}
      </button>
      {hinweis ? (
        <p className="einladung-hinweis" role="status">
          {t(`einladung.${hinweis}`)}
        </p>
      ) : null}
      <p className="einladung-link">{link}</p>
      <p className="einladung-unter">{t('einladung.hinweis')}</p>
    </section>
  );
}
