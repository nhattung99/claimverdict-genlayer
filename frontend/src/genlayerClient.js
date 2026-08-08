import { createClient } from 'genlayer-js';

export const studionet = {
  id: 61999,
  name: 'GenLayer Studionet',
  rpcUrl: 'https://studio.genlayer.com/api'
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
