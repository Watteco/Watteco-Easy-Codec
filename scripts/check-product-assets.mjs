import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const syncStatePath = resolve(root, 'public/product-assets/sync-state.json');
const apiManifestUrl = 'https://support.watteco.com/api/produits/manifest.json';
const requestTimeoutMs = 5000;

const readJson = async path => readFile(path, 'utf8')
  .then(value => JSON.parse(value.replace(/^\uFEFF/, '')))
  .catch(() => null);

const fetchApiManifest = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(apiManifestUrl, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const formatDate = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(date);
};

const runSynchronization = () => new Promise(resolvePromise => {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run', 'products:sync'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('error', () => resolvePromise(false));
  child.on('exit', code => resolvePromise(code === 0));
});

const main = async () => {
  const [localState, apiManifest] = await Promise.all([
    readJson(syncStatePath),
    fetchApiManifest(),
  ]);

  if (!apiManifest?.revision || localState?.revision === apiManifest.revision) return;

  const modificationDate = formatDate(apiManifest.derniere_modification);
  const updateMessage = modificationDate
    ? `Des ressources produit plus récentes sont disponibles (${modificationDate}).`
    : 'Des ressources produit plus récentes sont disponibles.';

  if (process.env.CI || !process.stdin.isTTY || !process.stdout.isTTY) {
    console.warn(`[product-assets] ${updateMessage} Lancez npm run products:sync pour les récupérer.`);
    return;
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`${updateMessage} Les synchroniser avant le build ? (o/N) `);
  prompt.close();
  if (!/^(?:o|oui|y|yes)$/i.test(answer.trim())) return;

  if (!(await runSynchronization())) {
    console.warn('[product-assets] La synchronisation a échoué. Le build continue avec les ressources locales.');
  }
};

main().catch(() => {
  // Le contrôle distant ne doit jamais empêcher un build hors ligne.
});
