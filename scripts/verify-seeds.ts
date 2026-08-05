/**
 * Live-check every seed board against its ATS API.
 *
 *   npm run verify-seeds
 *
 * Prints one line per board (job count or failure) and a summary of dead
 * tokens, so the seed list can honestly claim that every entry was verified.
 * No database involved.
 */
import { SEED_BOARDS } from '../src/lib/sources/seed';
import { fetchAshby, fetchGreenhouse, fetchLever, fetchSmartRecruiters } from '../src/lib/sources/ats';
import { fetchWorkable } from '../src/lib/sources/workable';
import { fetchBamboo, fetchBreezy, fetchPersonio, fetchRippling } from '../src/lib/sources/bigtech';
import { fetchEightfold } from '../src/lib/sources/eightfold';
import { fetchOracle } from '../src/lib/sources/oracle';
import { fetchPhenom } from '../src/lib/sources/phenom';
import { fetchWorkday } from '../src/lib/sources/workday';
import { mapPool } from '../src/lib/sources/http';

async function fetchCount(kind: string, token: string, label: string): Promise<number> {
  switch (kind) {
    case 'greenhouse':
      return (await fetchGreenhouse(token, label)).length;
    case 'lever':
      return (await fetchLever(token, label)).length;
    case 'ashby':
      return (await fetchAshby(token, label)).length;
    case 'smartrecruiters':
      return (await fetchSmartRecruiters(token, label)).length;
    case 'workable':
      return (await fetchWorkable(token, label)).length;
    case 'workday':
      return (await fetchWorkday(token, label)).length;
    case 'oracle':
      return (await fetchOracle(token, label)).length;
    case 'phenom':
      return (await fetchPhenom(token, label)).length;
    case 'eightfold':
      return (await fetchEightfold(token, label)).length;
    case 'rippling':
      return (await fetchRippling(token, label)).length;
    case 'bamboohr':
      return (await fetchBamboo(token, label)).length;
    case 'breezy':
      return (await fetchBreezy(token, label)).length;
    case 'personio':
      return (await fetchPersonio(token, label)).length;
    default:
      throw new Error(`unknown kind ${kind}`);
  }
}

async function main() {
  const dead: string[] = [];
  const empty: string[] = [];
  let live = 0;

  await mapPool(SEED_BOARDS, 8, async (board) => {
    try {
      const count = await fetchCount(board.kind, board.token, board.label);
      if (count === 0) {
        // The adapters tolerate 404s by returning [], so an empty result usually
        // means the token is wrong or the company left this ATS.
        empty.push(`${board.kind}:${board.token}`);
        console.log(`  EMPTY ${board.kind}:${board.token}`);
      } else {
        live++;
        console.log(`  ok    ${board.kind}:${board.token} (${count} postings)`);
      }
    } catch (err) {
      dead.push(`${board.kind}:${board.token}`);
      console.log(`  DEAD  ${board.kind}:${board.token}: ${(err as Error).message}`);
    }
  });

  console.log(`\n${live} live · ${empty.length} empty · ${dead.length} erroring`);
  if (empty.length) console.log(`empty: ${empty.join(' ')}`);
  if (dead.length) console.log(`dead: ${dead.join(' ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
