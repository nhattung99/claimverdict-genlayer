import { createClient } from 'genlayer-js';
import { toHex, toRlp } from 'viem';

export const studionet = {
  id: 61999,
  name: 'GenLayer Studionet',
  rpcUrl: 'https://studio.genlayer.com/api',
  nativeCurrency: {
    name: 'GenLayer Token',
    symbol: 'GEN',
    decimals: 18
  }
};

export const CONTRACT_ADDRESS = '0x030838e6829f5fA3CEEf6989c1dd78d2c626BAe3';

export const getGenlayerClient = () => {
  try {
    return createClient({
      chain: studionet,
      endpoint: 'https://studio.genlayer.com/api'
    });
  } catch (err) {
    console.warn("GenLayer client initialization fallback:", err);
    return null;
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

// Execute Write Transaction on GenLayer Contract via MetaMask or Client
export const sendContractTransaction = async ({ from, to = CONTRACT_ADDRESS, functionName, args = [], value = '0x0' }) => {
  await switchToGenlayerStudionet();
  const calldata = encodeGenLayerCalldata(functionName, args);

  if (window.ethereum) {
    const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const sender = from || accs[0];
    
    // Send actual contract write transaction via MetaMask
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: sender,
        to,
        data: calldata,
        value: typeof value === 'bigint' ? '0x' + value.toString(16) : value
      }]
    });
    return txHash;
  } else {
    const client = getGenlayerClient();
    if (!client) throw new Error("GenLayer client unavailable");
    return await client.readContract({
      address: to,
      functionName,
      args
    });
  }
};
