import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertValidBirthday,
  birthdayRewardClaimable,
  daysUntilBirthday,
  isBirthdayToday,
} from '../src/birthday.js';
import type { AppError } from '../src/errors.js';

test('Geburtstag: Mindestalter 16', () => {
  assert.equal(assertValidBirthday('1990-06-15'), '1990-06-15');
  assert.throws(
    () => assertValidBirthday('2015-01-01'),
    (err: AppError) => err.code === 'birthdayTooYoung',
  );
  assert.throws(
    () => assertValidBirthday('nicht-ein-datum'),
    (err: AppError) => err.code === 'birthdayInvalid',
  );
});

test('Countdown und Belohnbarkeit', () => {
  // Festes "heute": 3. August 2026 (Berlin).
  const heute = new Date('2026-08-03T12:00:00+02:00');
  assert.equal(daysUntilBirthday('1990-08-03', heute), 0);
  assert.equal(isBirthdayToday('1990-08-03', heute), true);
  assert.equal(daysUntilBirthday('1990-08-04', heute), 1);
  assert.equal(daysUntilBirthday('1990-08-02', heute), 364); // nächstes Jahr (kein Schaltjahr 2027 vor Aug)

  assert.equal(birthdayRewardClaimable('1990-08-03', null, heute), true);
  assert.equal(birthdayRewardClaimable('1990-08-03', 2026, heute), false);
  assert.equal(birthdayRewardClaimable('1990-08-04', null, heute), false);
});
