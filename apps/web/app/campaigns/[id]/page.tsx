"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits } from "viem";
import { NexusAbi } from "@/lib/abis/NexusAbi";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Users,
  Activity,
  Calendar,
  Zap,
  CheckCircle2,
  ExternalLink,
  Wallet,
} from "lucide-react";

const NEXUS_CONTRACT = "0x4730d6aDD549Cf6390B9BaAb664F1cED6d8d0182" as const;
const INDEXER_URL = "http://localhost:42069";

export default function PublicCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const campaignIdStr = params.id as string;
  const campaignId = Number(campaignIdStr);

  const { address } = useAccount();

  // 1. Fetch Campaign Data
  const { data: campaignRaw, isLoading: isLoadingCampaign, refetch: refetchCampaign } = useReadContract({
    address: NEXUS_CONTRACT,
    abi: NexusAbi,
    functionName: "campaigns",
    args: [BigInt(campaignId)],
  });

  const campaign = useMemo(() => {
    if (!campaignRaw) return null;
    const r = campaignRaw as readonly [
      `0x${string}`, // creator
      `0x${string}`, // token
      bigint,         // totalReward
      bigint,         // remainingReward
      bigint,         // rewardPerAction
      string,         // metadataUri
      `0x${string}`, // validator
      `0x${string}`, // targetContract
      bigint,         // startTime
      bigint,         // endTime
      number,         // maxClaims
      number,         // claimCount
      boolean,        // isActive
    ];
    return {
      creator: r[0],
      token: r[1],
      totalReward: r[2],
      remainingReward: r[3],
      rewardPerAction: r[4],
      metadataUri: r[5],
      validator: r[6],
      targetContract: r[7],
      startTime: r[8],
      endTime: r[9],
      maxClaims: r[10],
      claimCount: r[11],
      isActive: r[12],
    };
  }, [campaignRaw]);

  // 2. Fetch Token Data
  const tokenContracts = useMemo(() => {
    if (!campaign?.token) return [];
    return [
      { address: campaign.token, abi: ERC20Abi, functionName: "symbol" as const },
      { address: campaign.token, abi: ERC20Abi, functionName: "decimals" as const },
    ];
  }, [campaign?.token]);

  const { data: tokensRaw } = useReadContracts({
    contracts: tokenContracts,
    query: { enabled: !!campaign?.token },
  });

  const symbol = tokensRaw?.[0]?.result as string || "TOKEN";
  const decimalsRaw = tokensRaw?.[1]?.result;
  const decimals = typeof decimalsRaw === "number" ? decimalsRaw : typeof decimalsRaw === "bigint" ? Number(decimalsRaw) : 18;

  // 3. Fetch Metadata
  const [metadata, setMetadata] = useState<{ title: string; description?: string } | null>(null);

  useEffect(() => {
    if (!campaign?.metadataUri) return;
    const hash = campaign.metadataUri.replace("0g://", "");
    if (!hash) return;

    fetch(`/api/metadata/${hash}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.metadata) {
          setMetadata(data.metadata);
        }
      })
      .catch(err => console.error("Failed to fetch metadata:", err));
  }, [campaign?.metadataUri]);

  // 4. Claim Logic
  const [txHashInput, setTxHashInput] = useState("");
  const [claimStatus, setClaimStatus] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);

  const { writeContractAsync } = useWriteContract();

  const handleClaim = async () => {
    if (!address) {
      toast.error("Connect your wallet first!");
      return;
    }
    if (!txHashInput.startsWith("0x") || txHashInput.length !== 66) {
      toast.error("Enter a valid Transaction Hash (0x...)");
      return;
    }

    setIsClaiming(true);
    setClaimStatus("Verifying action with Validator...");

    try {
      // Step 1: Request signature from Ponder Indexer
      const res = await fetch(`${INDEXER_URL}/api/claim-ticket?campaignId=${campaignId}&userAddress=${address}&txHash=${txHashInput}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify action");
      }

      const { signature, ticketId } = data;
      setClaimStatus("Action verified! Submitting Claim to Nexus...");

      // Step 2: Submit to Nexus
      const tx = await writeContractAsync({
        address: NEXUS_CONTRACT,
        abi: NexusAbi,
        functionName: "claimReward",
        args: [BigInt(campaignId), ticketId, signature],
      });

      setClaimStatus(`Success! Reward claimed. TX: ${tx}`);
      toast.success("Reward claimed successfully!");
      refetchCampaign();
    } catch (error: any) {
      setClaimStatus(`Error: ${error.message}`);
      toast.error(error.message);
    } finally {
      setIsClaiming(false);
    }
  };


  // Formatting helpers
  const fmtAmount = (val: bigint | string) => {
    const bigVal = typeof val === "string" ? BigInt(val) : val;
    const n = Number(formatUnits(bigVal, decimals));
    return n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : n.toFixed(2);
  };

  const fmtDate = (ts: bigint) => {
    if (ts === 0n) return "No end date";
    return new Date(Number(ts) * 1000).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoadingCampaign) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="size-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <ShieldAlert className="size-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold">Campaign Not Found</h2>
        <p className="text-zinc-400 mt-2">Campaign #{campaignId} does not exist.</p>
        <Button onClick={() => router.push("/campaigns")} variant="outline" className="mt-6">
          Back to Explorer
        </Button>
      </div>
    );
  }

  const isDepleted = campaign.remainingReward < campaign.rewardPerAction;
  const isEnded = campaign.endTime > 0n && BigInt(Math.floor(Date.now() / 1000)) > campaign.endTime;
  const isUpcoming = campaign.startTime > 0n && BigInt(Math.floor(Date.now() / 1000)) < campaign.startTime;
  const canClaim = campaign.isActive && !isDepleted && !isEnded && !isUpcoming;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-violet-500/30">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/10 via-black to-black -z-10 pointer-events-none" />

      {/* Navbar Minimal */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/campaigns" className="p-2 hover:bg-white/5 rounded-full transition-colors group">
              <ArrowLeft className="size-5 text-zinc-400 group-hover:text-white transition-colors" />
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <h1 className="text-lg font-bold tracking-tight">Campaign Details</h1>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-mono text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-white/5">
              Campaign #{campaignId}
            </span>
            {!campaign.isActive ? (
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border text-red-400 bg-red-500/10 border-red-500/20">
                Cancelled
              </span>
            ) : isDepleted ? (
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border text-zinc-400 bg-zinc-500/10 border-zinc-500/20">
                Depleted
              </span>
            ) : isEnded ? (
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border text-orange-400 bg-orange-500/10 border-orange-500/20">
                Ended
              </span>
            ) : isUpcoming ? (
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border text-cyan-400 bg-cyan-500/10 border-cyan-500/20">
                Upcoming
              </span>
            ) : (
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                Active
              </span>
            )}
          </div>
          
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
            {metadata?.title || `Campaign #${campaignId}`}
          </h2>
          <p className="text-lg text-zinc-400 font-light leading-relaxed max-w-3xl">
            {metadata?.description || "No description available."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/30 flex flex-col gap-2">
                <span className="text-sm text-zinc-500 font-medium">Reward per action</span>
                <span className="text-3xl font-black text-white">
                  {fmtAmount(campaign.rewardPerAction)} <span className="text-violet-400 text-xl">{symbol}</span>
                </span>
              </div>
              <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/30 flex flex-col gap-2">
                <span className="text-sm text-zinc-500 font-medium">Remaining Pool</span>
                <span className="text-3xl font-black text-white">
                  {fmtAmount(campaign.remainingReward)} <span className="text-violet-400 text-xl">{symbol}</span>
                </span>
              </div>
            </div>

            {/* Claim Zone */}
            <div className="p-8 rounded-3xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-zinc-900/50 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-cyan-500" />
              <div className="flex items-center gap-3 mb-6">
                <Zap className="size-6 text-violet-400" />
                <h3 className="text-2xl font-bold text-white">Verify & Claim</h3>
              </div>
              
              {!canClaim ? (
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
                  <p className="text-zinc-400">This campaign is not currently active or claimable.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-zinc-300">
                    Did you complete the required action? Enter the Transaction Hash below to verify your action and claim your {symbol} reward.
                  </p>
                  <div className="space-y-3">
                    <Label className="text-zinc-400">Transaction Hash</Label>
                    <Input 
                      placeholder="0x..." 
                      value={txHashInput}
                      onChange={(e) => setTxHashInput(e.target.value)}
                      className="bg-black/50 border-white/10 h-12 text-lg font-mono text-white placeholder:text-zinc-600 focus-visible:ring-violet-500"
                    />
                  </div>
                  <Button 
                    onClick={handleClaim}
                    disabled={isClaiming || !txHashInput}
                    className="w-full h-14 text-lg font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all"
                  >
                    {isClaiming ? <Loader2 className="size-5 animate-spin mr-2" /> : null}
                    {isClaiming ? "Verifying..." : "Claim Reward"}
                  </Button>
                  
                  {claimStatus && (
                    <div className="mt-4 p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-sm text-zinc-300 break-all">
                      {claimStatus}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Stats */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold px-1 mb-4">Details</h3>
            
            <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/30 flex items-center justify-between">
              <div className="flex items-center gap-3 text-zinc-400">
                <Calendar className="size-4" />
                <span className="text-sm">Starts</span>
              </div>
              <span className="text-sm font-medium text-white">{fmtDate(campaign.startTime)}</span>
            </div>
            
            <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/30 flex items-center justify-between">
              <div className="flex items-center gap-3 text-zinc-400">
                <Calendar className="size-4" />
                <span className="text-sm">Ends</span>
              </div>
              <span className="text-sm font-medium text-white">{fmtDate(campaign.endTime)}</span>
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/30 flex items-center justify-between">
              <div className="flex items-center gap-3 text-zinc-400">
                <Users className="size-4" />
                <span className="text-sm">Claims</span>
              </div>
              <span className="text-sm font-medium text-white">
                {campaign.claimCount} / {campaign.maxClaims === 0 ? "∞" : campaign.maxClaims}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/30 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-zinc-400 mb-1">
                <Wallet className="size-4" />
                <span className="text-sm">Creator</span>
              </div>
              <span className="text-xs font-mono text-zinc-300 break-all bg-black/40 p-2 rounded-lg border border-white/5">
                {campaign.creator}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
