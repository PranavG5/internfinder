/**
 * Seed list of applicant-tracking-system job boards.
 *
 * Every token here was verified to return a live board (see
 * scripts/verify-seeds.ts). The list only bootstraps the catalog —
 * `discoverBoards()` grows it automatically by reading the apply URLs that come
 * back from the aggregator feeds, so the app learns about new employers without
 * anyone editing this file.
 */

import { encodeEightfoldToken, eightfoldBoardFromUrl } from './eightfold';
import { encodeOracleToken, oracleBoardFromUrl } from './oracle';
import { encodeWorkdayToken, workdayBoardFromUrl } from './workday';

export type BoardKind =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'workable'
  | 'workday'
  | 'oracle'
  | 'eightfold'
  | 'rippling'
  | 'bamboohr'
  | 'breezy'
  | 'personio';

export interface SeedBoard {
  kind: BoardKind;
  token: string;
  label: string;
}

const GREENHOUSE = [
  'affirm', 'airtable', 'anthropic', 'asana', 'astranis', 'brex', 'checkr', 'chime',
  'cloudflare', 'coinbase', 'databricks', 'datadog', 'discord', 'dropbox',
  'duolingo', 'elastic', 'faire', 'figma', 'fivetran', 'flexport', 'ginkgobioworks',
  'gitlab', 'glossier', 'gusto', 'instacart', 'komodohealth', 'lyft', 'marqeta',
  'mercury', 'mongodb', 'muonspace', 'nextdoor', 'nuro', 'peloton', 'pinterest',
  'planetlabs', 'recursionpharmaceuticals', 'reddit', 'remotecom', 'riotgames',
  'robinhood', 'roblox', 'samsara', 'slingshotaerospace', 'sofi', 'truveta', 'twilio',
  'twitch', 'vercel', 'verkada',
  // Expansion wave: large intern programs across tech, aero, quant, and health.
  'stripe', 'airbnb', 'doordashusa', 'spacex', 'andurilindustries', 'scaleai',
  'epicgames', 'klaviyo', 'moloco', 'qualtrics', 'thetradedesk', 'zscaler',
  'waymo', 'flyzipline', 'aurorainnovation', 'torcrobotics', 'figureai',
  'jumptrading', 'optiverus', 'virtu', 'flowtraders', 'squarepointcapital',
  'towerresearchcapital', 'akunacapital', 'drweng', 'imc', 'wehrtyou', 'okta',
  'boxinc', 'squarespace', 'neuralink', 'amplitude', 'braze', 'carta',
  'gofundme', 'lucidmotors', 'pandadoc', 'stubhubinc', 'tanium', 'tripadvisor',
  'cockroachlabs', 'chanzuckerberginitiative', 'zocdoc', 'crunchyroll', 'roku',
  'tripactions', 'rocketlab', 'toast', 'liftoff',
] as const;

const LEVER = [
  'alloy', 'canvasmedical', 'palantir', 'spotify', 'zoox',
  // Expansion wave.
  'kraken123', 'highspot', 'outreach', 'entrata', 'matchgroup', 'mashgin',
  'plaid', 'saronic',
] as const;

const ASHBY = [
  'abridge', 'braintrust', 'clickhouse', 'cognition', 'cohere', 'cursor', 'elevenlabs',
  'harvey', 'langchain', 'linear', 'llamaindex', 'lovable', 'materialize', 'modal',
  'neon', 'neptune', 'notion', 'openai', 'pika', 'pinecone', 'poolside', 'ramp', 'reka',
  'replit', 'sierra', 'suno', 'supabase', 'synthesia', 'vanta', 'warp', 'weaviate',
  'writer', 'zed',
  // Expansion wave.
  'astronomer', 'multiverse', 'eightsleep', 'decagon', 'sardine', 'browserbase',
  'character', 'kalshi', 'polymarket', 'anrok', 'mercor', 'skydio', 'runway',
  'gecko-robotics', 'Deel',
] as const;

const SMARTRECRUITERS = [
  'Visa',
  // Expansion wave.
  'ServiceNow', 'BoschGroup', 'Ubisoft2', 'Gameloft', 'Experian', 'Devoteam',
  'Continental',
] as const;

