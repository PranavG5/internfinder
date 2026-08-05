import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { boardFromUrl, fallbackLabel } from '../src/lib/sources/seed';
import { decodeWorkdayToken } from '../src/lib/sources/workday';

/**
 * Board discovery is what grows the catalog past its seed list: every apply URL
 * the pipeline sees is inspected for an ATS it knows how to crawl. A parser
 * that quietly stops recognizing a provider costs thousands of listings without
 * failing anything, so each shape is pinned here.
 */
describe('boardFromUrl', () => {
  const cases: [url: string, kind: string, token: string][] = [
    [
      'https://boards.greenhouse.io/figma/jobs/12345',
      'greenhouse',
      'figma',
    ],
    [
      'https://jobs.lever.co/palantir/abc-def',
      'lever',
      'palantir',
    ],
    [
      'https://jobs.ashbyhq.com/openai/1234/application',
      'ashby',
      'openai',
    ],
    [
      'https://apply.workable.com/huggingface/j/ABC123/',
      'workable',
      'huggingface',
    ],
    // Workday, the single biggest provider, in both of its hosting shapes.
    [
      'https://ngc.wd1.myworkdayjobs.com/Northrop_Grumman_External_Site/job/Melbourne/Intern_R102',
      'workday',
      'ngc.wd1.myworkdayjobs.com/ngc/Northrop_Grumman_External_Site',
    ],
    [
      'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/US-CA/Intern_JR1',
      'workday',
      'nvidia.wd5.myworkdayjobs.com/nvidia/NVIDIAExternalCareerSite',
    ],
    [
      'https://wd1.myworkdaysite.com/recruiting/snapchat/snap/job/LA/Intern_R004',
      'workday',
      'wd1.myworkdaysite.com/snapchat/snap',
    ],
    [
      'https://ibqbjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Honeywell/job/130547',
      'oracle',
      'ibqbjb.fa.ocs.oraclecloud.com/Honeywell',
    ],
    [
      'https://qualcomm.eightfold.ai/careers/job/446715696771',
      'eightfold',
      'qualcomm.eightfold.ai/qualcomm.com',
    ],
    [
      'https://ats.rippling.com/acretrader-jobs/jobs/763c6149-4335',
      'rippling',
      'acretrader-jobs',
    ],
    [
      'https://berkshiregrey.bamboohr.com/careers/655/',
      'bamboohr',
      'berkshiregrey',
    ],
    [
      'https://onyx-insight.breezy.hr/p/abc-intern',
      'breezy',
      'onyx-insight',
    ],
    // Phenom, which is how most health systems front their ATS.
    [
      'https://careers.chop.edu/us/en/job/1234567/Nurse-Extern',
      'phenom',
      'careers.chop.edu',
    ],
    [
      'https://jobs.sutterhealth.org/job/R-89012',
      'phenom',
      'jobs.sutterhealth.org',
    ],
  ];

  for (const [url, kind, token] of cases) {
    it(`recognizes ${kind} in ${new URL(url).hostname}`, () => {
      const board = boardFromUrl(url);
      assert.ok(board, `expected a board for ${url}`);
      assert.equal(board.kind, kind);
      assert.equal(board.token, token);
    });
  }

  it('ignores links that are not job boards', () => {
    assert.equal(boardFromUrl('https://example.com/careers'), null);
    assert.equal(boardFromUrl('not a url'), null);
    assert.equal(boardFromUrl(''), null);
  });

  it('does not claim every careers host as a Phenom site', () => {
    // A careers hostname alone proves nothing. Only Phenom's own job path does.
    assert.equal(boardFromUrl('https://careers.example.org/search-results'), null);
    assert.equal(boardFromUrl('https://jobs.example.org/openings/1234'), null);
  });

  it('does not mistake the Workday API path for a careers site', () => {
    const board = boardFromUrl('https://ngc.wd1.myworkdayjobs.com/wday/cxs/ngc/Site/jobs');
    assert.equal(board, null);
  });

  it('round-trips a Workday token back to host, tenant, and site', () => {
    const board = boardFromUrl(
      'https://asml.wd3.myworkdayjobs.com/asmlext1/job/San-Diego/Internship_J-1',
    );
    const decoded = decodeWorkdayToken(board!.token);
    assert.deepEqual(decoded, {
      host: 'asml.wd3.myworkdayjobs.com',
      tenant: 'asml',
      site: 'asmlext1',
    });
  });
});

describe('fallbackLabel', () => {
  it('reports the slug-derived name a board gets with no employer name known', () => {
    const board = boardFromUrl(
      'https://ibqbjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/1',
    )!;
    // Discovery replaces this the moment a feed supplies a real company name;
    // the comparison only works if the fallback matches what was stored.
    assert.equal(board.label, fallbackLabel(board));
  });
});
