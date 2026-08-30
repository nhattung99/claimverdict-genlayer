import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  PlusCircle, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Wallet, 
  Coins, 
  Search, 
  ExternalLink, 
  Activity, 
  Layers, 
  RefreshCw, 
  HelpCircle,
  Award,
  Sparkles,
  Info,
  UserPlus,
  ChevronRight,
  Send,
  Clipboard
} from 'lucide-react';
import { 
  studionet, 
  CONTRACT_ADDRESS, 
  getGenlayerClient, 
  switchToGenlayerStudionet,
  encodeGenLayerCalldata, 
  sendContractTransaction, 
  waitForFinalizedTx, 
  readContractState,
  parseGenToWei,
  formatWeiToGen,
  sanitizeGenInput,
  toWeiString,
  toPercentInt
} from './genlayerClient';
import { SAMPLE_CLAIM_DATA } from './data/sampleClaimData';
import { isDeprecatedPool } from './data/deprecatedPools';

// Initial Mock Pools & Claims for unconfigured / fallback mode (stored in wei base units)
const INITIAL_DEMO_POOLS = [
  {
    id: "0",
    coverage_type: "Flight Cancellation & Delay",
    operator: "0x8920...f4a1",
    max_payout_per_claim: "1000000000000000000000", // 1000 GEN
    pool_balance: "15000000000000000000000",        // 15000 GEN
    active: true,
    criteria: [
      "Official flight status confirmed CANCELLED or delayed > 4 hours by airline",
      "No alternative flight provided within 6 hours of original departure",
      "Claim filed with official e-ticket and booking reference"
    ]
  },
  {
    id: "1",
    coverage_type: "Amateur Sports Injury Reimbursement",
    operator: "0x3b1c...99d2",
    max_payout_per_claim: "2500000000000000000000", // 2500 GEN
    pool_balance: "30000000000000000000000",        // 30000 GEN
    active: true,
    criteria: [
      "Incident occurred during registered amateur sporting competition",
      "Hospital or urgent care medical evaluation record submitted",
      "Itemized medical treatment receipt from licensed clinic"
    ]
  }
];

const INITIAL_DEMO_CLAIMS = [
  {
    id: "0",
    pool_id: "0",
    claimant: "0x71C705E3B56E5C2f5e4129F7a26a56304288b172",
    claimed_amount: "800000000000000000000",  // 800 GEN
    incident_description: "Flight VN123 from SGN to HAN cancelled due to severe tropical storm warning.",
    evidence_urls: ["https://example.com/ticket_vn123.pdf"],
    reference_urls: [
      "https://flightstats.com/flight/VN123/status",
      "https://weather.gov/alerts/storm_warning"
    ],
    status: "RESOLVED",
    compliance_pct: 100,
    confidence: 95,
    payout_amount: "800000000000000000000",   // 800 GEN
    verdict_reason: "Flight cancellation confirmed by flightstats.com and storm alert confirmed by national weather bureau. All criteria satisfied.",
    paid_out: true
  },
  {
    id: "1",
    pool_id: "1",
    claimant: "0x5A38...e112",
    claimed_amount: "1200000000000000000000", // 1200 GEN
    incident_description: "Ankle sprain during amateur marathon, treated at City Hospital.",
    evidence_urls: ["https://example.com/hospital_receipt.pdf"],
    reference_urls: [
      "https://marathon-results.org/runners/552",
      "https://cityhospital.org/verify/doc_991"
    ],
    status: "DISPUTED",
    compliance_pct: 65,
    confidence: 48,
    payout_amount: "0",
    verdict_reason: "Hospital verification source note is missing doctor signature. Low confidence (48%). Claimant requested to provide supplemental signed medical report.",
    paid_out: false
  }
];

const PRESET_CATEGORIES = [
  {
    id: 'flight',
    icon: '✈️',
    name: 'Flight Cancellation & Delay',
    coverage_type: 'Flight Cancellation & Delay',
    default_max_payout: '1000',
    default_initial_deposit: '15000',
    max_payout_presets: ['500', '1000', '2000'],
    deposit_presets: ['5000', '15000', '30000'],
    allowed_source_hosts: ['transportation.gov', 'federalregister.gov'],
    authoritative_source_urls: [
      'https://www.transportation.gov/individuals/aviation-consumer-protection/refunds',
      'https://www.federalregister.gov/documents/2024/04/26/2024-07177/refunds-and-other-consumer-protections'
    ],
    criteria_presets: [
      "Official flight status confirmed CANCELLED or delayed > 4 hours by airline",
      "No alternative flight provided within 6 hours of original departure schedule",
      "Claim filed with valid e-ticket receipt and booking reference code"
    ]
  },
  {
    id: 'sports',
    icon: '🏃',
    name: 'Amateur Sports Injury',
    coverage_type: 'Amateur Sports Injury Reimbursement',
    default_max_payout: '2500',
    default_initial_deposit: '30000',
    max_payout_presets: ['1000', '2500', '5000'],
    deposit_presets: ['10000', '30000', '50000'],
    allowed_source_hosts: ['cdc.gov', 'who.int'],
    authoritative_source_urls: [
      'https://www.cdc.gov/heads-up/data/index.html',
      'https://www.who.int/news-room/fact-sheets/detail/injuries-and-violence'
    ],
    criteria_presets: [
      "Incident occurred during registered amateur sporting competition or event",
      "Hospital or urgent care medical evaluation record submitted",
      "Itemized medical treatment receipt from licensed healthcare clinic"
    ]
  },
  {
    id: 'trip',
    icon: '🧳',
    name: 'Trip Cancellation',
    coverage_type: 'Travel & Trip Cancellation',
    default_max_payout: '1500',
    default_initial_deposit: '20000',
    max_payout_presets: ['500', '1500', '3000'],
    deposit_presets: ['5000', '20000', '40000'],
    allowed_source_hosts: ['weather.gov', 'travel.state.gov'],
    authoritative_source_urls: [
      'https://www.weather.gov/',
      'https://travel.state.gov/en/international-travel/travel-advisories.html'
    ],
    criteria_presets: [
      "Trip cancelled due to documented personal emergency, illness, or severe weather",
      "Non-refundable travel booking receipts provided",
      "Cancellation request submitted at least 24 hours before scheduled departure"
    ]
  },
  {
    id: 'medical',
    icon: '🏥',
    name: 'Emergency Travel Medical',
    coverage_type: 'Emergency Travel Medical Insurance',
    default_max_payout: '5000',
    default_initial_deposit: '50000',
    max_payout_presets: ['2000', '5000', '10000'],
    deposit_presets: ['15000', '50000', '100000'],
    allowed_source_hosts: ['who.int', 'cdc.gov'],
    authoritative_source_urls: [
      'https://www.who.int/travel-advice',
      'https://www.cdc.gov/travel/index.html'
    ],
    criteria_presets: [
      "Emergency hospitalization required while traveling outside primary country of residence",
      "Official hospital admission and discharge summary attached",
      "Verified medical expense invoices from accredited international medical facility"
    ]
  },
  {
    id: 'baggage',
    icon: '🎒',
    name: 'Lost / Damaged Baggage',
    coverage_type: 'Lost & Damaged Luggage Protection',
    default_max_payout: '800',
    default_initial_deposit: '10000',
    max_payout_presets: ['300', '800', '1500'],
    deposit_presets: ['3000', '10000', '25000'],
    allowed_source_hosts: ['transportation.gov', 'iata.org'],
    authoritative_source_urls: [
      'https://www.transportation.gov/lost-delayed-or-damaged-baggage',
      'https://www.iata.org/en/programs/ops-infra/baggage/'
    ],
    criteria_presets: [
      "Baggage officially reported lost or damaged by carrier with Property Irregularity Report (PIR)",
      "Carrier failure to locate luggage within 24 hours of arrival",
      "Itemized list of lost personal items with purchase receipts"
    ]
  },
  {
    id: 'car',
    icon: '🚗',
    name: 'Rental Car Damage',
    coverage_type: 'Rental Vehicle Collision & Damage',
    default_max_payout: '2000',
    default_initial_deposit: '25000',
    max_payout_presets: ['1000', '2000', '4000'],
    deposit_presets: ['10000', '25000', '50000'],
    allowed_source_hosts: ['nhtsa.gov', 'ftc.gov'],
    authoritative_source_urls: [
      'https://www.nhtsa.gov/',
      'https://www.ftc.gov/enforcement/refunds'
    ],
    criteria_presets: [
      "Accidental damage occurred during active rental contract period",
      "Official police accident report or rental agency damage incident log submitted",
      "Itemized repair cost invoice from authorized vehicle repair shop"
    ]
  },
  {
    id: 'event',
    icon: '🎫',
    name: 'Event Ticket Cancellation',
    coverage_type: 'Concert & Event Ticket Protection',
    default_max_payout: '300',
    default_initial_deposit: '5000',
    max_payout_presets: ['150', '300', '600'],
    deposit_presets: ['2000', '5000', '15000'],
    allowed_source_hosts: ['federalregister.gov', 'ftc.gov'],
    authoritative_source_urls: [
      'https://www.federalregister.gov/documents/2025/01/10/2024-30293/trade-regulation-rule-on-unfair-or-deceptive-fees',
      'https://www.ftc.gov/news-events/news/press-releases/2024/12/federal-trade-commission-announces-bipartisan-rule-banning-junk-ticket-hotel-fees'
    ],
    criteria_presets: [
      "Official event cancellation notice issued by organizer or ticketing vendor",
      "No secondary rescheduled event date or venue alternative provided",
      "Original ticket purchase confirmation and receipt attached"
    ]
  }
];

