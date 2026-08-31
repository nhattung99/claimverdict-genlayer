import { createClient } from 'genlayer-js';
import { studionet as officialStudionet } from 'genlayer-js/chains';
import { ExecutionResult, TransactionStatus } from 'genlayer-js/types';
import { toHex, toRlp } from 'viem';

export const studionet = officialStudionet || {
  id: 61999,
  name: 'GenLayer Studionet',
  rpcUrl: 'https://studio.genlayer.com/api',
  nativeCurrency: {
    name: 'GenLayer Token',
    symbol: 'GEN',
    decimals: 18
  }
};

export const CONTRACT_ADDRESS = '0x4cdF0B6F0E3A1198F15a76e5391FB07b67E041f1';

const toAddress = (account) => {
  if (!account) return '';
  if (typeof account === 'string') return account;
  return account.address || '';
};

// MetaMask routing in genlayer-js only fires when client.account is a hex string
// (typeof !== "object"). writeContract encoding needs { address } or _sender is undefined.
const toWriteAccount = (account) => {
  const address = toAddress(account);
  if (!address) return null;
  return { address };
};

export const getGenlayerClient = (account) => {
  try {
    const cfg = {
      chain: officialStudionet || studionet
    };
    const address = toAddress(account);
    if (address) cfg.account = address;
    if (typeof window !== 'undefined' && window.ethereum) {
      cfg.provider = window.ethereum;
    }
    return createClient(cfg);
  } catch (err) {
    console.warn("GenLayer client initialization fallback:", err);
    return null;
  }
};

const asPlain = (val) => {
  if (val instanceof Map) {
    const obj = {};
    for (const [k, v] of val.entries()) obj[String(k)] = asPlain(v);
    return obj;
  }
  if (Array.isArray(val)) return val.map(asPlain);
  return val;
};

export const formatWriteError = (err) => {
  const msg = String(err?.shortMessage || err?.details || err?.message || err || '');
  const low = msg.toLowerCase();
  if (low.includes('user rejected') || low.includes('user denied') || low.includes('rejected the request')) {
    return 'Transaction cancelled in MetaMask.';
  }
  if (low.includes('insufficient') || low.includes('funds')) {
    return 'Not enough GEN for the deposit plus gas. Use 0 GEN initial deposit, then fund the pool later.';
  }
  if (low.includes('invalid address') || (low.includes('undefined') && low.includes('address'))) {
    return 'Wallet address was not attached. Reconnect MetaMask on GenLayer Studionet and retry.';
  }
  return msg || 'Write transaction failed.';
};

const toValueBigInt = (value) => {
  if (typeof value === 'bigint') return value < 0n ? 0n : value;
  if (typeof value === 'number') return 0n;
  const raw = String(value || '0x0').trim();
  if (raw === '' || raw === '0x' || raw === '0x0') return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
};

const isHexStub = (val) => typeof val === 'string' && /^0x[0-9a-fA-F]+$/.test(val);

// Base-Unit (Wei) Converter Helpers: 1 GEN = 10^18 base units (wei)
const WEI_PER_GEN = 1000000000000000000n; // 10^18

export const parseGenToWei = (genAmountStr) => {
  if (!genAmountStr) return 0n;
  const str = String(genAmountStr).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) return 0n;

  const [intPart, fracPartRaw = ""] = str.split(".");
  const fracPart = (fracPartRaw + "0".repeat(18)).slice(0, 18);
  const weiStr = intPart + fracPart;
  const wei = BigInt(weiStr);
  return wei > 0n ? wei : 0n;
};

export const formatWeiToGen = (val) => {
  if (val === null || val === undefined || val === '') return '0';
  if (typeof val === 'number') return '0';
  let wei;
  try {
    wei = BigInt(val);
  } catch (err) {
    return '0';
  }
  if (wei === 0n) return '0';

  const intPart = wei / WEI_PER_GEN;
  const fracPart = wei % WEI_PER_GEN;

  if (fracPart === 0n) return intPart.toString();

  let fracStr = fracPart.toString().padStart(18, "0").replace(/0+$/, "");
  return fracStr.length > 0 ? `${intPart.toString()}.${fracStr}` : intPart.toString();
};

