import type { Field, RoleFamily } from '../types';

interface Rule {
  family: RoleFamily;
  /** Patterns that strongly identify this family. */
  strong: RegExp[];
  /** Supporting patterns; count less on their own. */
  weak?: RegExp[];
}

/**
 * Ordered so that more specific families are evaluated first — a
 * "Machine Learning Engineer" should land in machine-learning, not swe-general.
 */
const RULES: Rule[] = [
  {
    family: 'machine-learning',
    strong: [/\bmachine\s*learning\b/i, /\bML\b/, /\bdeep\s*learning\b/i, /\bAI\b/, /\bartificial\s+intelligence\b/i, /\bNLP\b/i, /\bcomputer\s+vision\b/i, /\bLLM\b/i, /\bgenerative\s+ai\b/i, /\bMLOps\b/i],
    weak: [/\bpytorch|tensorflow\b/i, /\bneural\s+net/i],
  },
  {
    family: 'data-science',
    strong: [/\bdata\s+scien(?:ce|tist)\b/i, /\bstatistic(?:s|ian|al\s+model)/i, /\bexperimentation\b/i, /\bA\/B\s+test/i],
  },
  {
    family: 'data-engineering',
    strong: [/\bdata\s+engineer/i, /\bETL\b/, /\bdata\s+(?:pipeline|platform|warehouse|infrastructure)\b/i, /\banalytics\s+engineer/i, /\bbig\s+data\b/i],
    weak: [/\bspark|airflow|dbt|snowflake|databricks\b/i],
  },
  {
    family: 'data-analyst',
    strong: [/\bdata\s+analyst\b/i, /\bbusiness\s+(?:intelligence|analyst)\b/i, /\bBI\s+(?:analyst|developer)\b/i, /\breporting\s+analyst\b/i, /\banalytics\s+intern/i],
    weak: [/\btableau|power\s*bi|looker\b/i],
  },
  {
    family: 'security',
    strong: [/\b(?:cyber)?security\b/i, /\binfosec\b/i, /\bpenetration\s+test/i, /\bappsec\b/i, /\bthreat\s+(?:intel|detection|hunting)\b/i, /\bSOC\s+analyst\b/i, /\bvulnerability\b/i, /\bcryptograph/i, /\bincident\s+response\b/i],
  },
  {
    family: 'devops',
    strong: [/\bdevops\b/i, /\bSRE\b/, /\bsite\s+reliability\b/i, /\bplatform\s+engineer/i, /\binfrastructure\s+engineer/i, /\bcloud\s+engineer/i, /\bkubernetes\b/i, /\bcloud\s+operations\b/i],
    weak: [/\bterraform|docker|aws|azure|gcp\b/i, /\bCI\/CD\b/i],
  },
  {
    family: 'embedded',
    strong: [/\bembedded\b/i, /\bfirmware\b/i, /\bRTOS\b/i, /\bmicrocontroller\b/i, /\bdevice\s+driver/i, /\bbare[-\s]metal\b/i],
  },
  {
    family: 'game-dev',
    strong: [/\bgame\s+(?:dev|programm|design|engine|play)/i, /\bunreal\s+engine\b/i, /\bunity\s+develop/i, /\bgameplay\b/i, /\btechnical\s+artist\b/i],
  },
  {
    family: 'mobile',
    strong: [/\b(?:ios|android)\s+(?:develop|engineer)/i, /\bmobile\s+(?:develop|engineer|app)/i, /\bswift(?:ui)?\b/i, /\bkotlin\b/i, /\breact\s+native\b/i, /\bflutter\b/i],
  },
  {
    family: 'frontend',
    strong: [/\bfront[-\s]?end\b/i, /\bUI\s+(?:engineer|develop)/i, /\bweb\s+(?:develop|engineer)/i, /\bclient[-\s]side\b/i],
    weak: [/\breact|vue|angular|svelte|typescript|css\b/i],
  },
  {
    family: 'backend',
    strong: [/\bback[-\s]?end\b/i, /\bserver[-\s]?side\b/i, /\bAPI\s+(?:engineer|develop)/i, /\bdistributed\s+systems\b/i, /\bmicroservice/i, /\bdatabase\s+engineer/i],
  },
  {
    family: 'fullstack',
    strong: [/\bfull[-\s]?stack\b/i],
  },
  {
    family: 'qa-test',
    strong: [/\b(?:QA|quality\s+assurance)\b/i, /\btest\s+(?:engineer|automation)\b/i, /\bSDET\b/i, /\bsoftware\s+test/i],
  },
  {
    family: 'it-support',
    strong: [/\bIT\s+(?:support|intern|help|operations|service)/i, /\bhelp\s*desk\b/i, /\bsystems?\s+admin/i, /\bnetwork\s+(?:admin|engineer|technician)\b/i, /\btechnical\s+support\b/i, /\bdesktop\s+support\b/i],
  },
  {
    family: 'swe-general',
    strong: [/\bsoftware\s+(?:engineer|developer|development|engineering)\b/i, /\bSWE\b/, /\bprogrammer\b/i, /\bcomputer\s+science\b/i, /\bsoftware\s+intern/i, /\bcoding\b/i, /\bapplication\s+develop/i],
  },
  {
    family: 'product-management',
    strong: [/\bproduct\s+manage/i, /\bproduct\s+(?:owner|intern|analyst)\b/i, /\bAPM\b/, /\btechnical\s+program\s+manage/i, /\bprogram\s+manage/i, /\bproject\s+manage/i, /\bscrum\b/i],
  },
  {
    family: 'product-design',
    strong: [/\bUX\b/i, /\bUI\/UX\b/i, /\buser\s+(?:experience|research|interface)\b/i, /\bproduct\s+design/i, /\binteraction\s+design/i, /\bdesign\s+intern/i],
    weak: [/\bfigma|sketch|prototyp/i],
  },
  {
    family: 'graphic-design',
    strong: [/\bgraphic\s+design/i, /\bvisual\s+design/i, /\bbrand\s+design/i, /\bmotion\s+(?:design|graphic)/i, /\billustrat/i, /\bcreative\s+(?:intern|design)\b/i, /\bvideo\s+(?:edit|production)/i],
  },
  {
    family: 'quant-trading',
    strong: [/\bquantitative\s+trad/i, /\btrading\s+intern/i, /\bquant\s+trad/i, /\btrader\b/i, /\bmarket\s+mak/i, /\balgorithmic\s+trading\b/i],
  },
  {
    family: 'quant-research',
    strong: [/\bquantitative\s+(?:research|analyst|develop|strateg)/i, /\bquant\s+(?:research|dev)/i, /\bsystematic\s+strateg/i],
  },
  {
    family: 'investment-banking',
    strong: [/\binvestment\s+bank/i, /\bM&A\b/, /\bequity\s+research\b/i, /\bprivate\s+equity\b/i, /\bventure\s+capital\b/i, /\bhedge\s+fund\b/i, /\bcapital\s+markets\b/i, /\bsales\s+(?:&|and)\s+trading\b/i, /\bwealth\s+manage/i, /\basset\s+manage/i, /\bsummer\s+analyst\b/i],
  },
  {
    family: 'accounting',
    strong: [/\baccount(?:ing|ant)\b/i, /\baudit/i, /\btax\s+(?:intern|associate|analyst)\b/i, /\bCPA\b/, /\bbookkeep/i, /\bcontroller\b/i, /\btreasury\b/i, /\bfinancial\s+report/i],
  },
  {
    family: 'consulting',
    strong: [/\bconsult(?:ing|ant)\b/i, /\bstrategy\s+(?:intern|analyst)\b/i, /\bmanagement\s+consult/i, /\bbusiness\s+strateg/i, /\badvisory\b/i],
  },
  {
    family: 'marketing',
    strong: [/\bmarketing\b/i, /\bgrowth\s+(?:intern|market|hack)/i, /\bSEO\b/i, /\bsocial\s+media\b/i, /\bbrand\s+(?:manage|market|strateg)/i, /\bcontent\s+(?:market|strateg|creat)/i, /\bdemand\s+gen/i, /\bcampaign\b/i, /\bdigital\s+market/i],
  },
  {
    family: 'sales',
    strong: [/\bsales\b/i, /\bbusiness\s+development\b/i, /\bBDR\b|\bSDR\b/, /\baccount\s+(?:executive|manage)/i, /\bcustomer\s+success\b/i, /\bpartnerships?\b/i, /\brevenue\s+operations\b/i],
  },
  {
    family: 'supply-chain',
    strong: [/\bsupply\s+chain\b/i, /\blogistics\b/i, /\bprocurement\b/i, /\bsourcing\s+(?:intern|analyst)\b/i, /\binventory\b/i, /\bwarehouse\s+(?:operations|manage)/i, /\bdemand\s+planning\b/i, /\bmanufacturing\s+(?:engineer|operations)\b/i],
  },
  {
    family: 'operations',
    strong: [/\boperations\b/i, /\bbusiness\s+operations\b/i, /\bprocess\s+improve/i, /\blean\s+six\s+sigma\b/i, /\bindustrial\s+engineer/i, /\bstrategy\s+(?:&|and)\s+operations\b/i],
  },
  {
    family: 'hr-recruiting',
    strong: [/\bhuman\s+resources\b/i, /\bHR\s+(?:intern|analyst|generalist|business)\b/i, /\brecruit(?:ing|er|ment)\b/i, /\btalent\s+(?:acquisition|manage|develop)/i, /\bpeople\s+(?:operations|team)\b/i, /\bcompensation\s+(?:&|and)\s+benefits\b/i, /\bDEI\b/, /\bemployee\s+(?:relations|engagement)\b/i],
  },
  {
    family: 'legal',
    strong: [/\blegal\b/i, /\blaw\s+(?:clerk|intern|student)\b/i, /\bparalegal\b/i, /\bcompliance\b/i, /\bcontract\s+(?:analyst|manage)/i, /\bintellectual\s+property\b/i, /\bpatent\b/i, /\bregulatory\s+affairs\b/i, /\bvacation\s+scheme\b/i],
  },
  {
    family: 'policy',
    strong: [/\bpublic\s+policy\b/i, /\bgovernment\s+(?:affairs|relations)\b/i, /\bpolicy\s+(?:analyst|research|intern)\b/i, /\blegislative\b/i, /\bpolitical\b/i, /\binternational\s+relations\b/i, /\bdiplomat/i],
  },
  {
    family: 'clinical',
    strong: [/\bclinical\b/i, /\bnursing\b/i, /\bmedical\s+(?:intern|student|assistant|scribe)\b/i, /\bpatient\s+care\b/i, /\bpharmac/i, /\bpublic\s+health\b/i, /\bepidemiolog/i, /\bhealthcare\b/i, /\bphysical\s+therapy\b/i, /\bradiolog/i],
  },
  {
    family: 'biotech',
    strong: [/\bbio(?:tech|logy|informatics|chemistry|medical|engineering|statistic)/i, /\bgenom/i, /\bmolecular\b/i, /\bpharmaceutical\b/i, /\bdrug\s+(?:discovery|development)\b/i, /\bwet\s+lab\b/i, /\blaboratory\s+(?:intern|technician|assistant)\b/i, /\bcell\s+cultur/i, /\bneuroscien/i],
  },
  {
    family: 'mechanical',
    strong: [/\bmechanical\s+engineer/i, /\bCAD\b/, /\bSolidWorks\b/i, /\bthermal\b/i, /\bHVAC\b/i, /\bfluid\s+(?:dynamics|mechanics)\b/i, /\brobotic/i, /\bmechatronic/i, /\bFEA\b/, /\bdesign\s+engineer/i],
  },
  {
    family: 'electrical',
    strong: [/\belectrical\s+engineer/i, /\bPCB\b/i, /\bcircuit\s+design\b/i, /\banalog\b/i, /\bRF\b\s|\bRF\s+engineer/i, /\bpower\s+(?:systems|electronics)\b/i, /\bASIC\b/i, /\bFPGA\b/i, /\bVLSI\b/i, /\bsemiconductor\b/i, /\bhardware\s+engineer/i, /\bsignal\s+(?:integrity|processing)\b/i, /\bverilog|VHDL\b/i],
  },
  {
    family: 'civil',
    strong: [/\bcivil\s+engineer/i, /\bstructural\s+engineer/i, /\bgeotechnical\b/i, /\bconstruction\s+(?:manage|intern|engineer)/i, /\btransportation\s+(?:engineer|planning)\b/i, /\bsurveying\b/i, /\bwater\s+resources\b/i, /\barchitect(?:ure|ural)\b/i, /\burban\s+planning\b/i],
  },
  {
    family: 'chemical',
    strong: [/\bchemical\s+engineer/i, /\bchemistry\b/i, /\bmaterials\s+(?:science|engineer)/i, /\bpolymer\b/i, /\bprocess\s+engineer/i, /\bmetallurg/i, /\brefinery\b/i, /\bpetroleum\b/i],
  },
  {
    family: 'aerospace',
    strong: [/\baerospace\b/i, /\baeronautic/i, /\bastronautic/i, /\bavionics\b/i, /\bflight\s+(?:test|dynamics|software)\b/i, /\bpropulsion\b/i, /\bspacecraft\b/i, /\bsatellite\b/i, /\borbital\b/i, /\baerodynamic/i],
  },
  {
    family: 'teaching',
    strong: [/\bteach(?:ing|er)\b/i, /\btutor/i, /\beducation\s+(?:intern|program)\b/i, /\bcurriculum\b/i, /\binstructional\s+design/i, /\bcamp\s+counselor\b/i, /\bTA\b\s+position/i, /\bK-12\b/i],
  },
  {
    family: 'communications',
    strong: [/\bcommunications?\b/i, /\bpublic\s+relations\b/i, /\bPR\s+intern\b/i, /\bjournalis/i, /\beditorial\b/i, /\bcopywrit/i, /\bmedia\s+(?:relations|intern|production)\b/i, /\bbroadcast/i, /\btechnical\s+writ/i, /\bcontent\s+writ/i],
  },
  // Deliberately near the end: "research" is a weak signal next to a domain
  // qualifier, so "Clinical Research Intern" should land in clinical and
  // "Biology Research Intern" in biotech. Ties resolve to whichever rule is
  // declared first, so the generic bucket must come after the specific ones.
  {
    family: 'research-scientist',
    strong: [/\bresearch\s+(?:scientist|intern|assistant|engineer)\b/i, /\bR&D\b/, /\bscientific\s+research\b/i, /\bresearch\s+fellow\b/i],
  },
  {
    family: 'finance-general',
    strong: [/\bfinanc(?:e|ial)\b/i, /\bFP&A\b/i, /\bbudget/i, /\bactuarial\b/i, /\bunderwrit/i, /\brisk\s+(?:manage|analyst)/i, /\bcredit\s+analy/i, /\bbanking\b/i, /\binsurance\b/i],
  },
];

