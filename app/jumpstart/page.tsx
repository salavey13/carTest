"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FaRocket, FaGamepad, FaBoxOpen, FaBullseye, FaHandHoldingDollar, FaBrain, FaCubes, FaUsers, FaChartLine, FaRobot, FaMoneyBillWave, FaExternalLinkAlt, FaArrowUpRightFromSquare, FaLightbulb, FaRoad, FaFileCode, FaEye, FaArrowsSpin, FaNetworkWired, FaComments, FaWandMagicSparkles, FaListCheck, FaEnvelopeOpenText, FaShareAlt, FaPlay, FaLevelUpAlt, FaTachometerAlt, FaBolt, FaGift // Added FaBolt, FaGift
} from "react-icons/fa6"; 
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import SupportForm from "@/components/SupportForm"; 

// Placeholder URL
const PLACEHOLDER_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iIzQwNDA0MCIvPjwvc3ZnPg==";

export default function JumpstartPage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const userName = user?.first_name || 'Viberider'; 

  useEffect(() => {
    setIsMounted(true);
    debugLogger.log("[JumpstartPage] Mounted.");
  }, []);

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">Loading Supervibe Protocol...</p>
      </div>
    );
  }

  return ( // Added parentheses here
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-950 via-black to-purple-900/20 text-gray-200">
      {/* Subtle Background Grid */}
       <div
         className="absolute inset-0 bg-repeat opacity-[0.03] z-0"
         style={{
           backgroundImage: `linear-gradient(to right, rgba(174, 255, 0, 0.5) 1px, transparent 1px),
                             linear-gradient(to bottom, rgba(174, 255, 0, 0.5) 1px, transparent 1px)`,
           backgroundSize: '40px 40px',
         }}
       ></div>

      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-5xl mx-auto bg-black/90 backdrop-blur-xl text-white rounded-3xl border-2 border-neon-lime/50 shadow-[0_0_40px_rgba(174,255,0,0.4)]">
            <CardHeader className="text-center border-b border-neon-lime/30 pb-6 pt-8">
              <FaGift className="text-7xl text-neon-lime mx-auto mb-5 animate-pulse" /> {/* Changed icon */}
              <CardTitle className="text-4xl md:text-6xl font-bold text-neon-lime cyber-text glitch uppercase tracking-widest" data-text="Supervibe Jumpstart Kit">
                Supervibe Jumpstart Kit
              </CardTitle>
              <p className="text-lg md:text-xl text-gray-300 mt-5 font-mono max-w-3xl mx-auto">
                **Pimp Your Friend's** (or Your Own) **Dream:** Get a FREE, AI-Powered Biz Engine. Ready for XTRs in Minutes.
              </p>
            </CardHeader>

            <CardContent className="space-y-16 p-5 md:p-10">

              {/* Section 1: Why Start from Zero? */}
              <section className="space-y-5">
                <h2 className="flex items-center text-3xl md:text-4xl font-semibold text-brand-pink mb-4">
                  <FaRoad className="mr-4 text-brand-pink/80 flex-shrink-0" /> Skip the Bullshit Setup Grind.
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div>
                     <p className="text-gray-300 text-lg md:text-xl leading-relaxed">
                       Building from scratch? That's old matrix code. Takes forever. People ask "Where's the money?" when you're still debugging login forms. Reading <Link href="/selfdev" className="text-brand-blue hover:underline font-semibold">philosophy</Link> is cool, but it doesn't pay the bills *today*.
                     </p>
                     <p className="mt-4 text-gray-400 text-base leading-relaxed">
                       I (<Link href="/about" className="text-brand-blue hover:underline font-semibold">Pavel</Link>) already did the hard yards. Years of coding, security battles, VIBE refinement. **My grind is now your gain.** It's all encoded in this kit.
                     </p>
                     <p className="mt-4 text-brand-pink font-bold text-xl">You don't need my history. You need a **working engine** and **AI buddies**, like fucking Iron Man. Reality, 2025.</p>
                  </div>
                  <div className="p-2 border border-brand-pink/40 rounded-lg bg-black/40 shadow-lg">
                     {/* // TODO: Add visual: [Prompt: Image comparing a complex, confusing blueprint (old way) vs a sleek, plug-and-play cybernetic module labeled 'Supervibe Jumpstart Kit'] */}
                     <Image src={PLACEHOLDER_URL} alt="Old complex setup vs Instant Supervibe Kit" width={600} height={338} className="rounded-md opacity-80" loading="lazy" />
                     <p className="text-xs text-center text-gray-500 mt-1 italic">Stop wiring. Start VIBING.</p>
                  </div>
                </div>
              </section>

              {/* Section 2: Get Your Engine (The Golden Brick) */}
              <section className="space-y-5 bg-gradient-to-br from-neon-lime/10 via-black/50 to-brand-purple/10 border-2 border-neon-lime/30 p-6 md:p-8 rounded-2xl shadow-glow-lg">
                <h2 className="flex items-center text-3xl md:text-4xl font-semibold text-neon-lime mb-5 justify-center">
                  <FaBolt className="mr-4 text-neon-lime/90 flex-shrink-0" /> Instant Biz Engine: Plug & Play!
                </h2>
                 <p className="text-center text-gray-200 text-lg md:text-xl leading-relaxed mb-6 max-w-3xl mx-auto">
                   This ain't just code; it's a **launchpad**. Fork the repo, set **ONE** Telegram Bot Token in Vercel, deploy. Bam! You (or your friend) have a working site, ready for:
                 </p>
                 <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-6 text-center">
                    <li><FaMoneyBillWave className="inline mr-2 text-brand-green"/> Accepting Donations / Tips (XTR ready!)</li>
                    <li><FaEnvelopeOpenText className="inline mr-2 text-brand-blue"/> Handling Support Invoices</li>
                    <li><FaRobot className="inline mr-2 text-brand-purple"/> Basic Bot Management via Dashboard</li>
                    <li><FaFileCode className="inline mr-2 text-brand-orange"/> Easy Content Updates</li>
                 </ul>
                 <p className="text-center text-gray-200 text-lg md:text-xl leading-relaxed mb-6 max-w-3xl mx-auto">
                   Powered by the **Bot Crew** and the **Supervibe OS**, managed through your **Game Dashboard**. Zero upfront cost. Just the 87/13% Vibe Pact on future profits.
                 </p>
                  {/* // TODO: Add visual: [Prompt: Animated GIF or short video showing: 1. GitHub Fork button click -> 2. Vercel deploy screen with one ENV VAR field -> 3. Live site preview with working donation button] */}
                 <div className="p-2 border border-neon-lime/30 rounded-lg bg-black/30 my-6 max-w-3xl mx-auto">
                   <Image src={PLACEHOLDER_URL} alt="Visual: 5-Minute Setup - Fork, ENV, Deploy, Live!" width={800} height={450} className="rounded-md opacity-70" loading="lazy" />
                   <p className="text-xs text-center text-gray-400 mt-1 italic">Seriously. Fork -> Set Token -> Deploy -> Profit? (Okay, needs *your* niche vibe too).</p>
                 </div>
              </section>

              {/* Section 3: The Speedrun Game */}
              <section className="space-y-6">
                <h2 className="flex items-center justify-center text-3xl md:text-4xl font-semibold text-brand-blue mb-6">
                  <FaGamepad className="mr-3 text-brand-blue/80" /> The Game: Level Up Your Vibe & XTRs
                </h2>
                 {/* // TODO: Add visual: [Prompt: Cyberpunk game HUD interface mockup showing 'Rilmonetometer (XTR)', 'Active Bots: 1/5', 'Next Quest: First Sale', 'VIBE Skill: Validation Unlocked'] */}
                <div className="p-2 border border-brand-blue/30 rounded-lg bg-black/30 my-6 max-w-4xl mx-auto">
                  <Image src={PLACEHOLDER_URL} alt="Supervibe Gamified Dashboard HUD Mockup" width={800} height={450} className="rounded-md opacity-70" loading="lazy" />
                  <p className="text-xs text-center text-gray-400 mt-1 italic">Mission Control: Less spreadsheet, more high score.</p>
                </div>

                <div className="space-y-6">
                  {/* More concise levels, focusing on the instant start & AI */}
                  <Card className="bg-gray-900/60 border border-gray-600 hover:border-gray-400 transition-colors">
                    <CardHeader><CardTitle className="text-xl text-gray-300">Level 1: ONLINE <FaPlay className="inline ml-2 text-green-500"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">Deploy the kit (5 min). Bot guides basic niche setup. **Quest:** Get your personalized engine running.</p></CardContent>
                  </Card>
                  <Card className="bg-purple-900/30 border border-brand-purple/40 hover:border-purple-300 transition-colors">
                    <CardHeader><CardTitle className="text-xl text-brand-purple">Level 2: ENGAGE <FaBullseye className="inline ml-2 text-purple-400"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">Bot probes market, you talk to humans. **Quest:** First real interaction/payment. **Rilmonetometer GO!** Contextual VIBE tips unlock.</p></CardContent>
                  </Card>
                  <Card className="bg-green-900/30 border border-brand-green/40 hover:border-green-300 transition-colors">
                    <CardHeader><CardTitle className="text-xl text-brand-green">Level 3: AUTOMATE <FaArrowsSpin className="inline ml-2 text-green-400"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">Train your Bot Manager via dashboard. See profit metrics. **Quest:** Hit positive XTR flow. **Learn:** Core `SelfDev` automation loops.</p></CardContent>
                  </Card>
                  <Card className="bg-orange-900/30 border border-brand-orange/40 hover:border-orange-300 transition-colors">
                     <CardHeader><CardTitle className="text-xl text-brand-orange">Level 4: EXPAND <FaUsers className="inline ml-2 text-orange-400"/></CardTitle></CardHeader>
                     <CardContent><p className="text-sm text-gray-300">Deploy specialized Bots. Focus *only* on your unique human value-add. **Quest:** Scale profit OR free up your time drastically.</p></CardContent>
                  </Card>
                   <Card className="bg-neon-lime/10 border-2 border-neon-lime/50 shadow-glow-md hover:border-neon-lime transition-colors">
                     <CardHeader><CardTitle className="text-xl text-neon-lime">Level 5: THRIVE <FaTachometerAlt className="inline ml-2 text-lime-300"/></CardTitle></CardHeader>
                     <CardContent><p className="text-sm text-gray-200">System hums. You guide, strategize, or... jump to the next game! **Quest:** Sustainable profit with minimal direct ops. **F*ck Off Independence Achieved.**</p></CardContent>
                  </Card>
                  {/* Level 6 implicit: You repeat the cycle or exit */}
                </div>
                 {/* // TODO: Link specific quests to unlocking features in the dashboard or enabling new bot capabilities. */}
                 {/* // TODO: Integrate Configame mention maybe in Level 1 or as a related tool. */}
              </section>

              {/* Section 4: The Engine (Concise) */}
              <section className="space-y-5 pt-8 border-t border-gray-700">
                <h2 className="flex items-center justify-center text-3xl md:text-4xl font-semibold text-brand-cyan mb-4">
                  <FaCubes className="mr-3 text-brand-cyan/80" /> Built on Supervibe Tech
                </h2>
                <p className="text-center text-gray-400 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
                  This runs on the <Link href="/about" className="text-brand-blue hover:underline">VIBE methodology</Link>, leveraging AI via the <Link href="/repo-xml" className="text-brand-blue hover:underline">Supervibe Studio</Link> concepts, all on secure <strong className="text-gray-200">oneSitePls</strong> infrastructure. We handle the complex backend, you handle the VIBE.
                </p>
                 {/* // TODO: Add visual: [Prompt: Abstract neon graphic showing interconnected nodes: 'User Dashboard', 'Bot Crew AI', 'VIBE OS', 'oneSitePls Infra', 'XTR Ledger'] */}
              </section>

              {/* Section 5: Call to Action */}
              <section className="text-center border-t-2 border-neon-lime/40 pt-12 mt-12">
                <h2 className="text-4xl md:text-5xl font-bold text-neon-lime mb-6 uppercase tracking-wide">Pimp Your Future, {userName}.</h2>
                <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-5 max-w-3xl mx-auto">
                   Stop waiting. Start *doing*. Get your Jumpstart Kit. Help a friend launch theirs. Build the future, faster. Less serious, more results. That's the Supervibe way.
                </p>
                <p className="font-semibold text-xl text-neon-lime mb-6">
                    Launch Cost: 0 XTR. Success Tip: 13% Profit.
                </p>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-neon-lime via-brand-green to-cyan-400 text-black font-extrabold py-4 px-10 rounded-full text-xl shadow-glow-lg hover:scale-105 transform transition duration-300 animate-bounce"
                  onClick={() => {
                    const formElement = document.getElementById('jumpstart-form');
                    formElement?.scrollIntoView({ behavior: 'smooth' });
                   }}
                >
                  <FaRocket className="mr-3"/> GET MY INSTANT AI-BIZ KIT!
                </Button>

                 <div id="jumpstart-form" className="mt-16 max-w-lg mx-auto">
                    <h3 className="text-2xl font-semibold text-neon-lime mb-5">Apply / Ask Questions:</h3>
                    <SupportForm />
                 </div>
              </section>

            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}