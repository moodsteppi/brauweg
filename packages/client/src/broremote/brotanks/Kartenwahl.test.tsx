import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Kartenwahl } from './Kartenwahl';
it('zeigt ausgewählte Welt und meldet konkrete Wahl oder Überraschung', () => {
 const waehlen=vi.fn(); render(<Kartenwahl wahl={1} waehlen={waehlen}/>);
 expect(screen.getByRole('button',{name:/Bernsteindünen/}).getAttribute('aria-pressed')).toBe('true');
 fireEvent.click(screen.getByRole('button',{name:/Kristalltal/})); expect(waehlen).toHaveBeenLastCalledWith(2);
 fireEvent.click(screen.getByRole('button',{name:/Überraschung/})); expect(waehlen).toHaveBeenLastCalledWith(-1); cleanup();
});
it('sperrt die Auswahl ohne Verbindung', () => {
 const waehlen=vi.fn(); render(<Kartenwahl wahl={0} waehlen={waehlen} gesperrt/>);
 fireEvent.click(screen.getByRole('button',{name:/Kristalltal/})); expect(waehlen).not.toHaveBeenCalled(); cleanup();
});
