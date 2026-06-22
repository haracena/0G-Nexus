import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const zeroGNewton = {
  id: 16602,
  name: '0G Newton Testnet',
  nativeCurrency: { name: 'A0GI', symbol: 'A0GI', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Explorer', url: 'https://scan-testnet.0g.ai' },
  },
} as const;

export const config = createConfig({
  chains: [zeroGNewton],
  connectors: [
    injected(),
  ],
  transports: {
    [zeroGNewton.id]: http(),
  },
})