const PRESET_INCIDENT_SCENARIOS = {
  "Flight Cancellation & Delay": [
    "Official flight cancellation by airline with no alternative within 6 hours",
    "Flight departure delayed by more than 4 hours from original schedule",
    "Involuntary denied boarding or missed connection due to initial carrier delay"
  ],
  "Amateur Sports Injury Reimbursement": [
    "Acute joint sprain or muscle tear during registered amateur match",
    "Accidental fracture or collision injury requiring emergency medical evaluation",
    "Hospital outpatient treatment following competitive sports incident"
  ],
  "Travel & Trip Cancellation": [
    "Trip cancellation due to sudden personal illness or severe weather warning",
    "Carrier service suspension or non-refundable booking forfeiture",
    "Emergency travel interruption due to immediate family emergency"
  ],
  "Emergency Travel Medical Insurance": [
    "Emergency hospital admission for urgent medical treatment while abroad",
    "Outpatient urgent clinic care for unexpected travel illness",
    "Prescription emergency medication and diagnostic evaluation overseas"
  ],
  "Lost & Damaged Luggage Protection": [
    "Baggage officially declared lost by carrier exceeding 24 hours arrival",
    "Severe luggage container damage rendering contents unusable",
    "Irretrievable personal belongings loss with carrier irregularity report"
  ],
  "Rental Vehicle Collision & Damage": [
    "Accidental vehicle body collision damage during active rental contract",
    "Windshield or tire structural damage on authorized rental route",
    "Third-party parking damage recorded by rental agency inspection log"
  ],
  "Concert & Event Ticket Protection": [
    "Official event cancellation notice issued by primary ticket organizer",
    "Event postponement with no feasible rescheduled date alternative",
    "Venue closure or artist non-appearance official refund rejection"
  ]
};

const POOL_URL_HINTS = {
  "Flight Cancellation & Delay": {
    evidence: "E-ticket receipt link, official airline cancellation email confirmation",
    reference: "Public flight status page (FlightStats, FlightRadar24), official airport departure board link"
  },
  "Amateur Sports Injury Reimbursement": {
    evidence: "Hospital outpatient receipt link, emergency clinic evaluation report",
    reference: "Official event registration portal link, public sports tournament schedule"
  },
  "Travel & Trip Cancellation": {
    evidence: "Non-refundable booking invoice link, travel cancellation receipt",
    reference: "Public weather bulletin link, official government travel advisory notice"
  },
  "Emergency Travel Medical Insurance": {
    evidence: "Hospital admission summary link, itemized pharmacy invoice",
    reference: "Accredited international hospital directory, public health ministry medical registry"
  },
  "Lost & Damaged Luggage Protection": {
    evidence: "Airline Property Irregularity Report (PIR) link, damaged luggage photo receipt link",
    reference: "Carrier baggage tracking status page, official airline baggage policy bulletin"
  },
  "Rental Vehicle Collision & Damage": {
    evidence: "Rental contract receipt link, repair shop invoice photo link",
    reference: "Official police incident report registry, rental agency damage log portal"
  },
  "Concert & Event Ticket Protection": {
    evidence: "Original e-ticket purchase confirmation link, vendor refund denial email link",
    reference: "Primary ticketing vendor event status page, official venue announcement post"
  }
};

const DISPUTE_REASON_PRESETS = [
  "Attached newly verified independent reference source",
  "Rectified previous evidence URL format / document link",
  "Provided official hospital / airline / carrier verification log",
  "Submitted updated itemized cost statement"
];

const extractHost = (url) => {
  const raw = String(url || '').trim().toLowerCase();
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    throw new Error('Every URL must start with http:// or https://');
  }
  const rest = raw.split('://')[1] || '';
  let host = rest.split('/')[0].split('?')[0].split('#')[0];
  if (host.startsWith('www.')) host = host.slice(4);
  if (host.includes(':')) host = host.split(':')[0];
  if (host.length < 3 || !host.includes('.')) {
    throw new Error('Invalid URL host: ' + url);
  }
  return host;
};

const hostsOverlap = (a, b) => a === b || a.endsWith('.' + b) || b.endsWith('.' + a);

const hostOnAllowlist = (host, allowed) => {
  return (allowed || []).some((item) => {
    let allowedHost = String(item || '').trim().toLowerCase();
    if (allowedHost.startsWith('www.')) allowedHost = allowedHost.slice(4);
    return hostsOverlap(host, allowedHost);
  });
};

const toStringList = (val) => {
  if (Array.isArray(val)) return val.map(String);
  if (val && typeof val === 'object') {
    if (typeof val.values === 'function') {
      try { return [...val.values()].map(String); } catch { /* ignore */ }
    }
    const keys = Object.keys(val);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      return keys.sort((a, b) => Number(a) - Number(b)).map((k) => String(val[k]));
    }
  }
  return [];
};

const hostsFromUrls = (urls) => {
  const hosts = [];
  for (const url of urls) {
    try {
      const host = extractHost(url);
      if (!hosts.some((existing) => hostsOverlap(host, existing))) hosts.push(host);
    } catch { /* skip invalid */ }
  }
  return hosts;
};

const sameAddress = (a, b) => {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  return left.length >= 40 && right.length >= 40 && left === right;
};

const validateClaimantEvidenceOnly = (evidenceUrls, allowedHosts) => {
  const allowed = (allowedHosts || []).map(String).filter(Boolean);
  if (allowed.length < 2) {
    throw new Error('This policy has no enrolled authoritative sources. Create a new pool with at least 2 distinct source URLs.');
  }
  const evHosts = [];
  for (const url of evidenceUrls) {
    const host = extractHost(url);
    if (evHosts.some((existing) => hostsOverlap(host, existing))) {
      throw new Error('Claimant evidence URLs must be distinct hosts');
    }
    if (hostOnAllowlist(host, allowed)) {
      throw new Error('Claimant evidence cannot share a host with enrolled authoritative sources');
    }
    evHosts.push(host);
  }
};

// Reusable Free Gas Notice Component
const FreeGasNotice = ({ style }) => (
  <div className="notice-banner-free" style={style}>
    <span style={{ fontSize: '18px' }}>💰</span>
    <div>
      <strong style={{ fontSize: '13px', color: '#f8fafc' }}>Free to Use</strong>
      <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
        Free to use — you only pay GenLayer network gas fees when signing transactions via MetaMask. No platform fees or hidden cuts.
      </div>
    </div>
  </div>
);