const WORKABLE = [
  'blueground', 'huggingface', 'moodle',
] as const;

/**
 * Boards on the providers added for the large-employer expansion.
 *
 * Unlike the slug-based providers above, these tokens carry hosting details
 * (Workday encodes host/tenant/site, Oracle host/site), so they are listed as
 * explicit token/label pairs. Every entry below was confirmed to return at
 * least one live internship when it was added.
 */

const WORKDAY: [token: string, label: string][] = [
  ['cvshealth.wd1.myworkdayjobs.com/cvshealth/CVS_Health_Careers', 'CVS Health'],
  ['analogdevices.wd1.myworkdayjobs.com/analogdevices/External', 'Analog Devices'],
  ['hitachi.wd1.myworkdayjobs.com/hitachi/hitachi', 'Hitachi'],
  ['ag.wd3.myworkdayjobs.com/ag/Airbus', 'Airbus'],
  ['roche.wd3.myworkdayjobs.com/roche/roche-ext', 'Roche'],
  ['gevernova.wd5.myworkdayjobs.com/gevernova/vernova_externalsite', 'GE Vernova'],
  ['tencent.wd1.myworkdayjobs.com/tencent/Tencent_Careers', 'Tencent'],
  ['philips.wd3.myworkdayjobs.com/philips/jobs-and-careers', 'Philips'],
  ['utaustin.wd1.myworkdayjobs.com/utaustin/utstudent', 'University of Texas at Austin'],
  ['accenture.wd103.myworkdayjobs.com/accenture/AccentureCareers', 'Accenture'],
  ['nxp.wd3.myworkdayjobs.com/nxp/careers', 'NXP Semiconductors'],
  ['asml.wd3.myworkdayjobs.com/asml/asmlext1', 'ASML'],
  ['gevernova.wd5.myworkdayjobs.com/gevernova/only_confidential_executive_recruiting', 'GE Vernova'],
  ['abb.wd3.myworkdayjobs.com/abb/external_career_page', 'ABB'],
  ['disney.wd5.myworkdayjobs.com/disney/disneycareerdc', 'The Walt Disney Company'],
  ['thales.wd3.myworkdayjobs.com/thales/Careers', 'Thales'],
  ['citi.wd5.myworkdayjobs.com/citi/2', 'Citi'],
  ['globalfoundries.wd1.myworkdayjobs.com/globalfoundries/External', 'GlobalFoundries'],
  ['jll.wd1.myworkdayjobs.com/jll/jllcareers', 'Jones Lang LaSalle (JLL)'],
  ['medtronic.wd1.myworkdayjobs.com/medtronic/redeploymentmedtroniccareers', 'Medtronic'],
  ['mmc.wd1.myworkdayjobs.com/mmc/mmc', 'Marsh'],
  ['psu.wd1.myworkdayjobs.com/psu/PSU_Staff', 'Pennsylvania State University'],
  ['snc.wd1.myworkdayjobs.com/snc/snc_external_career_site', 'Sierra Nevada Corporation'],
  ['warnerbros.wd5.myworkdayjobs.com/warnerbros/global', 'Warner Bros.'],
  ['gehc.wd5.myworkdayjobs.com/gehc/GEHC_ExternalSite', 'GE Healthcare'],
  ['geaerospace.wd5.myworkdayjobs.com/geaerospace/ge_externalsite', 'GE Aerospace'],
  ['abbott.wd5.myworkdayjobs.com/abbott/abbottcareers', 'Abbott'],
  ['marvell.wd1.myworkdayjobs.com/marvell/MarvellCareers', 'Marvell'],
  ['micron.wd1.myworkdayjobs.com/micron/External', 'Micron Technology'],
  ['hp.wd5.myworkdayjobs.com/hp/EXTEU-AC-CareerSite', 'Hewlett Packard (HP)'],
  ['paloaltonetworks.wd5.myworkdayjobs.com/paloaltonetworks/panwexternalcareers', 'Palo Alto Networks'],
  ['cadence.wd1.myworkdayjobs.com/cadence/External_Careers', 'Cadence Design Systems'],
  ['intel.wd1.myworkdayjobs.com/intel/external', 'Intel'],
  ['cmu.wd5.myworkdayjobs.com/cmu/cmu', 'Carnegie Mellon University'],
  ['globalhr.wd5.myworkdayjobs.com/globalhr/Private_Posting_No_TMP', 'RTX'],
  ['tencent.wd1.myworkdayjobs.com/tencent/OA_Huoshui_Platform', 'Tencent'],
  ['harman.wd3.myworkdayjobs.com/harman/HARMAN', 'HARMAN International'],
  ['stryker.wd1.myworkdayjobs.com/stryker/StrykerCareers', 'Stryker'],
  ['cat.wd5.myworkdayjobs.com/cat/CaterpillarCareers', 'Caterpillar Inc.'],
  ['copart.wd12.myworkdayjobs.com/copart/copart', 'Copart'],
  ['jj.wd5.myworkdayjobs.com/jj/JJ', 'Johnson & Johnson'],
  ['aptiv.wd5.myworkdayjobs.com/aptiv/aptiv_careers', 'Aptiv'],
  ['generalmotors.wd5.myworkdayjobs.com/generalmotors/Careers_GM', 'General Motors'],
  ['globalhr.wd5.myworkdayjobs.com/globalhr/rec_rtx_ext_gateway', 'RTX'],
  ['selinc.wd1.myworkdayjobs.com/selinc/SEL', 'Schweitzer Engineering Laboratories'],
  ['utaustin.wd1.myworkdayjobs.com/utaustin/UTstaff', 'University of Texas at Austin'],
  ['ciena.wd5.myworkdayjobs.com/ciena/Careers', 'Ciena'],
  ['flextronics.wd1.myworkdayjobs.com/flextronics/Careers', 'Flextronics International'],
  ['jabil.wd5.myworkdayjobs.com/jabil/Jabil_Careers', 'Jabil'],
  ['jci.wd5.myworkdayjobs.com/jci/JCI', 'Johnson Controls'],
  ['salesforce.wd12.myworkdayjobs.com/salesforce/External_Career_Site', 'Salesforce'],
  ['amat.wd1.myworkdayjobs.com/amat/External', 'Applied Materials'],
  ['centific.wd1.myworkdayjobs.com/centific/Centific_Global', 'Centific'],
  ['motorolasolutions.wd5.myworkdayjobs.com/motorolasolutions/Careers', 'Motorola'],
  ['disney.wd5.myworkdayjobs.com/disney/disneycareer', 'The Walt Disney Company'],
  ['uasys.wd5.myworkdayjobs.com/uasys/uasys', 'University of Arkansas'],
  ['nvidia.wd5.myworkdayjobs.com/nvidia/NVIDIAExternalCareerSite', 'NVIDIA'],
  ['parsons.wd5.myworkdayjobs.com/parsons/search', 'Parsons'],
  ['tamus.wd1.myworkdayjobs.com/tamus/System-wide_External', 'Texas A&M University System'],
  ['wd1.myworkdaysite.com/wf/WellsFargoJobs', 'Wells Fargo'],
  ['roche.wd3.myworkdayjobs.com/roche/ROG-A2O-GENE', 'Genentech'],
  ['coke.wd1.myworkdayjobs.com/coke/coca-cola-careers', 'The Coca-Cola Company'],
  ['thermofisher.wd5.myworkdayjobs.com/thermofisher/ThermoFisherCareers', 'Thermo Fisher Scientific'],
  ['cae.wd3.myworkdayjobs.com/cae/career', 'CAE'],
  ['wd5.myworkdaysite.com/microchiphr/External', 'Microchip Technology'],
  ['moog.wd5.myworkdayjobs.com/moog/moog_external_career_site', 'Moog'],
  ['revvity.wd103.myworkdayjobs.com/revvity/External', 'Revvity'],
  ['marvell.wd1.myworkdayjobs.com/marvell/MarvellCareers2', 'Marvell'],
  ['mcgill.wd3.myworkdayjobs.com/mcgill/McGill_Careers', 'McGill University'],
  ['sbdinc.wd1.myworkdayjobs.com/sbdinc/Stanley_Black_Decker_Career_Site', 'Stanley Black & Decker'],
  ['flir.wd1.myworkdayjobs.com/flir/flircareers', 'Teledyne'],
  ['expedia.wd108.myworkdayjobs.com/expedia/private', 'Expedia Group'],
  ['fmr.wd1.myworkdayjobs.com/fmr/targeted', 'Fidelity Investments'],
  ['generac.wd5.myworkdayjobs.com/generac/external', 'Generac'],
  ['kiongroup.wd3.myworkdayjobs.com/kiongroup/kiongroup', 'KION Group'],
  ['manulife.wd3.myworkdayjobs.com/manulife/MFCJH_adminJobs', 'Manulife Financial'],
  ['fox.wd1.myworkdayjobs.com/fox/Domestic', 'FOX'],
  ['wd3.myworkdaysite.com/magna/Magna', 'Magna'],
  ['rbc.wd3.myworkdayjobs.com/rbc/ExternalPrivatePostingStudents', 'Royal Bank of Canada'],
  ['rbc.wd3.myworkdayjobs.com/rbc/RBCEARLYTALENT1', 'Royal Bank of Canada'],
  ['rb.wd5.myworkdayjobs.com/rb/FRS', 'The Federal Reserve System'],
  ['cisco.wd5.myworkdayjobs.com/cisco/cisco_careers', 'Cisco'],
  ['ms.wd5.myworkdayjobs.com/ms/External', 'Morgan Stanley'],
  ['rbc.wd3.myworkdayjobs.com/rbc/rbcglobal1', 'Royal Bank of Canada'],
  ['autodesk.wd1.myworkdayjobs.com/autodesk/Ext', 'Autodesk'],
  ['autodesk.wd1.myworkdayjobs.com/autodesk/uni', 'Autodesk'],
  ['cadence.wd1.myworkdayjobs.com/cadence/Univ_Careers', 'Cadence Design Systems'],
  ['massgeneralbrigham.wd1.myworkdayjobs.com/massgeneralbrigham/mgbexternal', 'Mass General Brigham'],
  ['resmed.wd3.myworkdayjobs.com/resmed/ResMed_External_Careers', 'Resmed'],
  ['sec.wd3.myworkdayjobs.com/sec/Samsung_Careers', 'Samsung'],
  ['bmo.wd3.myworkdayjobs.com/bmo/External', 'Bank of Montreal'],
  ['bdx.wd1.myworkdayjobs.com/bdx/EXTERNAL_CAREER_SITE_USA', 'Becton Dickinson'],
  ['capitalone.wd12.myworkdayjobs.com/capitalone/Capital_One', 'Capital One'],
  ['draper.wd5.myworkdayjobs.com/draper/Draper_Careers', 'Draper'],
  ['hpe.wd5.myworkdayjobs.com/hpe/acjobsite', 'Hewlett Packard Enterprise'],
  ['leidos.wd5.myworkdayjobs.com/leidos/External', 'Leidos'],
  ['lumentum.wd5.myworkdayjobs.com/lumentum/LITE', 'Lumentum'],
  ['manulife.wd3.myworkdayjobs.com/manulife/MFCJH_Jobs', 'Manulife Financial'],
  ['quickenloans.wd5.myworkdayjobs.com/quickenloans/rocket_careers', 'Rocket Mortgage'],
  ['rogersbh.wd1.myworkdayjobs.com/rogersbh/rbhcareer', 'Rogers Behavioral Health'],
  ['uline.wd1.myworkdayjobs.com/uline/Uline_Careers', 'Uline'],
  ['adobe.wd5.myworkdayjobs.com/adobe/external_experienced', 'Adobe'],
  ['comcast.wd5.myworkdayjobs.com/comcast/Comcast_Careers', 'Comcast'],
  ['kla.wd1.myworkdayjobs.com/kla/Search', 'KLA'],
  ['kla.wd1.myworkdayjobs.com/kla/search', 'KLA Corporation'],
  ['relx.wd3.myworkdayjobs.com/relx/relx', 'RELX'],
  ['spgi.wd5.myworkdayjobs.com/spgi/SPGI_Careers', 'S&P Global'],
  ['allstate.wd5.myworkdayjobs.com/allstate/allstate_careers', 'Allstate Insurance Company'],
  ['pae.wd1.myworkdayjobs.com/pae/amentum_careers', 'Amentum'],
  ['argonne.wd1.myworkdayjobs.com/argonne/Argonne_Careers', 'Argonne National Laboratory'],
  ['bmo.wd3.myworkdayjobs.com/bmo/Privileged', 'Bank of Montreal'],
  ['bmo.wd3.myworkdayjobs.com/bmo/Campus', 'Bank of Montreal'],
  ['blueorigin.wd5.myworkdayjobs.com/blueorigin/blueorigin', 'Blue Origin'],
  ['cvshealth.wd1.myworkdayjobs.com/cvshealth/Private_Postings_Intern_Conversion_ONLY', 'CVS Health'],
  ['gdit.wd5.myworkdayjobs.com/gdit/external_career_site', 'General Dynamics Information Technology'],
  ['huntington.wd12.myworkdayjobs.com/huntington/HNBcareers', 'Huntington Bancshares'],
  ['kbr.wd5.myworkdayjobs.com/kbr/KBR_Careers', 'KBR'],
  ['relx.wd3.myworkdayjobs.com/relx/RiskSolutions', 'LexisNexis Risk Solutions'],
  ['nasdaq.wd1.myworkdayjobs.com/nasdaq/Global_External_Site', 'Nasdaq'],
  ['osu.wd1.myworkdayjobs.com/osu/OSUCareers', 'Ohio State University'],
  ['onto.wd1.myworkdayjobs.com/onto/onto_careers', 'Onto Innovation'],
  ['aero.wd5.myworkdayjobs.com/aero/external', 'The Aerospace Corporation'],
  ['boeing.wd1.myworkdayjobs.com/boeing/EXTERNAL_CAREERS', 'The Boeing Company'],
  ['boeing.wd1.myworkdayjobs.com/boeing/external_subsidiary', 'The Boeing Company'],
  ['uchicago.wd5.myworkdayjobs.com/uchicago/External', 'University of Chicago'],
  ['vanguard.wd5.myworkdayjobs.com/vanguard/contractors_restricted', 'Vanguard'],
  ['onehealthineers.wd3.myworkdayjobs.com/onehealthineers/SHSJB', 'Varian'],
];
const ORACLE: [token: string, label: string][] = [
  ['hdpc.fa.us2.oraclecloud.com/LateralHiring', 'Goldman Sachs'],
  ['edbz.fa.us2.oraclecloud.com/CX', 'Texas Instruments'],
  ['edyy.fa.us2.oraclecloud.com/CX_2002', 'Sinclair'],
  ['fa-errt-saasfaprod1.fa.ocs.oraclecloud.com/CX_2001', 'SCOR'],
  ['fa-espx-saasfaprod1.fa.ocs.oraclecloud.com/CX_1', 'Cummins'],
  ['ebcs.fa.em2.oraclecloud.com/CX_1', 'Arcadis'],
  ['eofd.fa.us6.oraclecloud.com/CX_1001', 'Albertsons'],
  ['ibqbjb.fa.ocs.oraclecloud.com/Honeywell', 'Honeywell'],
  ['egug.fa.us2.oraclecloud.com/CX_1', 'American Express'],
  ['hctz.fa.us2.oraclecloud.com/CX_1001', 'onsemi'],
  ['jpmc.fa.oraclecloud.com/CX_1001', 'JP Morgan Chase'],
  ['fa-exty-saasfaprod1.fa.ocs.oraclecloud.com/CX_1', 'Howmet Aerospace'],
  ['emit.fa.ca3.oraclecloud.com/CX_2001', 'WSP'],
  ['eeik.fa.us2.oraclecloud.com/CX_1', 'University of Wyoming'],
  ['ejov.fa.ca2.oraclecloud.com/CX', 'GHD'],
  ['hdhl.fa.us6.oraclecloud.com/CX_1', 'Stantec'],
  ['fa-evxo-saasfaprod1.fa.ocs.oraclecloud.com/CX_1', 'Community Health Systems'],
  ['hcxs.fa.us2.oraclecloud.com/CX_1', 'Kroll'],
  ['eevd.fa.us6.oraclecloud.com/CX_1', 'Hearst'],
  ['eedu.fa.em3.oraclecloud.com/CX_1003', 'WTW'],
  ['ecyq.fa.em2.oraclecloud.com/CX_1', 'DNV'],
  ['fa-evmr-saasfaprod1.fa.ocs.oraclecloud.com/CX_1', 'Nokia'],
  ['edmn.fa.us2.oraclecloud.com/CX_1', 'Caesars Entertainment'],
  ['hdjq.fa.us2.oraclecloud.com/CX_1', 'Emerson Electric'],
  ['eljs.fa.us2.oraclecloud.com/CX', 'Tiffany & Co.'],
  ['ejta.fa.us6.oraclecloud.com/CX_2001', 'Fortive'],
  ['fa-eups-saasfaprod1.fa.ocs.oraclecloud.com/ULSolutionsCareers', 'UL Solutions'],
  ['ejhp.fa.us6.oraclecloud.com/CX_2', 'Sherwin-Williams'],
  ['hbbq.fa.us2.oraclecloud.com/CX_1', 'American Bureau of Shipping'],
  ['fa-ewgu-saasfaprod1.fa.ocs.oraclecloud.com/CX_2001', 'Chubb'],
  ['fa-euxc-saasfaprod1.fa.ocs.oraclecloud.com/CX_1', 'Citco'],
  ['eeug.fa.us6.oraclecloud.com/CX', 'Diebold Nixdorf'],
  ['edel.fa.us2.oraclecloud.com/CX_2001', 'Fortinet'],
  ['egay.fa.us6.oraclecloud.com/CX_4001', 'NOV'],
  ['ebwb.fa.us2.oraclecloud.com/CX', 'Hologic'],
  ['cva.fa.us1.oraclecloud.com/CX_3', 'Standard Aero'],
  ['fa-eygo-saasfaprod1.fa.ocs.oraclecloud.com/CX_2001', 'Worthington Enterprises'],
  ['hcjy.fa.us2.oraclecloud.com/CX_1', 'Cooper Companies'],
  ['hdks.fa.ca2.oraclecloud.com/CX_1', 'Definity Financial'],
  ['ejia.fa.us6.oraclecloud.com/CX_1001', 'S&C Electric Company'],
  ['fa-extu-saasfaprod1.fa.ocs.oraclecloud.com/CX_1', 'Akamai Technologies'],
  ['fa-essf-saasfaprod1.fa.ocs.oraclecloud.com/CX_1', 'Berkshire Hathaway Energy'],
  ['eoje.fa.us2.oraclecloud.com/CX_1001', 'Black Box'],
  ['edix.fa.us2.oraclecloud.com/CX_1', 'Corsair'],
  ['fa-ewjt-saasfaprod1.fa.ocs.oraclecloud.com/CX_2', 'EXL'],
  ['hcog.fa.em2.oraclecloud.com/CX_1', 'Intertek'],
  ['ebxs.fa.us2.oraclecloud.com/CX_2', 'Michael Baker International'],
  ['eppr.fa.us2.oraclecloud.com/CX_2', 'Northwell Health'],
  ['hccz.fa.em3.oraclecloud.com/CX_2', 'Pearson'],
  ['ibwujb.fa.ocs.oraclecloud.com/CX_1001', 'Ralliant'],
  ['hckz.fa.us2.oraclecloud.com/CX_1', 'Seaspan'],
  ['egup.fa.us2.oraclecloud.com/CX', 'Vertiv'],
  ['ebwg.fa.us2.oraclecloud.com/CX', 'ACI Worldwide'],
  ['eezy.fa.ca2.oraclecloud.com/CX', 'ATCO'],
  ['ejko.fa.us2.oraclecloud.com/CX_3', 'Blue Cross Blue Shield of Michigan'],
  ['ebxr.fa.us2.oraclecloud.com/CX_1', 'DTCC'],
  ['efds.fa.em5.oraclecloud.com/CX_1', 'Ford Motor Company'],
  ['fa-eqcd-saasfaprod1.fa.ocs.oraclecloud.com/CX_1', 'Hunt Oil Company'],
  ['fa-etnb-saasfaprod1.fa.ocs.oraclecloud.com/CX_1001', 'Northumbria University'],
  ['eeho.fa.us2.oraclecloud.com/CX_45001', 'Oracle'],
  ['elxw.fa.em3.oraclecloud.com/CX_1001', 'The University of Edinburgh'],
  ['ehac.fa.us6.oraclecloud.com/CX_1', 'Williams-Sonoma'],
];
const RIPPLING: [token: string, label: string][] = [
  ['rippling', 'Rippling'],
  ['democratic-national-committee', 'Democratic National Committee'],
  ['spreeai', 'SpreeAI'],
  ['lightguide', 'LightGuide, Inc.'],
  ['gitar-careers', 'Gitar, Inc.'],
  ['kraken-robotics-inc', 'Kraken Robotics'],
  ['acretrader-jobs', 'AcreTrader'],
  ['aapd-jobs', 'American Association of People With Disabilities'],
  ['ampliwork-inc', 'Ampliwork, Inc'],
  ['onware', 'Onware'],
];
const BAMBOOHR: [token: string, label: string][] = [
  ['safransed', 'Safran'],
];
const BREEZY: [token: string, label: string][] = [
  ['vetsez', 'VetsEZ'],
];

