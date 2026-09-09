import type { Me } from '../api';

/**
 * Ein Konto, wie `/api/me` es liefert — die Vorlage der Bildschirmtests.
 *
 * Steht in einer eigenen Datei, weil `Me` gut dreissig Felder hat: Eine
 * zweite Abschrift in der naechsten Testdatei ist genau die, die beim
 * naechsten neuen Feld niemand mitzieht. Die Abweichung je Test kommt oben
 * drauf.
 */
export function probeKonto(abweichung: Partial<Me> = {}): Me {
  return {
    id: 'a1',
    displayName: 'Robin',
    coins: 120,
    gems: 3,
    broJetons: 0,
    avatar: {},
    figur: null,
    bereit: { truhen: 0, aufgaben: 0 },
    level: { stufe: 4, xp: 300, imLevel: 40, fuerLevel: 100 },
    themes: {},
    avatarUrl: null,
    birthday: '1990-12-24',
    daysUntilBirthday: 87,
    birthdayToday: false,
    birthdayRewardClaimable: false,
    hasBirthdayOutfit: false,
    stats: [],
    clubs: [],
    activeTable: null,
    entitlements: {
      premium: false,
      unlimitedCoins: false,
      ownsEverything: false,
      staff: false,
    },
    stage: 'development',
    ...abweichung,
  };
}
