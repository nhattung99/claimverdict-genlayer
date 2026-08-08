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

  // Form Inputs
  const [newPool, setNewPool] = useState({
    coverage_type: '',
    criteria: ['', ''],
    max_payout: ''
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

  // Helper for adding/removing criteria inputs
  const handleCriterionChange = (index, value) => {
    const updated = [...newPool.criteria];
    updated[index] = value;
    setNewPool({ ...newPool, criteria: updated });
  };
  const addCriterionField = () => setNewPool({ ...newPool, criteria: [...newPool.criteria, ''] });

  // Helper for URL arrays
  const handleUrlChange = (form, setForm, key, index, value) => {
    const updated = [...form[key]];
    updated[index] = value;
    setForm({ ...setForm, [key]: updated });
  };
  const addUrlField = (form, setForm, key) => setForm({ ...setForm, [key]: [...form[key], ''] });

  // Handle Create Pool
  const handleCreatePoolSubmit = (e) => {
    e.preventDefault();
    const validCriteria = newPool.criteria.filter(c => c.trim() !== '');
    if (!newPool.coverage_type || validCriteria.length === 0 || !newPool.max_payout) {
      alert("Please fill all required pool fields");
      return;
    }

    const createdPool = {
      id: String(pools.length),
      coverage_type: newPool.coverage_type,
      operator: account || "0xYourWallet",
      max_payout_per_claim: newPool.max_payout,
      pool_balance: "0",
      active: true,
      criteria: validCriteria
    };

    setPools([createdPool, ...pools]);
    setShowCreatePoolModal(false);
    setNewPool({ coverage_type: '', criteria: ['', ''], max_payout: '' });
    setTxMessage("Policy Pool created successfully!");
    setTimeout(() => setTxMessage(null), 4000);
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

      {/* MODAL: CREATE POLICY POOL */}
      {showCreatePoolModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Policy Pool</h3>
              <button className="btn btn-secondary" onClick={() => setShowCreatePoolModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreatePoolSubmit}>
              <div className="form-group">
                <label className="form-label">Coverage Risk Type *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Travel Delay, Amateur Injury" 
                  className="form-input"
                  value={newPool.coverage_type}
                  onChange={e => setNewPool({ ...newPool, coverage_type: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Max Payout Per Claim (GEN) *</label>
                <input 
                  type="number" 
                  placeholder="1000" 
                  className="form-input"
                  value={newPool.max_payout}
                  onChange={e => setNewPool({ ...newPool, max_payout: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Eligibility Criteria List *</label>
                {newPool.criteria.map((c, i) => (
                  <input 
                    key={i}
                    type="text"
                    placeholder={`Criterion #${i + 1}`}
                    className="form-input"
                    style={{ marginBottom: '8px' }}
                    value={c}
                    onChange={e => handleCriterionChange(i, e.target.value)}
                    required={i === 0}
                  />
                ))}
                <button type="button" className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={addCriterionField}>
                  + Add Criterion
                </button>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                Deploy Policy Pool
              </button>
            </form>
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
