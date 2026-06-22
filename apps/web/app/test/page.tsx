'use client'

import { useState } from "react";
import Link from "next/link";
import { useAccount, useWriteContract, useSignMessage, useSwitchChain } from 'wagmi';
import { parseUnits, keccak256, encodePacked, stringToHex } from 'viem';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowLeft, Coins, CheckCircle, Ticket } from "lucide-react";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { NexusAbi } from "@/lib/abis/NexusAbi";

const MOCK_TOKEN = "0xfaEc345B6d0F96a32330d7DdFe0eAE51dF46cbf1";
const NEXUS_CONTRACT = "0xe3791566EB7A029990D100ACfE477a9985948E8E";
const CHAIN_ID = 16602;

export default function TestDashboard() {
  const { address, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  
  const [mintStatus, setMintStatus] = useState("");
  const [claimStatus, setClaimStatus] = useState("");
  const [campaignId, setCampaignId] = useState("");

  const handleMint = async () => {
    if (!address) {
      toast.error("Connect wallet first!");
      return;
    }
    setMintStatus("Minting...");
    try {
      if (chainId !== CHAIN_ID) {
        setMintStatus("Switching network to 0G Newton Testnet...");
        await switchChainAsync({ chainId: CHAIN_ID });
      }

      const tx = await writeContractAsync({
        address: MOCK_TOKEN,
        abi: ERC20Abi,
        functionName: 'mint',
        args: [address, parseUnits("1000", 18)],
        chainId: CHAIN_ID,
      });
      setMintStatus(`Success! TX: ${tx}`);
    } catch (e: any) {
      setMintStatus(`Error: ${e.message}`);
    }
  };

  const handleImportToken = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      toast.error("MetaMask or compatible wallet is not installed.");
      return;
    }
    try {
      await (window as any).ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: MOCK_TOKEN,
            symbol: 'mA0GI',
            decimals: 18,
            image: 'https://scan-testnet.0g.ai/images/logo.png',
          },
        },
      });
    } catch (e: any) {
      toast.error(`Error importing token: ${e.message}`);
    }
  };

  const handleClaim = async () => {
    if (!address) {
      toast.error("Connect wallet first!");
      return;
    }
    if (!campaignId) {
      toast.error("Enter Campaign ID!");
      return;
    }
    
    setClaimStatus("Generating Signature...");
    try {
      // 1. Generate random Ticket ID
      const randomString = Math.random().toString(36).substring(7);
      const ticketId = stringToHex(randomString, { size: 32 });

      // 2. Create Message Hash mimicking Solidity
      const messageHash = keccak256(
        encodePacked(
          ['uint256', 'address', 'bytes32', 'address', 'uint256'],
          [BigInt(campaignId), address, ticketId, NEXUS_CONTRACT, BigInt(CHAIN_ID)]
        )
      );

      if (chainId !== CHAIN_ID) {
        setClaimStatus("Switching network to 0G Newton Testnet...");
        await switchChainAsync({ chainId: CHAIN_ID });
      }

      // 3. Sign it with connected wallet (we assume creator is validator for this test)
      const signature = await signMessageAsync({
        message: { raw: messageHash }
      });

      setClaimStatus("Signature ready. Submitting to Nexus...");

      // 4. Claim Reward
      const tx = await writeContractAsync({
        address: NEXUS_CONTRACT,
        abi: NexusAbi,
        functionName: 'claimReward',
        args: [BigInt(campaignId), ticketId, signature],
        chainId: CHAIN_ID,
      });

      setClaimStatus(`Success! Reward claimed. TX: ${tx}`);
    } catch (e: any) {
      setClaimStatus(`Error: ${e.message}`);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-violet-500/30 overflow-hidden font-sans pb-24">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
      
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group text-decoration-none">
            <ArrowLeft className="size-4 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
            <div className="font-heading text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              0g-nexus
            </div>
          </Link>
          <div className="text-sm font-medium text-zinc-400">TEST ENVIRONMENT</div>
        </div>
      </header>

      <main className="relative z-10 max-w-[800px] mx-auto px-6 pt-12">
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-zinc-100">Test Dashboard</h1>
          <p className="text-lg text-zinc-400 leading-relaxed font-light">
            Use this environment to mint mock tokens, verify your campaigns, and simulate reward claiming interactions.
          </p>
        </div>

        <div className="grid gap-8">
          <Card className="border border-white/5 bg-zinc-900/30 backdrop-blur-md shadow-xl rounded-2xl">
            <CardHeader className="border-b border-white/5 bg-zinc-900/10 px-6 py-5">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-cyan-400">
                <Coins className="size-4" /> 1. Token Faucet
              </CardTitle>
              <CardDescription className="text-zinc-400 mt-1">
                Mint Mock A0GI tokens to your connected wallet. Copy the Mock Token address below to use it when creating a campaign.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-4">
                <p className="text-sm text-zinc-300 font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800 break-all select-all">
                  {MOCK_TOKEN}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <Button onClick={handleMint} className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-xl h-11 px-8 transition-all">
                  Mint 1000 Mock Tokens
                </Button>
                <Button onClick={handleImportToken} variant="outline" className="border-zinc-800 text-zinc-300 hover:text-white rounded-xl h-11 px-6 transition-all">
                  Add to MetaMask
                </Button>
              </div>
              {mintStatus && <p className="mt-4 text-sm text-zinc-400 font-mono break-all">{mintStatus}</p>}
            </CardContent>
          </Card>

          <Card className="border border-white/5 bg-zinc-900/30 backdrop-blur-md shadow-xl rounded-2xl">
            <CardHeader className="border-b border-white/5 bg-zinc-900/10 px-6 py-5">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-violet-400">
                <CheckCircle className="size-4" /> 2. Simulate Claim Workflow
              </CardTitle>
              <CardDescription className="text-zinc-400 mt-1">
                Test the Validator Agent flow. Enter a Campaign ID, sign the ticket hash with your wallet (acting as Validator), and submit the claim.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="campaign-id" className="text-zinc-300 font-medium">Campaign ID</Label>
                <Input 
                  id="campaign-id"
                  type="number"
                  placeholder="e.g. 0"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 h-11"
                />
              </div>
              <div>
                <Button onClick={handleClaim} className="bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-xl h-11 px-8 transition-all">
                  Sign Ticket & Claim Reward
                </Button>
                {claimStatus && <p className="mt-4 text-sm text-zinc-400 font-mono break-all">{claimStatus}</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