/** Which canonical field each role family rolls up into. */
const FAMILY_TO_FIELD: Record<string, Field> = {
  'swe-general': 'Software Engineering',
  frontend: 'Software Engineering',
  backend: 'Software Engineering',
  fullstack: 'Software Engineering',
  mobile: 'Software Engineering',
  devops: 'Software Engineering',
  embedded: 'Software Engineering',
  'game-dev': 'Software Engineering',
  'qa-test': 'Software Engineering',
  'data-engineering': 'Data & Analytics',
  'data-analyst': 'Data & Analytics',
  'data-science': 'Data & Analytics',
  'machine-learning': 'AI & Machine Learning',
  'research-scientist': 'Research & Academia',
  security: 'Cybersecurity',
  'it-support': 'IT & Systems',
  'product-management': 'Product Management',
  'product-design': 'Design & UX',
  'graphic-design': 'Design & UX',
  'quant-trading': 'Quantitative Finance',
  'quant-research': 'Quantitative Finance',
  'investment-banking': 'Finance & Accounting',
  accounting: 'Finance & Accounting',
  'finance-general': 'Finance & Accounting',
  consulting: 'Consulting & Strategy',
  marketing: 'Marketing & Growth',
  sales: 'Sales & Business Development',
  operations: 'Operations & Supply Chain',
  'supply-chain': 'Operations & Supply Chain',
  'hr-recruiting': 'Human Resources',
  legal: 'Legal & Policy',
  policy: 'Legal & Policy',
  clinical: 'Healthcare & Life Sciences',
  biotech: 'Healthcare & Life Sciences',
  mechanical: 'Mechanical & Aerospace',
  aerospace: 'Mechanical & Aerospace',
  electrical: 'Hardware & Electrical',
  civil: 'Civil & Structural',
  chemical: 'Chemical & Materials',
  teaching: 'Education',
  communications: 'Media & Communications',
  other: 'Other',
};

