import './lernen.css';

/**
 * Der Tipp am Uebungstisch (Lektion „Deine erste Runde").
 *
 * Er liest nur, was die Sicht ohnehin sagt — welche Karten `legalActions`
 * erlaubt, ob man am Zug ist, ob ein Vorbehalt gefragt ist — und setzt einen
 * Satz dazu. Er rechnet keine Regel nach (CLAUDE.md): Ob man bedienen muss,
 * steht in der Zahl der erlaubten Karten, nicht in einer Pruefung hier.
 */
export function LernTipp({
  phase,
  amZug,
  vorbehaltGefragt,
  erlaubt,
  handGroesse,
  stichLeer,
  partei,
}: {
  phase: string | null;
  amZug: boolean;
  vorbehaltGefragt: boolean;
  /** Wie viele Handkarten `legalActions` gerade erlaubt. */
  erlaubt: number;
  handGroesse: number;
  stichLeer: boolean;
  partei: string | null;
}): React.JSX.Element | null {
  const satz = tippText({ phase, amZug, vorbehaltGefragt, erlaubt, handGroesse, stichLeer, partei });
  if (!satz) return null;
  // Beim Bedienen dunkelt lernen.css die nicht erlaubten Handkarten ab — nur
  // dann stimmt „Nur die hellen Karten sind erlaubt".
  const bedienen = phase === 'playing' && amZug && !stichLeer && erlaubt > 0 && erlaubt < handGroesse;
  return (
    <div className="ln-tipp" role="status" data-bedienen={bedienen ? '' : undefined}>
      <span className="ln-tipp-symbol" aria-hidden="true">
        ?
      </span>
      <span>{satz}</span>
    </div>
  );
}

/** Ein Satz zur Lage. Eigene Funktion, damit er sich ohne Tisch pruefen laesst. */
export function tippText({
  phase,
  amZug,
  vorbehaltGefragt,
  erlaubt,
  handGroesse,
  stichLeer,
  partei,
}: {
  phase: string | null;
  amZug: boolean;
  vorbehaltGefragt: boolean;
  erlaubt: number;
  handGroesse: number;
  stichLeer: boolean;
  partei: string | null;
}): React.ReactNode {
  if (vorbehaltGefragt) {
    return (
      <>
        Hast du eine normale Hand? Dann sag einfach <b>„gesund"</b>.
      </>
    );
  }
  if (phase !== 'playing') return null;
  const parteiSatz = partei === 're' ? ' Du hast eine Kreuz-Dame: Du spielst Re.' : partei === 'kontra' ? ' Keine Kreuz-Dame: Du spielst Kontra.' : '';
  if (!amZug || erlaubt === 0) return <>Die anderen sind dran. Schau, wer welche Karte legt.{parteiSatz}</>;
  if (stichLeer) {
    return (
      <>
        <b>Du spielst aus.</b> Ein Fehl-Ass holt oft den Stich.{parteiSatz}
      </>
    );
  }
  if (erlaubt < handGroesse) {
    return (
      <>
        <b>Bedienen!</b> Nur die hellen Karten sind erlaubt.
      </>
    );
  }
  // Alles erlaubt heisst nicht sicher „kann nicht bedienen": Liegt nur noch die
  // ausgespielte Farbe auf der Hand, ist auch alles erlaubt. Der Satz stimmt
  // deshalb in beiden Faellen — eine Regel nachrechnen soll er nicht.
  return (
    <>
      Alle Karten sind erlaubt. Fehlt dir die Farbe, darfst du <b>mit Trumpf stechen</b>.
    </>
  );
}
