/**
 * Downloads only the game tables we need from the community datamine
 * (github.com/Arikatsu/WutheringWaves_Data) into .cache/wuwa-data.
 * Uses a shallow, sparse, blob-filtered clone (~130 MB on disk instead of several GB).
 *
 *   npm run data:fetch                 -> latest game version
 *   WUWA_DATA_REF=3.8 npm run data:fetch  (optional: a specific branch)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = 'https://github.com/Arikatsu/WutheringWaves_Data';
const DIR = resolve(process.env.WUWA_DATA_DIR ?? '.cache/wuwa-data');
const REF = process.env.WUWA_DATA_REF;

export const DATA_PATHS = [
  'BinData/role/roleinfo.json',
  'BinData/property/*',
  'BinData/skill/skill.json',
  'BinData/skill/skilldescription.json',
  'BinData/skillTree/skilltree.json',
  'BinData/resonate_chain/*',
  'BinData/weapon/weaponconf.json',
  'BinData/weapon/weaponreson.json',
  'BinData/phantom/*',
  'BinData/damage/damage.json',
  'Textmaps/en/role/*',
  'Textmaps/en/skill/*',
  'Textmaps/en/skillTree/*',
  'Textmaps/en/resonate_chain/*',
  'Textmaps/en/weapon/*',
  'Textmaps/en/weapon_reson/*',
  'Textmaps/en/phantom/*',
  'Textmaps/en/property/*',
  'Textmaps/en/multi_text/*',
];

const git = (args: string[], cwd?: string) =>
  execFileSync('git', args, { cwd, stdio: 'inherit', env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });

if (!existsSync(resolve(DIR, '.git'))) {
  mkdirSync(DIR, { recursive: true });
  git(['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', ...(REF ? ['--branch', REF] : []), REPO, DIR]);
  git(['config', 'gc.auto', '0'], DIR);
  git(['sparse-checkout', 'init', '--no-cone'], DIR);
} else {
  git(['fetch', '--depth', '1', 'origin', ...(REF ? [REF] : [])], DIR);
  git(['reset', '--hard', 'FETCH_HEAD'], DIR);
}
git(['sparse-checkout', 'set', ...DATA_PATHS], DIR);
git(['checkout'], DIR);
git(['log', '-1', '--format=Data version: %s (%ci)'], DIR);
