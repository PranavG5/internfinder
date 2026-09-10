/**
 * Seed list of applicant-tracking-system job boards.
 *
 * Every token here was verified to return a live board (see
 * scripts/verify-seeds.ts). The list only bootstraps the catalog, because
 * `discoverBoards()` grows it automatically by reading the apply URLs that come
 * back from the aggregator feeds, so the app learns about new employers without
 * anyone editing this file.
 */

import type { BoardKind } from '../types';
import { encodeEightfoldToken, eightfoldBoardFromUrl } from './eightfold';
import { encodeOracleToken, oracleBoardFromUrl } from './oracle';
import { encodeUkgToken, ukgBoardFromUrl } from './midmarket';
import { phenomHostFromUrl } from './phenom';
import { encodeWorkdayToken, workdayBoardFromUrl } from './workday';

// The kind vocabulary lives with the shared types so client components can
// name a provider without importing the adapters that fetch from it.
export type { BoardKind } from '../types';
export { BOARD_KINDS, FEED_KINDS, KIND_LABELS, SOURCE_KINDS } from '../types';

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
  // Healthcare, biotech and health tech. Premed and life-science students had
  // almost nothing to search before these.
  'calicolabs', 'flatironhealth', '10xgenomics', 'altoslabs', 'arcinstitute',
  'freenome', 'caribou', 'beamtherapeutics', 'primemedicine', 'pathai',
  'omadahealth', 'swordhealth', 'mavenclinic', 'doximity', 'parsleyhealth',
  'talkspace', 'curative', 'honor', 'elationhealth', 'oshihealth',
  'charliehealth', 'trustedhealth', 'cloverhealth', 'iterativehealth',
  'akidolabs', 'welbehealth', 'resilience',
  // Expansion wave: every board below answered its provider's API with live
  // postings when it was added. Most came from probing the employers students
  // actually name (verified against the company's own board, never a listing
  // site) and from the boards companies link in the monthly hiring threads.
  '6sense', 'adyen', 'air', 'algolia', 'alloy', 'alta', 'antheia', 'apptronik', 'attentive',
  'axiom', 'axonius', 'bandwidth', 'baselayer', 'betterment', 'beyond', 'biofourmis', 'bitgo',
  'bitwarden', 'blacklane', 'blend', 'block', 'branch', 'brave', 'buildkite', 'bungie', 'calm',
  'canonical', 'carbon', 'chainguard', 'chargepoint', 'checkbook', 'clear', 'coalition',
  'cognism', 'comet', 'consensys', 'corelight', 'coupang', 'current', 'cybereason', 'dashlane',
  'descope', 'dialpad', 'didi', 'divergent', 'doppel', 'dragos', 'durable', 'enveritas',
  'epirus', 'erasca', 'expel', 'fairlife', 'fastly', 'feedzai', 'fetch', 'figure',
  'fireblocks', 'five9', 'forbes', 'formlabs', 'forter', 'forward', 'gemini', 'ghost',
  'graphcore', 'highnote', 'honeycomb', 'hudl', 'huntress', 'innovid', 'iterable', 'jumio',
  'knock', 'kodiak', 'lattice', 'lightmatter', 'lithic', 'markforged', 'melio', 'mixpanel',
  'monzo', 'motional', 'motive', 'natera', 'netlify', 'netskope', 'nkarta', 'nuvalent',
  'octave', 'oportun', 'otter', 'pacaso', 'papa', 'payoneer', 'perpay', 'point72', 'porter',
  'prove', 'ripple', 'riskified', 'roofstock', 'salesloft', 'schonfeld', 'scopely', 'sendbird',
  'sezzle', 'smartsheet', 'spin', 'spire', 'sunnova', 'sweetgreen', 'taboola', 'tailscale',
  'tenstorrent', 'thanx', 'ubiquiti', 'universal', 'upgrade', 'upstart', 'vacasa', 'veracode',
  'veriff', 'verve', 'via', 'vonage', 'vtex', 'wayve', 'webflow', 'wise', 'wolt', 'wrike',
  'xometry', 'yubico',
] as const;

