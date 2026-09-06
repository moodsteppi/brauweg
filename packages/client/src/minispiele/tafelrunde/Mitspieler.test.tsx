import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * Die Mitspielerleiste.
 *
 * Geprueft wird, was man beim Spielen sofort merken wuerde: Steht mein
 * eigener Sitz mit drin, ist ein ausgeschiedener Sitz als solcher erkennbar,
 * und ist mein Gegner dieser Runde AUCH IM TEXT markiert — nicht nur in der
 * Farbe. Die Zahlen selbst kommen aus der Sicht; die Leiste darf sie nicht
 * nachrechnen, deshalb bekommt sie hier Werte, die sich nicht ableiten
 * lassen (Leben 0 an einem Sitz, der noch dabei ist).
 *
 * Das Aussehen (wo die Leiste haengt, wie der Balken laeuft) liegt in
 * Mitspieler.module.css und ist hier ausdruecklich nicht Gegenstand.
 */

import { type Sitzzeile, Mitspielerleiste, sitzname } from './Mitspieler';

const SITZE: Sitzzeile[] = [
  { seat: 0, displayName: 'Robin', avatarUrl: null, isBot: false },
  { seat: 1, displayName: null, avatarUrl: null, isBot: true },
  { seat: 2, displayName: 'Tom', avatarUrl: null, isBot: false },
  { seat: 3, displayName: null, avatarUrl: null, isBot: false },
];

function stand(teil: Partial<Parameters<typeof Mitspielerleiste>[0]['gegner'][number]> & { sitz: number }) {
  return { leben: 100, level: 1, ausRunde: null, bereit: false, ...teil };
}

function zeichne(teil: Partial<Parameters<typeof Mitspielerleiste>[0]> = {}) {
  const onWahl = vi.fn();
  render(
    <Mitspielerleiste
      eigenes={stand({ sitz: 0 })}
      gegner={[stand({ sitz: 1 }), stand({ sitz: 2 }), stand({ sitz: 3 })]}
      gegnerJetzt={null}
      gezeigt={null}
      sitze={SITZE}
      onWahl={onWahl}
      {...teil}
    />,
  );
  return { onWahl };
}

describe('sitzname', () => {
  it('nimmt den Anzeigenamen, sonst KI, sonst die Sitznummer', () => {
    expect(sitzname(SITZE[0], 0)).toBe('Robin');
    expect(sitzname(SITZE[1], 1)).toBe('KI');
    expect(sitzname(SITZE[3], 3)).toBe('Sitz 4');
    expect(sitzname(undefined, 5)).toBe('Sitz 6');
  });
});

