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
  ChevronRight,
  Send
} from 'lucide-react';
import { getGenlayerClient } from './genlayerClient';

// Initial Mock Pools & Claims for unconfigured / fallback mode
const INITIAL_DEMO_POOLS = [
  {
    id: "0",
    coverage_type: "Flight Cancellation & Delay",
    operator: "0x8920...f4a1",
    max_payout_per_claim: "1000",
    pool_balance: "15000",
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
    max_payout_per_claim: "2500",
    pool_balance: "30000",
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
    claimed_amount: "800",
    incident_description: "Flight VN123 from SGN to HAN cancelled due to severe tropical storm warning.",
    evidence_urls: ["https://example.com/ticket_vn123.pdf"],
    reference_urls: [
      "https://flightstats.com/flight/VN123/status",
      "https://weather.gov/alerts/storm_warning"
    ],
    status: "RESOLVED",
    compliance_pct: 100,
    confidence: 95,
    payout_amount: "800",
    verdict_reason: "Flight cancellation confirmed by flightstats.com and storm alert confirmed by national weather bureau. All criteria satisfied.",
    paid_out: true
  },
  {
    id: "1",
    pool_id: "1",
    claimant: "0x5A38...e112",
    claimed_amount: "1200",
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
    criteria_presets: [
      "Official event cancellation notice issued by organizer or ticketing vendor",
      "No secondary rescheduled event date or venue alternative provided",
      "Original ticket purchase confirmation and receipt attached"
    ]
  }
];

