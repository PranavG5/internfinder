/**
 * A curated skill vocabulary. Matching against a fixed list keeps the
 * extracted tags clean and makes them usable as real filter facets, which
 * a generic keyword extractor would not be.
 */
const SKILLS: { name: string; re: RegExp }[] = [
  // Languages
  { name: 'Python', re: /\bpython\b/i },
  { name: 'Java', re: /\bjava\b(?!script)/i },
  { name: 'JavaScript', re: /\bjavascript\b|\bjs\b(?!on)/i },
  { name: 'TypeScript', re: /\btypescript\b|\bts\b(?=\s|,|\.)/i },
  { name: 'C', re: /\bC\b(?!\+|#|\w)/ },
  { name: 'C++', re: /\bc\+\+\b/i },
  { name: 'C#', re: /\bc#\b|\b\.net\b/i },
  { name: 'Go', re: /\bgolang\b|\bgo\s+(?:programming|language)\b/i },
  { name: 'Rust', re: /\brust\b/i },
  { name: 'Ruby', re: /\bruby\b/i },
  { name: 'PHP', re: /\bphp\b/i },
  { name: 'Swift', re: /\bswift(?:ui)?\b/i },
  { name: 'Kotlin', re: /\bkotlin\b/i },
  { name: 'Scala', re: /\bscala\b/i },
  { name: 'R', re: /\bR\b(?=\s*(?:,|and|programming|statistical|\/))/ },
  { name: 'MATLAB', re: /\bmatlab\b/i },
  { name: 'SQL', re: /\bsql\b/i },
  { name: 'Shell/Bash', re: /\bbash\b|\bshell\s+script/i },
  { name: 'Verilog/VHDL', re: /\bverilog\b|\bvhdl\b|\bsystemverilog\b/i },
  { name: 'Assembly', re: /\bassembly\s+language\b/i },
  { name: 'Perl', re: /\bperl\b/i },
  { name: 'Julia', re: /\bjulia\b/i },
  { name: 'Solidity', re: /\bsolidity\b/i },

  // Web / app
  { name: 'React', re: /\breact(?:\.js)?\b/i },
  { name: 'Next.js', re: /\bnext\.?js\b/i },
  { name: 'Vue', re: /\bvue(?:\.js)?\b/i },
  { name: 'Angular', re: /\bangular\b/i },
  { name: 'Svelte', re: /\bsvelte\b/i },
  { name: 'Node.js', re: /\bnode\.?js\b/i },
  { name: 'Django', re: /\bdjango\b/i },
  { name: 'Flask', re: /\bflask\b/i },
  { name: 'FastAPI', re: /\bfastapi\b/i },
  { name: 'Spring', re: /\bspring\s*(?:boot|framework)\b/i },
  { name: 'Rails', re: /\bruby\s+on\s+rails\b|\brails\b/i },
  { name: 'HTML/CSS', re: /\bhtml\b|\bcss\b|\bsass\b|\btailwind\b/i },
  { name: 'GraphQL', re: /\bgraphql\b/i },
  { name: 'REST APIs', re: /\brest(?:ful)?\s+api/i },
  { name: 'React Native', re: /\breact\s+native\b/i },
  { name: 'Flutter', re: /\bflutter\b/i },
  { name: 'iOS', re: /\bios\s+(?:develop|app)/i },
  { name: 'Android', re: /\bandroid\s+(?:develop|app|studio)/i },

  // Data / ML
  { name: 'PyTorch', re: /\bpytorch\b/i },
  { name: 'TensorFlow', re: /\btensorflow\b|\bkeras\b/i },
  { name: 'scikit-learn', re: /\bscikit[-\s]?learn\b|\bsklearn\b/i },
  { name: 'Pandas', re: /\bpandas\b/i },
  { name: 'NumPy', re: /\bnumpy\b/i },
  { name: 'Spark', re: /\b(?:apache\s+)?spark\b|\bpyspark\b/i },
  { name: 'Hadoop', re: /\bhadoop\b/i },
  { name: 'Airflow', re: /\bairflow\b/i },
  { name: 'dbt', re: /\bdbt\b/i },
  { name: 'Kafka', re: /\bkafka\b/i },
  { name: 'Snowflake', re: /\bsnowflake\b/i },
  { name: 'Databricks', re: /\bdatabricks\b/i },
  { name: 'Tableau', re: /\btableau\b/i },
  { name: 'Power BI', re: /\bpower\s*bi\b/i },
  { name: 'Looker', re: /\blooker\b/i },
  { name: 'Excel', re: /\b(?:microsoft\s+)?excel\b|\bvlookup\b|\bpivot\s+table/i },
  { name: 'Statistics', re: /\bstatistic(?:s|al)\b|\bregression\b|\bhypothesis\s+test/i },
  { name: 'NLP', re: /\bnlp\b|\bnatural\s+language\s+processing\b/i },
  { name: 'Computer Vision', re: /\bcomputer\s+vision\b|\bopencv\b/i },
  { name: 'LLMs', re: /\bllm(?:s)?\b|\blarge\s+language\s+model/i },

  // Infra
  { name: 'AWS', re: /\baws\b|\bamazon\s+web\s+services\b/i },
  { name: 'Azure', re: /\bazure\b/i },
  { name: 'GCP', re: /\bgcp\b|\bgoogle\s+cloud\b/i },
  { name: 'Docker', re: /\bdocker\b/i },
  { name: 'Kubernetes', re: /\bkubernetes\b|\bk8s\b/i },
  { name: 'Terraform', re: /\bterraform\b/i },
  { name: 'CI/CD', re: /\bci\/cd\b|\bjenkins\b|\bgithub\s+actions\b/i },
  { name: 'Linux', re: /\blinux\b|\bunix\b/i },
  { name: 'Git', re: /\bgit\b|\bversion\s+control\b/i },
  { name: 'PostgreSQL', re: /\bpostgres(?:ql)?\b/i },
  { name: 'MongoDB', re: /\bmongodb\b|\bnosql\b/i },
  { name: 'Redis', re: /\bredis\b/i },

  // Engineering (non-software)
  { name: 'CAD', re: /\bcad\b|\bsolidworks\b|\bautocad\b|\bcatia\b|\bfusion\s*360\b/i },
  { name: 'FEA/Simulation', re: /\bfea\b|\bansys\b|\bfinite\s+element\b|\bcfd\b|\bcomsol\b/i },
  { name: 'PCB Design', re: /\bpcb\b|\baltium\b|\beagle\s+cad\b|\bkicad\b/i },
  { name: 'Embedded C', re: /\bembedded\s+c\b|\bmicrocontroller\b|\barduino\b|\braspberry\s+pi\b/i },
  { name: 'LabVIEW', re: /\blabview\b/i },
  { name: 'Revit', re: /\brevit\b/i },
  { name: 'GIS', re: /\bgis\b|\barcgis\b/i },
  { name: 'PLC', re: /\bplc\b|\bscada\b/i },
  { name: 'Six Sigma', re: /\bsix\s+sigma\b|\blean\s+manufactur/i },

  // Business / creative
  { name: 'Financial Modeling', re: /\bfinancial\s+model/i },
  { name: 'Valuation', re: /\bvaluation\b|\bDCF\b/i },
  { name: 'Bloomberg', re: /\bbloomberg\s+terminal\b|\bbloomberg\b/i },
  { name: 'QuickBooks', re: /\bquickbooks\b/i },
  { name: 'SAP', re: /\bsap\b/i },
  { name: 'Salesforce', re: /\bsalesforce\b/i },
  { name: 'HubSpot', re: /\bhubspot\b/i },
  { name: 'Google Analytics', re: /\bgoogle\s+analytics\b|\bga4\b/i },
  { name: 'SEO/SEM', re: /\bseo\b|\bsem\b|\bppc\b/i },
  { name: 'Figma', re: /\bfigma\b/i },
  { name: 'Adobe Creative Suite', re: /\bphotoshop\b|\billustrator\b|\bindesign\b|\bafter\s+effects\b|\bpremiere\s+pro\b|\badobe\s+creative\b/i },
  { name: 'Sketch', re: /\bsketch\s+(?:app|design)\b/i },
  { name: 'Prototyping', re: /\bprototyp/i },
  { name: 'User Research', re: /\buser\s+research\b|\busability\s+test/i },
  { name: 'Agile/Scrum', re: /\bagile\b|\bscrum\b|\bkanban\b|\bjira\b/i },
  { name: 'Technical Writing', re: /\btechnical\s+writ/i },
  { name: 'Public Speaking', re: /\bpublic\s+speaking\b|\bpresentation\s+skills\b/i },

  // Science / health
  { name: 'Wet Lab', re: /\bwet\s+lab\b|\bpipett/i },
  { name: 'PCR', re: /\bpcr\b|\bqpcr\b/i },
  { name: 'Cell Culture', re: /\bcell\s+cultur/i },
  { name: 'Bioinformatics', re: /\bbioinformatic/i },
  { name: 'Clinical Research', re: /\bclinical\s+(?:research|trial)/i },
  { name: 'HIPAA', re: /\bhipaa\b/i },
  { name: 'Chromatography', re: /\bchromatograph|\bhplc\b|\bmass\s+spec/i },
  { name: 'Microscopy', re: /\bmicroscop|\bconfocal\b/i },
  { name: 'Flow Cytometry', re: /\bflow\s+cytometry\b|\bFACS\b/ },
  { name: 'Western Blot', re: /\bwestern\s+blot\b|\bimmunoblot/i },
  { name: 'ELISA', re: /\belisa\b/i },
  { name: 'Immunohistochemistry', re: /\bimmunohistochem|\bhistolog|\bIHC\b/ },
  { name: 'CRISPR', re: /\bcrispr\b|\bgene\s+editing\b/i },
  { name: 'Sequencing', re: /\b(?:RNA|DNA)[-\s]?seq\b|\bnext[-\s]generation\s+sequencing\b|\bNGS\b/ },
  { name: 'Animal Handling', re: /\banimal\s+(?:handling|husbandry|model)\b|\brodent\b|\bvivarium\b/i },
  { name: 'Sterile Technique', re: /\baseptic\b|\bsterile\s+technique\b|\bbiosafety\b|\bBSL-?[123]\b/i },
  { name: 'Patient Care', re: /\bpatient\s+care\b|\bbedside\b|\bdirect\s+patient\b/i },
  { name: 'Vital Signs', re: /\bvital\s+signs\b|\bphlebotom|\bvenipuncture\b|\bEKG\b|\bECG\b/i },
  { name: 'CPR/BLS', re: /\bCPR\b|\bBLS\b|\bACLS\b|\bbasic\s+life\s+support\b/i },
  { name: 'Medical Terminology', re: /\bmedical\s+terminolog/i },
  { name: 'Electronic Health Records', re: /\belectronic\s+(?:health|medical)\s+record|\bEHR\b|\bEMR\b|\bEpic\s+(?:systems|EHR|charting)\b/i },
  { name: 'Medical Coding', re: /\bICD-?10\b|\bCPT\s+cod|\bmedical\s+coding\b/i },
  { name: 'REDCap', re: /\bredcap\b/i },
  { name: 'SPSS', re: /\bspss\b/i },
  { name: 'SAS', re: /\bSAS\b(?!\s*token)/ },
  { name: 'Biostatistics', re: /\bbiostatistic|\bepidemiologic\s+method|\bsurvival\s+analysis\b/i },
  { name: 'GCP/IRB', re: /\bgood\s+clinical\s+practice\b|\bGCP\b|\bIRB\b|\binformed\s+consent\b/ },
  { name: 'Public Health Outreach', re: /\bcommunity\s+(?:outreach|health\s+worker)\b|\bhealth\s+education\b|\bcontact\s+tracing\b/i },
];

/** Extract known skills mentioned in a posting, most-signal first. */
export function extractSkills(text: string | null | undefined, limit = 14): string[] {
  const body = text ?? '';
  if (!body.trim()) return [];
  const found: { name: string; index: number }[] = [];
  for (const { name, re } of SKILLS) {
    const m = re.exec(body);
    if (m) found.push({ name, index: m.index });
  }
  // Earlier mentions usually sit in the requirements section.
  found.sort((a, b) => a.index - b.index);
  return found.slice(0, limit).map((f) => f.name);
}

export function allSkills(): string[] {
  return SKILLS.map((s) => s.name);
}

/** Case-insensitive skill overlap, used by fit scoring and resume gap analysis. */
export function skillOverlap(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((s) => s.toLowerCase().trim()));
  return a.filter((s) => setB.has(s.toLowerCase().trim()));
}
