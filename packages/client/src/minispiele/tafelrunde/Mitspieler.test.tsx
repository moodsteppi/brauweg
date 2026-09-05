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
    expect(screen.getByText('noch 2 von 4')).toBeInTheDocument();
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
    expect(screen.getByText('noch 4 von 4')).toBeInTheDocument();
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

  it('laesst sich zuklappen, ohne aus dem Baum zu verschwinden', () => {
    /* `data-offen` statt `{offen && …}`: Am Desktop gibt es keinen
       Klappknopf, dort waere die Leiste sonst fuer immer weg. */
    zeichne();
    const kopf = screen.getByRole('button', { expanded: true });
    fireEvent.click(kopf);
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
    expect(screen.getByText('Tom')).toBeInTheDocument();
  });

  it('kommt ohne eigenen Sitz aus — der Zuschauer hat keinen', () => {
    zeichne({ eigenes: null, gegner: [stand({ sitz: 0 }), stand({ sitz: 1 })] });
    expect(screen.queryByText('Du')).toBeNull();
    expect(screen.getByText('noch 2 von 2')).toBeInTheDocument();
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