const LEVER = [
  'alloy', 'canvasmedical', 'palantir', 'spotify', 'zoox',
  // Expansion wave.
  'kraken123', 'highspot', 'outreach', 'entrata', 'matchgroup', 'mashgin',
  'plaid', 'saronic',
  // Health tech.
  'nomihealth',
  // Expansion wave: every board below answered its provider's API with live
  // postings when it was added. Most came from probing the employers students
  // actually name (verified against the company's own board, never a listing
  // site) and from the boards companies link in the monthly hiring threads.
  'aircall', 'alector', 'anomali', 'anyscale', 'arcadia', 'contentsquare', 'deliverect',
  'dexterity', 'factor', 'finix', 'fundrise', 'gopuff', 'immuta', 'kasada', 'latch',
  'matillion', 'metabase', 'osaro', 'placemakr', 'porter', 'prosper', 'protolabs', 'resilinc',
  'rover', 'scaleway', 'secureframe', 'sonatype', 'sophos', 'sysdig', 'telesat', 'twingate',
  'voltus', 'waabi', 'wealthfront', 'zilliz',
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
  // Clinical AI and digital health.
  'openevidence', 'nabla', 'counsel', 'superpower', 'tennr', 'anterior',
  'clarium', 'rula', 'slingshotai', 'neko-health', 'cradlebio',
  // Expansion wave: every board below answered its provider's API with live
  // postings when it was added. Most came from probing the employers students
  // actually name (verified against the company's own board, never a listing
  // site) and from the boards companies link in the monthly hiring threads.
  'acorns', 'airbyte', 'airwallex', 'alchemy', 'anyscale', 'aptura', 'astera', 'astra',
  'baseten', 'bestow', 'bliro', 'cantina', 'capsule', 'castle', 'circle', 'clerk', 'colonist',
  'column', 'confluent', 'DeepL', 'delinea', 'deliveroo', 'demandbase', 'docker', 'doppel',
  'drata', 'dryft', 'elliptic', 'expensify', 'firetiger', 'flink', 'forus', 'grow-therapy',
  'headway', 'iterable', 'knock', 'ladder', 'langdock', 'lemonade', 'lifespan', 'mechanize',
  'middesk', 'netgear', 'nubank', 'old-mission-capital', 'olympus', 'openly', 'paxos',
  'Pear-VC', 'persona', 'plaid', 'prelude', 'prior-labs', 'railway', 'redis', 'render', 'rho',
  'rilla', 'saronic', 'second-front-systems', 'secureframe', 'semgrep', 'sentry', 'sisense',
  'slingshot-aerospace', 'snowflake', 'socure', 'sprinter-health', 'strava', 'stream',
  'stytch', 'supercell', 'tonal', 'trulioo', 'turion-space', 'upvest', 'volta', 'vultr',
  'wayve', 'Weave', 'whoop',
] as const;

const SMARTRECRUITERS = [
  'Visa',
  // Expansion wave.
  'ServiceNow', 'BoschGroup', 'Ubisoft2', 'Gameloft', 'Experian', 'Devoteam',
  'Continental',
] as const;

