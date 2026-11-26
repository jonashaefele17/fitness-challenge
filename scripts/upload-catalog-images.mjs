#!/usr/bin/env node
// Uploads supabase/catalog-images/** into the public Storage bucket "catalog".
//
//   SUPABASE_URL=https://xyz.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run catalog:images
//
// Run it once per Supabase project (local, staging, live) after the catalogue migration.
// Existing files are replaced. Files are cached for a year, so a changed image should get a
// new file name (and a migration that points image_path to it).

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = 'supabase/catalog-images';
const BUCKET = 'catalog';
const TYPES = { '.webp': 'image/webp', '.png': 'image/png' };

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role, never commit it).');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

let failed = 0;
for (const file of files(ROOT)) {
  const contentType = TYPES[file.slice(file.lastIndexOf('.'))];
  if (!contentType) continue;
  const path = relative(ROOT, file).replaceAll('\\', '/');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, readFileSync(file), { contentType, cacheControl: '31536000', upsert: true });
  if (error) {
    failed += 1;
    console.error(`✗ ${path}: ${error.message}`);
  } else {
    console.log(`✓ ${path}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
