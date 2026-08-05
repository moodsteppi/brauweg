-- Einmalig: Geburtstag fuer bestehendes Beta-Konto nachpflegen.
UPDATE "account"
SET "birthday" = '2004-04-04'
WHERE lower("email") = 'emilklerner@icloud.com'
  AND lower("display_name") = 'emil';
