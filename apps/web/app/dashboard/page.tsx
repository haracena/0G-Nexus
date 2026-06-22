"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
  useSwitchChain,
  useReadContract,
} from "wagmi";
import { parseUnits } from "viem";
import { injected } from "wagmi/connectors";
import { toast } from "sonner";

const CHAIN_ID = 16602;
import { NexusAbi } from "@/lib/abis/NexusAbi";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { WebPreview } from "@/components/ui/web-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Wallet,
  ArrowLeft,
} from "lucide-react";

interface ABIInput {
  name: string;
  type: string;
  indexed?: boolean;
}

interface ABIEvent {
  name: string;
  type: string;
  inputs?: ABIInput[];
}

export default function Dashboard() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  // Campaign builder state
  const [targetContract, setTargetContract] = useState("");
  const [abiText, setAbiText] = useState("");
  const [events, setEvents] = useState<ABIEvent[]>([]);
  const [selectedEventName, setSelectedEventName] = useState("");
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [isLoadingAbi, setIsLoadingAbi] = useState(false);
  const [abiError, setAbiError] = useState("");

  const [campaignData, setCampaignData] = useState({
    title: "",
    description: "",
    appName: "",
    appImage: "",
    rewardBaseUrl: "",
    category: "",
    tokenAddress: "", // Default token address
    totalReward: "",
    rewardPerAction: "",
    validatorAddress: "",
    startTime: "",
    endTime: "",
    maxClaims: "",
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const nextStep = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Read Token metadata dynamically
  const isValidAddress =
    campaignData.tokenAddress.startsWith("0x") &&
    campaignData.tokenAddress.length === 42;

  const { data: decimals } = useReadContract({
    address: campaignData.tokenAddress as `0x${string}`,
    abi: ERC20Abi,
    functionName: "decimals",
    query: {
      enabled: isValidAddress,
    },
  });

  const { data: symbol } = useReadContract({
    address: campaignData.tokenAddress as `0x${string}`,
    abi: ERC20Abi,
    functionName: "symbol",
    query: {
      enabled: isValidAddress,
    },
  });

  const { data: name } = useReadContract({
    address: campaignData.tokenAddress as `0x${string}`,
    abi: ERC20Abi,
    functionName: "name",
    query: {
      enabled: isValidAddress,
    },
  });

  const tokenDecimals =
    typeof decimals === "number"
      ? decimals
      : typeof decimals === "bigint"
        ? Number(decimals)
        : 18;

  // Fetch ABI from 0G Block Explorer (ChainScan)
  const handleFetchAbi = async () => {
    if (!targetContract.startsWith("0x") || targetContract.length !== 42) {
      toast.error("Please enter a valid contract address first.");
      return;
    }
    setIsLoadingAbi(true);
    setAbiError("");
    try {
      const res = await fetch(
        `https://chainscan-newton.0g.ai/api?module=contract&action=getabi&address=${targetContract}`,
      );
      const data = await res.json();
      if (data.status === "1" && data.result) {
        setAbiText(data.result);
        setAbiError("");
      } else {
        setAbiError(
          "Contract not verified on ChainScan Newton Explorer. Please paste the JSON ABI manually below.",
        );
      }
    } catch (err) {
      setAbiError(
        "Failed to connect to explorer API. Please paste the JSON ABI manually below.",
      );
    } finally {
      setIsLoadingAbi(false);
    }
  };

  // Parse ABI whenever the user updates the text
  useEffect(() => {
    if (!abiText.trim()) {
      setEvents([]);
      return;
    }
    try {
      const parsed = JSON.parse(abiText) as ABIEvent[];
      const contractEvents = parsed.filter((item) => item.type === "event");
      setEvents(contractEvents);
      const firstEvent = contractEvents[0];
      if (firstEvent) {
        setSelectedEventName(firstEvent.name);
      } else {
        setSelectedEventName("");
      }
    } catch (e) {
      setEvents([]);
    }
  }, [abiText]);

  // Reset and pre-populate conditions when the event changes
  const selectedEvent = events.find((e) => e.name === selectedEventName);
  useEffect(() => {
    const initialConditions: Record<string, string> = {};
    if (selectedEvent?.inputs) {
      selectedEvent.inputs.forEach((input) => {
        if (input.type === "address") {
          initialConditions[input.name] = "claimant";
        } else if (input.type === "bool") {
          initialConditions[input.name] = "true";
        }
      });
    }
    setConditions(initialConditions);
  }, [selectedEventName, selectedEvent]);

  const handleConditionChange = (paramName: string, value: string) => {
    setConditions((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const handleReviewClick = () => {
    const form = document.getElementById("campaign-form") as HTMLFormElement;
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!isConnected) {
      toast.error("Please connect your wallet first.");
      return;
    }

    if (!targetContract.startsWith("0x")) {
      toast.error("Invalid Target Contract Address. Must start with 0x.");
      return;
    }

    if (!selectedEventName) {
      toast.error("Please select a target event from the parsed ABI.");
      return;
    }

    setIsConfirmDialogOpen(true);
  };

  const handleDeploy = async () => {
    setIsConfirmDialogOpen(false);
    setIsUploading(true);
    setUploadStatus("Uploading metadata to 0G Storage...");

    try {
      const questMetadata = {
        title: campaignData.title,
        description: campaignData.description || "",
        appName: campaignData.appName || "",
        appImage: campaignData.appImage || "",
        rewardBaseUrl: campaignData.rewardBaseUrl || "",
        category: campaignData.category || "",
        targetContract,
        targetEvent: selectedEventName,
        conditions,
        createdAt: new Date().toISOString(),
      };

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questMetadata),
      });
      const data = await res.json();

      setUploadStatus(
        `Uploaded successfully! Hash: ${data.dataHash.slice(0, 16)}...`,
      );

      const startTimeUnix = campaignData.startTime
        ? Math.floor(new Date(campaignData.startTime).getTime() / 1000)
        : Math.floor(Date.now() / 1000);
      const endTimeUnix = campaignData.endTime
        ? Math.floor(new Date(campaignData.endTime).getTime() / 1000)
        : 0;
      const maxClaimsNum = campaignData.maxClaims
        ? parseInt(campaignData.maxClaims)
        : 0;

      if (chainId !== CHAIN_ID) {
        setUploadStatus("Switching network to 0G Newton Testnet...");
        await switchChainAsync({ chainId: CHAIN_ID });
      }

      setUploadStatus("Approving ERC20 token...");
      const totalRewardParsed = parseUnits(
        campaignData.totalReward,
        tokenDecimals,
      );
      const rewardPerActionParsed = parseUnits(
        campaignData.rewardPerAction,
        tokenDecimals,
      );

      const NEXUS_CONTRACT = "0xe3791566EB7A029990D100ACfE477a9985948E8E";

      await writeContractAsync({
        address: campaignData.tokenAddress as `0x${string}`,
        abi: ERC20Abi,
        functionName: "approve",
        args: [NEXUS_CONTRACT, totalRewardParsed],
        chainId: CHAIN_ID,
      });

      setUploadStatus("Deploying campaign on Nexus...");
      const tx = await writeContractAsync({
        address: NEXUS_CONTRACT,
        abi: NexusAbi,
        functionName: "createCampaign",
        args: [
          campaignData.tokenAddress as `0x${string}`,
          totalRewardParsed,
          rewardPerActionParsed,
          `0g://${data.dataHash}`,
          address as `0x${string}`,
          BigInt(startTimeUnix),
          BigInt(endTimeUnix),
          maxClaimsNum,
        ],
        chainId: CHAIN_ID,
      });

      setUploadStatus(`Success! TX: ${tx}`);
      toast.success(`Campaign Created Successfully! TX: ${tx}`);
    } catch (err: any) {
      toast.error(
        `Failed: ${err.message || "uploading metadata to 0G Storage."}`,
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-violet-500/30 overflow-hidden font-sans pb-24">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />

      {/* Sticky Premium Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 group text-decoration-none"
          >
            <ArrowLeft className="size-4 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
            <div className="font-heading text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              0g-nexus
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/campaigns"
              className="text-sm text-zinc-400 hover:text-white transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800/50"
            >
              Campaigns
            </Link>
            {isConnected && (
              <Link
                href="/admin"
                className="text-sm text-zinc-400 hover:text-white transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800/50"
              >
                Admin Panel
              </Link>
            )}
            <Link
              href="/leaderboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800/50"
            >
              Leaderboard
            </Link>
            <div>
              {isConnected ? (
                <div className="flex items-center gap-4">
                  <span className="text-zinc-400 font-mono text-sm bg-zinc-900 px-3 py-1 rounded-full border border-white/5">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
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
        </div>
      </header>

      {/* Main Form Dashboard */}
      <main className="max-w-[760px] mx-auto px-6 pt-16 relative">
        <div className="mb-12 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-violet-500/10 bg-violet-500/5 text-violet-300 text-xs font-medium mb-4">
            Campaign Builder
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">
            Launch Campaign
          </h1>
          <p className="text-zinc-400 text-lg font-light leading-relaxed">
            Define the smart contract target event and fund the campaign to
            incentivize users.
          </p>
        </div>

        {/* Stepper Progress */}
        <div className="mb-10 mt-6 hidden md:block">
          <div className="flex items-center justify-between relative px-6">
            <div className="absolute left-10 right-10 top-6 -translate-y-1/2 h-0.5 bg-zinc-800/50 rounded-full z-0"></div>
            <div
              className="absolute left-10 top-6 -translate-y-1/2 h-0.5 bg-violet-500 rounded-full z-0 transition-all duration-500 ease-in-out"
              style={{
                width: `calc(${((currentStep - 1) / (totalSteps - 1)) * 100}% - ${((currentStep - 1) / (totalSteps - 1)) * 5}rem)`,
              }}
            ></div>

            {[
              { num: 1, label: "App Metadata" },
              { num: 2, label: "Target Condition" },
              { num: 3, label: "Budget & Rewards" },
              { num: 4, label: "Time Gates" },
            ].map((step) => (
              <div
                key={step.num}
                className="relative z-10 flex flex-col items-center gap-3"
              >
                <div
                  className={`size-12 rounded-full flex items-center justify-center font-bold text-base transition-all duration-500 ${
                    currentStep >= step.num
                      ? "bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] border-2 border-violet-400"
                      : "bg-zinc-900/80 text-zinc-500 border-2 border-zinc-800 backdrop-blur-md"
                  }`}
                >
                  {currentStep > step.num ? (
                    <CheckCircle2 className="size-6" />
                  ) : (
                    step.num
                  )}
                </div>
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${currentStep >= step.num ? "text-violet-300" : "text-zinc-600"}`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <form
          id="campaign-form"
          onSubmit={(e) => e.preventDefault()}
          className="grid gap-8"
        >
          {/* Step 1: App Metadata */}
          {currentStep === 1 && (
            <Card className="border border-white/5 bg-zinc-900/30 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="border-b border-white/5 bg-zinc-900/10 px-6 py-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-violet-400">
                  <Sparkles className="size-4" /> 1. App Metadata
                </CardTitle>
                <CardDescription className="text-zinc-400 font-light mt-0.5">
                  Define the campaign basics and what users will see when they
                  complete your action.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 p-6 md:p-8">
                <div className="grid gap-2">
                  <Label
                    htmlFor="app-name"
                    className="text-zinc-300 font-medium"
                  >
                    App name
                  </Label>
                  <div className="text-sm text-zinc-500 mb-1">
                    What is your app called?
                  </div>
                  <Input
                    id="app-name"
                    type="text"
                    placeholder="Base bubbles"
                    value={campaignData.appName}
                    onChange={(e) =>
                      setCampaignData({
                        ...campaignData,
                        appName: e.target.value,
                      })
                    }
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                  />
                </div>
                <div className="grid gap-2">
                  <Label
                    htmlFor="campaign-title"
                    className="text-zinc-300 font-medium"
                  >
                    Campaign Title
                  </Label>
                  <Input
                    id="campaign-title"
                    type="text"
                    required
                    placeholder="e.g. Stake A0GI on our Newton Vault"
                    value={campaignData.title}
                    onChange={(e) =>
                      setCampaignData({
                        ...campaignData,
                        title: e.target.value,
                      })
                    }
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <Label
                      htmlFor="campaign-description"
                      className="text-zinc-300 font-medium"
                    >
                      Campaign Description
                    </Label>
                    <span className="text-xs text-zinc-500 font-light">
                      Optional
                    </span>
                  </div>
                  <Textarea
                    id="campaign-description"
                    placeholder="Provide context or instructions for participants..."
                    value={campaignData.description}
                    onChange={(e) =>
                      setCampaignData({
                        ...campaignData,
                        description: e.target.value,
                      })
                    }
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg min-h-[90px] py-3 px-4 resize-none"
                  />
                </div>

                <div className="grid gap-2">
                  <Label
                    htmlFor="app-image"
                    className="text-zinc-300 font-medium"
                  >
                    App image URL
                  </Label>
                  <div className="text-sm text-zinc-500 mb-1">
                    App image, square dimensions recommended.
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="size-11 shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 flex items-center justify-center overflow-hidden relative">
                      {campaignData.appImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={campaignData.appImage}
                          alt="App preview"
                          className="w-full h-full object-cover relative z-10"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                      <svg
                        className="size-4 text-zinc-700 absolute z-0"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          width="18"
                          height="18"
                          x="3"
                          y="3"
                          rx="2"
                          ry="2"
                        />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                    </div>
                    <Input
                      id="app-image"
                      type="url"
                      placeholder="https://example.com/image.png"
                      value={campaignData.appImage}
                      onChange={(e) =>
                        setCampaignData({
                          ...campaignData,
                          appImage: e.target.value,
                        })
                      }
                      className="flex-1 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label
                    htmlFor="reward-base-url"
                    className="text-zinc-300 font-medium"
                  >
                    Reward base URL
                  </Label>
                  <div className="text-sm text-zinc-500 mb-1">
                    Where will users perform your actions?
                  </div>
                  <Input
                    id="reward-base-url"
                    type="url"
                    placeholder="https://yourwebsite.com/..."
                    value={campaignData.rewardBaseUrl}
                    onChange={(e) =>
                      setCampaignData({
                        ...campaignData,
                        rewardBaseUrl: e.target.value,
                      })
                    }
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                  />
                  <WebPreview url={campaignData.rewardBaseUrl} />
                </div>
                <div className="grid gap-2">
                  <Label
                    htmlFor="category"
                    className="text-zinc-300 font-medium"
                  >
                    Category
                  </Label>
                  <div className="text-sm text-zinc-500 mb-1">
                    What type of action is this?
                  </div>
                  <Select
                    value={campaignData.category}
                    onValueChange={(val) =>
                      setCampaignData({ ...campaignData, category: val })
                    }
                  >
                    <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500/50 focus:ring-violet-500/20 h-11 px-4">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                      <SelectItem value="DeFi">DeFi</SelectItem>
                      <SelectItem value="NFT">NFT</SelectItem>
                      <SelectItem value="Gaming">Gaming</SelectItem>
                      <SelectItem value="Social">Social</SelectItem>
                      <SelectItem value="Bridge">Bridge</SelectItem>
                      <SelectItem value="Governance">Governance</SelectItem>
                      <SelectItem value="Payments">Payments</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Target Condition */}
          {currentStep === 2 && (
            <Card className="border border-white/5 bg-zinc-900/30 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="border-b border-white/5 bg-zinc-900/10 px-6 py-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-violet-400">
                  <Sparkles className="size-4" /> 2. Target Condition (On-Chain
                  Event)
                </CardTitle>
                <CardDescription className="text-zinc-400 font-light mt-0.5">
                  Specify which contract and event to watch for incentive
                  verification.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 p-6 md:p-8">
                <div className="grid gap-2">
                  <Label
                    htmlFor="contract-address"
                    className="text-zinc-300 font-medium"
                  >
                    Target Contract Address
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      id="contract-address"
                      type="text"
                      required={currentStep === 2}
                      placeholder="0x..."
                      value={targetContract}
                      onChange={(e) => setTargetContract(e.target.value)}
                      className="flex-1 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFetchAbi}
                      disabled={isLoadingAbi}
                      className="h-11 px-5 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900/50 font-semibold shrink-0"
                    >
                      {isLoadingAbi ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />{" "}
                          Fetching...
                        </>
                      ) : (
                        "Fetch ABI"
                      )}
                    </Button>
                  </div>
                </div>
                {abiError && (
                  <Alert
                    variant="destructive"
                    className="border-red-500/20 bg-red-500/5 py-3 rounded-xl"
                  >
                    <AlertCircle className="size-4 text-red-400" />
                    <div className="grid gap-0.5">
                      <AlertTitle className="text-red-400 font-semibold text-xs uppercase tracking-wider">
                        Verification Note
                      </AlertTitle>
                      <AlertDescription className="text-red-300 text-sm">
                        {abiError}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <Label
                      htmlFor="abi-textarea"
                      className="text-zinc-300 font-medium"
                    >
                      Target Contract ABI (JSON)
                    </Label>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setAbiText(exampleAbi)}
                      className="h-auto p-0 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      Insert Example ABI
                    </Button>
                  </div>
                  <Textarea
                    id="abi-textarea"
                    required={currentStep === 2}
                    placeholder='Paste ABI here. E.g. [{"type": "event"...}]'
                    value={abiText}
                    onChange={(e) => setAbiText(e.target.value)}
                    rows={5}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg p-4 font-mono text-xs resize-y"
                  />
                </div>
                {events.length > 0 && (
                  <div className="grid gap-6 bg-zinc-950/40 p-6 rounded-xl border border-white/5">
                    <div className="grid gap-2">
                      <Label className="text-zinc-300 font-medium">
                        Select Target Event
                      </Label>
                      <Select
                        value={selectedEventName}
                        onValueChange={(val) => setSelectedEventName(val || "")}
                      >
                        <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500/50 focus:ring-violet-500/20 text-left flex justify-between h-11 px-4">
                          <SelectValue placeholder="Select contract event" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] border-zinc-800 bg-zinc-900 text-zinc-100">
                          {events.map((e) => (
                            <SelectItem
                              key={e.name}
                              value={e.name}
                              className="hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer"
                            >
                              {e.name}(
                              {e.inputs
                                ?.map((i) => `${i.type} ${i.name}`)
                                .join(", ")}
                              )
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedEvent?.inputs &&
                      selectedEvent.inputs.length > 0 && (
                        <div className="grid gap-4 border-t border-white/5 pt-5 mt-2">
                          <Label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                            Verify Event Parameter Conditions:
                          </Label>
                          <div className="grid gap-3">
                            {selectedEvent.inputs.map((input) => {
                              const isAddress = input.type === "address";
                              const isBool = input.type === "bool";
                              return (
                                <div
                                  key={input.name}
                                  className="flex flex-col sm:flex-row sm:items-center gap-3"
                                >
                                  <span className="min-w-[200px] text-xs font-mono text-violet-400 bg-violet-950/20 border border-violet-500/10 px-3 py-2 rounded-lg truncate select-none text-left">
                                    {input.name} ({input.type})
                                    {input.indexed ? " [indexed]" : ""}
                                  </span>
                                  <span className="text-sm font-bold text-zinc-500 text-center sm:text-left min-w-[24px]">
                                    {isAddress || isBool ? "==" : ">="}
                                  </span>
                                  {isAddress ? (
                                    <div className="flex-1 max-w-full sm:max-w-[200px] flex items-center justify-between bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg h-10 px-3 text-xs font-mono select-none">
                                      <span>claimant</span>
                                      <span className="text-emerald-500 font-semibold font-sans text-[9px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                                        AUTO
                                      </span>
                                    </div>
                                  ) : isBool ? (
                                    <Select
                                      value={conditions[input.name] || "true"}
                                      onValueChange={(val) =>
                                        handleConditionChange(
                                          input.name,
                                          val || "true",
                                        )
                                      }
                                    >
                                      <SelectTrigger className="w-full sm:w-[200px] bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-violet-500/50 focus:ring-violet-500/20 h-10 px-3 text-left">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                                        <SelectItem value="true">
                                          true
                                        </SelectItem>
                                        <SelectItem value="false">
                                          false
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      type="text"
                                      placeholder="e.g. 100"
                                      value={conditions[input.name] || ""}
                                      onChange={(e) =>
                                        handleConditionChange(
                                          input.name,
                                          e.target.value,
                                        )
                                      }
                                      className="max-w-full sm:max-w-[200px] bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-10 px-3"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Budget & Rewards */}
          {currentStep === 3 && (
            <Card className="border border-white/5 bg-zinc-900/30 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="border-b border-white/5 bg-zinc-900/10 px-6 py-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-violet-400">
                  <Sparkles className="size-4" /> 3. Budget & Rewards
                </CardTitle>
                <CardDescription className="text-zinc-400 font-light mt-0.5">
                  Define the incentive tokens and total supply parameters.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 p-6 md:p-8">
                <div className="grid grid-cols-1 gap-6">
                  <div className="grid gap-2">
                    <Label
                      htmlFor="token-address"
                      className="text-zinc-300 font-medium"
                    >
                      Reward Token Address
                    </Label>
                    <Input
                      id="token-address"
                      type="text"
                      required={currentStep === 3}
                      placeholder="0x..."
                      value={campaignData.tokenAddress}
                      onChange={(e) =>
                        setCampaignData({
                          ...campaignData,
                          tokenAddress: e.target.value,
                        })
                      }
                      className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                    />
                    {symbol && (
                      <div className="mt-2 text-xs flex items-center gap-2 text-zinc-400 bg-zinc-900/30 p-2.5 rounded-lg border border-white/5 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>
                          Detected:{" "}
                          <strong>
                            {name} ({symbol})
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Decimals: <strong>{tokenDecimals}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="grid gap-2">
                    <Label
                      htmlFor="total-reward"
                      className="text-zinc-300 font-medium"
                    >
                      Total Reward Pool (tokens)
                    </Label>
                    <Input
                      id="total-reward"
                      type="number"
                      required={currentStep === 3}
                      placeholder="1000"
                      value={campaignData.totalReward}
                      onChange={(e) =>
                        setCampaignData({
                          ...campaignData,
                          totalReward: e.target.value,
                        })
                      }
                      className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label
                      htmlFor="reward-per-action"
                      className="text-zinc-300 font-medium"
                    >
                      Reward per Action (tokens)
                    </Label>
                    <Input
                      id="reward-per-action"
                      type="number"
                      required={currentStep === 3}
                      placeholder="10"
                      value={campaignData.rewardPerAction}
                      onChange={(e) =>
                        setCampaignData({
                          ...campaignData,
                          rewardPerAction: e.target.value,
                        })
                      }
                      className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Time Gates */}
          {currentStep === 4 && (
            <Card className="border border-white/5 bg-zinc-900/30 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="border-b border-white/5 bg-zinc-900/10 px-6 py-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-violet-400">
                  <Sparkles className="size-4" /> 4. Time Gates & Limits
                </CardTitle>
                <CardDescription className="text-zinc-400 font-light mt-0.5">
                  Schedule campaign run times and transaction constraints.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="grid gap-2">
                    <Label
                      htmlFor="start-time"
                      className="text-zinc-300 font-medium"
                    >
                      Start Date/Time
                    </Label>
                    <Input
                      id="start-time"
                      type="datetime-local"
                      value={campaignData.startTime}
                      onChange={(e) =>
                        setCampaignData({
                          ...campaignData,
                          startTime: e.target.value,
                        })
                      }
                      className="bg-zinc-950 border-zinc-800 text-zinc-300 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label
                      htmlFor="end-time"
                      className="text-zinc-300 font-medium"
                    >
                      End Date/Time (Optional)
                    </Label>
                    <Input
                      id="end-time"
                      type="datetime-local"
                      value={campaignData.endTime}
                      onChange={(e) =>
                        setCampaignData({
                          ...campaignData,
                          endTime: e.target.value,
                        })
                      }
                      className="bg-zinc-950 border-zinc-800 text-zinc-300 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                    />
                  </div>
                </div>
                {/* <div className="grid gap-2 max-w-full md:max-w-[388px]">
                  <Label
                    htmlFor="max-claims"
                    className="text-zinc-300 font-medium"
                  >
                    Max Claims Limit (Optional)
                  </Label>
                  <Input
                    id="max-claims"
                    type="number"
                    placeholder="e.g. 50"
                    value={campaignData.maxClaims}
                    onChange={(e) =>
                      setCampaignData({
                        ...campaignData,
                        maxClaims: e.target.value,
                      })
                    }
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg h-11 px-4"
                  />
                </div> */}
              </CardContent>
            </Card>
          )}

          {/* Form Actions / Stepper Navigation */}
          <div className="flex justify-between items-center pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1 || isUploading}
              className="border-zinc-800 text-zinc-300 hover:text-white"
            >
              Previous
            </Button>

            {currentStep < totalSteps ? (
              <Button
                type="button"
                onClick={nextStep}
                className="bg-zinc-100 hover:bg-white text-zinc-900 font-semibold px-8"
              >
                Next Step
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleReviewClick}
                disabled={isUploading}
                className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white font-bold border-0 shadow-lg shadow-violet-500/20 px-8"
              >
                Review Campaign
              </Button>
            )}
          </div>

          {uploadStatus && (
            <Alert
              variant="default"
              className="border-emerald-500/20 bg-emerald-500/5 py-4 rounded-xl mt-4"
            >
              <CheckCircle2 className="size-4 text-emerald-400" />
              <AlertTitle className="text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                Success
              </AlertTitle>
              <AlertDescription className="text-emerald-300 text-sm">
                {uploadStatus}
              </AlertDescription>
            </Alert>
          )}

          {/* Confirmation Dialog */}
          <Dialog
            open={isConfirmDialogOpen}
            onOpenChange={setIsConfirmDialogOpen}
          >
            <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">Review Campaign</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Please confirm the details before deploying to the 0G Network.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4 text-sm">
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-zinc-500">Title:</span>
                  <span className="col-span-2 font-medium">
                    {campaignData.title || "-"}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-start gap-4">
                  <span className="text-zinc-500">Description:</span>
                  <span className="col-span-2 font-medium text-zinc-300 break-words line-clamp-3">
                    {campaignData.description || "-"}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-zinc-500">Category:</span>
                  <span className="col-span-2 font-medium">
                    {campaignData.category || "-"}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-zinc-500">Target Event:</span>
                  <span className="col-span-2 font-medium text-violet-400">
                    {selectedEventName}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-zinc-500">Total Reward:</span>
                  <span className="col-span-2 font-medium">
                    {campaignData.totalReward} {symbol || "Tokens"}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-zinc-500">Per Action:</span>
                  <span className="col-span-2 font-medium">
                    {campaignData.rewardPerAction} {symbol || "Tokens"}
                  </span>
                </div>
              </div>

              <DialogFooter className="gap-3 sm:gap-0 sm:space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setIsConfirmDialogOpen(false)}
                  className="border-zinc-800 text-zinc-300 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeploy}
                  disabled={isUploading}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Deploying...
                    </>
                  ) : (
                    "Confirm & Deploy"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </form>
      </main>
    </div>
  );
}

const exampleAbi = `[
  {
    "type": "event",
    "name": "Staked",
    "inputs": [
      { "name": "user", "type": "address", "indexed": true },
      { "name": "amount", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SwapCompleted",
    "inputs": [
      { "name": "user", "type": "address", "indexed": true },
      { "name": "amountIn", "type": "uint256", "indexed": false },
      { "name": "amountOut", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Minted",
    "inputs": [
      { "name": "user", "type": "address", "indexed": true },
      { "name": "tokenId", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  }
]`;
