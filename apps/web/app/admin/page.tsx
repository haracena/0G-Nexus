"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useReadContract, useReadContracts } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatUnits } from "viem";
import { NexusAbi } from "@/lib/abis/NexusAbi";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  ArrowLeft,
  Wallet,
  Zap,
  Clock,
  Users,
  TrendingUp,
  Trophy,
  ExternalLink,
  Loader2,
  LayoutDashboard,
  Plus,
  ShieldCheck,
  Activity
} from "lucide-react";

const NEXUS_CONTRACT = "0x4730d6aDD549Cf6390B9BaAb664F1cED6d8d0182" as const;

// ─── Types ───────────────────────────────────────────────────────────────────
interface CampaignData {
  id: number;
  creator: `0x${string}`;
  token: `0x${string}`;
  totalReward: bigint;
  remainingReward: bigint;
  rewardPerAction: bigint;
  metadataUri: string;
  validator: `0x${string}`;
  targetContract: `0x${string}`;
  startTime: bigint;
  endTime: bigint;
  maxClaims: number;
  claimCount: number;
  isActive: boolean;
}

interface CampaignResolvedData extends CampaignData {
  symbol: string;
  decimals: number;
  title: string;
  description: string;
  status: string;
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/30 backdrop-blur-md p-6 animate-pulse flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="h-5 w-20 bg-zinc-800 rounded-full" />
        <div className="h-5 w-16 bg-zinc-800 rounded-full" />
      </div>
      <div className="h-6 w-3/4 bg-zinc-800 rounded-lg" />
      <div className="h-2 w-full bg-zinc-800 rounded-full" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 bg-zinc-800 rounded-xl" />
        <div className="h-14 bg-zinc-800 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────
function StatChip({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 bg-zinc-950/50 border border-white/5 rounded-xl p-3 ${highlight ? 'bg-violet-500/5 border-violet-500/20' : ''}`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold ${highlight ? 'text-violet-400' : 'text-zinc-500'}`}>
        {icon}
        {label}
      </div>
      <span className={`text-sm font-semibold truncate ${highlight ? 'text-violet-100' : 'text-zinc-100'}`}>{value}</span>
    </div>
  );
}

