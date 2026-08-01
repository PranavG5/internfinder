/**
 * Prepare the catalog to be served from a read-only filesystem.
 *
 * A WAL-mode SQLite database cannot be opened at all when the disk is not
 * writable, because WAL needs a `-shm` companion file. This checkpoints the log
 * into the main file and switches to rollback-journal mode, leaving one
 * self-contained file that a serverless function can read.
 *
 * Run this LAST in a deploy build: anything that opens the database for writing
 * afterwards — including the seed step — turns WAL straight back on.
 *
 *   npm run finalize
 */
process.env.INTERNFINDER_READONLY = '0';

import fs from 'node:fs';
import { dbPath, finalizeForReadOnly, getDb } from '../src/lib/db';

const file = dbPath();
const db = getDb();
finalizeForReadOnly(db);
db.close();

// Read the journal mode straight out of the file header. Asking SQLite would
// mean opening the database again, which is what re-enables WAL in the first
// place — the check has to not disturb what it is checking.
const header = Buffer.alloc(20);
const fd = fs.openSync(file, 'r');
fs.readSync(fd, header, 0, 20, 0);
fs.closeSync(fd);

const writeVersion = header[18];
const readVersion = header[19];
const isWal = writeVersion === 2 || readVersion === 2;

const leftovers = ['-wal', '-shm'].filter((suffix) => fs.existsSync(`${file}${suffix}`));

console.log(`Finalized ${file}`);
console.log(`  journal mode : ${isWal ? 'WAL' : 'rollback journal'}`);
console.log(`  size         : ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB`);
console.log(`  side files   : ${leftovers.length ? leftovers.join(', ') : 'none'}`);

if (isWal || leftovers.length > 0) {
  console.error(
    '\nThis database cannot be served from a read-only filesystem.\n' +
      'Make sure nothing opens it for writing after this step runs.',
  );
  process.exit(1);
}