const WORKABLE = [
  'blueground', 'huggingface', 'moodle',
  // Expansion wave: every board below answered its provider's API with live
  // postings when it was added. Most came from probing the employers students
  // actually name (verified against the company's own board, never a listing
  // site) and from the boards companies link in the monthly hiring threads.
  'treatwell',
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
  // Workday site names are case-insensitive, so the lowercase twin of this
  // token was the same board fetched twice under a second employer name.
  ['kla.wd1.myworkdayjobs.com/kla/Search', 'KLA'],
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
  // Hospitals and academic medical centers. Health systems are where clinical
  // internships, nurse externships and hospital research assistantships are
  // posted, and none of them were reachable from the catalog before.
  ['ccf.wd1.myworkdayjobs.com/ccf/ClevelandClinicCareers', 'Cleveland Clinic'],
  ['msk.wd108.myworkdayjobs.com/msk/MSKCC_Careers_Primary', 'Memorial Sloan Kettering Cancer Center'],
  ['danafarber.wd5.myworkdayjobs.com/danafarber/dana-farber', 'Dana-Farber Cancer Institute'],
  ['stanfordmedicine.wd115.myworkdayjobs.com/stanfordmedicine/SHC_External_Career_Site', 'Stanford Health Care'],
  ['nyp.wd1.myworkdayjobs.com/nyp/nypcareers', 'NewYork-Presbyterian'],
  ['jeffersonhealth.wd5.myworkdayjobs.com/jeffersonhealth/ThomasJeffersonExternal', 'Jefferson Health'],
  ['geisinger.wd5.myworkdayjobs.com/geisinger/GeisingerExternal', 'Geisinger'],
  ['sentara.wd1.myworkdayjobs.com/sentara/SCS', 'Sentara Health'],
  ['imh.wd108.myworkdayjobs.com/imh/IntermountainCareers', 'Intermountain Health'],
  ['bannerhealth.wd108.myworkdayjobs.com/bannerhealth/Careers', 'Banner Health'],
  ['bannerhealth.wd108.myworkdayjobs.com/bannerhealth/sonoraquestcareers', 'Sonora Quest Laboratories'],
  ['sharp.wd1.myworkdayjobs.com/sharp/External', 'Sharp HealthCare'],
  ['adventhealth.wd12.myworkdayjobs.com/adventhealth/AH_External_Career_Site', 'AdventHealth'],
  ['ochsner.wd1.myworkdayjobs.com/ochsner/Ochsner', 'Ochsner Health'],
  ['musc.wd1.myworkdayjobs.com/musc/MUSC', 'Medical University of South Carolina'],
  ['vumc.wd1.myworkdayjobs.com/vumc/vumccareers', 'Vanderbilt University Medical Center'],
  ['wvumedicine.wd1.myworkdayjobs.com/wvumedicine/WVUH', 'WVU Medicine'],
  ['wvumedicine.wd1.myworkdayjobs.com/wvumedicine/UHA', 'WVU Medicine'],
  ['childrensnational.wd108.myworkdayjobs.com/childrensnational/CN_Careers', "Children's National Hospital"],
  ['nationwidechildrens.wd5.myworkdayjobs.com/nationwidechildrens/NCHCareers', "Nationwide Children's Hospital"],
  // Pharma, medical devices and diagnostics.
  ['msd.wd5.myworkdayjobs.com/msd/SearchJobs', 'Merck'],
  ['amgen.wd1.myworkdayjobs.com/amgen/Careers', 'Amgen'],
  ['gilead.wd1.myworkdayjobs.com/gilead/gileadcareers', 'Gilead Sciences'],
  ['modernatx.wd1.myworkdayjobs.com/modernatx/M_tx', 'Moderna'],
  ['biibhr.wd3.myworkdayjobs.com/biibhr/external', 'Biogen'],
  ['bristolmyerssquibb.wd5.myworkdayjobs.com/bristolmyerssquibb/BMS', 'Bristol Myers Squibb'],
  ['illumina.wd1.myworkdayjobs.com/illumina/illumina-careers', 'Illumina'],
  ['edwards.wd5.myworkdayjobs.com/edwards/EdwardsCareers', 'Edwards Lifesciences'],
  ['iqvia.wd1.myworkdayjobs.com/iqvia/IQVIA', 'IQVIA'],
  ['agilent.wd5.myworkdayjobs.com/agilent/Agilent_Careers', 'Agilent Technologies'],
  ['agilent.wd5.myworkdayjobs.com/agilent/Agilent_Student_Careers', 'Agilent Technologies'],
  ['elevancehealth.wd1.myworkdayjobs.com/elevancehealth/ANT', 'Elevance Health'],
  ['cigna.wd5.myworkdayjobs.com/cigna/cignacareers', 'The Cigna Group'],
  // Research institutes and universities, which is where bench and lab
  // openings live: undergraduate research assistants, lab aides, study
  // coordinators.
  ['hhmi.wd1.myworkdayjobs.com/hhmi/External', 'Howard Hughes Medical Institute'],
  ['thejacksonlaboratory.wd503.myworkdayjobs.com/thejacksonlaboratory/External_JAX', 'The Jackson Laboratory'],
  ['rand.wd5.myworkdayjobs.com/rand/External_Career_Site', 'RAND Corporation'],
  ['wd5.myworkdaysite.com/uw/UWHires', 'University of Washington'],
  ['rochester.wd5.myworkdayjobs.com/rochester/UR_Staff', 'University of Rochester'],
  ['rochester.wd5.myworkdayjobs.com/rochester/UR_Nursing', 'University of Rochester'],
  ['cornell.wd1.myworkdayjobs.com/cornell/CornellCareerPage', 'Cornell University'],
  ['brown.wd5.myworkdayjobs.com/brown/staff-careers-brown', 'Brown University'],
  ['usc.wd5.myworkdayjobs.com/usc/ExternalUSCCareers', 'University of Southern California'],
  ['northeastern.wd1.myworkdayjobs.com/northeastern/careers', 'Northeastern University'],
  ['georgetown.wd1.myworkdayjobs.com/georgetown/Georgetown_Admin_Careers', 'Georgetown University'],
  ['wustl.wd1.myworkdayjobs.com/wustl/External', 'Washington University in St. Louis'],
  ['umd.wd1.myworkdayjobs.com/umd/UMCP', 'University of Maryland'],
  // Expansion wave: verified live when added.
  ['albemarle.wd5.myworkdayjobs.com/albemarle/External', 'Albemarle'],
  ['arcticwolf.wd1.myworkdayjobs.com/arcticwolf/External', 'Arctic Wolf'],
  ['aviagen.wd1.myworkdayjobs.com/aviagen/aviagen-careers', 'Aviagen'],
  ['blackrock.wd1.myworkdayjobs.com/blackrock/BlackRock_Professional', 'BlackRock'],
  ['cambiumlearning.wd1.myworkdayjobs.com/cambiumlearning/camb', 'Cambium Learning Group'],
  ['cenovus.wd3.myworkdayjobs.com/cenovus/careers', 'Cenovus Energy'],
  ['ceritypartners.wd12.myworkdayjobs.com/ceritypartners/ceritypartnerscareers', 'Cerity Partners'],
  ['desjardins.wd10.myworkdayjobs.com/desjardins/Desjardins', 'Desjardins'],
  ['djeholdings.wd5.myworkdayjobs.com/djeholdings/ZenoCareers', 'Zeno Group'],
  ['dowjones.wd1.myworkdayjobs.com/dowjones/Dow_Jones_Career', 'Dow Jones'],
  ['ebay.wd5.myworkdayjobs.com/ebay/apply', 'eBay'],
  ['healthcare.wd1.myworkdayjobs.com/healthcare/Search', 'Solventum'],
  ['kiongroup.wd3.myworkdayjobs.com/kiongroup/KION_SCS', 'KION Group'],
  ['labcorp.wd1.myworkdayjobs.com/labcorp/External', 'Labcorp'],
  ['mastercard.wd1.myworkdayjobs.com/mastercard/CorporateCareers', 'Mastercard'],
  ['medtronic.wd1.myworkdayjobs.com/medtronic/MedtronicCareers', 'Medtronic'],
  ['myhrabc.wd5.myworkdayjobs.com/myhrabc/Global', 'Cencora'],
  ['nelnet.wd1.myworkdayjobs.com/nelnet/MyNelnet', 'Nelnet'],
  ['premierinc.wd1.myworkdayjobs.com/premierinc/External_Professional', 'Premier Inc.'],
  ['relx.wd3.myworkdayjobs.com/relx/ElsevierJobs', 'Elsevier'],
  ['sonyglobal.wd1.myworkdayjobs.com/sonyglobal/SonyGlobalCareers', 'Sony'],
  ['trumpf.wd3.myworkdayjobs.com/trumpf/TRUMPF_Graduates_and_Professionals', 'TRUMPF'],
  ['tuftsmedicine.wd1.myworkdayjobs.com/tuftsmedicine/Jobs', 'Tufts Medicine'],
  ['ucar.wd5.myworkdayjobs.com/ucar/UCAR_Careers', 'University Corporation for Atmospheric Research'],
  ['wd1.myworkdaysite.com/ssctech/SSCTechnologies', 'SS&C Technologies'],
  ['wd1.myworkdaysite.com/upenn/careers-at-penn', 'University of Pennsylvania'],
  ['workwear.wd503.myworkdayjobs.com/workwear/Careers', 'Workwear Outfitters'],
  ['wpengine.wd1.myworkdayjobs.com/wpengine/WP_Engine', 'WP Engine'],
  ['zeissgroup.wd3.myworkdayjobs.com/zeissgroup/External', 'ZEISS Group'],
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
  // Health systems on Oracle. These are among the largest single employers of
  // student clinical staff in the country.
  ['ejis.fa.us6.oraclecloud.com/CX_1', 'Mount Sinai Health System'],
  ['hdkk.fa.us6.oraclecloud.com/CX_1', 'Cedars-Sinai'],
  ['evac.fa.us2.oraclecloud.com/CX_1', 'Providence'],
  ['iazuqy.fa.ocs.oraclecloud.com/CX_1', 'UCSF'],
  ['fa-euwp-saasfaprod1.fa.ocs.oraclecloud.com/CX_1', 'Mayo Clinic'],
  // Expansion wave: verified live when added.
  ['eeho.fa.us2.oraclecloud.com/CX_1', 'Oracle'],
  ['eevd.fa.us6.oraclecloud.com/CX_15', 'San Francisco Chronicle'],
  ['fa-ewto-saasfaprod1.fa.ocs.oraclecloud.com/CX_1001', 'Milestone Systems'],
];

