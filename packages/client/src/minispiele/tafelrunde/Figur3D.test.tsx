import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { blattPfad } from './bildfolge';
import { Figur3D } from './Figur3D';

/*
 * Das Bauteil steht an vier Orten: Arena, Brett, Bank und Ladenkarte. Geprueft
 * wird hier, was an allen vieren gleich sein muss — vor allem der RUECKFALL.
 * Er ist der Grund, warum die Figur ein `<img>` ist und kein Hintergrundbild:
 * Ein ausgefallener Hintergrund waere ein leeres Feld, und das sieht aus wie
 * ein Fehler des Spiels (CLAUDE.md).
 *
 * Wie GROSS die Figur ist und WO sie steht, steht nicht hier, sondern beim
 * Aufrufer — das ist an jedem der vier Orte anders und Sache des Stylesheets.
 */

describe('Figur3D', () => {
  it('zeigt das Blatt der Rolle unter dem Namen der Einheit', () => {
    render(
      <Figur3D
        name="Dorfwache"
        blatt={blattPfad('wache')}
        ersatz={<span data-testid="ersatz" />}
      />,
    );
    /* Der Name der EINHEIT und nicht der der Rolle: Fuer den Leser ist die
       Figur eine Dorfwache; dass sie sich das Blatt mit sieben anderen teilt,
       ist eine Auskunft ueber die Dateien. */
    expect(screen.getByAltText('Dorfwache')).toHaveAttribute('src', blattPfad('wache'));
    expect(screen.queryByTestId('ersatz')).not.toBeInTheDocument();
  });

  it('nimmt den Rueckfall, wenn es zur Rolle gar kein Blatt gibt', () => {
    // Fuenf Blaetter fuer 22 Einheiten — kommt je eine sechste Rolle in den
    // Katalog, faellt sie hier auf den Rueckfall und nicht auf ein Loch.
    render(<Figur3D name="Phantom" blatt={null} ersatz={<span data-testid="ersatz" />} />);
    expect(screen.getByTestId('ersatz')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('nimmt den Rueckfall, wenn das Blatt nicht laedt', () => {
    render(
      <Figur3D
        name="Dorfwache"
        blatt={blattPfad('wache')}
        ersatz={<span data-testid="ersatz" />}
      />,
    );
    fireEvent.error(screen.getByAltText('Dorfwache'));
    expect(screen.getByTestId('ersatz')).toBeInTheDocument();
  });

  it('merkt sich den gescheiterten PFAD und nicht bloss ein Ja/Nein', () => {
    /*
     * Ein Bankplatz behaelt seine Komponente, wenn dort eine andere Einheit
     * landet — React setzt ueber die Stelle zusammen, nicht ueber den Inhalt.
     * Mit einem Ja/Nein bliebe der Rueckfall der ersten Einheit an der
     * zweiten kleben, deren Blatt vollkommen in Ordnung ist.
     */
    const { rerender } = render(
      <Figur3D
        name="Dorfwache"
        blatt={blattPfad('wache')}
        ersatz={<span data-testid="ersatz" />}
      />,
    );
    fireEvent.error(screen.getByAltText('Dorfwache'));
    expect(screen.getByTestId('ersatz')).toBeInTheDocument();

    rerender(
      <Figur3D
        name="Funkenmagier"
        blatt={blattPfad('magier')}
        ersatz={<span data-testid="ersatz" />}
      />,
    );
    expect(screen.getByAltText('Funkenmagier')).toHaveAttribute('src', blattPfad('magier'));
    expect(screen.queryByTestId('ersatz')).not.toBeInTheDocument();
  });

  it('spiegelt den AUSSCHNITT und nicht das Bild', () => {
    /*
     * Alle Blaetter schauen nach rechts (FIGUREN3D_BLICKT). Gespiegelt wird
     * der Kasten, weil das Schieben des Blattes im Kampf dieselbe
     * `transform`-Angabe braucht — zwei Dinge darin schliessen einander aus.
     */
    const { container } = render(
      <Figur3D name="Dorfwache" blatt={blattPfad('wache')} spiegeln ersatz={<span />} />,
    );
    const kasten = container.querySelector('[data-spiegel]');
    expect(kasten).not.toBeNull();
    expect(kasten!.tagName).toBe('SPAN');
    expect(kasten!.querySelector('img')).toBe(screen.getByAltText('Dorfwache'));
  });

  it('steht ohne Angabe still — kein Versatz und keine eigene Ebene', () => {
    /*
     * Ohne Versatz steht die Zelle links oben im Blatt, und das ist Bild 0 der
     * Ruhefolge. Wer aufstellt, soll nicht von zappelnden Figuren abgelenkt
     * werden; bewegt wird allein im Kampf, und nur DORT lohnt die eigene
     * Ebene (`will-change`). Neunzehn Waben plus Bank und Laden waeren ein
     * Dutzend Ebenen fuer Bilder, die sich nie bewegen.
     */
    const { container, rerender } = render(
      <Figur3D name="Dorfwache" blatt={blattPfad('wache')} ersatz={<span />} />,
    );
    const still = container.querySelector('img')!;
    expect(still.style.transform).toBe('');
    const ruhigeKlassen = still.className;

    rerender(
      <Figur3D name="Dorfwache" blatt={blattPfad('wache')} ersatz={<span />} gib={() => {}} />,
    );
    // Ein geschobenes Blatt bekommt eine Klasse mehr als ein stehendes.
    expect(container.querySelector('img')!.className.split(' ').length).toBe(
      ruhigeKlassen.split(' ').length + 1,
    );
  });
});