export default function App() {
  // Config & State
  const [account, setAccount] = useState(null);
  const [courtAddress, setCourtAddress] = useState(import.meta.env.VITE_CONTRACT_ADDRESS || import.meta.env.VITE_CLAIM_COURT_ADDRESS || '0x030838e6829f5fA3CEEf6989c1dd78d2c626BAe3');
  const [treasuryAddress, setTreasuryAddress] = useState(import.meta.env.VITE_TREASURY_ADDRESS || '');
  const [reputationAddress, setReputationAddress] = useState(import.meta.env.VITE_REPUTATION_ADDRESS || '');

  const [activeTab, setActiveTab] = useState('pools'); // 'pools' | 'claims' | 'submit' | 'disputed'
  const [pools, setPools] = useState(INITIAL_DEMO_POOLS);
  const [claims, setClaims] = useState(INITIAL_DEMO_CLAIMS);

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

  // Form Inputs
  const [newPool, setNewPool] = useState({
    coverage_type: PRESET_CATEGORIES[0].coverage_type,
    criteria: PRESET_CATEGORIES[0].criteria_presets,
    max_payout: PRESET_CATEGORIES[0].default_max_payout
  });

  const [depositAmount, setDepositAmount] = useState('');

  const [newClaim, setNewClaim] = useState({
    pool_id: '0',
    amount: '',
    description: '',
    evidence_urls: [''],
    reference_urls: ['', '']
  });

  const [additionalEvidence, setAdditionalEvidence] = useState(['']);
  const [additionalReference, setAdditionalReference] = useState(['']);

  // Connect Wallet
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
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

  // Helper for URL arrays
  const handleUrlChange = (form, setForm, key, index, value) => {
    const updated = [...form[key]];
    updated[index] = value;
    setForm({ ...setForm, [key]: updated });
  };
  const addUrlField = (form, setForm, key) => setForm({ ...setForm, [key]: [...form[key], ''] });

  // Handle Create Pool (Template Guided Flow)
  const handleCreatePoolSubmit = (e) => {
    e.preventDefault();
    const activePresets = selectedCategory.criteria_presets.filter((_, idx) => selectedCriteriaMap[idx]);
    const allCriteria = [...activePresets, ...customCriteriaList];

    if (allCriteria.length === 0) {
      alert("Please select or add at least 1 eligibility criterion for the policy pool.");
      return;
    }

    const maxPayoutVal = newPool.max_payout || selectedCategory.default_max_payout;
    if (!maxPayoutVal || parseFloat(maxPayoutVal) <= 0) {
      alert("Please specify a valid Max Payout per Claim (> 0 GEN).");
      return;
    }

    const createdPool = {
      id: String(pools.length),
      coverage_type: selectedCategory.coverage_type,
      operator: account || "0xYourWallet",
      max_payout_per_claim: maxPayoutVal,
      pool_balance: "0",
      active: true,
      criteria: allCriteria
    };

    setPools([createdPool, ...pools]);
    setShowCreatePoolModal(false);

    // Automatic Flow Transition: Prompt initial deposit modal immediately after pool creation
    if (initialDepositAmount && parseFloat(initialDepositAmount) > 0) {
      setSelectedPoolForDeposit(createdPool);
      setDepositAmount(initialDepositAmount);
      setShowDepositModal(true);
      setTxMessage(`Policy Pool #${createdPool.id} created! Opening deposit authorization for ${initialDepositAmount} GEN initial pool funding...`);
    } else {
      setTxMessage(`Policy Pool #${createdPool.id} created successfully!`);
    }

    // Reset creation form state
    setCreateStep(1);
    setCustomCriteriaList([]);
    setCustomCriterionInput('');
    setShowCustomInput(false);
    setTimeout(() => setTxMessage(null), 5000);
  };

  // Handle Deposit to Pool
  const handleDepositSubmit = (e) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;

    setPools(pools.map(p => {
      if (p.id === selectedPoolForDeposit.id) {
        return {
          ...p,
          pool_balance: String(parseFloat(p.pool_balance) + parseFloat(depositAmount))
        };
      }
      return p;
    }));

    setShowDepositModal(false);
    setDepositAmount('');
    setTxMessage(`Successfully deposited ${depositAmount} GEN to Pool #${selectedPoolForDeposit.id}`);
    setTimeout(() => setTxMessage(null), 4000);
  };

  // Handle Submit Claim
  const handleSubmitClaim = (e) => {
    e.preventDefault();
    const validEvidence = newClaim.evidence_urls.filter(u => u.trim() !== '');
    const validReference = newClaim.reference_urls.filter(u => u.trim() !== '');

    if (validEvidence.length < 1) {
      alert("At least 1 evidence URL is required");
      return;
    }
    if (validReference.length < 2) {
      alert("At least 2 independent reference verification URLs are required");
      return;
    }

    const targetPool = pools.find(p => p.id === newClaim.pool_id);
    const poolBal = parseFloat(targetPool ? targetPool.pool_balance : 0);
    const claimed = parseFloat(newClaim.amount);

    const createdClaim = {
      id: String(claims.length),
      pool_id: newClaim.pool_id,
      claimant: account || "0xClaimantWallet",
      claimed_amount: newClaim.amount,
      incident_description: newClaim.description,
      evidence_urls: validEvidence,
      reference_urls: validReference,
      status: poolBal < claimed ? "REJECTED_NO_FUNDS" : "SUBMITTED",
      compliance_pct: 0,
      confidence: 0,
      payout_amount: "0",
      verdict_reason: poolBal < claimed ? "Insufficient policy pool balance in treasury" : "Awaiting AI consensus resolution",
      paid_out: false
    };

    setClaims([createdClaim, ...claims]);
    setNewClaim({ pool_id: '0', amount: '', description: '', evidence_urls: [''], reference_urls: ['', ''] });
    setActiveTab('claims');
    setTxMessage("Claim filed successfully! Ready for AI evaluation.");
    setTimeout(() => setTxMessage(null), 4000);
  };

  // Trigger AI Resolution (Simulated or Contract)
  const handleResolveClaim = (claimId) => {
    setIsResolving(true);
    setTimeout(() => {
      setClaims(claims.map(c => {
        if (c.id === claimId) {
          const isHighConf = Math.random() > 0.3;
          const compliance = Math.floor(Math.random() * 30) + 75; // 75-100%
          const confidence = isHighConf ? Math.floor(Math.random() * 20) + 80 : 52;
          const targetPool = pools.find(p => p.id === c.pool_id);
          const maxCap = parseFloat(targetPool ? targetPool.max_payout_per_claim : 1000);
          const baseAmt = Math.min(parseFloat(c.claimed_amount), maxCap);
          const payout = isHighConf ? String(Math.floor(baseAmt * (compliance / 100))) : "0";

          return {
            ...c,
            status: isHighConf ? "RESOLVED" : "DISPUTED",
            compliance_pct: compliance,
            confidence: confidence,
            payout_amount: payout,
            verdict_reason: isHighConf 
              ? `AI Consensus verified ${compliance}% criteria compliance across independent references. Payout calculated.` 
              : `Low confidence (${confidence}%). Independent reference provided ambiguous verification. Claimant invited to submit supplemental documentation.`,
            paid_out: isHighConf
          };
        }
        return c;
      }));
      setIsResolving(false);
      setTxMessage("AI Non-Deterministic Consensus evaluation completed!");
      setTimeout(() => setTxMessage(null), 4000);
    }, 2500);
  };

  // Submit Additional Evidence for Disputed Claim
  const handleAddEvidenceSubmit = (e) => {
    e.preventDefault();
    if (!selectedClaimForDetail) return;

    setClaims(claims.map(c => {
      if (c.id === selectedClaimForDetail.id) {
        return {
          ...c,
          evidence_urls: [...c.evidence_urls, ...additionalEvidence.filter(u => u.trim() !== '')],
          reference_urls: [...c.reference_urls, ...additionalReference.filter(u => u.trim() !== '')],
          status: "SUBMITTED",
          verdict_reason: "Supplemental evidence attached. Queued for re-assessment."
        };
      }
      return c;
    }));

    setShowEvidenceModal(false);
    setAdditionalEvidence(['']);
    setAdditionalReference(['']);
    setTxMessage("Supplemental evidence attached! Claim re-queued for AI evaluation.");
    setTimeout(() => setTxMessage(null), 4000);
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
        <div className="banner banner-info" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <Sparkles size={20} style={{ color: 'var(--accent-cyan)' }} />
          <span>{txMessage}</span>
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

          <div className="grid-2">
            {pools.map(pool => (
              <div key={pool.id} className="card pool-card">
                <div className="card-header">
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--accent-indigo)', fontWeight: '700' }}>
                      POOL #{pool.id}
                    </span>
                    <h3 className="card-title">{pool.coverage_type}</h3>
                  </div>
                  <span className="badge badge-resolved">Active</span>
                </div>

                <div className="pool-stats">
                  <div>
                    <div className="stat-label">Pool Fund Balance</div>
                    <div className="stat-value text-cyan">{pool.pool_balance} GEN</div>
                  </div>
                  <div>
                    <div className="stat-label">Max Payout / Claim</div>
                    <div className="stat-value">{pool.max_payout_per_claim} GEN</div>
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
            ))}
          </div>
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
                        {claim.claimed_amount} GEN
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
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Payout Executed: <strong style={{ color: claim.paid_out ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                        {claim.paid_out ? `${claim.payout_amount} GEN` : '0 GEN'}
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
        </div>
      )}

      {/* TAB 3: FILE CLAIM FORM */}
      {activeTab === 'submit' && (
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <FileText className="text-cyan" />
                Submit Insurance Claim
              </h2>
            </div>

            <form onSubmit={handleSubmitClaim}>
              <div className="form-group">
                <label className="form-label">Select Policy Pool *</label>
                <select 
                  className="form-select"
                  value={newClaim.pool_id}
                  onChange={e => setNewClaim({ ...newClaim, pool_id: e.target.value })}
                >
                  {pools.map(p => (
                    <option key={p.id} value={p.id}>
                      Pool #{p.id} — {p.coverage_type} (Balance: {p.pool_balance} GEN)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Claimed Amount (GEN) *</label>
                <input 
                  type="number"
                  placeholder="e.g. 800"
                  className="form-input"
                  value={newClaim.amount}
                  onChange={e => setNewClaim({ ...newClaim, amount: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Incident Description & Statement *</label>
                <textarea 
                  placeholder="Describe the incident clearly (e.g. Flight VN123 cancelled on Aug 8 due to weather warning...)"
                  className="form-textarea"
                  value={newClaim.description}
                  onChange={e => setNewClaim({ ...newClaim, description: e.target.value })}
                  required
                />
              </div>

              {/* Evidence URLs */}
              <div className="form-group">
                <label className="form-label">Claimant Evidence URLs (Receipts, Tickets, Reports - Min 1) *</label>
                {newClaim.evidence_urls.map((url, idx) => (
                  <input 
                    key={idx}
                    type="url"
                    placeholder="https://example.com/receipt.pdf"
                    className="form-input"
                    style={{ marginBottom: '8px' }}
                    value={url}
                    onChange={e => handleUrlChange(newClaim, setNewClaim, 'evidence_urls', idx, e.target.value)}
                    required={idx === 0}
                  />
                ))}
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => addUrlField(newClaim, setNewClaim, 'evidence_urls')}
                >
                  + Add Evidence URL
                </button>
              </div>

              {/* Reference Verification URLs */}
              <div className="form-group">
                <label className="form-label">
                  Independent Reference Verification URLs (Min 2 Required) *
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-subtle)' }}>
                    Public flight status, weather reports, official hospital registry, public news feeds
                  </span>
                </label>
                {newClaim.reference_urls.map((url, idx) => (
                  <input 
                    key={idx}
                    type="url"
                    placeholder={idx === 0 ? "https://flightstats.com/status/123" : "https://weather.gov/report/123"}
                    className="form-input"
                    style={{ marginBottom: '8px' }}
                    value={url}
                    onChange={e => handleUrlChange(newClaim, setNewClaim, 'reference_urls', idx, e.target.value)}
                    required={idx < 2}
                  />
                ))}
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => addUrlField(newClaim, setNewClaim, 'reference_urls')}
                >
                  + Add Reference Verification URL
                </button>
              </div>

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
                    type="number" 
                    placeholder="Enter custom max payout per claim" 
                    className="form-input"
                    value={newPool.max_payout}
                    onChange={e => setNewPool({ ...newPool, max_payout: e.target.value })}
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
                    type="number" 
                    placeholder="Enter initial pool deposit amount" 
                    className="form-input"
                    value={initialDepositAmount}
                    onChange={e => setInitialDepositAmount(e.target.value)}
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

                {/* Free Notice Banner */}
                <div className="notice-banner-free">
                  <span style={{ fontSize: '20px' }}>💰</span>
                  <div>
                    <strong>Free Policy Pool Creation</strong>
                    <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                      You only pay standard GenLayer network gas fees when signing the transaction. No platform fees or hidden cuts.
                    </div>
                  </div>
                </div>

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
              <h3>Fund Pool #{selectedPoolForDeposit.id}</h3>
              <button className="btn btn-secondary" onClick={() => setShowDepositModal(false)}>✕</button>
            </div>
            <form onSubmit={handleDepositSubmit}>
              <div className="form-group">
                <label className="form-label">Deposit Native GEN Amount *</label>
                <input 
                  type="number" 
                  placeholder="5000" 
                  className="form-input"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  required
                />
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                GEN will be deposited directly into the <strong>Treasury Intelligent Contract</strong> for this pool.
              </p>

              <button type="submit" className="btn btn-cyan" style={{ width: '100%' }}>
                Deposit GEN to Treasury
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
              <label className="form-label">Independent Reference Verification Sources:</label>
              {selectedClaimForDetail.reference_urls.map((u, i) => (
                <div key={i} style={{ fontSize: '13px', wordBreak: 'break-all', marginBottom: '4px' }}>
                  🌐 <a href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-indigo)' }}>{u}</a>
                </div>
              ))}
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
              <div className="form-group">
                <label className="form-label">Additional Evidence URLs</label>
                {additionalEvidence.map((u, idx) => (
                  <input 
                    key={idx}
                    type="url"
                    placeholder="https://example.com/medical_report_signed.pdf"
                    className="form-input"
                    style={{ marginBottom: '8px' }}
                    value={u}
                    onChange={e => {
                      const updated = [...additionalEvidence];
                      updated[idx] = e.target.value;
                      setAdditionalEvidence(updated);
                    }}
                  />
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Additional Independent Verification URLs</label>
                {additionalReference.map((u, idx) => (
                  <input 
                    key={idx}
                    type="url"
                    placeholder="https://hospital-registry.org/verify/doc_991"
                    className="form-input"
                    style={{ marginBottom: '8px' }}
                    value={u}
                    onChange={e => {
                      const updated = [...additionalReference];
                      updated[idx] = e.target.value;
                      setAdditionalReference(updated);
                    }}
                  />
                ))}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Re-submit Claim for AI Assessment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