/**
 * Phenom careers sites, keyed by hostname.
 *
 * Health systems overwhelmingly front their ATS with one of these, so this is
 * the list that decides whether a nursing or premed student sees the hospital
 * down the road from their campus.
 */
const PHENOM: [token: string, label: string][] = [
  ['careers.stanfordhealthcare.org', 'Stanford Health Care'],
  ['jobs.sutterhealth.org', 'Sutter Health'],
  ['jobs.bswhealth.com', 'Baylor Scott & White Health'],
  ['careers.chop.edu', "Children's Hospital of Philadelphia"],
  ['jobs.trinity-health.org', 'Trinity Health'],
  ['careers.templehealth.org', 'Temple Health'],
  ['careers.baptisthealth.net', 'Baptist Health'],
  ['jobs.cincinnatichildrens.org', "Cincinnati Children's"],
  ['careers.seattlechildrens.org', "Seattle Children's"],
  ['careers.tuftsmedicine.org', 'Tufts Medicine'],
  ['careers.corewellhealth.org', 'Corewell Health'],
  ['careers.prismahealth.org', 'Prisma Health'],
  ['careers.wellstar.org', 'Wellstar Health System'],
  ['careers.bsmhealth.org', 'Bon Secours Mercy Health'],
  ['careers.yale.edu', 'Yale University'],
  ['jobs.virginia.edu', 'University of Virginia'],
  ['careers.labcorp.com', 'Labcorp'],
  ['jobs.gsk.com', 'GSK'],
  ['careers.lilly.com', 'Eli Lilly and Company'],
  ['jobs.merck.com', 'Merck'],
  ['jobs.danaher.com', 'Danaher'],
  ['careers.zimmerbiomet.com', 'Zimmer Biomet'],
  ['jobs.thecignagroup.com', 'The Cigna Group'],
  ['careers.humana.com', 'Humana'],
  // Expansion wave: verified live when added.
  ['careers.adobe.com', 'Adobe'],
  ['careers.gene.com', 'Genentech'],
  ['careers.idexx.com', 'IDEXX Laboratories'],
  ['careers.miami.edu', 'University of Miami'],
  ['careers.snowflake.com', 'Snowflake'],
  ['careers.southstatebank.com', 'SouthState Bank'],
  ['jobs.republicservices.com', 'Republic Services'],
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
  // Expansion wave: verified live when added.
  ['boom-supersonic', 'boom-supersonic'],
];
const BAMBOOHR: [token: string, label: string][] = [
  ['safransed', 'Safran'],
  // Expansion wave: verified live when added.
  ['kubermatic', 'kubermatic'],
];
const BREEZY: [token: string, label: string][] = [
  ['vetsez', 'VetsEZ'],
  // Expansion wave: verified live when added.
  ['djamo', 'djamo'],
  ['zetier', 'zetier'],
];

