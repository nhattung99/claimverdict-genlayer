import { createClient } from 'genlayer-js';

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
    // Try switching to GenLayer Studionet (Chain ID 61999 = 0xF22F)
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xF22F' }]
    });
  } catch (switchError) {
    // Error code 4902 means the chain has not been added to MetaMask yet
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