/**
 * Eightfold tenants, as `{host}/{domain}`.
 *
 * Most Eightfold instances answer the jobs API only for an authenticated
 * session, so this list stays short by necessity — the adapter treats a 403 as
 * an empty board rather than a failure. Vanity hosts like Netflix's carry no
 * derivable tenant key either, which is the other reason they are named here
 * rather than discovered.
 */
const EIGHTFOLD: [token: string, label: string][] = [
  ['explore.jobs.netflix.net/netflix.com', 'Netflix'],
];

/** Turn a board slug into something presentable, e.g. "ginkgobioworks" -> "Ginkgobioworks". */
function label(token: string): string {
  return token
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Providers whose tokens already carry the employer name, as token/label pairs. */
const PAIRED: [kind: BoardKind, boards: [token: string, label: string][]][] = [
  ['workday', WORKDAY],
  ['oracle', ORACLE],
  ['eightfold', EIGHTFOLD],
  ['rippling', RIPPLING],
  ['bamboohr', BAMBOOHR],
  ['breezy', BREEZY],
];

export const SEED_BOARDS: SeedBoard[] = [
  ...GREENHOUSE.map((token) => ({ kind: 'greenhouse' as const, token, label: label(token) })),
  ...LEVER.map((token) => ({ kind: 'lever' as const, token, label: label(token) })),
  ...ASHBY.map((token) => ({ kind: 'ashby' as const, token, label: label(token) })),
  ...SMARTRECRUITERS.map((token) => ({ kind: 'smartrecruiters' as const, token, label: token })),
  ...WORKABLE.map((token) => ({ kind: 'workable' as const, token, label: label(token) })),
  ...PAIRED.flatMap(([kind, boards]) => boards.map(([token, name]) => ({ kind, token, label: name }))),
];

/** Singleton feeds that aren't per-company. */
export const SEED_FEEDS: { kind: string; token: string; label: string }[] = [
  { kind: 'github', token: 'simplify-summer', label: 'GitHub · SimplifyJobs Summer 2026' },
  { kind: 'github', token: 'vansh-summer', label: 'GitHub · vanshb03 Summer 2026' },
  { kind: 'github', token: 'simplify-newgrad', label: 'GitHub · SimplifyJobs New Grad' },
  { kind: 'amazon', token: '-', label: 'Amazon' },
  { kind: 'remoteok', token: '-', label: 'RemoteOK' },
  { kind: 'arbeitnow', token: '-', label: 'Arbeitnow (Europe)' },
  { kind: 'jobicy', token: '-', label: 'Jobicy (remote)' },
];

/**
 * Recognize an ATS board from an application URL so new employers can be
 * discovered from feeds we already ingest.
 */
export function boardFromUrl(url: string): SeedBoard | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const segments = u.pathname.split('/').filter(Boolean);

  const take = (index: number): string | null => {
    const raw = segments[index];
    if (!raw) return null;
    const token = decodeURIComponent(raw).trim();
    // Board slugs are short and simple; anything else is a path, not a token.
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,48}$/.test(token)) return null;
    if (/^(jobs?|careers?|embed|board|search|en-us|api|v\d+)$/i.test(token)) return null;
    return token;
  };

  if (host.endsWith('greenhouse.io')) {
    // boards.greenhouse.io/<token>/jobs/123, job-boards.greenhouse.io/<token>/jobs/123
    const token = take(0);
    return token ? { kind: 'greenhouse', token, label: label(token) } : null;
  }
  if (host.endsWith('lever.co')) {
    const token = take(0);
    return token ? { kind: 'lever', token, label: label(token) } : null;
  }
  if (host.endsWith('ashbyhq.com')) {
    const token = take(0);
    return token ? { kind: 'ashby', token, label: label(token) } : null;
  }
  if (host.endsWith('smartrecruiters.com')) {
    const token = take(0);
    return token ? { kind: 'smartrecruiters', token, label: token } : null;
  }
  if (host === 'apply.workable.com') {
    // apply.workable.com/<token>/j/<shortcode>
    const token = take(0);
    return token ? { kind: 'workable', token, label: label(token) } : null;
  }

  // Workday alone accounts for about half of every application link in the
  // community archives, so recognizing it here is what turns one sync into a
  // thousand new employer boards.
  const workday = workdayBoardFromUrl(host, segments);
  if (workday) {
    return { kind: 'workday', token: encodeWorkdayToken(workday), label: label(workday.tenant) };
  }

  const oracle = oracleBoardFromUrl(host, segments);
  if (oracle) {
    // Oracle pods are opaque hashes, so the site name is the only readable
    // hint — and it is often a placeholder like "CX_1". A real employer name
    // from the feed replaces this during discovery whenever one is available.
    return { kind: 'oracle', token: encodeOracleToken(oracle), label: label(oracle.site) };
  }

  const eightfold = eightfoldBoardFromUrl(host, segments);
  if (eightfold) {
    return {
      kind: 'eightfold',
      token: encodeEightfoldToken(eightfold),
      label: label(host.split('.')[0]),
    };
  }

  if (host === 'ats.rippling.com') {
    // ats.rippling.com/<board>/jobs/<uuid>
    const token = take(0);
    return token ? { kind: 'rippling', token, label: label(token.replace(/-(jobs|careers)$/, '')) } : null;
  }
  if (host.endsWith('.bamboohr.com')) {
    const token = host.split('.')[0];
    return /^[a-z0-9][a-z0-9-]{1,40}$/.test(token)
      ? { kind: 'bamboohr', token, label: label(token) }
      : null;
  }
  if (host.endsWith('.breezy.hr')) {
    const token = host.split('.')[0];
    return /^[a-z0-9][a-z0-9-]{1,40}$/.test(token)
      ? { kind: 'breezy', token, label: label(token) }
      : null;
  }
  if (host.endsWith('.jobs.personio.de') || host.endsWith('.jobs.personio.com')) {
    const token = host.split('.')[0];
    return /^[a-z0-9][a-z0-9-]{1,40}$/.test(token)
      ? { kind: 'personio', token, label: label(token) }
      : null;
  }

  return null;
}

/**
 * The label a board gets when nothing better is known — i.e. derived from its
 * own token. Discovery uses this to tell "we only ever had a slug" apart from
 * "someone already gave this board a real employer name".
 */
export function fallbackLabel(board: SeedBoard): string {
  switch (board.kind) {
    case 'workday':
      return label(board.token.split('/')[1] ?? board.token);
    case 'oracle':
      return label(board.token.split('/')[1] ?? board.token);
    case 'eightfold':
      return label((board.token.split('/')[0] ?? '').split('.')[0]);
    case 'smartrecruiters':
      return board.token;
    case 'rippling':
      return label(board.token.replace(/-(jobs|careers)$/, ''));
    default:
      return label(board.token);
  }
}