/**
 * Eightfold tenants, as `{host}/{domain}`.
 *
 * Most Eightfold instances answer the jobs API only for an authenticated
 * session, so this list stays short by necessity. The adapter treats a 403 as
 * an empty board rather than a failure. Vanity hosts like Netflix's carry no
 * derivable tenant key either, which is the other reason they are named here
 * rather than discovered.
 */
const EIGHTFOLD: [token: string, label: string][] = [
  ['explore.jobs.netflix.net/netflix.com', 'Netflix'],
  // Expansion wave: verified live when added.
  ['albemarle.eightfold.ai/albemarle.com', 'Albemarle'],
];

/** Turn a board slug into something presentable, e.g. "ginkgobioworks" -> "Ginkgobioworks". */
function label(token: string): string {
  return token
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Boards whose slug does not read as the employer's name.
 *
 * "sonyinteractiveentertainmentglobal" title-cased is not "PlayStation", and
 * the label is what the listing shows as the company, so these are named
 * outright rather than derived.
 */

const GREENHOUSE_NAMED: [token: string, label: string][] = [
  ['abnormalsecurity', 'Abnormal'],
  ['acadiapharmaceuticals', 'Acadia Pharmaceuticals'],
  ['aegisventures', 'Aegis Ventures'],
  ['agilityrobotics', 'Agility Robotics'],
  ['alarmcom', 'Alarm.com'],
  ['align', 'A-LIGN External'],
  ['apolloio', 'Apollo.io'],
  ['applovin', 'AppLovin'],
  ['appviewx', 'AppViewX'],
  ['aqr', 'AQR'],
  ['archer56', 'Archer Aviation'],
  ['arkoselabs', 'Arkose Labs'],
  ['asteralabs', 'Astera Labs'],
  ['astspacemobile', 'AST SpaceMobile'],
  ['axsometherapeutics', 'Axsome Therapeutics'],
  ['batteryventures', 'Battery'],
  ['bayada', 'Bayada Home Health Care'],
  ['beam', 'Bridge to Enter Advanced Mathematics (BEAM)'],
  ['bessemerventurepartners', 'Bessemer Venture Partners'],
  ['betterhelp', 'BetterHelp'],
  ['beyondtrust', 'BeyondTrust'],
  ['bigid', 'BigID'],
  ['billcom', 'BILL'],
  ['billiontoone', 'BillionToOne'],
  ['blacksky', 'BlackSky'],
  ['blinkhealth', 'Blink Health'],
  ['blueprintmedicines', 'Blueprint Medicines'],
  ['blueroseresearch', 'Blue Rose Research'],
  ['butterflynetwork', 'Butterfly Network'],
  ['carrotfertility', 'Carrot'],
  ['catonetworks', 'Cato Networks'],
  ['charles', 'charles'],
  ['chicagotrading', 'CTC Lateral - Website & LinkedIn'],
  ['circleci', 'CircleCI'],
  ['commercetools', 'commercetools'],
  ['complyadvantage', 'ComplyAdvantage'],
  ['cookunity', 'CookUnity'],
  ['corcepttherapeutics', 'Corcept Therapeutics'],
  ['coreweave', 'CoreWeave'],
  ['denver', 'Animal Health Care Denver'],
  ['digicert', 'DigiCert'],
  ['diligent', 'Diligent Services'],
  ['diligentrobotics', 'Diligent Robotics'],
  ['dillards', 'Dillard\'s'],
  ['dominodatalab', 'Domino Data Lab'],
  ['elementbiosciences', 'Element Biosciences'],
  ['emergentlabsinc', 'Emergent Labs'],
  ['equityzen', 'EquityZen'],
  ['ess', 'cBEYONData + SMX'],
  ['exoduspoint', 'ExodusPoint'],
  ['flagshippioneeringinc', 'Flagship Pioneering'],
  ['forgeglobal', 'Forge Global'],
  ['founders', 'Founders Green Animal Hospital'],
  ['garnerhealth', 'Garner Health'],
  ['generalatlantic', 'General Atlantic'],
  ['godaddy', 'GoDaddy'],
  ['grafanalabs', 'Grafana Labs'],
  ['hawkeye360', 'HawkEye 360'],
  ['hazel', 'Hazel Health'],
  ['help', 'HELP'],
  ['homechef', 'Home Chef'],
  ['homelight', 'HomeLight'],
  ['indiesemiconductor', 'indie'],
  ['intercom', 'Fin'],
  ['iovancebiotherapeutics', 'Iovance Biotherapeutics'],
  ['janestreet', 'Jane Street'],
  ['jfrog', 'JFrog'],
  ['keepersecurity', 'Keeper Security'],
  ['kuraoncology', 'Kura Oncology'],
  ['lastpass', 'LastPass'],
  ['lgelectronics', 'LG Electronics'],
  ['locusrobotics', 'Locus Robotics'],
  ['luminishealth', 'Luminis Health'],
  ['mangroup', 'Man Group'],
  ['mcafee', 'McAfee'],
  ['misfitsmarket', 'Misfits Market'],
  ['modernhealth', 'Modern Health'],
  ['myfitnesspal', 'MyFitnessPal'],
  ['national', 'NATIONAL'],
  ['newrelic', 'New Relic'],
  ['northside', 'Northside Veterinary Clinic'],
  ['nozominetworks', 'Nozomi Networks'],
  ['octopusdeploy', 'Octopus Deploy'],
  ['ohio', 'OH.io'],
  ['oldmissioncapital', 'Old Mission'],
  ['olema', 'Olema Oncology'],
  ['onemedical', 'One Medical'],
  ['onetrust', 'OneTrust'],
  ['onrunning', 'On'],
  ['opentable', 'OpenTable'],
  ['orca', 'ORCA Service Technologies'],
  ['orcasecurity', 'Orca Security'],
  ['oscar', 'Oscar Health'],
  ['oura', 'Ōura'],
  ['pagerduty', 'PagerDuty'],
  ['parkland', 'Parkland Animal Clinic'],
  ['pathrobotics', 'Path Robotics'],
  ['pingidentity', 'Ping Identity'],
  ['pivotbio', 'Pivot Bio'],
  ['planetscale', 'PlanetScale'],
  ['platformsh', 'Platform.sh'],
  ['primerai', 'Primer AI'],
  ['propublica', 'ProPublica'],
  ['psiquantum', 'PsiQuantum'],
  ['pubmatic', 'PubMatic'],
  ['purestorage', 'Everpure'],
  ['quberesearchandtechnologies', 'Qube Research & Technologies'],
  ['recordedfuture', 'Recorded Future'],
  ['redwoodmaterials', 'Redwood Materials'],
  ['relativity', 'Relativity Space'],
  ['relaytherapeutics', 'Relay Therapeutics'],
  ['revolutionmedicines', 'Revolution Medicines'],
  ['rockstargames', 'Rockstar Games'],
  ['saltsecurity', 'Salt Security'],
  ['sambanovasystems', 'SambaNova'],
  ['ses', 'SES Construction'],
  ['sesai', 'SES'],
  ['silananotechnologies', 'Sila'],
  ['simplisafe', 'SimpliSafe'],
  ['singlestore', 'SingleStore'],
  ['singulargenomics', 'Singular Genomics'],
  ['slideinsurance', 'Slide Insurance'],
  ['smartrent', 'SmartRent'],
  ['solidpower', 'Solid Power'],
  ['sonyinteractiveentertainmentglobal', 'PlayStation'],
  ['strandtherapeutics', 'Strand Therapeutics'],
  ['streamnative', 'StreamNative'],
  ['sumologic', 'Sumo Logic'],
  ['tesseratherapeutics', 'Tessera Therapeutics'],
  ['thenewyorktimes', 'The New York Times'],
  ['thrive', 'THRIVE'],
  ['thrivemarket', 'Thrive Market'],
  ['togetherai', 'Together AI'],
  ['transmitsecurity', 'Transmit Security'],
  ['twistbioscience', 'Twist Bioscience'],
  ['twochairs', 'Two Chairs'],
  ['ultimagenomics', 'Ultima Genomics'],
  ['ursamajor', 'Ursa Major'],
  ['vannevarlabs', 'Vannevar'],
  ['vardaspace', 'Varda Space'],
  ['vikingglobalinvestors', 'Viking Global Investors'],
  ['vitalfarms', 'Vital Farms'],
  ['vorbiopharma', 'Vor Bio'],
  ['wikimedia', 'Wikimedia Foundation'],
  ['zoominfo', 'ZoomInfo'],
];

const LEVER_NAMED: [token: string, label: string][] = [
  ['ambirobotics', 'Ambi Robotics'],
  ['anchorage', 'Anchorage Digital'],
  ['angellist', 'AngelList'],
  ['atomcomputing', 'Atom Computing'],
  ['belvederetrading', 'Belvedere Trading'],
  ['blablacar', 'BlaBlaCar'],
  ['brightmachines', 'Bright Machines'],
  ['brooksrunning', 'Brooks Running'],
  ['ekohealth', 'Eko Health'],
  ['elfbeauty', 'e.l.f. Beauty'],
  ['extremenetworks', 'Extreme Networks'],
  ['fatetherapeutics', 'Fate Therapeutics'],
  ['finn', 'FINN'],
  ['includedhealth', 'Included Health'],
  ['jamcity', 'Jam City'],
  ['justwatch', 'JustWatch'],
  ['loftorbital', 'Loft Orbital'],
  ['logrocket', 'LogRocket'],
  ['lyrahealth', 'Lyra Health'],
  ['octoenergy', 'Octopus Energy'],
  ['picklerobot', 'Pickle Robot'],
  ['quantummetric', 'Quantum Metric'],
  ['rai', 'RAI Institute'],
  ['rigetti', 'Rigetti Computing'],
  ['scholarrock', 'Scholar Rock'],
  ['shieldai', 'Shield AI'],
  ['trustarc', 'TrustArc'],
  ['velo3d', 'Velo3D'],
  ['vestiairecollective', 'Vestiaire Collective'],
];

const ASHBY_NAMED: [token: string, label: string][] = [
  ['1password', '1Password'],
  ['applied', 'Applied Intuition'],
  ['arkoselabs', 'Arkose Labs'],
  ['backmarket', 'Back Market'],
  ['cerebras', 'Cerebras Systems'],
  ['clickup', 'ClickUp'],
  ['fireworks', 'Fireworks AI'],
  ['formenergy', 'Form Energy'],
  ['frontcareers', 'Front'],
  ['fullstory', 'FullStory'],
  ['graymatter-robotics', 'GrayMatter Robotics'],
  ['hims-and-hers', 'Hims & Hers'],
  ['human', 'HUMAN Security'],
  ['iceye', 'ICEYE'],
  ['kin', 'Kin Insurance'],
  ['lancedb', 'LanceDB'],
  ['livekit', 'LiveKit'],
  ['materialsecurity', 'Material Security'],
  ['menlosecurity', 'Menlo Security'],
  ['moderntreasury', 'Modern Treasury'],
  ['nightfall-ai', 'Nightfall AI'],
  ['NorthwoodSpace', 'Northwood Space'],
  ['opusclip', 'OpusClip'],
  ['phoebe-work', 'Phoebe'],
  ['reframesystems', 'Reframe Systems'],
  ['rothys', 'Rothy\'s'],
  ['serverobotics', 'Serve Robotics'],
  ['shield-ai', 'Shield AI'],
  ['sondermind', 'SonderMind'],
  ['spoton', 'SpotOn'],
  ['trm-labs', 'TRM Labs'],
  ['uniswap', 'Uniswap Labs'],
  ['voleon', 'Voleon Group'],
  ['workos', 'WorkOS'],
  ['ycombinator', 'Y Combinator'],
];

const WORKABLE_NAMED: [token: string, label: string][] = [
  ['akeno', 'akeno'],
  ['imachines', 'Intuition Machines'],
  ['securityriskadvisors', 'Security Risk Advisors'],
];

const SMARTRECRUITERS_NAMED: [token: string, label: string][] = [
  ['AristaNetworks', 'Arista Networks'],
];

/**
 * The mid-market providers, which reach the employers the big-ATS adapters
 * never touch: European small and mid-size companies, labs, agencies, clinics
 * and the regional employers that hire more interns than they advertise.
 */

const PERSONIO: [token: string, label: string][] = [
  ['autarcenergy', 'autarc'],
  ['edgeless-systems', 'Edgeless Systems'],
  ['exactag', 'Exactag'],
  ['m4c', 'Media4Care'],
  ['merantix', 'Merantix'],
  ['mercanis', 'Mercanis'],
  ['twaice', 'TWAICE Technologies'],
];

const RECRUITEE: [token: string, label: string][] = [
  ['accenture', 'Accenture'],
  ['arcus', 'ARCUS Planung + Beratung Bauplanungsgesellschaft mbH'],
  ['attendi', 'Attendi'],
  ['bloom', 'BLOOM'],
  ['bright', 'BRIGHT Operations GmbH'],
  ['draeger', 'Draeger'],
  ['dunkin', 'Dunkin'],
  ['gong', 'Gong'],
  ['ifit', 'iFIT'],
  ['jump', 'Jump'],
  ['nikon', 'Nikon'],
  ['nimble', 'Nimble'],
  ['ppg', 'ppg'],
  ['prisma', 'Prisma'],
  ['radix', 'Superlinear'],
  ['spring', 'SPRiNG'],
  ['sri', 'SRI Rechtsanwaltsgesellschaft mbH'],
  ['stevemadden', 'Steve Madden'],
  ['teleperformance', 'Teleperformance'],
  ['upgrade', 'Upgrade'],
  ['upside', 'Upside'],
];

const TEAMTAILOR: [token: string, label: string][] = [
  ['air', 'AIR'],
  ['black', 'Eventus'],
  ['clue', 'Clue'],
  ['color', 'Almat Srl'],
  ['electrify', 'Electrify'],
  ['endeavor', 'Endeavor'],
  ['ethos', 'Ethos'],
  ['firefly', 'Firefly'],
  ['five', 'fiver'],
  ['headway', 'Headway'],
  ['hudson', 'Hudson Nordic'],
  ['loft', 'Loft'],
  ['meilisearch', 'Meilisearch'],
  ['mks', 'MKS PAMP'],
  ['monster', 'Monster'],
  ['naturalcycles', 'Natural Cycles'],
  ['next', 'Novati'],
  ['nidec', 'Nidec'],
  ['oatly', 'Oatly'],
  ['polestar', 'Polestar'],
  ['revolution', 'REV'],
  ['righthand', 'RightHand'],
  ['root', 'Root Platform'],
  ['sonder', 'Sonder'],
  ['spacelift', 'Spacelift'],
  ['starship', 'Starship Technologies'],
  ['thales', 'Thales Norway'],
  ['thrive', 'Thrive'],
  ['toyota', 'Toyota'],
  ['two', 'Two'],
  ['veo', 'Veo'],
  ['virtasant', 'Virtasant'],
];

const PINPOINT: [token: string, label: string][] = [
  ['safetywing', 'SafetyWing'],
];

const JOBSCORE: [token: string, label: string][] = [
  ['directdefense', 'DirectDefense'],
  ['hexagonmininginc', 'Hexagon Mining, Inc.'],
];

const UKG: [token: string, label: string][] = [
  ['recruiting.ultipro.com/AIS1000AISI/b22b728d-47a6-4550-9005-01c83b9a527f', 'a.i. solutions'],
  ['recruiting.ultipro.com/PHI1008PMINC/2bfae9ff-dc34-4867-b871-a579eae69b54', 'Cofense'],
  ['recruiting2.ultipro.com/ARU1000ARUP/62cc791d-612e-42e6-909f-0de27efe2038', 'ARUP Laboratories'],
  ['recruiting2.ultipro.com/HOU1000/e68ddd55-8f58-ba9d-0b3a-76742aed1055', 'Houston Astros'],
  ['recruiting2.ultipro.com/MIL1017/f54234e9-dfde-b183-fd20-4fbdb19cba7a', 'Milliman'],
];

/** Providers whose tokens already carry the employer name, as token/label pairs. */
const PAIRED: [kind: BoardKind, boards: [token: string, label: string][]][] = [
  ['workday', WORKDAY],
  ['oracle', ORACLE],
  ['phenom', PHENOM],
  ['eightfold', EIGHTFOLD],
  ['rippling', RIPPLING],
  ['bamboohr', BAMBOOHR],
  ['breezy', BREEZY],
  ['greenhouse', GREENHOUSE_NAMED],
  ['lever', LEVER_NAMED],
  ['ashby', ASHBY_NAMED],
  ['workable', WORKABLE_NAMED],
  ['smartrecruiters', SMARTRECRUITERS_NAMED],
  ['personio', PERSONIO],
  ['recruitee', RECRUITEE],
  ['teamtailor', TEAMTAILOR],
  ['pinpoint', PINPOINT],
  ['jobscore', JOBSCORE],
  ['ukg', UKG],
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
  { kind: 'github', token: 'cvrve-newgrad', label: 'GitHub · cvrve New Grad' },
  { kind: 'amazon', token: '-', label: 'Amazon' },
  { kind: 'muse', token: '-', label: 'The Muse (healthcare, science, education)' },
  { kind: 'orise', token: '-', label: 'ORISE · federal research participation' },
  { kind: 'usajobs', token: '-', label: 'USAJOBS · federal student openings' },
  { kind: 'remoteok', token: '-', label: 'RemoteOK' },
  { kind: 'arbeitnow', token: '-', label: 'Arbeitnow (Europe)' },
  { kind: 'jobicy', token: '-', label: 'Jobicy (remote)' },
  // Read for employer links rather than listings: see sources/community.ts.
  { kind: 'hackernews', token: '-', label: 'Hacker News · who is hiring' },
  { kind: 'reddit', token: '-', label: 'Reddit · student and career subreddits' },
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
    // hint, and it is often a placeholder like "CX_1". A real employer name
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

  // Branded careers sites, which is how nearly every hospital presents itself.
  const phenom = phenomHostFromUrl(host, segments);
  if (phenom) {
    return { kind: 'phenom', token: phenom, label: label(phenom.split('.')[1] ?? phenom) };
  }

  if (host.endsWith('.recruitee.com')) {
    const token = host.split('.')[0];
    return /^[a-z0-9][a-z0-9-]{1,40}$/.test(token)
      ? { kind: 'recruitee', token, label: label(token) }
      : null;
  }
  if (host.endsWith('.teamtailor.com')) {
    // Regional boards insert a country segment: acme.na.teamtailor.com.
    const token = host.split('.')[0];
    return /^[a-z0-9][a-z0-9-]{1,40}$/.test(token)
      ? { kind: 'teamtailor', token, label: label(token) }
      : null;
  }
  if (host.endsWith('.pinpointhq.com')) {
    const token = host.split('.')[0];
    return /^[a-z0-9][a-z0-9-]{1,40}$/.test(token)
      ? { kind: 'pinpoint', token, label: label(token) }
      : null;
  }
  if (host === 'careers.jobscore.com') {
    // careers.jobscore.com/careers/<token>/jobs/...
    const token = segments[0] === 'careers' ? take(1) : take(0);
    return token ? { kind: 'jobscore', token, label: label(token) } : null;
  }

  // UKG boards are keyed by a customer code and a board GUID, both of which
  // only ever appear in a link someone published, so recognizing them here is
  // the only way this provider is ever reached.
  const ukg = ukgBoardFromUrl(host, segments);
  if (ukg) {
    return { kind: 'ukg', token: encodeUkgToken(ukg), label: label(ukg.code) };
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
 * The label a board gets when nothing better is known, i.e. derived from its
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
    case 'phenom':
      return label(board.token.split('.')[1] ?? board.token);
    case 'smartrecruiters':
      return board.token;
    case 'rippling':
      return label(board.token.replace(/-(jobs|careers)$/, ''));
    case 'ukg':
      return label(board.token.split('/')[1] ?? board.token);
    default:
      return label(board.token);
  }
}
