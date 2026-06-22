"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { Trophy, Medal, Star, ArrowLeft, Loader2, Crown } from "lucide-react";

const INDEXER_URL = "http://localhost:42069";

interface ClaimRecord {
  claimant: string;
  amount: string;
}

interface LeaderboardEntry {
  rank: number;
  address: string;
  totalEarned: number; // Normalized to 18 decimals for the score
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAndAggregate = async () => {
      try {
        const res = await fetch(`${INDEXER_URL}/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query GetAllClaims {
                rewardClaims(limit: 1000) {
                  items {
                    claimant
                    amount
                  }
                }
              }
            `
          })
        });

        const data = await res.json();
        const claims: ClaimRecord[] = data?.data?.rewardClaims?.items || [];

        // Aggregate by claimant
        const aggregated: Record<string, bigint> = {};
        claims.forEach(c => {
          const amountBn = BigInt(c.amount);
          aggregated[c.claimant] = (aggregated[c.claimant] || 0n) + amountBn;
        });

        // Convert to array, format, and sort
        // We assume 18 decimals for the global score
        const sorted = Object.entries(aggregated)
          .map(([address, totalBn]) => ({
            address,
            totalEarned: Number(formatUnits(totalBn, 18))
          }))
          .sort((a, b) => b.totalEarned - a.totalEarned)
          .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

        setEntries(sorted);
      } catch (err) {
        console.error("Failed to fetch leaderboard data", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndAggregate();
  }, []);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const renderPodium = () => {
    if (entries.length === 0) return null;
    
    // Podium order: 2nd, 1st, 3rd
    const first = entries[0];
    const second = entries[1];
    const third = entries[2];

    return (
      <div className="flex items-end justify-center gap-4 md:gap-8 h-64 mb-16 pt-8">
        
        {/* 2nd Place */}
        {second && (
          <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 fade-in delay-100">
            <div className="relative">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                <Medal className="size-8 text-zinc-300 drop-shadow-[0_0_8px_rgba(212,212,216,0.8)]" />
              </div>
              <div className="bg-zinc-800/80 border border-white/10 rounded-t-2xl w-24 md:w-32 h-32 flex flex-col items-center justify-start pt-4 backdrop-blur-md shadow-[0_0_30px_rgba(212,212,216,0.1)]">
                <span className="text-2xl font-black text-white">2</span>
                <span className="text-[10px] text-zinc-400 font-mono mt-2">{formatAddress(second.address)}</span>
                <span className="text-sm font-bold text-emerald-400 mt-1">{second.totalEarned.toFixed(2)} pts</span>
              </div>
            </div>
          </div>
        )}

        {/* 1st Place */}
        {first && (
          <div className="flex flex-col items-center animate-in slide-in-from-bottom-12 duration-700 fade-in z-10">
            <div className="relative">
              <div className="absolute -top-14 left-1/2 -translate-x-1/2">
                <Crown className="size-12 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]" />
              </div>
              <div className="bg-gradient-to-t from-violet-900/80 to-violet-600/80 border border-violet-400/30 rounded-t-2xl w-28 md:w-36 h-40 flex flex-col items-center justify-start pt-6 backdrop-blur-md shadow-[0_0_40px_rgba(139,92,246,0.3)]">
                <span className="text-4xl font-black text-white drop-shadow-md">1</span>
                <span className="text-xs text-violet-200 font-mono mt-3">{formatAddress(first.address)}</span>
                <span className="text-base font-black text-white mt-1 drop-shadow-md">{first.totalEarned.toFixed(2)} pts</span>
              </div>
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {third && (
          <div className="flex flex-col items-center animate-in slide-in-from-bottom-4 duration-700 fade-in delay-200">
            <div className="relative">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                <Medal className="size-8 text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.8)]" />
              </div>
              <div className="bg-zinc-900/80 border border-white/5 rounded-t-2xl w-24 md:w-32 h-24 flex flex-col items-center justify-start pt-3 backdrop-blur-md shadow-[0_0_20px_rgba(217,119,6,0.1)]">
                <span className="text-xl font-black text-white">3</span>
                <span className="text-[10px] text-zinc-500 font-mono mt-2">{formatAddress(third.address)}</span>
                <span className="text-xs font-bold text-emerald-500 mt-1">{third.totalEarned.toFixed(2)} pts</span>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 font-sans relative overflow-hidden pb-24">
      {/* Dynamic Backgrounds */}
      <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[800px] h-[400px] rounded-[100%] bg-violet-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <div className="max-w-[800px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="size-4" />
            <span className="text-sm font-medium">Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-yellow-500" />
            <span className="font-bold tracking-tight">Global Leaderboard</span>
          </div>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-6 pt-12 relative z-10">
        
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400">
            Top Earners
          </h1>
          <p className="text-zinc-400 max-w-lg mx-auto">
            Ranking the most active participants across the 0G Network based on total rewards claimed.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="size-8 text-violet-500 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-12 text-center backdrop-blur-md">
            <Star className="size-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white">No claims yet</h3>
            <p className="text-zinc-500 mt-2">The leaderboard is empty. Start participating in campaigns to be the first!</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {renderPodium()}

            {/* The Rest of the List */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-500 uppercase tracking-wider bg-zinc-950/50">
                  <tr>
                    <th className="px-6 py-4 font-semibold w-24 text-center">Rank</th>
                    <th className="px-6 py-4 font-semibold">Wallet Address</th>
                    <th className="px-6 py-4 font-semibold text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {entries.slice(3).map((entry) => (
                    <tr key={entry.address} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">#{entry.rank}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-violet-300">0G</span>
                          </div>
                          <span className="font-mono text-zinc-300">{entry.address}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-emerald-400">{entry.totalEarned.toFixed(2)}</span>
                        <span className="text-xs text-zinc-600 ml-1">pts</span>
                      </td>
                    </tr>
                  ))}
                  {entries.length <= 3 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-zinc-500 text-xs">
                        Only {entries.length} participants so far.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

      </main>
    </div>
  );
}