// Keep user GEN input as a decimal string. Never coerce through IEEE-754 numbers.
export const sanitizeGenInput = (raw) => {
  const str = String(raw ?? '');
  let out = '';
  let seenDot = false;
  let fracCount = 0;
  for (const ch of str) {
    if (ch >= '0' && ch <= '9') {
      if (seenDot) {
        if (fracCount >= 18) continue;
        fracCount += 1;
      }
      out += ch;
    } else if (ch === '.' && !seenDot) {
      seenDot = true;
      out += ch;
    }
  }
  return out;
};

// Contract money fields must stay integer strings (wei). JS Number cannot hold 10^18 values.
export const toWeiString = (val) => {
  if (val === null || val === undefined || val === '') return '0';
  if (typeof val === 'bigint') return val.toString();
  if (typeof val === 'number') return '0';
  const str = String(val).trim();
  if (!/^\d+$/.test(str)) return '0';
  return str;
};

// AI scores are 0-100 integers, not money. Safe to expose as a JS number in that range only.
export const toPercentInt = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  try {
    const asInt = typeof val === 'bigint' ? val : BigInt(String(val).split('.')[0] || '0');
    if (asInt < 0n) return 0;
    if (asInt > 100n) return 100;
    return Number(asInt);
  } catch {
    return 0;
  }
};

export const switchToGenlayerStudionet = async () => {
  if (typeof window === 'undefined' || !window.ethereum) return;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xF22F' }]
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xF22F',
            chainName: 'GenLayer Studionet',
            nativeCurrency: {
              name: 'GenLayer Token',
              symbol: 'GEN',
              decimals: 18
            },
            rpcUrls: ['https://studio.genlayer.com/api'],
            blockExplorerUrls: ['https://genlayer-explorer.vercel.app']
          }]
        });
      } catch (addError) {
        console.warn("Could not add GenLayer Studionet network to MetaMask:", addError);
      }
    }
  }
};

// GenLayer Contract Calldata Encoder
export const encodeGenLayerCalldata = (method, args = []) => {
  const BITS = 3, T_SPECIAL = 0, T_PINT = 1, T_NINT = 2, T_STR = 4, T_ARR = 5, T_MAP = 6;
  const SPECIAL_NULL = 0, SPECIAL_FALSE = 1 << BITS, SPECIAL_TRUE = 2 << BITS;

  function writeNum(to, n) {
    if (n === 0n) { to.push(0); return; }
    while (n > 0) {
      let cur = Number(n & 0x7fn); n >>= 7n;
      if (n > 0) cur |= 128;
      to.push(cur);
    }
  }
  function encodeNumWithType(to, n, type) { writeNum(to, (n << BigInt(BITS)) | BigInt(type)); }
  function encodeImpl(to, data) {
    if (data === null || data === undefined) { to.push(SPECIAL_NULL); return; }
    if (data === true) { to.push(SPECIAL_TRUE); return; }
    if (data === false) { to.push(SPECIAL_FALSE); return; }
    if (typeof data === 'number' || typeof data === 'bigint') {
      const n = BigInt(data);
      encodeNumWithType(to, n >= 0n ? n : -n - 1n, n >= 0n ? T_PINT : T_NINT);
      return;
    }
    if (typeof data === 'string') {
      const str = new TextEncoder().encode(data);
      encodeNumWithType(to, BigInt(str.length), T_STR);
      for (const c of str) to.push(c);
      return;
    }
    if (Array.isArray(data)) {
      encodeNumWithType(to, BigInt(data.length), T_ARR);
      for (const c of data) encodeImpl(to, c);
      return;
    }
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      const entries = keys.map(k => [new TextEncoder().encode(k), data[k]]);
      entries.sort((a, b) => {
        for (let i = 0; i < a[0].length && i < b[0].length; i++) {
          const diff = a[0][i] - b[0][i];
          if (diff !== 0) return diff;
        }
        return a[0].length - b[0].length;
      });
      encodeNumWithType(to, BigInt(entries.length), T_MAP);
      for (const [k, v] of entries) {
        writeNum(to, BigInt(k.length));
        for (const c of k) to.push(c);
        encodeImpl(to, v);
      }
      return;
    }
  }

  const arr = [];
  encodeImpl(arr, { method, args });
  return toRlp([toHex(new Uint8Array(arr))]);
};

