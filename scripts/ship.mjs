import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
// pnpm ship [patch|minor|major|x.y.z] — publishes a version others can install: optional bump,
// checks and builds, Chrome zip, Mozilla-signed Firefox XPI. Only this release stays in releases/.
const bump = process.argv[2];
const step = (title, command, args) => {
  console.log(`\n▸ ${title}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n✗ Failed: ${title}.`);
    process.exit(result.status ?? 1);
  }
};
const readVersion = async () => JSON.parse(await readFile('package.json', 'utf8')).version;
const signedXpi = (v) => `releases/${v}/youtube-triage-${v}-firefox-signed.xpi`;

// Keys from the environment or a local, git-ignored .env (see docs/distribution.md).
if (existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET)
  throw new Error('Missing Mozilla keys: set WEB_EXT_API_KEY and WEB_EXT_API_SECRET in .env.');

// Mozilla signs each version once: a version already signed here needs a bump first.
const current = await readVersion();
if (!bump && existsSync(signedXpi(current)))
  throw new Error(
    `${current} is already signed by Mozilla: run again with a bump, e.g. "pnpm ship patch".`,
  );

if (bump) step(`Version (${bump})`, 'pnpm', ['version', bump, '--no-git-tag-version']);
const version = await readVersion();
const folder = `releases/${version}`;

step('Checks and builds (format, types, tests, Chrome, Firefox)', 'pnpm', ['verify']);
step('Firefox lint (web-ext lint)', 'pnpm', ['lint:firefox']);

await rm(folder, { recursive: true, force: true });
await mkdir(folder, { recursive: true });
step('Chrome zip', 'ditto', [
  '-c',
  '-k',
  '--norsrc',
  'dist',
  `${folder}/youtube-triage-${version}-chrome.zip`,
]);
step('Mozilla signing (unlisted)', 'pnpm', [
  'exec',
  'web-ext',
  'sign',
  '--channel=unlisted',
  '--source-dir=dist-firefox',
  `--artifacts-dir=${folder}`,
  '--approval-timeout=900000',
]);
const signed = (await readdir(folder)).find((file) => file.endsWith('.xpi'));
if (!signed) throw new Error('Mozilla returned no signed XPI.');
await rename(`${folder}/${signed}`, signedXpi(version));
await copyFile('docs/distribution.md', `${folder}/INSTALLATION.md`);
await copyFile('docs/release-notes.md', `${folder}/NOTES.md`);

const shipped = (await readdir(folder)).filter((file) => /\.(zip|xpi)$/.test(file)).sort();
const sums = [];
for (const file of shipped)
  sums.push(
    `${createHash('sha256')
      .update(await readFile(`${folder}/${file}`))
      .digest('hex')}  ${file}`,
  );
await writeFile(`${folder}/SHA256SUMS.txt`, sums.join('\n') + '\n');

for (const entry of await readdir('releases', { withFileTypes: true }))
  if (entry.isDirectory() && entry.name !== version)
    await rm(`releases/${entry.name}`, { recursive: true, force: true });

// releases/ is tracked: stage the new version and the removal of the previous one.
step('Stage releases/ for git', 'git', ['add', '--all', 'releases']);

console.log(`\n✓ ${version} ready in ${folder}:`);
for (const file of shipped) console.log(`  · ${file}`);
console.log('  · INSTALLATION.md, NOTES.md, SHA256SUMS.txt');
console.log(`Staged; commit and push: git commit -m "release: ${version}" && git push`);
