import type { BauForm } from '@brauweg/building-kern';

export const BAUFARBEN: Record<BauForm, [string, string, string]> = {
  balken: ['#77e8d4', '#217d7e', '#c6fff0'], quadrat: ['#ffda86', '#a76b28', '#fff1bb'],
  treppe: ['#c1a4ff', '#6d49a0', '#eee1ff'], bogen: ['#ffa3b3', '#a83c61', '#ffe1df'],
  haken: ['#8ac9ff', '#345f9e', '#daefff'], spiegel: ['#ffb87f', '#a85b29', '#ffe5bd'], stufe: ['#b1e086', '#56803c', '#e2ffc3'],
};