const STUDIO_RPC = 'https://studio.genlayer.com/api';

const studioRpc = async (method, params = []) => {
  const res = await fetch(STUDIO_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  }).then((r) => r.json());
  if (res?.error) throw new Error(res.error.message || JSON.stringify(res.error));
  return res?.result;
};

const waitForStudioEvmReceipt = async (txHash, maxRetries = 24, intervalMs = 2000) => {
  for (let i = 0; i < maxRetries; i++) {
    const receipt = await studioRpc('eth_getTransactionReceipt', [txHash]).catch(() => null);
    if (receipt) {
      const status = receipt.status;
      if (status === '0x0' || status === 0 || status === '0') {
        throw new Error('Studionet transaction reverted. Contract state was not changed.');
      }
      await new Promise((r) => setTimeout(r, 1500));
      return receipt;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for Studionet receipt ${txHash}.`);
};

// Execute Write Transaction on GenLayer via genlayer-js + MetaMask
export const sendContractTransaction = async ({ from, to = CONTRACT_ADDRESS, functionName, args = [], value = '0x0' }) => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error("Signed Web3 Wallet Required: Please connect MetaMask to execute write transactions on GenLayer.");
  }

  const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const sender = toAddress(from) || (accs && accs[0]);
  if (!sender) {
    throw new Error("No connected wallet account found. Please connect MetaMask to execute write actions.");
  }

  // Do not call client.connect('studionet'): it requests a MetaMask Snap and blocks regular wallets.
  await switchToGenlayerStudionet();

  const client = getGenlayerClient(sender);
  if (!client || !client.writeContract) {
    throw new Error("GenLayer write client is not available.");
  }

  const writeAccount = toWriteAccount(sender);
  try {
    return await client.writeContract({
      account: writeAccount,
      address: to,
      functionName,
      args,
      value: toValueBigInt(value)
    });
  } catch (err) {
    throw new Error(formatWriteError(err));
  }
};

// On Studionet, writeContract returns the EVM hash. Consensus status polling does not map that hash.
export const waitForFinalizedTx = async (txHash, maxRetries = 24, intervalMs = 2000) => {
  if (!txHash) {
    throw new Error("Missing transaction hash.");
  }

  try {
    return await waitForStudioEvmReceipt(txHash, maxRetries, intervalMs);
  } catch (studioErr) {
    const studioMsg = String(studioErr?.message || '').toLowerCase();
    if (studioMsg.includes('reverted')) throw studioErr;
    const client = getGenlayerClient();
    if (!client || !client.waitForTransactionReceipt) {
      throw studioErr;
    }
    try {
      const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.ACCEPTED,
        retries: Math.min(maxRetries, 12),
        interval: intervalMs
      });
      const execName = receipt?.txExecutionResultName || receipt?.executionResult || receipt?.txExecutionResult;
      if (execName === ExecutionResult.FINISHED_WITH_ERROR) {
        const detail = receipt?.txExecutionError || receipt?.stderr || receipt?.verdict_reason || '';
        throw new Error("Contract execution failed. State was not changed. " + String(detail));
      }
      return receipt;
    } catch {
      throw studioErr;
    }
  }
};

// Read Contract View Methods (`get_pool`, `get_claim`, `get_pool_balance`) using selected contract address
export const readContractState = async (functionName, args = [], targetAddress = CONTRACT_ADDRESS) => {
  const addr = targetAddress || CONTRACT_ADDRESS;
  try {
    const client = getGenlayerClient();
    if (client && client.readContract) {
      const result = await client.readContract({
        address: addr,
        functionName,
        args,
        stateStatus: 'accepted'
      });
      if (isHexStub(result)) return null;
      return asPlain(result);
    }
  } catch (err) {
    console.warn(`readContract ${functionName} note:`, err);
  }

  try {
    const calldata = encodeGenLayerCalldata(functionName, args);
    const res = await fetch('https://studio.genlayer.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: addr, data: calldata }, 'latest']
      })
    }).then(r => r.json());
    return res?.result;
  } catch (err) {
    console.warn("eth_call RPC error:", err);
    return null;
  }
};
