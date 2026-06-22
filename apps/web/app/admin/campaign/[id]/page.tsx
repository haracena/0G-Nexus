"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useReadContract, useReadContracts, useDisconnect } from "wagmi";
import { formatUnits } from "viem";
import { NexusAbi } from "@/lib/abis/NexusAbi";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { Button } from "@/components/ui/button";
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
  LineChart,
  Wallet
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

const NEXUS_CONTRACT = "0xe3791566EB7A029990D100ACfE477a9985948E8E" as const;
const INDEXER_URL = "http://localhost:42069";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ClaimRecord {
  id: string;
  claimant: string;
  amount: string; // it's stored as BigInt but returned as string in GraphQL
  ticketId: string;
}

export default function CampaignStatsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignIdStr = params.id as string;
  const campaignId = Number(campaignIdStr);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // 1. Fetch Campaign Data
  const { data: campaignRaw, isLoading: isLoadingCampaign } = useReadContract({
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
      startTime: r[7],
      endTime: r[8],
      maxClaims: r[9],
      claimCount: r[10],
      isActive: r[11],
    };
  }, [campaignRaw]);

  // Authorization Check
  const isAuthorized = isConnected && campaign && campaign.creator.toLowerCase() === address?.toLowerCase();

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
    query: { enabled: !!campaign?.token && !!isAuthorized },
  });

  const symbol = tokensRaw?.[0]?.result as string || "TOKEN";
  const decimalsRaw = tokensRaw?.[1]?.result;
  const decimals = typeof decimalsRaw === "number" ? decimalsRaw : typeof decimalsRaw === "bigint" ? Number(decimalsRaw) : 18;

  // 3. Fetch Metadata
  const [metadata, setMetadata] = useState<{ title: string; description?: string } | null>(null);

  useEffect(() => {
    if (!campaign?.metadataUri || !isAuthorized) return;
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
  }, [campaign?.metadataUri, isAuthorized]);

  // 4. Fetch Claims from Ponder GraphQL
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);

  useEffect(() => {
    if (!isAuthorized) return;

    const fetchClaims = async () => {
      setIsLoadingClaims(true);
      try {
        const res = await fetch(`${INDEXER_URL}/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query GetClaims($campaignId: String!) {
                rewardClaims(where: { campaignId: $campaignId }, orderBy: "id", orderDirection: "desc") {
                  items {
                    id
                    claimant
                    amount
                    ticketId
                  }
                }
              }
            `,
            variables: { campaignId: campaignIdStr }
          })
        });
        
        const data = await res.json();
        
        // Ponder wraps collections in `items`
        if (data?.data?.rewardClaims?.items) {
          setClaims(data.data.rewardClaims.items);
        }
      } catch (err) {
        console.error("Failed to fetch claims from indexer:", err);
      } finally {
        setIsLoadingClaims(false);
      }
    };

    fetchClaims();
    // Poll every 10 seconds for new claims
    const interval = setInterval(fetchClaims, 10000);
    return () => clearInterval(interval);
  }, [isAuthorized, campaignIdStr]);

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
      hour: "numeric",
      minute: "2-digit"
    });
  };

  // Render logic
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
        <Button onClick={() => router.push("/admin")} variant="outline" className="mt-6">
          Back to Admin Panel
        </Button>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <ShieldAlert className="size-12 text-orange-500 mb-4" />
        <h2 className="text-2xl font-bold">Unauthorized Access</h2>
        <p className="text-zinc-400 mt-2 max-w-md text-center">
          You are not the creator of Campaign #{campaignId}. Connect the correct wallet to view these stats.
        </p>
        <Button onClick={() => router.push("/admin")} variant="outline" className="mt-6">
          Back to Admin Panel
        </Button>
      </div>
    );
  }

  // Derived metrics
  const totalNum = Number(formatUnits(campaign.totalReward, decimals));
  const remainingNum = Number(formatUnits(campaign.remainingReward, decimals));
  const distributedNum = totalNum - remainingNum;
  const progressPct = totalNum > 0 ? (distributedNum / totalNum) * 100 : 0;
  
  const now = Math.floor(Date.now() / 1000);
  const started = now >= Number(campaign.startTime);
  const ended = campaign.endTime > 0n && now > Number(campaign.endTime);
  const depleted = campaign.remainingReward < campaign.rewardPerAction;

  let statusLabel = "Active";
  let statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (!campaign.isActive || depleted) {
    statusLabel = "Depleted";
    statusColor = "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
  } else if (ended) {
    statusLabel = "Ended";
    statusColor = "text-orange-400 bg-orange-500/10 border-orange-500/20";
  } else if (!started) {
    statusLabel = "Upcoming";
    statusColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
  }

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-violet-500/30 overflow-hidden font-sans pb-24">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2 group text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="size-4" />
              <span className="text-sm font-medium">Back to Admin</span>
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <div className="text-sm font-semibold flex items-center gap-2">
              <span className="text-zinc-500">Campaign #{campaignId}</span>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/campaigns"
              className="text-sm text-zinc-400 hover:text-white transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800/50"
            >
              Campaign Hub
            </Link>
            <Link
              href="/leaderboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800/50"
            >
              Leaderboard
            </Link>
            {isConnected && (
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 font-mono text-sm bg-zinc-900 px-3 py-1 rounded-full border border-white/5">
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnect()}
                  className="border-zinc-800 text-zinc-300 hover:text-white"
                >
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 pt-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Metrics & Info */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Title Card */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md shadow-xl">
              <h1 className="text-3xl font-black tracking-tight mb-2 text-white">
                {metadata?.title || `Campaign #${campaignId}`}
              </h1>
              {metadata?.description ? (
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                  {metadata.description}
                </p>
              ) : (
                <p className="text-zinc-500 text-sm italic mb-6">No description provided.</p>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Reward Token</span>
                  <span className="text-sm font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">{symbol}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Reward / Action</span>
                  <span className="text-sm font-bold text-white">{fmtAmount(campaign.rewardPerAction)} {symbol}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Start Time</span>
                  <span className="text-sm text-zinc-300 flex items-center gap-1.5"><Calendar className="size-3" /> {fmtDate(campaign.startTime)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">End Time</span>
                  <span className="text-sm text-zinc-300 flex items-center gap-1.5"><Calendar className="size-3" /> {fmtDate(campaign.endTime)}</span>
                </div>
              </div>
            </div>

            {/* Progress Card */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="size-4 text-emerald-400" />
                <h3 className="font-bold text-white">Budget Consumption</h3>
              </div>
              
              <div className="flex justify-between text-xs text-zinc-400 mb-2">
                <span>Distributed: <strong className="text-emerald-400">{fmtAmount(campaign.totalReward - campaign.remainingReward)}</strong></span>
                <span>Remaining: <strong className="text-zinc-300">{fmtAmount(campaign.remainingReward)}</strong></span>
              </div>
              
              <div className="h-3 w-full rounded-full bg-zinc-950 border border-white/5 overflow-hidden mb-3 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-1000 relative"
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-pulse" />
                </div>
              </div>
              
              <div className="flex justify-between items-end">
                <span className="text-3xl font-black text-white">{progressPct.toFixed(1)}%</span>
                <span className="text-xs text-zinc-500 mb-1 uppercase tracking-wider font-semibold">of {fmtAmount(campaign.totalReward)} {symbol}</span>
              </div>
            </div>

            {/* Claims Stats Card */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Users className="size-4 text-violet-400" />
                <h3 className="font-bold text-white">Claims Overview</h3>
              </div>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black text-white">{campaign.claimCount}</span>
                <span className="text-sm text-zinc-500 mb-1 font-semibold uppercase tracking-wider">
                  / {campaign.maxClaims === 0 ? "∞" : campaign.maxClaims} Claims Limit
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: Claims Table */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl flex flex-col h-full min-h-[600px]">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-400" />
                  <h2 className="text-xl font-bold text-white">Recent Claims</h2>
                </div>
                {isLoadingClaims && <Loader2 className="size-4 text-zinc-500 animate-spin" />}
              </div>
              
              {/* Chart Section */}
              {claims.length > 0 && (
                <div className="px-6 py-4 border-b border-white/5 bg-zinc-950/20">
                  <div className="flex items-center gap-2 mb-4">
                    <LineChart className="size-4 text-violet-400" />
                    <h3 className="font-bold text-sm text-zinc-300">Claims Timeline (Sequence)</h3>
                  </div>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={[...claims].reverse().map((c, i) => ({
                          name: `Claim ${i + 1}`,
                          amount: Number(formatUnits(BigInt(c.amount), decimals)),
                        }))}
                        margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="rgba(255,255,255,0.2)" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="rgba(255,255,255,0.2)" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(9, 9, 11, 0.8)', 
                            backdropFilter: 'blur(8px)',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '12px'
                          }}
                          itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
                          formatter={(value: any) => [`${value} ${symbol}`, 'Rewarded']}
                          labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="amount" 
                          stroke="#8b5cf6" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorAmount)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-auto">
                {claims.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-center text-zinc-500">
                    <Zap className="size-8 text-zinc-700 mb-3" />
                    <p className="font-medium">No claims recorded yet.</p>
                    <p className="text-xs mt-1">Once users start verifying actions, their claims will appear here.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 uppercase tracking-wider bg-zinc-950/50 sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Claimant Wallet</th>
                        <th className="px-6 py-4 font-semibold text-right">Amount Rewarded</th>
                        <th className="px-6 py-4 font-semibold">Ticket ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {claims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-mono text-zinc-300">
                            {claim.claimant}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-emerald-400">{fmtAmount(claim.amount)}</span>
                            <span className="text-xs text-zinc-500 ml-1">{symbol}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-zinc-500 font-mono text-xs">
                              {claim.ticketId.slice(0, 10)}...{claim.ticketId.slice(-8)}
                              <a 
                                href={`https://chainscan-newton.0g.ai/tx/${claim.id.split('-')[0]}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-violet-400 hover:text-violet-300"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
