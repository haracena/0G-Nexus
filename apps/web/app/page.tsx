"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-violet-500/30 overflow-hidden font-sans">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />

      {/* Sticky Premium Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-heading text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            0g-nexus
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/campaigns"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "text-zinc-400 hover:text-white",
              })}
            >
              Campaigns
            </Link>
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
            <Link
              href="/dashboard"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "text-zinc-400 hover:text-white",
              })}
            >
              Dashboard
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
                  className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white font-medium shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.3)] transition-all duration-300 border-0"
                  onClick={() => connect({ connector: injected() })}
                >
                  Connect Wallet
                </Button>
              )
            ) : (
              <div className="w-32 h-9 bg-zinc-800/50 rounded-md animate-pulse"></div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full px-6 max-w-6xl mx-auto">
        <section className="py-32 flex flex-col items-center text-center relative">
          {/* Radial Center Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.08)_0%,transparent_60%)] pointer-events-none" />

          <div className="animate-fade-up flex flex-col items-center">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-300 text-xs font-semibold uppercase tracking-wider mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              0G Zero Cup Hackathon MVP
            </div>

            <h1 className="text-5xl md:text-8xl font-black tracking-tight mb-8 leading-[1.05] bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent max-w-4xl">
              The marketplace for
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                onchain actions
              </span>
            </h1>

            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl font-light leading-relaxed mb-12">
              Distribute tokens to drive real user transactions. 0g-nexus is the
              fastest way to deploy, manage, and verify AI-native incentive
              campaigns on the 0G network.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/dashboard"
                className={buttonVariants({
                  size: "lg",
                  className:
                    "px-8 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white font-semibold transition-all duration-300 border-0 shadow-[0_4px_20px_rgba(139,92,246,0.3)] hover:scale-[1.02]",
                })}
              >
                Launch Campaign
              </Link>
              <Link
                href="/campaigns"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className:
                    "px-8 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900/50 transition-all",
                })}
              >
                Explore Campaigns
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="py-24 border-t border-white/5 relative"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight mb-4">
            How It Works
          </h2>
          <p className="text-zinc-400 text-center max-w-xl mx-auto mb-20 font-light text-base md:text-lg">
            Get started in four quick and easy steps to configure your
            incentives on the 0G Newton Testnet.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step Card 1 */}
            <div className="group relative p-8 bg-zinc-900/20 backdrop-blur-md border border-white/5 rounded-2xl hover:border-violet-500/30 hover:bg-zinc-900/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold mb-6 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-lg group-hover:scale-110 transition-transform">
                1
              </div>
              <h3 className="text-xl font-bold mb-3 font-heading text-zinc-100">
                Create Target Action
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Define the exact on-chain or off-chain action you want to
                incentivize.
              </p>
            </div>

            {/* Step Card 2 */}
            <div className="group relative p-8 bg-zinc-900/20 backdrop-blur-md border border-white/5 rounded-2xl hover:border-violet-500/30 hover:bg-zinc-900/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold mb-6 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-lg group-hover:scale-110 transition-transform">
                2
              </div>
              <h3 className="text-xl font-bold mb-3 font-heading text-zinc-100">
                Deposit Funds
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Fund your campaign securely on the 0G Newton Testnet.
              </p>
            </div>

            {/* Step Card 3 */}
            <div className="group relative p-8 bg-zinc-900/20 backdrop-blur-md border border-white/5 rounded-2xl hover:border-violet-500/30 hover:bg-zinc-900/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold mb-6 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-lg group-hover:scale-110 transition-transform">
                3
              </div>
              <h3 className="text-xl font-bold mb-3 font-heading text-zinc-100">
                Deploy & Distribute
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Launch your campaign instantly. Users participate, and proofs
                are immutably stored on 0G Storage.
              </p>
            </div>

            {/* Step Card 4 */}
            <div className="group relative p-8 bg-zinc-900/20 backdrop-blur-md border border-white/5 rounded-2xl hover:border-violet-500/30 hover:bg-zinc-900/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold mb-6 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-lg group-hover:scale-110 transition-transform">
                4
              </div>
              <h3 className="text-xl font-bold mb-3 font-heading text-zinc-100">
                Verify & Optimize
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Rewards are distributed programmatically to verified users.
                Analyze campaign metrics in real-time.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
