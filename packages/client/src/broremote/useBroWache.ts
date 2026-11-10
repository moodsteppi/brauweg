import { useEffect } from 'react';
import { useTischwache } from '../minispiele/partykiste/useTischwache';

export function useBroWache(aktiv: boolean): void {
  useTischwache({ aktiv, dranSchluessel: null });
  useEffect(() => {
    if (!aktiv) return;
    // WKWebView benötigt die native Brücke, Safari den Wake-Lock im Hook oben.
    window.BrauwegNativ?.wachHalten?.(true);
    return () => window.BrauwegNativ?.wachHalten?.(false);
  }, [aktiv]);
}
