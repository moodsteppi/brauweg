import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Verbindungsanzeige } from './Verbindungsanzeige';

it('zeigt den gemessenen Server-Ping und entfernt alte Werte sofort bei Unterbrechung', () => {
  const werte = { ping: 37, schwankung: 3, versuch: 0 };
  const { rerender } = render(<Verbindungsanzeige status="verbunden" werte={werte} art="relay" />);
  expect(screen.getByLabelText('Server-Ping: 37 ms')).toBeInTheDocument();
  rerender(<Verbindungsanzeige status="wiederverbinden" werte={{ ...werte, versuch: 2 }} art="relay" />);
  expect(screen.queryByText('37 ms')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Versuch 2: Verbinde erneut')).toBeInTheDocument();
});
it('zeigt beim lokalen Gastgeber keine erfundene Latenz', () => {
  render(<Verbindungsanzeige status="verbunden" werte={{ ping: null, schwankung: 0, versuch: 0 }} art="lan" lokalHost />);
  expect(screen.getByText('Lokaler Host')).toBeInTheDocument();
  expect(screen.queryByText(/\d+ ms/)).not.toBeInTheDocument();
});
