/**
 * Geburtstag: Countdown und jaehrliche Belohnung.
 *
 * Kalenderlaeufe beziehen sich auf Europe/Berlin — sonst wuerde die Belohnung
 * je nach Server-UTC um Mitternacht falsch kippen.
 */

import { badRequest } from './errors.js';

const MIN_AGE = 16;
const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

export interface Ymd {
  readonly y: number;
  readonly m: number;
  readonly d: number;
}

/** Heutiges Datum in Berlin als Jahr/Monat/Tag. */
export function berlinToday(now = new Date()): Ymd {
  const stamped = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [y, m, d] = stamped.split('-').map((part) => Number(part));
  return { y: y!, m: m!, d: d! };
}

export function parseIsoDate(iso: string): Ymd {
  if (!ISO_TAG.test(iso)) throw badRequest('birthdayInvalid');
  const [y, m, d] = iso.split('-').map((part) => Number(part));
  const probe = new Date(Date.UTC(y!, m! - 1, d!));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m! - 1 ||
    probe.getUTCDate() !== d
  ) {
    throw badRequest('birthdayInvalid');
  }
  return { y: y!, m: m!, d: d! };
}

/** Prueft Format und Mindestalter; gibt den normalisierten ISO-String zurueck. */
export function assertValidBirthday(iso: string, now = new Date()): string {
  const birth = parseIsoDate(iso.trim());
  const today = berlinToday(now);
  if (birth.y < 1900 || birth.y > today.y) throw badRequest('birthdayInvalid');

  let age = today.y - birth.y;
  if (today.m < birth.m || (today.m === birth.m && today.d < birth.d)) age -= 1;
  if (age < MIN_AGE) throw badRequest('birthdayTooYoung');
  if (age > 120) throw badRequest('birthdayInvalid');

  return `${String(birth.y).padStart(4, '0')}-${String(birth.m).padStart(2, '0')}-${String(birth.d).padStart(2, '0')}`;
}

export function isBirthdayToday(birthday: string, now = new Date()): boolean {
  const birth = parseIsoDate(birthday);
  const today = berlinToday(now);
  return birth.m === today.m && birth.d === today.d;
}

/** Tage bis zum naechsten Geburtstag (0 = heute). */
export function daysUntilBirthday(birthday: string, now = new Date()): number {
  const birth = parseIsoDate(birthday);
  const today = berlinToday(now);
  const thisYear = Date.UTC(today.y, birth.m - 1, birth.d);
  const todayUtc = Date.UTC(today.y, today.m - 1, today.d);
  if (thisYear >= todayUtc) {
    return Math.round((thisYear - todayUtc) / 86_400_000);
  }
  const nextYear = Date.UTC(today.y + 1, birth.m - 1, birth.d);
  return Math.round((nextYear - todayUtc) / 86_400_000);
}

export function birthdayRewardClaimable(
  birthday: string | null | undefined,
  rewardYear: number | null | undefined,
  now = new Date(),
): boolean {
  if (!birthday) return false;
  if (!isBirthdayToday(birthday, now)) return false;
  return rewardYear !== berlinToday(now).y;
}