export default function App() {
  // Config & State
  const [account, setAccount] = useState(null);
  const [courtAddress, setCourtAddress] = useState(CONTRACT_ADDRESS || import.meta.env.VITE_CONTRACT_ADDRESS || import.meta.env.VITE_CLAIM_COURT_ADDRESS || '');

  const [activeTab, setActiveTab] = useState('pools'); // 'pools' | 'claims' | 'submit' | 'disputed'
  const [pools, setPools] = useState([]);
  const [claims, setClaims] = useState([]);
  const [isLoadingContract, setIsLoadingContract] = useState(true);

  // Modals & UI States
  const [showCreatePoolModal, setShowCreatePoolModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedPoolForDeposit, setSelectedPoolForDeposit] = useState(null);
  const [selectedClaimForDetail, setSelectedClaimForDetail] = useState(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);

  // Loading States
  const [isResolving, setIsResolving] = useState(false);
  const [txMessage, setTxMessage] = useState(null);

  // Guided Pool Creation State (Template Driven)
  const [createStep, setCreateStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(PRESET_CATEGORIES[0]);
  const [selectedCriteriaMap, setSelectedCriteriaMap] = useState({ 0: true, 1: true, 2: true });
  const [initialDepositAmount, setInitialDepositAmount] = useState(PRESET_CATEGORIES[0].default_initial_deposit);
  const [customCriterionInput, setCustomCriterionInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCriteriaList, setCustomCriteriaList] = useState([]);

  // Form Inputs & Selection Controls
  const [newPool, setNewPool] = useState({
    coverage_type: PRESET_CATEGORIES[0].coverage_type,
    criteria: PRESET_CATEGORIES[0].criteria_presets,
    max_payout: PRESET_CATEGORIES[0].default_max_payout
  });

  const [depositAmount, setDepositAmount] = useState('');

  // Submit Claim Selection State
  const [selectedIncidentRadio, setSelectedIncidentRadio] = useState(0);
  const [showCustomIncidentText, setShowCustomIncidentText] = useState(false);

  const [newClaim, setNewClaim] = useState({
    pool_id: '1',
    amount: '',
    description: '',
    evidence_urls: [''],
    reference_urls: ['', '']
  });

  const [additionalEvidence, setAdditionalEvidence] = useState(['']);
  const [additionalReference, setAdditionalReference] = useState(['']);
  const [selectedDisputeReasons, setSelectedDisputeReasons] = useState({ 0: true, 1: true });
  const [enrollInputs, setEnrollInputs] = useState({});

  // Sample Data Popover & Helper State
  const [showSamplePopover, setShowSamplePopover] = useState(false);

  const handleApplySample = (sampleSet) => {
    if (!sampleSet) return;
    const targetPool = (pools && pools.length > 0)
      ? (pools.find(p => String(p.id) === String(newClaim.pool_id)) || pools[0])
      : null;
    const maxCapWei = BigInt(targetPool?.max_payout_per_claim || '1000000000000000000000');
    const halfCapWei = maxCapWei / 2n;
    const defaultAmount = sampleSet.claimedAmount || formatWeiToGen(halfCapWei);

    setNewClaim(prev => ({
      ...prev,
      amount: defaultAmount,
      evidence_urls: [...(sampleSet.evidenceUrls || [''])],
      reference_urls: [...(sampleSet.referenceUrls || ['', ''])]
    }));
    setShowSamplePopover(false);
    setTxMessage(`Loaded sample dataset: "${sampleSet.label}" into claim form!`);
    setTimeout(() => setTxMessage(null), 4000);
  };

  // GenLayer Contract Transaction Helper
  const requestMetaMaskTx = async (actionTitle, functionName, args = [], value = '0x0') => {
    const targetAddr = (courtAddress && courtAddress.trim()) ? courtAddress.trim() : CONTRACT_ADDRESS;
    try {
      setTxMessage({
        status: 'pending',
        title: `Phase 1/3: Submitting ${actionTitle} to MetaMask...`,
        detail: `Executing on contract ${targetAddr}. Please sign in MetaMask.`
      });
      const txHash = await sendContractTransaction({
        from: account,
        to: targetAddr,
        functionName,
        args,
        value
      });
      return txHash;
    } catch (err) {
      console.warn("Contract transaction note:", err.message || err);
      throw err;
    }
  };

  // Clipboard Paste Helper
  const handlePasteClipboard = async (onSuccess) => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          let trimmed = text.trim();
          if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            trimmed = 'https://' + trimmed;
          }
          onSuccess(trimmed);
        }
      } else {
        alert("Clipboard access disabled or unsupported. Please press Ctrl+V to paste.");
      }
    } catch (err) {
      alert("Unable to read clipboard: " + err.message);
    }
  };

  // Connect Wallet
  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        await switchToGenlayerStudionet();
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accs[0]);
      } catch (err) {
        alert("Failed to connect wallet: " + err.message);
      }
    } else {
      alert("MetaMask is required to connect to GenLayer Studionet.");
    }
  };

  // Category Chip Selection
  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    const initialMap = {};
    cat.criteria_presets.forEach((_, idx) => { initialMap[idx] = true; });
    setSelectedCriteriaMap(initialMap);
    setNewPool({
      coverage_type: cat.coverage_type,
      criteria: cat.criteria_presets,
      max_payout: cat.default_max_payout
    });
    setInitialDepositAmount(cat.default_initial_deposit);
  };

  // Toggle Criterion Checkbox
  const handleToggleCriterion = (idx) => {
    setSelectedCriteriaMap(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Add Custom Criterion
  const handleAddCustomCriterion = () => {
    if (!customCriterionInput.trim()) return;
    setCustomCriteriaList(prev => [...prev, customCriterionInput.trim()]);
    setCustomCriterionInput('');
    setShowCustomInput(false);
  };

  // Remove Custom Criterion
  const handleRemoveCustomCriterion = (idx) => {
    setCustomCriteriaList(prev => prev.filter((_, i) => i !== idx));
  };

  // Helper for URL arrays (safely spreading state object form)
  const handleUrlChange = (form, setForm, key, index, value) => {
    const currentArray = (form && Array.isArray(form[key])) ? [...form[key]] : [''];
    currentArray[index] = value;
    setForm({ ...form, [key]: currentArray });
  };
  const addUrlField = (form, setForm, key) => {
    const currentArray = (form && Array.isArray(form[key])) ? [...form[key]] : [''];
    setForm({ ...form, [key]: [...currentArray, ''] });
  };

  // Load Contract State View Methods (Reads strictly from selected courtAddress with RPC rate limit throttling)
  const loadContractData = async () => {
    setIsLoadingContract(true);
    const targetAddr = (courtAddress && courtAddress.trim()) ? courtAddress.trim() : CONTRACT_ADDRESS;
    try {
      const loadedPools = [];
      let consecutiveEmptyPools = 0;
      for (let i = 1; i <= 10; i++) {
        const pId = String(i);
        const pool = await readContractState('get_pool', [pId], targetAddr);
        if (pool && pool.coverage_type && String(pool.coverage_type).trim() !== '') {
          consecutiveEmptyPools = 0;
          const bal = await readContractState('get_pool_balance', [pId], targetAddr);
          const operator = String(pool.operator || '');
          const authUrls = toStringList(pool.authoritative_source_urls);
          let hosts = toStringList(pool.allowed_source_hosts);
          if (hosts.length < 2 && authUrls.length > 0) hosts = hostsFromUrls(authUrls);
          let enrolled = false;
          if (account) {
            try {
              enrolled = Boolean(await readContractState('is_enrolled', [pId, account], targetAddr));
            } catch {
              enrolled = false;
            }
            if (!enrolled && sameAddress(operator, account)) enrolled = true;
          }
          loadedPools.push({
            id: pId,
            coverage_type: String(pool.coverage_type),
            operator,
            max_payout_per_claim: toWeiString(pool.max_payout_per_claim),
            pool_balance: toWeiString(bal || pool.pool_balance),
            active: Boolean(pool.active !== false),
            criteria: toStringList(pool.criteria),
            allowed_source_hosts: hosts,
            authoritative_source_urls: authUrls,
            enrolled
          });
        } else {
          consecutiveEmptyPools++;
          if (consecutiveEmptyPools >= 2) break; // Break early if 2 empty slots encountered
        }
        await new Promise(r => setTimeout(r, 150)); // Throttling delay to avoid RPC 429 rate limit
      }
      setPools(loadedPools);

      const loadedClaims = [];
      let consecutiveEmptyClaims = 0;
      for (let j = 1; j <= 20; j++) {
        const cId = String(j);
        const claim = await readContractState('get_claim', [cId], targetAddr);
        if (claim && claim.pool_id && String(claim.pool_id).trim() !== '') {
          consecutiveEmptyClaims = 0;
          loadedClaims.push({
            id: cId,
            pool_id: String(claim.pool_id),
            claimant: String(claim.claimant || '0xClaimant'),
            claimed_amount: toWeiString(claim.claimed_amount),
            incident_description: String(claim.incident_description || ''),
            evidence_urls: Array.isArray(claim.evidence_urls) ? claim.evidence_urls.map(String) : [],
            reference_urls: Array.isArray(claim.reference_urls) ? claim.reference_urls.map(String) : [],
            status: String(claim.status || 'SUBMITTED'),
            compliance_pct: toPercentInt(claim.compliance_pct),
            confidence: toPercentInt(claim.confidence),
            payout_amount: toWeiString(claim.payout_amount),
            verdict_reason: String(claim.verdict_reason || ''),
            paid_out: Boolean(claim.paid_out),
            authoritative_retrieved: Number(String(claim.authoritative_retrieved || 0))
          });
        } else {
          consecutiveEmptyClaims++;
          if (consecutiveEmptyClaims >= 2) break; // Break early if 2 empty slots encountered
        }
        await new Promise(r => setTimeout(r, 150)); // Throttling delay to avoid RPC 429 rate limit
      }
      setClaims(loadedClaims);
    } catch (err) {
      console.warn("loadContractData note:", err);
      setPools([]);
      setClaims([]);
    } finally {
      setIsLoadingContract(false);
    }
  };

  useEffect(() => {
    loadContractData();
  }, [courtAddress, account]);

  useEffect(() => {
    if (!pools.length) return;
    const current = pools.find((p) => String(p.id) === String(newClaim.pool_id) && !isDeprecatedPool(p.id));
    if (current) return;
    const first = pools.find((p) => !isDeprecatedPool(p.id));
    if (!first) return;
    const capWei = BigInt(first.max_payout_per_claim || '1000000000000000000000');
    setNewClaim((prev) => ({
      ...prev,
      pool_id: first.id,
      amount: prev.amount || formatWeiToGen(capWei / 2n)
    }));
  }, [pools]);

  // Handle Create Pool (Template Guided Flow) - On-Chain Finalized Execution
  const handleCreatePoolSubmit = async (e) => {
    e.preventDefault();
    const activePresets = selectedCategory.criteria_presets.filter((_, idx) => selectedCriteriaMap[idx]);
    const allCriteria = [...activePresets, ...customCriteriaList];

    if (allCriteria.length === 0) {
      alert("Please select or add at least 1 eligibility criterion for the policy pool.");
      return;
    }

    const maxPayoutVal = newPool.max_payout || selectedCategory.default_max_payout;
    const maxPayoutWei = parseGenToWei(maxPayoutVal);
    if (maxPayoutWei <= 0n) {
      alert("Please specify a valid Max Payout per Claim (> 0 GEN).");
      return;
    }

    const enrolledUrls = selectedCategory.authoritative_source_urls || [];
    if (enrolledUrls.length < 2) {
      alert("Policy must enroll at least 2 distinct authoritative source URLs.");
      return;
    }

    const depositWei = parseGenToWei(initialDepositAmount);
    const depositHex = depositWei > 0n ? ('0x' + depositWei.toString(16)) : '0x0';

    setTxMessage({
      status: 'pending',
      title: 'Phase 1/3: Submitting Deploy Policy Pool to MetaMask...',
      detail: 'Please confirm transaction signature in MetaMask.'
    });

    try {
      const txHash = await sendContractTransaction({
        from: account,
        to: courtAddress || CONTRACT_ADDRESS,
        functionName: 'create_policy_pool',
        args: [selectedCategory.coverage_type, allCriteria, enrolledUrls, maxPayoutWei],
        value: depositHex
      });

      if (!txHash) {
        throw new Error("Transaction cancelled or rejected by user.");
      }

      setTxMessage({
        status: 'processing',
        hash: txHash,
        title: 'Phase 2/3: Transaction submitted! Waiting for finalization on GenLayer Studionet...',
        detail: 'Validators are processing block inclusion. Please do not close window.'
      });

      await waitForFinalizedTx(txHash);

      setTxMessage({
        status: 'reading',
        hash: txHash,
        title: 'Phase 3/3: Finalized! Reading pool state directly from GenLayer contract...',
        detail: 'Fetching get_pool and get_pool_balance from contract view methods.'
      });

      await loadContractData();
      setShowCreatePoolModal(false);

      setTxMessage({
        status: 'success',
        hash: txHash,
        title: 'Policy Pool Created Successfully on GenLayer Contract!',
        detail: 'State populated 100% directly from contract view methods.'
      });
    } catch (err) {
      console.warn("Create pool error:", err);
      // DO NOT update UI state on error!
      setTxMessage({
        status: 'error',
        title: err.message.includes('rejected') || err.message.includes('cancelled') || err.message.includes('User rejected')
          ? 'Transaction Cancelled.'
          : 'Pool Creation Failed: ' + err.message,
        detail: 'No local state changes applied.'
      });
    } finally {
      setTimeout(() => setTxMessage(null), 8000);
    }
  };

  // Handle Deposit to Pool - On-Chain Finalized Execution
  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    const depositWei = parseGenToWei(depositAmount);
    if (depositWei <= 0n) {
      alert("Please enter a valid deposit amount (> 0 GEN).");
      return;
    }

    const poolIdStr = String(selectedPoolForDeposit?.id || '1');
    const depositWeiHex = '0x' + depositWei.toString(16);

    setTxMessage({
      status: 'pending',
      title: `Phase 1/3: Submitting ${depositAmount} GEN Deposit to MetaMask...`,
      detail: 'Please confirm native GEN deposit in MetaMask.'
    });

    try {
      const txHash = await sendContractTransaction({
        from: account,
        to: courtAddress || CONTRACT_ADDRESS,
        functionName: 'deposit_to_pool',
        args: [poolIdStr],
        value: depositWeiHex
      });

      if (!txHash) {
        throw new Error("Transaction cancelled or rejected by user.");
      }

      setTxMessage({
        status: 'processing',
        hash: txHash,
        title: `Phase 2/3: Deposit submitted! Waiting for finalization on GenLayer Studionet...`,
        detail: 'Confirming block inclusion.'
      });

      await waitForFinalizedTx(txHash);

      setTxMessage({
        status: 'reading',
        hash: txHash,
        title: 'Phase 3/3: Finalized! Reading updated pool balance from contract...',
        detail: 'Reading get_pool_balance view directly from contract.'
      });

      await loadContractData();
      setShowDepositModal(false);
      setDepositAmount('');

      setTxMessage({
        status: 'success',
        hash: txHash,
        title: `Successfully Deposited ${depositAmount} GEN to Pool #${poolIdStr}!`,
        detail: 'Updated balance verified on-chain.'
      });
    } catch (err) {
      console.warn("Deposit error:", err);
      // DO NOT update UI state on error!
      setTxMessage({
        status: 'error',
        title: err.message.includes('rejected') || err.message.includes('cancelled') || err.message.includes('User rejected')
          ? 'Transaction Cancelled.'
          : 'Deposit Failed: ' + err.message,
        detail: 'No balance changes applied.'
      });
    } finally {
      setTimeout(() => setTxMessage(null), 8000);
    }
  };

  const handleEnrollPolicyholder = async (pool) => {
    const holder = String(enrollInputs[pool.id] || account || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(holder)) {
      alert("Enter a valid 0x wallet address to enroll on this policy.");
      return;
    }
    setTxMessage({
      status: 'pending',
      title: `Phase 1/3: Enrolling ${holder.slice(0, 8)}... on Pool #${pool.id}`,
      detail: 'Please confirm enroll_policyholder in MetaMask.'
    });
    try {
      const txHash = await sendContractTransaction({
        from: account,
        to: courtAddress || CONTRACT_ADDRESS,
        functionName: 'enroll_policyholder',
        args: [String(pool.id), holder]
      });
      if (!txHash) throw new Error("Transaction cancelled or rejected by user.");
      setTxMessage({
        status: 'processing',
        hash: txHash,
        title: 'Phase 2/3: Enrollment submitted. Waiting for finalization...',
        detail: 'Binding this wallet to the enrolled policy.'
      });
      await waitForFinalizedTx(txHash);
      await loadContractData();
      setTxMessage({
        status: 'success',
        hash: txHash,
        title: `Wallet enrolled on Pool #${pool.id}`,
        detail: 'That address can now file a claim bound to this policy.'
      });
    } catch (err) {
      console.warn("Enroll error:", err);
      setTxMessage({
        status: 'error',
        title: err.message.includes('rejected') || err.message.includes('cancelled') || err.message.includes('User rejected')
          ? 'Transaction Cancelled.'
          : 'Enrollment Failed: ' + err.message,
        detail: 'No enrollment changes applied.'
      });
    } finally {
      setTimeout(() => setTxMessage(null), 8000);
    }
  };

  // Handle Submit Claim - On-Chain Finalized Execution
  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    const validEvidence = newClaim.evidence_urls.filter(u => u.trim() !== '');

    if (validEvidence.length < 1) {
      alert("At least 1 evidence URL is required");
      return;
    }

    const targetPool = (pools && pools.length > 0)
      ? (pools.find(p => String(p.id) === String(newClaim?.pool_id) && !isDeprecatedPool(p.id)) || pools.find(p => !isDeprecatedPool(p.id)))
      : null;
    if (!targetPool) {
      alert("Create a policy pool on this contract first, then file a claim.");
      setActiveTab('pools');
      return;
    }

    if (account && targetPool && targetPool.enrolled === false) {
      alert("Your wallet is not enrolled on this policy pool. Ask the pool operator to enroll your address before filing a claim.");
      return;
    }

    try {
      validateClaimantEvidenceOnly(validEvidence, targetPool.allowed_source_hosts || []);
    } catch (err) {
      alert(err.message || String(err));
      return;
    }

    const scenarios = PRESET_INCIDENT_SCENARIOS[targetPool.coverage_type] || [
      "Official incident claim matching pool eligibility criteria"
    ];

    let finalDesc = scenarios[selectedIncidentRadio] || scenarios[0];
    if (showCustomIncidentText && newClaim.description && newClaim.description.trim()) {
      finalDesc += ` (Note: ${newClaim.description.trim()})`;
    }

    const maxCapWei = BigInt(targetPool?.max_payout_per_claim || '1000000000000000000000');
    const claimedWei = newClaim.amount ? parseGenToWei(newClaim.amount) : (maxCapWei / 2n);
    if (claimedWei <= 0n) {
      alert("Please enter a valid claim amount (> 0 GEN).");
      return;
    }

    setTxMessage({
      status: 'pending',
      title: 'Phase 1/3: Submitting Claim to MetaMask...',
      detail: 'Please confirm submit_claim transaction in MetaMask.'
    });

    try {
      const txHash = await sendContractTransaction({
        from: account,
        to: courtAddress || CONTRACT_ADDRESS,
        functionName: 'submit_claim',
        args: [
          String(newClaim.pool_id || '1'),
          claimedWei,
          finalDesc,
          validEvidence
        ]
      });

      if (!txHash) {
        throw new Error("Transaction cancelled or rejected by user.");
      }

      setTxMessage({
        status: 'processing',
        hash: txHash,
        title: 'Phase 2/3: Claim submitted! Waiting for finalization on GenLayer Studionet...',
        detail: 'Processing block inclusion.'
      });

      await waitForFinalizedTx(txHash);

      setTxMessage({
        status: 'reading',
        hash: txHash,
        title: 'Phase 3/3: Finalized! Reading created claim record from contract state...',
        detail: 'Reading get_claim view for official contract claim ID and status.'
      });

      await loadContractData();
      setNewClaim({ pool_id: '1', amount: '', description: '', evidence_urls: [''], reference_urls: ['', ''] });
      setShowCustomIncidentText(false);
      setActiveTab('claims');

      setTxMessage({
        status: 'success',
        hash: txHash,
        title: 'Insurance Claim Submitted to GenLayer Contract!',
        detail: 'Claim status populated directly from contract.'
      });
    } catch (err) {
      console.warn("Submit claim error:", err);
      // DO NOT update UI state on error!
      setTxMessage({
        status: 'error',
        title: err.message.includes('rejected') || err.message.includes('cancelled') || err.message.includes('User rejected')
          ? 'Transaction Cancelled.'
          : 'Submission Failed: ' + err.message,
        detail: 'No claim created.'
      });
    } finally {
      setTimeout(() => setTxMessage(null), 8000);
    }
  };

  // Trigger AI Resolution on Deployed GenLayer Contract (No Random Verdicts)
  const handleResolveClaim = async (claimId) => {
    setIsResolving(true);
    const cId = String(claimId);

    setTxMessage({
      status: 'pending',
      title: `Phase 1/4: Submitting AI Consensus Trigger for Claim #${cId}...`,
      detail: 'Please confirm resolve_claim transaction in MetaMask.'
    });

    try {
      const txHash = await sendContractTransaction({
        from: account,
        to: courtAddress || CONTRACT_ADDRESS,
        functionName: 'resolve_claim',
        args: [cId]
      });

      if (!txHash) {
        throw new Error("Transaction cancelled or rejected by user.");
      }

      setTxMessage({
        status: 'consensus',
        hash: txHash,
        title: `Phase 2/4: AI validators are rendering web evidence and reaching consensus on-chain...`,
        detail: 'GenLayer validators are rendering URLs via gl.nondet.web.render. This may take 1-2 minutes. Please do not close this tab.'
      });

      await waitForFinalizedTx(txHash, 50, 3000);

      setTxMessage({
        status: 'reading',
        hash: txHash,
        title: `Phase 3/4: AI Consensus Finalized! Reading official verdict from get_claim(${cId})...`,
        detail: 'Fetching compliance_pct, confidence, verdict_reason, and payout_amount from contract state.'
      });

      const targetAddr = (courtAddress && courtAddress.trim()) ? courtAddress.trim() : CONTRACT_ADDRESS;
      const updatedClaimData = await readContractState('get_claim', [cId], targetAddr);

      if (updatedClaimData && updatedClaimData.status) {
        setClaims(prevClaims => prevClaims.map(c => {
          if (String(c.id) === cId) {
            return {
              ...c,
              status: String(updatedClaimData.status),
              compliance_pct: toPercentInt(updatedClaimData.compliance_pct),
              confidence: toPercentInt(updatedClaimData.confidence),
              payout_amount: toWeiString(updatedClaimData.payout_amount),
              verdict_reason: String(updatedClaimData.verdict_reason || ''),
              paid_out: Boolean(updatedClaimData.paid_out),
              authoritative_retrieved: Number(String(updatedClaimData.authoritative_retrieved || 0))
            };
          }
          return c;
        }));
      } else {
        await loadContractData();
      }

      setTxMessage({
        status: 'success',
        hash: txHash,
        title: `Phase 4/4: AI Adjudication Completed for Claim #${cId}!`,
        detail: 'Verdict, confidence score, and payout populated 100% from contract state.'
      });
    } catch (err) {
      console.warn("Resolve claim error:", err);
      // DO NOT update UI state on error!
      setTxMessage({
        status: 'error',
        title: err.message.includes('rejected') || err.message.includes('cancelled') || err.message.includes('User rejected')
          ? 'Transaction Cancelled.'
          : 'Adjudication Failed: ' + err.message,
        detail: 'No verdict changes applied.'
      });
    } finally {
      setIsResolving(false);
      setTimeout(() => setTxMessage(null), 12000);
    }
  };

  // Submit Additional Evidence for Disputed Claim
  const handleAddEvidenceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClaimForDetail) return;

    const validEv = additionalEvidence.filter(u => u.trim() !== '');

    if (validEv.length === 0) {
      alert("Please provide at least 1 new claimant evidence URL.");
      return;
    }

    const relatedPool = pools.find(p => String(p.id) === String(selectedClaimForDetail.pool_id));
    try {
      validateClaimantEvidenceOnly(
        [...(selectedClaimForDetail.evidence_urls || []), ...validEv],
        relatedPool?.allowed_source_hosts || []
      );
    } catch (err) {
      alert(err.message || String(err));
      return;
    }

    const cId = String(selectedClaimForDetail.id);
    setTxMessage({
      status: 'pending',
      title: `Phase 1/3: Submitting Supplemental Evidence for Claim #${cId}...`,
      detail: 'Please confirm add_evidence transaction in MetaMask.'
    });

    try {
      const txHash = await sendContractTransaction({
        from: account,
        to: courtAddress || CONTRACT_ADDRESS,
        functionName: 'add_evidence',
        args: [cId, validEv]
      });

      if (!txHash) {
        throw new Error("Transaction cancelled or rejected by user.");
      }

      setTxMessage({
        status: 'processing',
        hash: txHash,
        title: `Phase 2/3: Supplemental evidence submitted! Waiting for finalization...`,
        detail: 'Confirming transaction inclusion.'
      });

      await waitForFinalizedTx(txHash);

      setTxMessage({
        status: 'reading',
        hash: txHash,
        title: `Phase 3/3: Finalized! Reading updated claim record from contract...`,
        detail: 'Synchronizing evidence list and status from contract view.'
      });

      await loadContractData();
      setShowEvidenceModal(false);
      setAdditionalEvidence(['']);
      setAdditionalReference(['']);

      setTxMessage({
        status: 'success',
        hash: txHash,
        title: `Supplemental Evidence Attached to Claim #${cId}!`,
        detail: 'Claim re-queued for AI evaluation on-chain.'
      });
    } catch (err) {
      console.warn("Add evidence error:", err);
      // DO NOT update UI state on error!
      setTxMessage({
        status: 'error',
        title: err.message.includes('rejected') || err.message.includes('cancelled') || err.message.includes('User rejected')
          ? 'Transaction Cancelled.'
          : 'Evidence Attachment Failed: ' + err.message,
        detail: 'No evidence updated.'
      });
    } finally {
      setTimeout(() => setTxMessage(null), 8000);
    }
  };

  const isConfigured = courtAddress.trim() !== '';

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <Shield size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brand-title">ClaimVerdict</span>
              <span className="brand-tag">GenLayer AI</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Autonomous Insurance Claim Adjudication Protocol
            </p>
          </div>
        </div>

        <div className="nav-actions">
          <div className="network-badge">
            <span className="status-dot"></span>
            GenLayer Studionet
          </div>
          {account ? (
            <button className="btn btn-secondary" style={{ fontFamily: 'monospace' }}>
              <Wallet size={16} />
              {account.substring(0, 6)}...{account.substring(account.length - 4)}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={connectWallet}>
              <Wallet size={16} />
              Connect MetaMask
            </button>
          )}
        </div>
      </nav>

      {/* Contract Connection Banner */}
      {!isConfigured ? (
        <div className="banner banner-warning">
          <Info size={22} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div className="banner-title">GenLayer Studio Deployment Pending</div>
            <p className="banner-desc">
              Deploy single contract <code style={{ color: '#fef3c7', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>contracts/claim_verdict.py</code> in GenLayer Studio <strong>Run & Debug</strong> panel. Paste deployed address below to connect live. Running in <strong>Interactive Demo Mode</strong>.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <input 
                type="text" 
                placeholder="ClaimVerdict Deployed Contract Address (0x...)" 
                className="form-input" 
                style={{ fontSize: '12px', padding: '6px 12px', width: '420px' }}
                value={courtAddress}
                onChange={e => setCourtAddress(e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="banner banner-info">
          <CheckCircle2 size={20} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
          <div>
            <div className="banner-title">Connected to ClaimVerdict Intelligent Contract</div>
            <p className="banner-desc" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              Contract: {courtAddress}
            </p>
          </div>
        </div>
      )}

      {/* Transaction Notification Toast */}
      {txMessage && (
        <div 
          className={`banner ${
            typeof txMessage === 'object' && txMessage.status === 'error' 
              ? 'banner-error' 
              : typeof txMessage === 'object' && txMessage.status === 'success'
              ? 'banner-success'
              : 'banner-info'
          }`} 
          style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {typeof txMessage === 'object' && (txMessage.status === 'pending' || txMessage.status === 'processing' || txMessage.status === 'consensus' || txMessage.status === 'reading') && (
              <RefreshCw className="spin" size={20} color="#06b6d4" />
            )}
            {typeof txMessage === 'object' && txMessage.status === 'success' && (
              <CheckCircle2 size={20} color="#10b981" />
            )}
            {typeof txMessage === 'object' && txMessage.status === 'error' && (
              <XCircle size={20} color="#ef4444" />
            )}
            {typeof txMessage !== 'object' && (
              <Sparkles size={20} style={{ color: 'var(--accent-cyan)' }} />
            )}
            <div>
              <strong style={{ fontSize: '14px', color: '#f8fafc', display: 'block' }}>
                {typeof txMessage === 'object' ? txMessage.title : txMessage}
              </strong>
              {typeof txMessage === 'object' && txMessage.detail && (
                <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                  {txMessage.detail}
                </div>
              )}
            </div>
          </div>

          <a 
            href={typeof txMessage === 'object' && txMessage.hash ? `https://genlayer-explorer.vercel.app/tx/${txMessage.hash}` : `https://genlayer-explorer.vercel.app/address/${courtAddress}`}
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              color: '#38bdf8',
              fontWeight: 600,
              fontSize: '12px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            View on Explorer <ExternalLink size={12} />
          </a>
        </div>
      )}

      {/* Main Tabs */}
      <div className="tab-list">
        <button 
          className={`tab-btn ${activeTab === 'pools' ? 'active' : ''}`}
          onClick={() => setActiveTab('pools')}
        >
          <Layers size={16} style={{ display: 'inline', marginRight: '6px' }} />
          Policy Pools ({pools.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'claims' ? 'active' : ''}`}
          onClick={() => setActiveTab('claims')}
        >
          <FileText size={16} style={{ display: 'inline', marginRight: '6px' }} />
          Claims Registry ({claims.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'submit' ? 'active' : ''}`}
          onClick={() => setActiveTab('submit')}
        >
          <PlusCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
          File New Claim
        </button>
        <button 
          className={`tab-btn ${activeTab === 'disputed' ? 'active' : ''}`}
          onClick={() => setActiveTab('disputed')}
        >
          <AlertTriangle size={16} style={{ display: 'inline', marginRight: '6px' }} />
          Disputed Claims ({claims.filter(c => c.status === 'DISPUTED').length})
        </button>
      </div>

      {/* TAB 1: POLICY POOLS */}
      {activeTab === 'pools' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2>Active Insurance Policy Pools</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Pre-funded risk pools with automated AI claim assessment criteria
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreatePoolModal(true)}>
              <PlusCircle size={18} />
              Create Policy Pool
            </button>
          </div>

          {isLoadingContract ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <RefreshCw className="spin" size={32} color="var(--accent-cyan)" style={{ marginBottom: '12px' }} />
              <div style={{ color: '#f8fafc', fontSize: '14px' }}>Loading policy pools from GenLayer contract...</div>
            </div>
          ) : pools.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Layers size={40} color="var(--accent-cyan)" style={{ marginBottom: '12px', opacity: 0.8 }} />
              <h3 style={{ fontSize: '16px', color: '#f8fafc', marginBottom: '8px' }}>No On-Chain Policy Pools Found</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 16px' }}>
                No active policy pools have been created on contract <code style={{ color: 'var(--accent-cyan)' }}>{courtAddress}</code>. Click below to create and deploy the first pool on-chain.
              </p>
              <button className="btn btn-primary" onClick={() => setShowCreatePoolModal(true)}>
                <PlusCircle size={18} />
                Create Policy Pool
              </button>
            </div>
          ) : (
            <div className="grid-2">
              {pools.map(pool => {
                const isLegacyCorrupted = isDeprecatedPool(pool.id);

                return (
                  <div key={pool.id} className="card pool-card" style={{ opacity: isLegacyCorrupted ? 0.75 : 1 }}>
                    <div className="card-header">
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--accent-indigo)', fontWeight: '700' }}>
                          POOL #{pool.id}
                        </span>
                        <h3 className="card-title">{pool.coverage_type}</h3>
                      </div>
                      {isLegacyCorrupted ? (
                        <span className="badge badge-disputed" title="Legacy pool created with un-converted units. Deprecated.">⚠️ Deprecated Test Pool</span>
                      ) : (
                        <span className="badge badge-resolved">Active</span>
                      )}
                    </div>

                  <div className="pool-stats">
                    <div>
                      <div className="stat-label">Pool Fund Balance</div>
                      <div className="stat-value text-cyan">{formatWeiToGen(pool.pool_balance)} GEN</div>
                    </div>
                    <div>
                      <div className="stat-label">Max Payout / Claim</div>
                      <div className="stat-value">{formatWeiToGen(pool.max_payout_per_claim)} GEN</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Eligibility & Validity Criteria:
                    </div>
                    <ul className="criteria-list">
                      {pool.criteria.map((c, i) => (
                        <li key={i} className="criteria-item">
                          <CheckCircle2 size={14} style={{ color: 'var(--accent-emerald)', marginTop: '3px', flexShrink: 0 }} />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Enrolled authoritative sources (fetched by the contract, not chosen by claimants):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {(pool.allowed_source_hosts || []).length > 0 ? pool.allowed_source_hosts.map((h) => (
                        <span key={h} className="badge badge-resolved" style={{ fontSize: '11px' }}>{h}</span>
                      )) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>No enrolled sources on this pool (legacy). Create a new pool.</span>
                      )}
                    </div>
                    {(pool.authoritative_source_urls || []).map((u) => (
                      <div key={u} style={{ fontSize: '11px', wordBreak: 'break-all', marginBottom: '4px', color: 'var(--text-muted)' }}>{u}</div>
                    ))}
                    <div style={{ fontSize: '12px', color: pool.enrolled ? 'var(--accent-emerald)' : 'var(--accent-rose)', marginBottom: '8px' }}>
                      {pool.enrolled ? 'Your wallet is enrolled on this policy.' : 'Your wallet is not enrolled — the operator must enroll you before you can file a claim.'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={account || '0x covered wallet'}
                        value={enrollInputs[pool.id] || ''}
                        onChange={(e) => setEnrollInputs((prev) => ({ ...prev, [pool.id]: e.target.value }))}
                        style={{ flex: 1, fontSize: '12px', padding: '8px 10px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleEnrollPolicyholder(pool)}
                        title="Pool operator only"
                      >
                        <UserPlus size={14} />
                        Enroll
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      className="btn btn-cyan" 
                      style={{ flex: 1 }}
                      onClick={() => {
                        setSelectedPoolForDeposit(pool);
                        setShowDepositModal(true);
                      }}
                    >
                      <Coins size={16} />
                      Fund Pool (Deposit GEN)
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => {
                        setNewClaim({ ...newClaim, pool_id: pool.id });
                        setActiveTab('submit');
                      }}
                    >
                      File Claim
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLAIMS REGISTRY */}
      {activeTab === 'claims' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2>Claims Registry & Adjudication</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Claims evaluated by GenLayer multi-validator AI consensus
            </p>
          </div>

          {isLoadingContract ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <RefreshCw className="spin" size={32} color="var(--accent-cyan)" style={{ marginBottom: '12px' }} />
              <div style={{ color: '#f8fafc', fontSize: '14px' }}>Loading claims from GenLayer contract...</div>
            </div>
          ) : claims.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <FileText size={40} color="var(--accent-cyan)" style={{ marginBottom: '12px', opacity: 0.8 }} />
              <h3 style={{ fontSize: '16px', color: '#f8fafc', marginBottom: '8px' }}>No On-Chain Claims Found</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 16px' }}>
                No claims have been submitted to contract <code style={{ color: 'var(--accent-cyan)' }}>{courtAddress}</code> yet. Click below to file a new claim.
              </p>
              <button className="btn btn-primary" onClick={() => setActiveTab('submit')}>
                <PlusCircle size={18} />
                File New Claim
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {claims.map(claim => {
              const pool = pools.find(p => p.id === claim.pool_id);
              return (
                <div key={claim.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '700', fontSize: '16px' }}>CLAIM #{claim.id}</span>
                        <span className={`badge badge-${claim.status.toLowerCase()}`}>
                          {claim.status}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          Pool #{claim.pool_id} ({pool ? pool.coverage_type : 'Insurance'})
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '12px' }}>
                        "{claim.incident_description}"
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="stat-label">Claimed Amount</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                        {formatWeiToGen(claim.claimed_amount)} GEN
                      </div>
                    </div>
                  </div>

                  {/* Resolution Bar & Status */}
                  <div className="meter-container" style={{ margin: '12px 0 16px' }}>
                    <div className="meter-header">
                      <span>AI Verdict Compliance: {claim.compliance_pct}%</span>
                      <span>Confidence: {claim.confidence}%</span>
                    </div>
                    <div className="meter-bar">
                      <div className="meter-fill" style={{ width: `${claim.compliance_pct}%` }}></div>
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
                    <strong>Verdict Summary:</strong> {claim.verdict_reason || 'Pending consensus evaluation'}
                    <div style={{ marginTop: '8px', fontSize: '12px' }}>
                      Authoritative sources retrieved: {claim.authoritative_retrieved ?? 0}/2 required for payout
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Payout Executed: <strong style={{ color: claim.paid_out ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                        {claim.paid_out ? `${formatWeiToGen(claim.payout_amount)} GEN` : '0 GEN'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      {claim.status === 'SUBMITTED' && (
                        <button 
                          className="btn btn-primary"
                          disabled={isResolving}
                          onClick={() => handleResolveClaim(claim.id)}
                        >
                          {isResolving ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
                          Run AI Adjudication Consensus
                        </button>
                      )}
                      <button 
                        className="btn btn-secondary"
                        onClick={() => setSelectedClaimForDetail(claim)}
                      >
                        View Verification Sources & Evidence
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* TAB 3: FILE CLAIM FORM (PRESET CARDS & CLIPBOARD HELPERS) */}
      {activeTab === 'submit' && (
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <FileText className="text-cyan" />
                Submit Insurance Claim
              </h2>
            </div>

            <form onSubmit={handleSubmitClaim}>
              {pools.filter((p) => !isDeprecatedPool(p.id)).length === 0 && (
                <div className="form-group" style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: 'rgba(56,189,248,0.08)',
                  border: '1px solid rgba(56,189,248,0.25)',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>No enrolled policy pool on this contract yet</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Contract `{courtAddress}` is empty. Create a policy pool first (that writes the two authoritative source URLs and enrolls your operator wallet). Then come back here to file a claim.
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => setActiveTab('pools')}>
                    Go to Policy Pools
                  </button>
                </div>
              )}
              {/* Select Policy Pool (Clickable Cards) */}
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '10px' }}>Select Policy Pool *</label>
                <div className="pool-select-grid">
                  {pools.map(p => {
                    if (isDeprecatedPool(p.id)) return null; // Exclude deprecated legacy test pools from new claim selection grid

                    return (
                      <div 
                        key={p.id}
                        className={`pool-select-card ${String(newClaim?.pool_id) === String(p.id) ? 'selected' : ''}`}
                        onClick={() => {
                          const capWei = BigInt(p.max_payout_per_claim || '1000000000000000000000');
                          const halfWei = capWei / 2n;
                          setNewClaim({ 
                            ...newClaim, 
                            pool_id: p.id,
                            amount: formatWeiToGen(halfWei)
                          });
                          setSelectedIncidentRadio(0);
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <span className="badge badge-resolved" style={{ fontSize: '10px' }}>POOL #{p.id}</span>
                          <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 700 }}>{formatWeiToGen(p.pool_balance)} GEN</span>
                        </div>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{p.coverage_type}</h4>
                        <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Max Payout: {formatWeiToGen(p.max_payout_per_claim)} GEN</span>
                        <div style={{ fontSize: '11px', marginTop: '6px', color: p.enrolled ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                          {p.enrolled ? 'Enrolled' : 'Not enrolled'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Incident Scenario Radio Options */}
              {(() => {
                const realPools = (pools || []).filter((p) => !isDeprecatedPool(p.id));
                const targetPool = realPools.find(p => String(p.id) === String(newClaim.pool_id)) || realPools[0];
                if (!targetPool) return null;
                const coverageType = targetPool?.coverage_type || 'Flight Cancellation & Delay';
                const scenarios = PRESET_INCIDENT_SCENARIOS[coverageType] || [
                  "Official incident claim matching policy criteria"
                ];
                const hints = POOL_URL_HINTS[coverageType] || {
                  evidence: "Official invoice, loss photo, carrier receipt link",
                  reference: "Public status verification page, official bulletin link"
                };
                const evidenceUrls = newClaim?.evidence_urls || [''];
                const allowedHosts = targetPool?.allowed_source_hosts || [];

                return (
                  <>
                    <div className="form-group" style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: targetPool?.enrolled ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                        {targetPool?.enrolled ? 'Wallet enrolled on this policy' : 'Wallet is not enrolled on this policy'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Claims are bound to enrolled wallets. Ask the pool operator to enroll you on the Policy Pools tab if this is red.
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Required independent hosts:{' '}
                        {allowedHosts.length > 0 ? allowedHosts.map((h) => (
                          <span key={h} className="badge badge-resolved" style={{ fontSize: '10px', marginRight: '4px' }}>{h}</span>
                        )) : 'none on this pool — create a new pool with enrolled sources'}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ marginBottom: '10px' }}>Incident Type Scenario *</label>
                      <div className="incident-radio-list">
                        {scenarios.map((sc, idx) => (
                          <div 
                            key={idx}
                            className={`incident-radio-item ${selectedIncidentRadio === idx ? 'selected' : ''}`}
                            onClick={() => setSelectedIncidentRadio(idx)}
                          >
                            <input 
                              type="radio" 
                              name="incidentScenario"
                              className="incident-radio-input"
                              checked={selectedIncidentRadio === idx}
                              onChange={() => setSelectedIncidentRadio(idx)}
                            />
                            <span style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.4 }}>{sc}</span>
                          </div>
                        ))}
                      </div>

                      {!showCustomIncidentText ? (
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ fontSize: '12px', padding: '4px 12px' }}
                          onClick={() => setShowCustomIncidentText(true)}
                        >
                          ➕ Add Additional Detail Note (Optional)
                        </button>
                      ) : (
                        <div style={{ marginTop: '10px' }}>
                          <input 
                            type="text" 
                            placeholder="Optional additional detail (e.g. Flight VN123, Ticket #99120)..." 
                            className="form-input"
                            value={newClaim.description}
                            onChange={e => setNewClaim({ ...newClaim, description: e.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    {/* Claimed Amount Chips & Input */}
                    <div className="form-group">
                      <label className="form-label">Claimed Amount (GEN) *</label>
                      <div className="preset-chips-row">
                        {[25, 50, 75, 100].map(pctInt => {
                          const maxCapWei = BigInt(targetPool?.max_payout_per_claim || '1000000000000000000000');
                          const valWei = (maxCapWei * BigInt(pctInt)) / 100n;
                          const val = formatWeiToGen(valWei);
                          return (
                            <button 
                              key={pctInt}
                              type="button"
                              className={`preset-chip ${newClaim.amount === val ? 'active' : ''}`}
                              disabled={isLoadingContract}
                              onClick={() => setNewClaim({ ...newClaim, amount: val })}
                            >
                              {isLoadingContract ? `${pctInt}% (...)` : `${pctInt}% (${val} GEN)`}
                            </button>
                          );
                        })}
                      </div>
                      <input 
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="Enter custom claimed amount (e.g. 123.456)"
                        className="form-input"
                        value={newClaim.amount}
                        onChange={e => setNewClaim({ ...newClaim, amount: sanitizeGenInput(e.target.value) })}
                        required
                      />
                      {newClaim.amount ? (
                        <div data-testid="claim-amount-roundtrip" style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginTop: '8px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                          Exact: {parseGenToWei(newClaim.amount).toString()} wei → displays {formatWeiToGen(parseGenToWei(newClaim.amount))} GEN
                        </div>
                      ) : null}
                    </div>

                    {/* Sample Data Helper Row */}
                    <div className="sample-data-header-row">
                      <button 
                        type="button" 
                        className="sample-data-btn"
                        onClick={() => setShowSamplePopover(!showSamplePopover)}
                      >
                        🧪 Fill Sample Test Data
                      </button>
                      <span className="sample-warning-text">
                        ⚠️ For test/demo use only — when submitting a real claim, use your own genuine evidence.
                      </span>

                      {showSamplePopover && (() => {
                        const samples = SAMPLE_CLAIM_DATA[coverageType] 
                          || SAMPLE_CLAIM_DATA[targetPool?.coverage_type] 
                          || SAMPLE_CLAIM_DATA["Flight Cancellation & Delay"];

                        return (
                          <div className="sample-popover">
                            <div style={{ fontSize: '11px', color: 'var(--text-subtle)', padding: '4px 8px 8px', fontWeight: 600 }}>
                              SAMPLE DATASETS FOR ({coverageType}):
                            </div>
                            {samples.map((s, idx) => (
                              <div 
                                key={idx} 
                                className="sample-popover-item"
                                onClick={() => handleApplySample(s)}
                              >
                                <span>{s.label}</span>
                                <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 600 }}>Apply →</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Evidence URLs with Clipboard Paste Button & Contextual Hint */}
                    <div className="form-group">
                      <label className="form-label">Claimant Evidence URLs (Min 1 Required) *</label>
                      {evidenceUrls.map((url, idx) => (
                        <div key={idx} className="url-input-wrapper">
                          <input 
                            type="url"
                            placeholder="https://example.com/receipt.pdf"
                            className="form-input"
                            value={url}
                            onChange={e => handleUrlChange(newClaim, setNewClaim, 'evidence_urls', idx, e.target.value)}
                            required={idx === 0}
                          />
                          <button 
                            type="button" 
                            className="paste-btn"
                            onClick={() => handlePasteClipboard((pasted) => handleUrlChange(newClaim, setNewClaim, 'evidence_urls', idx, pasted))}
                          >
                            <Clipboard size={14} /> Paste
                          </button>
                        </div>
                      ))}
                      <div className="url-hint">
                        💡 <strong>Suggested Evidence:</strong> {hints.evidence}
                      </div>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => addUrlField(newClaim, setNewClaim, 'evidence_urls')}
                      >
                        + Add Evidence URL
                      </button>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Policy-enrolled authoritative sources (read-only — you cannot choose these)</label>
                      {(targetPool.authoritative_source_urls || []).length > 0 ? (
                        (targetPool.authoritative_source_urls || []).map((u, idx) => (
                          <div key={idx} style={{ fontSize: '12px', wordBreak: 'break-all', marginBottom: '6px' }}>
                            🌐 <a href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-indigo)' }}>{u}</a>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                          This pool has no enrolled source URLs. Create a new pool after the steward ABI update.
                        </div>
                      )}
                      <div className="url-hint">
                        The contract fetches these enrolled pages on resolve. Payout requires both distinct hosts to retrieve successfully. You only attach claimant evidence (receipts), not these sources.
                      </div>
                    </div>
                  </>
                );
              })()}

              <FreeGasNotice style={{ marginTop: '20px' }} />

              <button type="submit" className="btn btn-cyan" style={{ width: '100%', marginTop: '10px' }}>
                <Send size={18} />
                Submit Claim to Intelligent Contract
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: DISPUTED CLAIMS */}
      {activeTab === 'disputed' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2>Disputed Claims Portal</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Claims flagged with low AI confidence (&lt;60%). Claimants can submit supplemental evidence for re-evaluation.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {claims.filter(c => c.status === 'DISPUTED').map(claim => (
              <div key={claim.id} className="card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge badge-disputed">DISPUTED</span>
                    <h3 style={{ marginTop: '6px' }}>Claim #{claim.id}</h3>
                    <p style={{ fontSize: '14px', marginTop: '4px' }}>"{claim.incident_description}"</p>
                  </div>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setSelectedClaimForDetail(claim);
                      setShowEvidenceModal(true);
                    }}
                  >
                    Attach Supplemental Evidence
                  </button>
                </div>

                <div className="banner banner-warning" style={{ marginTop: '16px', marginBottom: 0 }}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Low Confidence Flag ({claim.confidence}%):</strong> {claim.verdict_reason}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: CREATE POLICY POOL (TEMPLATE DRIVEN & GUIDED FLOW) */}
      {showCreatePoolModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '20px' }}>Create Policy Pool</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Guided template setup — zero platform fees, sign only network gas.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowCreatePoolModal(false)}>✕</button>
            </div>

            {/* Step Progress Indicator */}
            <div className="step-indicator">
              <div className={`step-item ${createStep === 1 ? 'active' : createStep > 1 ? 'completed' : ''}`}>
                <span className="step-number">1</span>
                <span>Category & Criteria</span>
              </div>
              <div className="step-divider" />
              <div className={`step-item ${createStep === 2 ? 'active' : createStep > 2 ? 'completed' : ''}`}>
                <span className="step-number">2</span>
                <span>Financial Terms</span>
              </div>
              <div className="step-divider" />
              <div className={`step-item ${createStep === 3 ? 'active' : ''}`}>
                <span className="step-number">3</span>
                <span>Review & Deploy</span>
              </div>
            </div>

            {/* STEP 1: CATEGORY CHIPS & PRESET CRITERIA CHECKBOXES */}
            {createStep === 1 && (
              <div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '10px' }}>Select Policy Category Preset *</label>
                  <div className="category-grid">
                    {PRESET_CATEGORIES.map(cat => (
                      <div 
                        key={cat.id} 
                        className={`category-chip ${selectedCategory.id === cat.id ? 'selected' : ''}`}
                        onClick={() => handleSelectCategory(cat)}
                      >
                        <span className="category-chip-icon">{cat.icon}</span>
                        <span className="category-chip-label">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '8px' }}>
                    Enrolled authoritative source URLs (bound to this policy)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                    {(selectedCategory.allowed_source_hosts || []).map((h) => (
                      <span key={h} className="badge badge-resolved" style={{ fontSize: '11px' }}>{h}</span>
                    ))}
                  </div>
                  {(selectedCategory.authoritative_source_urls || []).map((u) => (
                    <div key={u} style={{ fontSize: '11px', wordBreak: 'break-all', marginBottom: '4px', color: 'var(--text-muted)' }}>{u}</div>
                  ))}
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    These URLs are written into the pool. Claimants cannot choose or replace them. Payout requires both distinct hosts to be retrieved successfully.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '10px' }}>
                    Eligibility Criteria (Tick to Apply) *
                  </label>
                  <div className="criteria-checkbox-list">
                    {selectedCategory.criteria_presets.map((criterion, idx) => (
                      <div 
                        key={idx} 
                        className={`criteria-checkbox-item ${selectedCriteriaMap[idx] ? 'checked' : ''}`}
                        onClick={() => handleToggleCriterion(idx)}
                      >
                        <input 
                          type="checkbox" 
                          className="criteria-checkbox-input"
                          checked={!!selectedCriteriaMap[idx]}
                          onChange={() => {}}
                        />
                        <span className="criteria-checkbox-text">{criterion}</span>
                      </div>
                    ))}

                    {customCriteriaList.map((cust, idx) => (
                      <div key={idx} className="criteria-checkbox-item checked" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge badge-resolved" style={{ fontSize: '10px' }}>CUSTOM</span>
                          <span className="criteria-checkbox-text">{cust}</span>
                        </div>
                        <button 
                          type="button" 
                          style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '14px' }}
                          onClick={() => handleRemoveCustomCriterion(idx)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {!showCustomInput ? (
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                      onClick={() => setShowCustomInput(true)}
                    >
                      ➕ Add Custom Criterion
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <input 
                        type="text" 
                        placeholder="Enter optional custom criterion..." 
                        className="form-input"
                        value={customCriterionInput}
                        onChange={e => setCustomCriterionInput(e.target.value)}
                      />
                      <button type="button" className="btn btn-primary" onClick={handleAddCustomCriterion}>Add</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowCustomInput(false)}>Cancel</button>
                    </div>
                  )}
                </div>

                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '16px' }}
                  onClick={() => setCreateStep(2)}
                >
                  Next: Financial Terms →
                </button>
              </div>
            )}

            {/* STEP 2: FINANCIAL AMOUNTS & PRESET CHIPS */}
            {createStep === 2 && (
              <div>
                <div className="form-group">
                  <label className="form-label">Max Payout Per Claim (GEN) *</label>
                  <div className="preset-chips-row">
                    {selectedCategory.max_payout_presets.map(val => (
                      <button 
                        key={val}
                        type="button"
                        className={`preset-chip ${newPool.max_payout === val ? 'active' : ''}`}
                        onClick={() => setNewPool({ ...newPool, max_payout: val })}
                      >
                        {val} GEN
                      </button>
                    ))}
                  </div>
                  <input 
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="Enter custom max payout per claim" 
                    className="form-input"
                    value={newPool.max_payout}
                    onChange={e => setNewPool({ ...newPool, max_payout: sanitizeGenInput(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Pool Deposit (GEN) *</label>
                  <div className="preset-chips-row">
                    {selectedCategory.deposit_presets.map(val => (
                      <button 
                        key={val}
                        type="button"
                        className={`preset-chip ${initialDepositAmount === val ? 'active' : ''}`}
                        onClick={() => setInitialDepositAmount(val)}
                      >
                        {val} GEN
                      </button>
                    ))}
                  </div>
                  <input 
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="Enter initial pool deposit amount" 
                    className="form-input"
                    value={initialDepositAmount}
                    onChange={e => setInitialDepositAmount(sanitizeGenInput(e.target.value))}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCreateStep(1)}>
                    ← Back
                  </button>
                  <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={() => setCreateStep(3)}>
                    Review & Deploy →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SUMMARY & SINGLE-CLICK DEPLOY */}
            {createStep === 3 && (
              <form onSubmit={handleCreatePoolSubmit}>
                <div className="summary-card">
                  <h4 style={{ fontSize: '15px', color: 'var(--accent-cyan)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{selectedCategory.icon}</span> {selectedCategory.coverage_type}
                  </h4>

                  <div className="summary-row">
                    <span style={{ color: 'var(--text-muted)' }}>Max Payout / Claim:</span>
                    <strong style={{ color: 'var(--accent-emerald)' }}>{newPool.max_payout || selectedCategory.default_max_payout} GEN</strong>
                  </div>

                  <div className="summary-row">
                    <span style={{ color: 'var(--text-muted)' }}>Initial Pool Funding:</span>
                    <strong style={{ color: 'var(--accent-cyan)' }}>{initialDepositAmount} GEN</strong>
                  </div>

                  <div className="summary-row" style={{ alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Authoritative hosts:</span>
                    <strong style={{ color: 'var(--text-main)', textAlign: 'right' }}>
                      {(selectedCategory.allowed_source_hosts || []).join(', ')}
                    </strong>
                  </div>

                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed rgba(255, 255, 255, 0.08)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-subtle)', fontWeight: 600 }}>APPLIED ELIGIBILITY CRITERIA:</span>
                    <ul style={{ paddingLeft: '18px', marginTop: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
                      {selectedCategory.criteria_presets.filter((_, idx) => selectedCriteriaMap[idx]).map((c, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{c}</li>
                      ))}
                      {customCriteriaList.map((c, i) => (
                        <li key={`c-${i}`} style={{ marginBottom: '4px', color: 'var(--accent-cyan)' }}>{c} (Custom)</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <FreeGasNotice style={{ marginBottom: '16px' }} />

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCreateStep(2)}>
                    ← Back
                  </button>
                  <button type="submit" className="btn btn-cyan" style={{ flex: 2 }}>
                    Deploy & Fund Policy Pool
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: FUND POOL */}
      {showDepositModal && selectedPoolForDeposit && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Fund Pool #{selectedPoolForDeposit.id} ({selectedPoolForDeposit.coverage_type})</h3>
              <button className="btn btn-secondary" onClick={() => setShowDepositModal(false)}>✕</button>
            </div>
            <form onSubmit={handleDepositSubmit}>
              <div className="form-group">
                <label className="form-label">Deposit Native GEN Amount *</label>
                <div className="preset-chips-row">
                  {['500', '1000', '5000', '10000'].map(val => (
                    <button 
                      key={val}
                      type="button"
                      className={`preset-chip ${depositAmount === val ? 'active' : ''}`}
                      onClick={() => setDepositAmount(val)}
                    >
                      {val} GEN
                    </button>
                  ))}
                  {BigInt(selectedPoolForDeposit?.pool_balance || '0') > 0n && (
                    <button 
                      type="button"
                      className="preset-chip"
                      onClick={() => {
                        const poolBalWei = BigInt(selectedPoolForDeposit.pool_balance || '0');
                        setDepositAmount(formatWeiToGen(poolBalWei / 2n));
                      }}
                    >
                      +50% Match
                    </button>
                  )}
                </div>
                <input 
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Enter custom deposit amount (e.g. 123.456)" 
                  className="form-input"
                  value={depositAmount}
                  onChange={e => setDepositAmount(sanitizeGenInput(e.target.value))}
                  required
                />
                {depositAmount ? (
                  <div data-testid="deposit-amount-roundtrip" style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginTop: '8px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    Exact: {parseGenToWei(depositAmount).toString()} wei → displays {formatWeiToGen(parseGenToWei(depositAmount))} GEN
                  </div>
                ) : null}
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Native GEN will be deposited directly into the consolidated ClaimVerdict contract for Pool #{selectedPoolForDeposit.id}.
              </p>

              <FreeGasNotice style={{ marginBottom: '16px' }} />

              <button type="submit" className="btn btn-cyan" style={{ width: '100%' }}>
                Deposit GEN to Pool
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLAIM DETAILS & SOURCES */}
      {selectedClaimForDetail && !showEvidenceModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Claim #{selectedClaimForDetail.id} Verification Details</h3>
              <button className="btn btn-secondary" onClick={() => setSelectedClaimForDetail(null)}>✕</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <strong>Statement:</strong> "{selectedClaimForDetail.incident_description}"
            </div>

            <div className="form-group">
              <label className="form-label">Claimant Evidence URLs:</label>
              {selectedClaimForDetail.evidence_urls.map((u, i) => (
                <div key={i} style={{ fontSize: '13px', wordBreak: 'break-all', marginBottom: '4px' }}>
                  📄 <a href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>{u}</a>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">Independent Authoritative Reference Sources:</label>
              {selectedClaimForDetail.reference_urls.map((u, i) => (
                <div key={i} style={{ fontSize: '13px', wordBreak: 'break-all', marginBottom: '4px' }}>
                  🌐 <a href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-indigo)' }}>{u}</a>
                </div>
              ))}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Successfully retrieved enrolled sources: {selectedClaimForDetail.authoritative_retrieved ?? 0} (payout requires 2 distinct hosts)
              </div>
            </div>

            <div className="assessment-box">
              <div style={{ fontWeight: '700', marginBottom: '6px' }}>AI Verdict Reason:</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {selectedClaimForDetail.verdict_reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ATTACH SUPPLEMENTAL EVIDENCE */}
      {showEvidenceModal && selectedClaimForDetail && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Attach Supplemental Evidence (Claim #{selectedClaimForDetail.id})</h3>
              <button className="btn btn-secondary" onClick={() => setShowEvidenceModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddEvidenceSubmit}>
              {/* Checkbox Dispute Reasons */}
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '10px' }}>Re-submission Reason / Rectification *</label>
                <div className="criteria-checkbox-list">
                  {DISPUTE_REASON_PRESETS.map((reason, idx) => (
                    <div 
                      key={idx}
                      className={`criteria-checkbox-item ${selectedDisputeReasons[idx] ? 'checked' : ''}`}
                      onClick={() => setSelectedDisputeReasons(prev => ({ ...prev, [idx]: !prev[idx] }))}
                    >
                      <input 
                        type="checkbox"
                        className="criteria-checkbox-input"
                        checked={!!selectedDisputeReasons[idx]}
                        onChange={() => {}}
                      />
                      <span className="criteria-checkbox-text">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Evidence URLs */}
              <div className="form-group">
                <label className="form-label">Additional Evidence URLs</label>
                {additionalEvidence.map((u, idx) => (
                  <div key={idx} className="url-input-wrapper">
                    <input 
                      type="url"
                      placeholder="https://example.com/medical_report_signed.pdf"
                      className="form-input"
                      value={u}
                      onChange={e => {
                        const updated = [...additionalEvidence];
                        updated[idx] = e.target.value;
                        setAdditionalEvidence(updated);
                      }}
                    />
                    <button 
                      type="button" 
                      className="paste-btn"
                      onClick={() => handlePasteClipboard((pasted) => {
                        const updated = [...additionalEvidence];
                        updated[idx] = pasted;
                        setAdditionalEvidence(updated);
                      })}
                    >
                      <Clipboard size={14} /> Paste
                    </button>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Authoritative sources stay bound to the enrolled policy. You can only attach more claimant evidence.
              </p>

              <FreeGasNotice style={{ marginBottom: '16px' }} />

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Re-submit Claim for AI Assessment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* APP FOOTER WITH REUSABLE NOTICE */}
      <footer style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid var(--border-glass)' }}>
        <FreeGasNotice style={{ marginBottom: 0 }} />
      </footer>
    </div>
  );
}