/** Hints some aggregators provide; map them straight to a field. */
const CATEGORY_HINTS: { re: RegExp; field: Field; family: RoleFamily }[] = [
  { re: /^software\s*engineer/i, field: 'Software Engineering', family: 'swe-general' },
  { re: /AI|ML|Data/i, field: 'Data & Analytics', family: 'data-analyst' },
  { re: /quant/i, field: 'Quantitative Finance', family: 'quant-research' },
  { re: /hardware/i, field: 'Hardware & Electrical', family: 'electrical' },
  { re: /product/i, field: 'Product Management', family: 'product-management' },
  { re: /design/i, field: 'Design & UX', family: 'product-design' },
];

export interface FieldResult {
  field: Field;
  roleFamily: RoleFamily;
  confidence: number;
}

/**
 * Classify a posting into a field and role family.
 * Title matches are worth 3x description matches; strong patterns 2x weak ones.
 */
export function classifyField(title: string, description = '', categoryHint = ''): FieldResult {
  const t = title ?? '';
  const body = (description ?? '').slice(0, 6000);

  const scores = new Map<RoleFamily, number>();
  const bump = (family: RoleFamily, amount: number) =>
    scores.set(family, (scores.get(family) ?? 0) + amount);

  for (const rule of RULES) {
    for (const re of rule.strong) {
      if (re.test(t)) bump(rule.family, 6);
      else if (re.test(body)) bump(rule.family, 2);
    }
    for (const re of rule.weak ?? []) {
      if (re.test(t)) bump(rule.family, 3);
      else if (re.test(body)) bump(rule.family, 1);
    }
  }

  let best: RoleFamily = 'other';
  let bestScore = 0;
  for (const [family, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = family;
    }
  }

  // Nothing matched with confidence — fall back to the source's own category.
  if (bestScore < 3 && categoryHint) {
    for (const hint of CATEGORY_HINTS) {
      if (hint.re.test(categoryHint)) {
        return { field: hint.field, roleFamily: hint.family, confidence: 0.4 };
      }
    }
  }

  if (bestScore === 0) return { field: 'Other', roleFamily: 'other', confidence: 0.1 };

  return {
    field: FAMILY_TO_FIELD[best] ?? 'Other',
    roleFamily: best,
    confidence: Math.min(1, bestScore / 12),
  };
}

export function fieldForFamily(family: string): Field {
  return FAMILY_TO_FIELD[family] ?? 'Other';
}