describe('Mitspielerleiste', () => {
  it('zeigt alle Sitze — auch den eigenen', () => {
    /* Genau die Luecke der Aufgabe: Vorher standen nur die Gegner da, und man
       konnte sein eigenes Leben nicht mit ihrem vergleichen. */
    zeichne();
    expect(screen.getByText('Robin')).toBeInTheDocument();
    expect(screen.getByText('KI')).toBeInTheDocument();
    expect(screen.getByText('Tom')).toBeInTheDocument();
    expect(screen.getByText('Sitz 4')).toBeInTheDocument();
    expect(screen.getByText('Du')).toBeInTheDocument();
  });

  it('nennt, wie viele noch dabei sind', () => {
    zeichne({
      eigenes: stand({ sitz: 0 }),
      gegner: [stand({ sitz: 1, ausRunde: 4 }), stand({ sitz: 2, ausRunde: 6 }), stand({ sitz: 3 })],
    });
    /* Sichtbar sagen es die ausgegrauten Kacheln; als Satz steht die Zahl im
       Namen der Gruppe, damit ein Vorlesegeraet sie nennt, ohne dass eine
       Zeile in der festgehefteten Kopfleiste dafuer draufgeht. */
    expect(screen.getByRole('group', { name: 'Mitspieler — noch 2 von 4' })).toBeInTheDocument();
  });

  it('markiert den Gegner der Runde mit einem Wort, nicht nur mit Farbe', () => {
    zeichne({ gegnerJetzt: 2 });
    expect(screen.getByText('Gegner')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Tom.*dein Gegner diese Runde/ }),
    ).toBeInTheDocument();
  });

  it('sagt beim Vorlesen, wer ausgeschieden ist', () => {
    zeichne({ gegner: [stand({ sitz: 1, ausRunde: 5 }), stand({ sitz: 2 }), stand({ sitz: 3 })] });
    expect(screen.getByRole('button', { name: /KI.*ausgeschieden/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tom.*ausgeschieden/ })).toBeNull();
  });

  it('haelt einen Sitz mit null Leben fuer dabei, solange keine Runde des Ausscheidens steht', () => {
    /* Die Leiste darf `ausgeschieden` nicht aus dem Leben ableiten: Zwischen
       Kampf und Rundenwechsel faellt beides auseinander (sicht.ts). */
    zeichne({ eigenes: stand({ sitz: 0, leben: 0 }) });
    expect(screen.getByRole('group', { name: /noch 4 von 4/ })).toBeInTheDocument();
  });

  it('macht aus dem eigenen Sitz keine Schaltflaeche', () => {
    /* Sein Brett liegt ohnehin unten — ein Knopf, der nichts tut, ist
       schlimmer als keiner. */
    const { onWahl } = zeichne();
    expect(screen.queryByRole('button', { name: /Robin/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Tom/ }));
    expect(onWahl).toHaveBeenCalledWith(2);
  });

  it('zeigt bereit nur an Sitzen, die noch spielen', () => {
    /* Ein ausgeschiedener Sitz steht dauerhaft auf bereit; ein Punkt an ihm
       saehe aus, als warte der Tisch auf ihn. */
    zeichne({
      gegner: [
        stand({ sitz: 1, bereit: true }),
        stand({ sitz: 2, bereit: true, ausRunde: 3 }),
        stand({ sitz: 3 }),
      ],
    });
    expect(screen.getAllByText('bereit')).toHaveLength(1);
  });

  it('laesst sich nicht mehr zuklappen — sie steht oben und bleibt', () => {
    /* Bis zum 05.09.2026 war sie eine zuklappbare Liste. Wer sie zuklappte —
       und das tat man, weil acht Zeilen den Laden unter den Rand drueckten —,
       hatte die halbe Auskunft der Partie nicht mehr. Jetzt ist sie ein
       Streifen, der seitlich rollt; einen Klappknopf gibt es nicht mehr, und
       genau darauf prueft dieser Fall. */
    zeichne();
    expect(screen.queryByRole('button', { expanded: true })).toBeNull();
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
    expect(screen.getByText('Tom')).toBeInTheDocument();
  });

  it('zeigt das Bild eines Sitzes, sonst seinen Anfangsbuchstaben', () => {
    /* Kein `<img>` auf eine Datei, die es nicht gibt (CLAUDE.md): Wo kein
       Profilbild vorliegt — und bei Bots liegt nie eins vor —, steht ein
       Buchstabe statt eines weissen Kastens. */
    render(
      <Mitspielerleiste
        eigenes={stand({ sitz: 0 })}
        gegner={[stand({ sitz: 1 })]}
        gegnerJetzt={null}
        gezeigt={null}
        sitze={[
          { seat: 0, displayName: 'Robin', avatarUrl: '/bilder/robin.webp', isBot: false },
          { seat: 1, displayName: null, avatarUrl: null, isBot: true },
        ]}
        onWahl={() => {}}
      />,
    );
    const bilder = document.querySelectorAll('img');
    expect(bilder).toHaveLength(1);
    expect(bilder[0]).toHaveAttribute('src', '/bilder/robin.webp');
    // Die KI hat keins — dort steht das K.
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('faellt auf den Buchstaben zurueck, wenn ein Bild nicht laedt', () => {
    render(
      <Mitspielerleiste
        eigenes={null}
        gegner={[stand({ sitz: 2 })]}
        gegnerJetzt={null}
        gezeigt={null}
        sitze={[{ seat: 2, displayName: 'Tom', avatarUrl: '/weg.webp', isBot: false }]}
        onWahl={() => {}}
      />,
    );
    fireEvent.error(document.querySelector('img')!);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('nennt das Leben als Zahl und nicht nur als Balken', () => {
    /* Ein Balken ohne Zahl beantwortet "wer fuehrt", aber nicht "reicht mein
       Vorsprung fuer noch eine Niederlage". */
    zeichne({ gegner: [stand({ sitz: 1, leben: 7 }), stand({ sitz: 2 }), stand({ sitz: 3 })] });
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('kommt ohne eigenen Sitz aus — der Zuschauer hat keinen', () => {
    zeichne({ eigenes: null, gegner: [stand({ sitz: 0 }), stand({ sitz: 1 })] });
    expect(screen.queryByText('Du')).toBeNull();
    expect(screen.getByRole('group', { name: /noch 2 von 2/ })).toBeInTheDocument();
  });

  /*
   * Das Zusehen. Bis zum 06.09.2026 war die Kachel des Sitzes, dessen Brett
   * gerade unten liegt, nur an einem Ring von einem Pixel zu erkennen — man
   * tippte, das Brett wechselte, und nichts sagte einem, dass man das getan
   * hatte. Geprueft wird deshalb, was man SIEHT und was ein Vorlesegeraet
   * HOERT, nicht die Farbe.
   */
  it('markiert den Sitz, dessen Brett gerade unten liegt', () => {
    zeichne({ gezeigt: 2 });
    const kachel = screen.getByRole('button', { name: /^Tom,/ });
    expect(kachel).toHaveAttribute('aria-pressed', 'true');
    expect(kachel).toHaveAttribute('data-an');
    expect(kachel.getAttribute('aria-label')).toContain('Brett liegt oben');
    /* Und das Auge steht sichtbar daneben, genau EINMAL in der ganzen Leiste.
       Erkannt an seiner Pupille: Das Herz an jeder Kachel ist ein reiner
       Pfad, der Kreis kommt nur im Auge vor. */
    expect(kachel.querySelectorAll('svg circle')).toHaveLength(1);
    expect(document.querySelectorAll('svg circle')).toHaveLength(1);
  });

  it('markiert ohne Wahl niemanden', () => {
    zeichne();
    for (const knopf of screen.getAllByRole('button')) {
      expect(knopf).toHaveAttribute('aria-pressed', 'false');
      expect(knopf.getAttribute('aria-label')).not.toContain('Brett liegt oben');
    }
    expect(document.querySelectorAll('svg circle')).toHaveLength(0);
  });

  it('meldet den angetippten Sitz nach oben', () => {
    const { onWahl } = zeichne();
    fireEvent.click(screen.getByRole('button', { name: /^Tom,/ }));
    expect(onWahl).toHaveBeenCalledWith(2);
  });

  it('zeichnet gar nichts, wenn kein Sitz bekannt ist', () => {
    const { container } = render(
      <Mitspielerleiste
        eigenes={null}
        gegner={[]}
        gegnerJetzt={null}
        gezeigt={null}
        sitze={[]}
        onWahl={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
