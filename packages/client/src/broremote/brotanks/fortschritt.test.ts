import { afterEach, expect, it, vi } from 'vitest';
import { TanksBuch, tanksChronik, tanksStatistik, panzerFreigaben } from './fortschritt';
import { api } from '../../api';
vi.mock('../../api',()=>({api:{tanksStart:vi.fn(),tanksErgebnis:vi.fn()}}));
const ergebnis={modus:'einzel' as const,spielerzahl:2,bots:1,stufe:'mittel' as const,gewonnen:true,aufgegeben:false,platz:1,schaden:100,schuesse:4,treffer:3,dauer:50};
afterEach(()=>{localStorage.clear();vi.resetAllMocks();});
it('speichert einen Abschluss wiederholbar ohne doppelte lokale Statistik und erhält die Kontozuordnung',async()=>{
  vi.mocked(api.tanksStart).mockResolvedValue({konto:'konto-a',partie:'runde-111'});vi.mocked(api.tanksErgebnis).mockResolvedValue({muenzen:15,wiederholt:false});
  const buch=new TanksBuch('runde-111','einzel');await buch.speichern(ergebnis);await buch.speichern(ergebnis);
  const r=tanksChronik();expect(r).toHaveLength(1);expect(r[0].konto).toBe('konto-a');expect(r[0].muenzen).toBe(15);expect(tanksStatistik(r).partien).toBe(1);expect(panzerFreigaben(tanksStatistik(r))).toEqual(['klassisch','kupfer']);
});
it('behält Ergebnisse bei verlorenem Netz zur erneuten Synchronisierung, Gäste erhalten lokale Fortschritte',async()=>{
  vi.mocked(api.tanksStart).mockResolvedValueOnce({konto:'konto-a',partie:'runde-netz'}).mockRejectedValueOnce(new Error('offline'));vi.mocked(api.tanksErgebnis).mockRejectedValue(new Error('offline'));
  expect(await new TanksBuch('runde-netz','einzel').speichern(ergebnis)).toContain('synchronisierung');
  expect(tanksChronik()[0]).toMatchObject({konto:'konto-a'});expect(tanksChronik()[0].muenzen).toBeUndefined();
  expect(await new TanksBuch('runde-gast','einzel').speichern(ergebnis)).toContain('Auf diesem Gerät');expect(tanksChronik().filter(r=>!r.konto)).toHaveLength(1);
});
