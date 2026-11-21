#!/usr/bin/env node
// Generates a VAPID key pair for Web Push (P-256, base64url as expected by browsers/web-push).
//
//   node scripts/vapid-keys.mjs            print a new pair (for staging/live secrets)
//   node scripts/vapid-keys.mjs --local    write a pair into supabase/.env and .env.local

import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const fromB64url = (value) => Buffer.from(value, 'base64url');
const publicKey = Buffer.concat([Buffer.from([4]), fromB64url(jwk.x), fromB64url(jwk.y)]).toString(
  'base64url',
);
const privateKeyValue = jwk.d;

function upsertEnv(file, entries, comment) {
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const keys = Object.keys(entries);
  const kept = lines.filter((line) => line && !keys.some((key) => line.startsWith(`${key}=`)));
  const added = keys.map((key) => `${key}=${entries[key]}`);
  writeFileSync(file, [...kept, `# ${comment}`, ...added, ''].join('\n'));
}

if (process.argv.includes('--local')) {
  upsertEnv(
    'supabase/.env',
    { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKeyValue },
    'Local development VAPID key pair',
  );
  upsertEnv('.env.local', { VITE_VAPID_PUBLIC_KEY: publicKey }, 'Local VAPID public key');
  console.log('Wrote local VAPID keys to supabase/.env and .env.local.');
} else {
  console.log('\nPublic key  (GitHub variable VITE_VAPID_PUBLIC_KEY):');
  console.log(publicKey);
  console.log('\nPrivate key (GitHub secret VAPID_PRIVATE_KEY – keep it secret):');
  console.log(privateKeyValue);
  console.log('');
}
