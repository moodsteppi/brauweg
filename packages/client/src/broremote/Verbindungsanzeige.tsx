import { BroIcon } from './BroIcon';
import type { Status, Verbindungswerte } from './transport';

export function Verbindungsanzeige({ status, werte, art, lokalHost = false }: { status: Status; werte: Verbindungswerte; art: 'relay' | 'lan'; lokalHost?: boolean }): React.JSX.Element {
  const online = status === 'verbunden';
  const ping = online ? werte.ping : null;
  const stufe = !online ? 'wartet' : lokalHost ? 'gut' : ping === null ? 'wartet' : ping > 200 ? 'langsam' : ping > 100 || werte.schwankung > 80 ? 'wechselnd' : 'gut';
  const text = !online ? status === 'beendet' ? 'Getrennt' : status === 'wiederverbinden' ? 'Verbinde erneut' : 'Verbinde …' : lokalHost ? 'Lokaler Host' : ping === null ? 'Messe Ping …' : `${ping} ms`;
  const beschreibung = !online ? werte.versuch ? `Versuch ${werte.versuch}` : 'Verbindung' : lokalHost ? 'Dieses Gerät' : `${art === 'lan' ? 'Host' : 'Server'}-Ping`;
  return <div className={`br-netz br-netz-${stufe}`} aria-label={`${beschreibung}: ${text}`} title={online && !lokalHost ? 'Hin- und Rückweg zum Server bzw. Gastgeber. Der Ping misst nicht die gesamte Spielreaktion.' : undefined}>
    <BroIcon name="signal" /><div><strong>{text}</strong><small>{beschreibung}{stufe === 'wechselnd' ? ' · schwankend' : stufe === 'langsam' ? ' · verzögert' : ''}</small></div>
  </div>;
}