// ─── Admin Campaign Card ──────────────────────────────────────────────────────
function AdminCampaignCard({
  id,
  campaign,
}: {
  id: number;
  campaign: CampaignResolvedData;
}) {
  const { symbol, decimals, title, description, status } = campaign;

  let statusLabel = "Active";
  let statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (status === "depleted") {
    statusLabel = "Depleted";
    statusColor = "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
  } else if (status === "ended") {
    statusLabel = "Ended";
    statusColor = "text-orange-400 bg-orange-500/10 border-orange-500/20";
  } else if (status === "upcoming") {
    statusLabel = "Upcoming";
    statusColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
  }

  const totalNum = Number(formatUnits(campaign.totalReward, decimals));
  const remainingNum = Number(formatUnits(campaign.remainingReward, decimals));
  const distributedNum = totalNum - remainingNum;
  const progressPct = totalNum > 0 ? (distributedNum / totalNum) * 100 : 0;

  const fmtAmount = (val: bigint) => {
    const n = Number(formatUnits(val, decimals));
    return n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : n.toFixed(2);
  };

  const claimsLabel =
    campaign.maxClaims === 0
      ? `${campaign.claimCount} / ∞`
      : `${campaign.claimCount} / ${campaign.maxClaims}`;

  return (
    <div className="group relative flex flex-col rounded-2xl border border-white/5 bg-zinc-900/30 backdrop-blur-md overflow-hidden hover:border-violet-500/30 hover:bg-zinc-900/50 transition-all duration-300 shadow-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-6 flex flex-col gap-5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full border border-white/5">
              #{id}
            </span>
            <span className="text-xs font-bold text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
              {symbol}
            </span>
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-bold text-zinc-100 group-hover:text-violet-300 transition-colors line-clamp-1">
            {title || `Campaign #${id}`}
          </h3>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-2 bg-zinc-950/40 p-4 rounded-xl border border-white/5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Budget Distributed</span>
            <span className="font-semibold text-zinc-300">
              {progressPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-700"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
            <span className="text-emerald-400 font-medium">{fmtAmount(campaign.totalReward - campaign.remainingReward)} {symbol}</span>
            <span className="text-zinc-500">{fmtAmount(campaign.remainingReward)} remaining</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatChip
            icon={<TrendingUp className="size-3" />}
            label="Total Pool"
            value={`${fmtAmount(campaign.totalReward)} ${symbol}`}
          />
          <StatChip
            icon={<Users className="size-3" />}
            label="Claims"
            value={claimsLabel}
            highlight={true}
          />
        </div>

        <div className="flex items-center justify-between pt-4 pb-1 border-t border-white/5 mt-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
              Reward Rate
            </span>
            <span className="text-sm font-black text-white">
              {fmtAmount(campaign.rewardPerAction)} <span className="text-[10px] text-zinc-500 font-semibold">{symbol}/action</span>
            </span>
          </div>
          <Link
            href={`/admin/campaign/${id}`}
            className={buttonVariants({
              variant: "default",
              size: "sm",
              className: "bg-white !text-black hover:bg-zinc-200 font-bold",
            })}
          >
            View Stats
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  // 1. Fetch total campaign count
  const { data: nextCampaignId, isLoading: isLoadingCount } = useReadContract({
    address: NEXUS_CONTRACT,
    abi: NexusAbi,
    functionName: "nextCampaignId",
  });

  const totalCampaigns = nextCampaignId ? Number(nextCampaignId) : 0;

  // 2. Batch-fetch all campaigns via multicall
  const campaignContracts = useMemo(() => {
    if (!totalCampaigns) return [];
    return Array.from({ length: totalCampaigns }, (_, i) => ({
      address: NEXUS_CONTRACT as `0x${string}`,
      abi: NexusAbi,
      functionName: "campaigns" as const,
      args: [BigInt(i)] as const,
    }));
  }, [totalCampaigns]);

  const { data: campaignsRaw, isLoading: isLoadingCampaigns } = useReadContracts({
    contracts: campaignContracts,
    query: { enabled: totalCampaigns > 0 },
  });

  const isLoading = isLoadingCount || (totalCampaigns > 0 && isLoadingCampaigns);

  // 3. Parse campaigns AND filter by user address immediately
  const myCampaigns = useMemo((): CampaignData[] => {
    if (!campaignsRaw || !address) return [];
    
    return campaignsRaw
      .map((result, i) => {
        if (result.status !== "success" || !result.result) return null;
        const r = result.result as readonly [
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
          id: i,
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
        } satisfies CampaignData;
      })
      .filter((c): c is CampaignData => c !== null && c.creator.toLowerCase() === address.toLowerCase());
  }, [campaignsRaw, address]);

  // 4. Batch-fetch reward token metadata only for MY campaigns
  const tokenContracts = useMemo(() => {
    if (!myCampaigns.length) return [];
    const contracts: any[] = [];
    myCampaigns.forEach((c) => {
      contracts.push({
        address: c.token,
        abi: ERC20Abi,
        functionName: "symbol" as const,
      });
      contracts.push({
        address: c.token,
        abi: ERC20Abi,
        functionName: "decimals" as const,
      });
    });
    return contracts;
  }, [myCampaigns]);

  const { data: tokensRaw } = useReadContracts({
    contracts: tokenContracts,
    query: { enabled: myCampaigns.length > 0 },
  });

  // 5. Fetch campaign metadata JSON for MY campaigns
  const [metadataMap, setMetadataMap] = useState<Record<string, { title: string; description?: string }>>({});

  useEffect(() => {
    if (!myCampaigns.length) return;

    const fetchAllMetadata = async () => {
      const newMap = { ...metadataMap };
      let changed = false;

      await Promise.all(
        myCampaigns.map(async (c) => {
          if (!c.metadataUri) return;
          const hash = c.metadataUri.replace("0g://", "");
          if (!hash || newMap[hash]) return;

          try {
            const res = await fetch(`/api/metadata/${hash}`);
            const data = await res.json();
            if (data.success && data.metadata) {
              newMap[hash] = data.metadata;
              changed = true;
            }
          } catch (err) {
            console.error(`Failed to fetch metadata for hash ${hash}:`, err);
          }
        })
      );

      if (changed) {
        setMetadataMap(newMap);
      }
    };

    fetchAllMetadata();
  }, [myCampaigns]);

  // 6. Merge dynamic token symbols/decimals and metadata
  const resolvedCampaigns = useMemo(() => {
    if (!myCampaigns.length) return [];

    return myCampaigns.map((c, idx) => {
      let symbol = "TOKEN";
      let decimals = 18;

      if (tokensRaw) {
        const symbolResult = tokensRaw[idx * 2];
        const decimalsResult = tokensRaw[idx * 2 + 1];

        if (symbolResult && symbolResult.status === "success" && typeof symbolResult.result === "string") {
          symbol = symbolResult.result;
        }
        if (decimalsResult && decimalsResult.status === "success") {
          const d = decimalsResult.result;
          decimals = typeof d === "number" ? d : typeof d === "bigint" ? Number(d) : 18;
        }
      }

      const hash = c.metadataUri.replace("0g://", "");
      const meta = metadataMap[hash];
      const title = meta?.title || `Campaign #${c.id}`;
      const description = meta?.description || "";

      // Determine Status
      const now = Math.floor(Date.now() / 1000);
      const started = now >= Number(c.startTime);
      const ended = c.endTime > 0n && now > Number(c.endTime);
      const depleted = c.remainingReward < c.rewardPerAction;

      let status = "active";
      if (!c.isActive || depleted) {
        status = "depleted";
      } else if (ended) {
        status = "ended";
      } else if (!started) {
        status = "upcoming";
      }

      return {
        ...c,
        symbol,
        decimals,
        title,
        description,
        status,
      } satisfies CampaignResolvedData;
    });
  }, [myCampaigns, tokensRaw, metadataMap]);

  // Derived Stats
  const activeCount = resolvedCampaigns.filter(c => c.status === "active").length;
  const totalClaims = resolvedCampaigns.reduce((acc, c) => acc + c.claimCount, 0);

  // Split campaigns
  const activeCampaigns = resolvedCampaigns.filter((c) => c.status === "active" || c.status === "upcoming");
  const pastCampaigns = resolvedCampaigns.filter((c) => c.status === "ended" || c.status === "depleted");

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-violet-500/30 overflow-hidden font-sans pb-24">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <ArrowLeft className="size-4 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
            <div className="font-heading text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              0g-nexus
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800/50"
            >
              Create Campaign
            </Link>
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
            {isConnected ? (
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
            ) : (
              <Button
                variant="default"
                size="sm"
                className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white font-medium border-0 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                onClick={() => connect({ connector: injected() })}
              >
                <Wallet className="size-4 mr-1.5" /> Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 pt-14 relative">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6">
              <ShieldCheck className="size-9 text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Admin Panel</h2>
            <p className="text-zinc-400 max-w-md mb-8 leading-relaxed">
              Connect your wallet to view and manage the incentive campaigns you have created on 0G Nexus.
            </p>
            <Button
              size="lg"
              className="px-8 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white font-semibold border-0 shadow-[0_4px_20px_rgba(139,92,246,0.3)] hover:scale-[1.02] transition-all duration-300"
              onClick={() => connect({ connector: injected() })}
            >
              <Wallet className="size-4 mr-2" />
              Connect Wallet
            </Button>
          </div>
        ) : (
          <>
            <section className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-violet-500/10 bg-violet-500/5 text-violet-300 text-xs font-medium mb-4">
                  <LayoutDashboard className="size-3" />
                  Creator Dashboard
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3 bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                  My Campaigns
                </h1>
                <p className="text-zinc-400 text-lg font-light leading-relaxed max-w-xl">
                  Monitor the performance and metrics of the campaigns you have launched.
                </p>
              </div>

              {/* Stats summary */}
              {!isLoading && resolvedCampaigns.length > 0 && (
                <div className="flex gap-4 shrink-0">
                  <div className="flex flex-col items-center bg-zinc-900/30 border border-white/5 rounded-2xl px-6 py-4">
                    <span className="text-3xl font-black text-white">{resolvedCampaigns.length}</span>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mt-1">Total</span>
                  </div>
                  <div className="flex flex-col items-center bg-emerald-500/5 border border-emerald-500/20 rounded-2xl px-6 py-4">
                    <span className="text-3xl font-black text-emerald-400">
                      {activeCount}
                    </span>
                    <span className="text-xs text-emerald-500 uppercase tracking-wider font-semibold mt-1">Active</span>
                  </div>
                  <div className="flex flex-col items-center bg-violet-500/5 border border-violet-500/20 rounded-2xl px-6 py-4">
                    <span className="text-3xl font-black text-violet-300">
                      {totalClaims}
                    </span>
                    <span className="text-xs text-violet-400 uppercase tracking-wider font-semibold mt-1">Total Claims</span>
                  </div>
                </div>
              )}
            </section>

            {isLoading && (
              <div>
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-6">
                  <Loader2 className="size-4 animate-spin" />
                  Fetching your campaigns...
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && resolvedCampaigns.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-white/5 bg-zinc-900/20 rounded-3xl">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-4">
                  <Activity className="size-6 text-zinc-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Campaigns Found</h3>
                <p className="text-zinc-400 max-w-sm mb-6">
                  You haven't created any campaigns yet using this wallet address.
                </p>
                <Link
                  href="/dashboard"
                  className={buttonVariants({
                    size: "sm",
                    className: "bg-white !text-black hover:bg-zinc-200 font-semibold"
                  })}
                >
                  <Plus className="size-4 mr-1.5" />
                  Create Your First Campaign
                </Link>
              </div>
            )}

            {!isLoading && resolvedCampaigns.length > 0 && (
              <div className="space-y-12">
                {activeCampaigns.length > 0 && (
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-xl font-bold text-white">Active & Upcoming</h2>
                      <span className="h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {activeCampaigns.map((campaign) => (
                        <AdminCampaignCard key={campaign.id} id={campaign.id} campaign={campaign} />
                      ))}
                    </div>
                  </section>
                )}

                {pastCampaigns.length > 0 && (
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-xl font-bold text-zinc-500">Past Campaigns</h2>
                      <span className="h-px flex-1 bg-gradient-to-r from-zinc-700/40 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity">
                      {pastCampaigns.map((campaign) => (
                        <AdminCampaignCard key={campaign.id} id={campaign.id} campaign={campaign} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
