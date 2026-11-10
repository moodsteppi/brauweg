import { useEffect, useRef } from 'react';

export type BroRueckfrage = { text: string; bestaetigen: string; ausfuehren(): void };
/** Native confirm-Dialoge können im WebView die gesamte Verbindung anhalten. */
export function BroDialog({ frage, schliessen }: { frage: BroRueckfrage; schliessen(): void }): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = dialog.current; d?.showModal(); return () => d?.close(); }, []);
  return <dialog className="br-dialog" ref={dialog} onCancel={e => { e.preventDefault(); schliessen(); }} aria-labelledby="br-dialog-titel">
    <h2 id="br-dialog-titel">{frage.text}</h2><div className="br-dialog-aktionen"><button className="br-knopf br-sekundaer" autoFocus onClick={schliessen}>Hier bleiben</button><button className="br-knopf" onClick={() => { schliessen(); frage.ausfuehren(); }}>{frage.bestaetigen}</button></div>
  </dialog>;
}
