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
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

const NEXUS_CONTRACT = "0xe3791566EB7A029990D100ACfE477a9985948E8E" as const;

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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 bg-zinc-950/50 border border-white/5 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">
        {icon}
        {label}
      </div>
      <span className="text-zinc-100 text-sm font-semibold truncate">{value}</span>
    </div>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────
function CampaignCard({
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

  const fmtDate = (ts: bigint) => {
    if (ts === 0n) return "No end date";
    return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const claimsLabel =
    campaign.maxClaims === 0
      ? `${campaign.claimCount} / ∞`
      : `${campaign.claimCount} / ${campaign.maxClaims}`;

  return (
    <div className="group relative flex flex-col rounded-2xl border border-white/5 bg-zinc-900/30 backdrop-blur-md overflow-hidden hover:border-violet-500/30 hover:bg-zinc-900/50 transition-all duration-300 shadow-xl">
      {/* Top glow on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-6 flex flex-col gap-5 flex-1">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full border border-white/5">
              #{id}
            </span>
            <span className="text-xs font-bold text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
              {symbol}
            </span>
          </div>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Title & Description */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-bold text-zinc-100 group-hover:text-violet-300 transition-colors line-clamp-1">
            {title || `Campaign #${id}`}
          </h3>
          {description ? (
            <p className="text-xs text-zinc-400 font-light line-clamp-2 leading-relaxed h-8">
              {description}
            </p>
          ) : (
            <p className="text-xs text-zinc-500 font-light italic h-8">
              No description provided.
            </p>
          )}
        </div>

        {/* Reward per action headline */}
        <div>
          <p className="text-xs text-zinc-500 mb-0.5 uppercase tracking-wider font-semibold">
            Reward per action
          </p>
          <p className="text-3xl font-black tracking-tight text-white">
            {fmtAmount(campaign.rewardPerAction)}{" "}
            <span className="text-lg font-semibold text-violet-300">{symbol}</span>
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Distributed</span>
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
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>{fmtAmount(campaign.totalReward - campaign.remainingReward)} distributed</span>
            <span>{fmtAmount(campaign.remainingReward)} remaining</span>
          </div>
        </div>

        {/* Stats Grid */}
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
          />
          <StatChip
            icon={<Zap className="size-3" />}
            label="Starts"
            value={fmtDate(campaign.startTime)}
          />
          <StatChip
            icon={<Clock className="size-3" />}
            label="Ends"
            value={fmtDate(campaign.endTime)}
          />
        </div>

        {/* Creator */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
            Creator
          </span>
          <span className="text-xs font-mono text-zinc-400">
            {campaign.creator.slice(0, 6)}…{campaign.creator.slice(-4)}
          </span>
        </div>
      </div>

      {/* Footer CTA */}
      {campaign.metadataUri && (
        <div className="px-6 pb-5">
          <a
            href={`https://scan-testnet.0g.ai`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-9 rounded-xl text-xs font-semibold text-zinc-400 border border-white/5 bg-zinc-900/40 hover:bg-zinc-800/60 hover:text-white hover:border-white/10 transition-all"
          >
            <ExternalLink className="size-3" />
            View on Explorer
          </a>
        </div>
      )}
    </div>
  );
}


// ─── Horizontal Campaign Card ──────────────────────────────────────────────────
function HorizontalCampaignCard({
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

  const fmtDate = (ts: bigint) => {
    if (ts === 0n) return "No end date";
    return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const claimsLabel =
    campaign.maxClaims === 0
      ? `${campaign.claimCount} / ∞`
      : `${campaign.claimCount} / ${campaign.maxClaims}`;

  return (
    <div className="group relative flex flex-col md:flex-row items-center gap-6 rounded-2xl border border-white/5 bg-zinc-900/30 backdrop-blur-md overflow-hidden hover:border-violet-500/30 hover:bg-zinc-900/50 transition-all duration-300 shadow-xl p-5 md:p-6">
      {/* Top glow on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Left Column: Title & Info */}
      <div className="flex-1 flex flex-col gap-3 w-full md:w-auto min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full border border-white/5 shrink-0">
            #{id}
          </span>
          <span className="text-xs font-bold text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full shrink-0">
            {symbol}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-lg md:text-xl font-bold text-zinc-100 group-hover:text-violet-300 transition-colors line-clamp-1">
            {title || `Campaign #${id}`}
          </h3>
          <p className="text-sm text-zinc-400 font-light line-clamp-1 md:line-clamp-2">
            {description || <span className="italic text-zinc-500">No description provided.</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Creator</span>
          <span className="text-xs font-mono text-zinc-400">{campaign.creator.slice(0, 6)}…{campaign.creator.slice(-4)}</span>
        </div>
      </div>

      {/* Middle Column: Rewards & Progress */}
      <div className="flex-1 w-full md:w-auto flex flex-col gap-4 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
        <div>
          <p className="text-xs text-zinc-500 mb-0.5 uppercase tracking-wider font-semibold">Reward per action</p>
          <p className="text-2xl font-black tracking-tight text-white">
            {fmtAmount(campaign.rewardPerAction)} <span className="text-base font-semibold text-violet-300">{symbol}</span>
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Distributed</span>
            <span className="font-semibold text-zinc-300">{progressPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-700"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>{fmtAmount(campaign.totalReward - campaign.remainingReward)} dist.</span>
            <span>{fmtAmount(campaign.remainingReward)} rem.</span>
          </div>
        </div>
      </div>

      {/* Right Column: Stats & Action */}
      <div className="w-full md:w-auto flex flex-row md:flex-col items-center md:items-end justify-between gap-4 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6 shrink-0">
        <div className="flex flex-wrap md:flex-col gap-3 md:gap-2 w-full md:w-auto text-xs">
          <div className="flex items-center gap-2">
            <Users className="size-3.5 text-zinc-500" />
            <span className="text-zinc-300 font-semibold">{claimsLabel} <span className="text-zinc-500 font-normal">claims</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 text-zinc-500" />
            <span className="text-zinc-300 font-semibold">{fmtDate(campaign.endTime)} <span className="text-zinc-500 font-normal">ends</span></span>
          </div>
        </div>
        {campaign.metadataUri && (
          <a
            href={`https://scan-testnet.0g.ai`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-all shadow-lg shadow-violet-500/20 w-full md:w-auto"
          >
            <ExternalLink className="size-3.5" />
            View
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  // 3. Parse campaigns
  const campaigns = useMemo((): CampaignData[] => {
    if (!campaignsRaw) return [];
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
          startTime: r[7],
          endTime: r[8],
          maxClaims: r[9],
          claimCount: r[10],
          isActive: r[11],
        } satisfies CampaignData;
      })
      .filter((c): c is CampaignData => c !== null);
  }, [campaignsRaw]);

  // 4. Batch-fetch reward token metadata for all campaigns
  const tokenContracts = useMemo(() => {
    if (!campaigns.length) return [];
    const contracts: any[] = [];
    campaigns.forEach((c) => {
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
  }, [campaigns]);

  const { data: tokensRaw, isLoading: isLoadingTokens } = useReadContracts({
    contracts: tokenContracts,
    query: { enabled: campaigns.length > 0 },
  });

  // 5. Fetch campaign metadata JSON at the page level
  const [metadataMap, setMetadataMap] = useState<Record<string, { title: string; description?: string }>>({});

  useEffect(() => {
    if (!campaigns.length) return;

    const fetchAllMetadata = async () => {
      const newMap = { ...metadataMap };
      let changed = false;

      await Promise.all(
        campaigns.map(async (c) => {
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
  }, [campaigns]);

  // 6. Merge dynamic token symbols/decimals and metadata
  const campaignsWithTokensAndMeta = useMemo(() => {
    if (!campaigns.length) return [];

    return campaigns.map((c, idx) => {
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
  }, [campaigns, tokensRaw, metadataMap]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tokenFilter, setTokenFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Get list of unique token symbols
  const uniqueTokens = useMemo(() => {
    const tokens = new Set<string>();
    campaignsWithTokensAndMeta.forEach((c) => {
      if (c.symbol) tokens.add(c.symbol);
    });
    return Array.from(tokens);
  }, [campaignsWithTokensAndMeta]);

  // Apply search, filters and sort
  const filteredAndSortedCampaigns = useMemo(() => {
    let result = [...campaignsWithTokensAndMeta];

    // 1. Search filter (matches title, description, creator, contract address)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.creator.toLowerCase().includes(q) ||
          c.token.toLowerCase().includes(q)
      );
    }

    // 2. Status filter
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    // 3. Token filter
    if (tokenFilter !== "all") {
      result = result.filter((c) => c.symbol === tokenFilter);
    }

    // 4. Sort
    if (sortBy === "reward-high") {
      result.sort((a, b) => {
        const aVal = Number(formatUnits(a.rewardPerAction, a.decimals));
        const bVal = Number(formatUnits(b.rewardPerAction, b.decimals));
        return bVal - aVal;
      });
    } else if (sortBy === "reward-low") {
      result.sort((a, b) => {
        const aVal = Number(formatUnits(a.rewardPerAction, a.decimals));
        const bVal = Number(formatUnits(b.rewardPerAction, b.decimals));
        return aVal - bVal;
      });
    } else if (sortBy === "pool-large") {
      result.sort((a, b) => {
        const aVal = Number(formatUnits(a.totalReward, a.decimals));
        const bVal = Number(formatUnits(b.totalReward, b.decimals));
        return bVal - aVal;
      });
    } else if (sortBy === "newest") {
      result.sort((a, b) => b.id - a.id);
    } else if (sortBy === "ends-soon") {
      result.sort((a, b) => {
        if (a.endTime === 0n && b.endTime === 0n) return 0;
        if (a.endTime === 0n) return 1;
        if (b.endTime === 0n) return -1;
        return Number(a.endTime - b.endTime);
      });
    }

    return result;
  }, [campaignsWithTokensAndMeta, searchQuery, statusFilter, tokenFilter, sortBy]);

  const activeCampaigns = useMemo(() => {
    return filteredAndSortedCampaigns.filter((c) => c.status === "active" || c.status === "upcoming");
  }, [filteredAndSortedCampaigns]);

  const pastCampaigns = useMemo(() => {
    return filteredAndSortedCampaigns.filter((c) => c.status === "ended" || c.status === "depleted");
  }, [filteredAndSortedCampaigns]);

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-violet-500/30 overflow-hidden font-sans pb-24">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full bg-fuchsia-600/5 blur-[120px] pointer-events-none" />

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
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "text-zinc-400 hover:text-white",
              })}
            >
              <Plus className="size-3.5 mr-1" />
              Create Campaign
            </Link>
            {mounted && isConnected && (
              <Link
                href="/admin"
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "text-zinc-400 hover:text-white",
                })}
              >
                Admin Panel
              </Link>
            )}
            <Link
              href="/leaderboard"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "text-zinc-400 hover:text-white",
              })}
            >
              Leaderboard
            </Link>
            {mounted ? (
              isConnected ? (
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
              )
            ) : (
              <div className="w-32 h-9 bg-zinc-800/50 rounded-md animate-pulse"></div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 pt-14 relative">
        {/* Hero */}
        <section className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-violet-500/10 bg-violet-500/5 text-violet-300 text-xs font-medium mb-4">
              <LayoutGrid className="size-3" />
              Campaign Hub
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-3 bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
              Active Campaigns
            </h1>
            <p className="text-zinc-400 text-lg font-light leading-relaxed max-w-xl">
              Browse all incentive campaigns deployed on 0G Newton Testnet. Earn
              rewards for completing on-chain actions.
            </p>
          </div>

          {/* Stats summary */}
          {!isLoading && campaigns.length > 0 && (
            <div className="flex gap-4 shrink-0">
              <div className="flex flex-col items-center bg-zinc-900/30 border border-white/5 rounded-2xl px-6 py-4">
                <span className="text-3xl font-black text-white">{totalCampaigns}</span>
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mt-1">Total</span>
              </div>
              <div className="flex flex-col items-center bg-violet-500/5 border border-violet-500/20 rounded-2xl px-6 py-4">
                <span className="text-3xl font-black text-violet-300">
                  {campaignsWithTokensAndMeta.filter((c) => c.status === "active").length}
                </span>
                <span className="text-xs text-violet-400 uppercase tracking-wider font-semibold mt-1">Active</span>
              </div>
            </div>
          )}
        </section>

        {/* Controls Bar */}
        {!isLoading && campaigns.length > 0 && (
          <section className="mb-10 bg-zinc-900/20 border border-white/5 backdrop-blur-md rounded-2xl p-4 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Search bar (col-span-5) */}
            <div className="relative md:col-span-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by title, creator, or token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-zinc-950/80 border border-zinc-800 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 text-sm text-zinc-100 placeholder:text-zinc-500 rounded-xl transition-all duration-200 outline-none"
              />
            </div>

            {/* Status Filter (col-span-2) */}
            <div className="md:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-11 px-3.5 bg-zinc-950/80 border border-zinc-800 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 text-sm text-zinc-300 rounded-xl transition-all duration-200 outline-none cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(113,113,122)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "16px",
                  paddingRight: "36px",
                }}
              >
                <option value="all" className="bg-zinc-950 text-zinc-300">All Statuses</option>
                <option value="active" className="bg-zinc-950 text-zinc-300">Active</option>
                <option value="upcoming" className="bg-zinc-950 text-zinc-300">Upcoming</option>
                <option value="ended" className="bg-zinc-950 text-zinc-300">Ended</option>
                <option value="depleted" className="bg-zinc-950 text-zinc-300">Depleted</option>
              </select>
            </div>

            {/* Token Filter (col-span-2) */}
            <div className="md:col-span-2">
              <select
                value={tokenFilter}
                onChange={(e) => setTokenFilter(e.target.value)}
                className="w-full h-11 px-3.5 bg-zinc-950/80 border border-zinc-800 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 text-sm text-zinc-300 rounded-xl transition-all duration-200 outline-none cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(113,113,122)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "16px",
                  paddingRight: "36px",
                }}
              >
                <option value="all" className="bg-zinc-950 text-zinc-300">All Tokens</option>
                {uniqueTokens.map((t) => (
                  <option key={t} value={t} className="bg-zinc-950 text-zinc-300">{t}</option>
                ))}
              </select>
            </div>

            {/* Sort By (col-span-3) */}
            <div className="md:col-span-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-11 px-3.5 bg-zinc-950/80 border border-zinc-800 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 text-sm text-zinc-300 rounded-xl transition-all duration-200 outline-none cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgb(113,113,122)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "16px",
                  paddingRight: "36px",
                }}
              >
                <option value="default" className="bg-zinc-950 text-zinc-300">Sort: Default</option>
                <option value="newest" className="bg-zinc-950 text-zinc-300">Sort: Newest Created</option>
                <option value="reward-high" className="bg-zinc-950 text-zinc-300">Sort: Reward (High-Low)</option>
                <option value="reward-low" className="bg-zinc-950 text-zinc-300">Sort: Reward (Low-High)</option>
                <option value="pool-large" className="bg-zinc-950 text-zinc-300">Sort: Pool Size (Largest)</option>
                <option value="ends-soon" className="bg-zinc-950 text-zinc-300">Sort: Ending Soonest</option>
              </select>
            </div>

            {/* View Toggle (col-span-1) */}
            <div className="md:col-span-1 flex items-center justify-end bg-zinc-950/80 border border-zinc-800 rounded-xl h-11 p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex-1 flex items-center justify-center h-full rounded-lg transition-all ${viewMode === "grid" ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"}`}
                title="Grid View"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex-1 flex items-center justify-center h-full rounded-lg transition-all ${viewMode === "list" ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"}`}
                title="List View"
              >
                <List className="size-4" />
              </button>
            </div>
          </section>
        )}

        {/* Loading state */}
        {isLoading && (
          <div>
            <div className="flex items-center gap-2 text-zinc-500 text-sm mb-6">
              <Loader2 className="size-4 animate-spin" />
              Fetching campaigns from 0G Newton Testnet...
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && campaigns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6">
              <Trophy className="size-9 text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No Campaigns Yet</h2>
            <p className="text-zinc-400 max-w-md mb-8 leading-relaxed">
              Be the first to deploy an incentive campaign on 0G Nexus. Define a
              target on-chain event, fund it with tokens, and let users earn.
            </p>
            <Link
              href="/dashboard"
              className={buttonVariants({
                size: "lg",
                className:
                  "px-8 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white font-semibold border-0 shadow-[0_4px_20px_rgba(139,92,246,0.3)] hover:scale-[1.02] transition-all duration-300",
              })}
            >
              <Plus className="size-4 mr-2" />
              Launch First Campaign
            </Link>
          </div>
        )}

        {/* Empty state for filtered results */}
        {!isLoading && campaigns.length > 0 && filteredAndSortedCampaigns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-4">
              <SlidersHorizontal className="size-6 text-zinc-500 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Matching Campaigns</h3>
            <p className="text-zinc-400 max-w-sm mb-6">
              We couldn't find any campaigns matching your search query or active filter settings.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setTokenFilter("all");
                setSortBy("default");
              }}
              className="border-zinc-800 text-zinc-300 hover:text-white"
            >
              Reset All Filters
            </Button>
          </div>
        )}

        {/* Campaign Grid */}
        {!isLoading && filteredAndSortedCampaigns.length > 0 && (
          <>
            {activeCampaigns.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-xl font-bold text-white">Active Campaigns</h2>
                  <span className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent" />
                  <span className="text-xs text-violet-300 font-semibold bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                    {activeCampaigns.length} live
                  </span>
                </div>
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
                  {activeCampaigns.map((campaign) => (
                    viewMode === "grid" ? <CampaignCard key={campaign.id} id={campaign.id} campaign={campaign} /> : <HorizontalCampaignCard key={campaign.id} id={campaign.id} campaign={campaign} />
                  ))}
                </div>
              </section>
            )}

            {pastCampaigns.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-xl font-bold text-zinc-500">Past Campaigns</h2>
                  <span className="h-px flex-1 bg-gradient-to-r from-zinc-700/40 to-transparent" />
                  <span className="text-xs text-zinc-500 font-semibold bg-zinc-800/60 border border-white/5 px-2 py-0.5 rounded-full">
                    {pastCampaigns.length} ended
                  </span>
                </div>
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60" : "flex flex-col gap-4 opacity-60"}>
                  {pastCampaigns.map((campaign) => (
                    viewMode === "grid" ? <CampaignCard key={campaign.id} id={campaign.id} campaign={campaign} /> : <HorizontalCampaignCard key={campaign.id} id={campaign.id} campaign={campaign} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
