"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FaRocket, FaGamepad, FaBoxOpen, FaBullseye, FaHandHoldingDollar, FaBrain, FaCubes, FaUsers, FaChartLine, FaRobot, FaMoneyBillWave, FaExternalLinkAlt, FaArrowUpRightFromSquare, FaLightbulb, FaRoad, FaFileCode, FaEye, FaArrowsSpin, FaNetworkWired, FaComments, FaWandMagicSparkles, FaListCheck, FaEnvelopeOpenText, FaShareAlt, FaPlay, FaLevelUpAlt, FaTachometerAlt // FaShareAlt, FaPlay, FaLevelUpAlt, FaTachometerAlt added
} from "react-icons/fa6"; 
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import SupportForm from "@/components/SupportForm"; 

// Generic placeholder for images
const PLACEHOLDER_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iIzQwNDA0MCIvPjwvc3ZnPg=="; // Slightly darker placeholder

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
        <p className="text-brand-green animate-pulse text-xl font-mono">Initializing Supervibe Protocol...</p>
      </div>
    );
  }

  // FIX: Added parentheses around the returned JSX block
  return ( 
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-dark-bg text-gray-200">
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
              <FaRocket className="text-7xl text-neon-lime mx-auto mb-5 animate-pulse" />
              <CardTitle className="text-4xl md:text-6xl font-bold text-neon-lime cyber-text glitch uppercase tracking-widest" data-text="Supervibe Speedrun">
                Supervibe Speedrun
              </CardTitle>
              <p className="text-lg md:text-xl text-gray-300 mt-5 font-mono max-w-3xl mx-auto">
                Launch a Real, AI-Powered Biz. Faster Than Beating Cyberpunk. Earn Actual XTRs. <strong className="text-neon-lime">This Ain't Your Grandpa's Startup Grind.</strong>
              </p>
            </CardHeader>

            <CardContent className="space-y-16 p-5 md:p-10">

              {/* Section 1: The Old Matrix is Broken */}
              <section className="space-y-5">
                <h2 className="flex items-center text-3xl md:text-4xl font-semibold text-brand-pink mb-4">
                  <FaRoad className="mr-4 text-brand-pink/80 flex-shrink-0" /> F*ck The Slow Lane.
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div>
                     <p className="text-gray-300 text-lg md:text-xl leading-relaxed">
                       The old way? Build forever, beg for traction, drown in theory (<Link href="/selfdev" className="text-brand-blue hover:underline font-semibold">SelfDev</Link>, <Link href="/purpose-profit" className="text-brand-purple hover:underline font-semibold">P&P</Link> – good shit, but later!), and pray someone asks *"where money?"* AFTER you have it.
                     </p>
                     <p className="mt-4 text-gray-400 text-base leading-relaxed">
                       Look at me (<Link href="/about" className="text-brand-blue hover:underline font-semibold">Pavel</Link>) - years of enterprise grind, *then* vibing this out. Took ages. **My experience is now encoded into the system.** You don't need my backstory to succeed *faster*.
                     </p>
                     <p className="mt-4 text-brand-pink font-bold text-xl">If I could VIBE this, YOU can VIBE it 10x faster with the right tools.</p>
                  </div>
                  <div className="p-2 border border-brand-pink/40 rounded-lg bg-black/40 shadow-lg">
                     {/* // TODO: Add visual: [Prompt: Glitching, dissolving image of Peldi's slow business ladder, contrasted with a neon Supervibe rocket trail] */}
                     <Image src={PLACEHOLDER_URL} alt="Old slow journey vs Supervibe Speedrun" width={600} height={338} className="rounded-md opacity-80" loading="lazy" />
                     <p className="text-xs text-center text-gray-500 mt-1 italic">Old path = Dial-up. Supervibe = Neuralink download.</p>
                  </div>
                </div>
              </section>

              {/* Section 2: The Jumpstart Kit (Your Golden Brick) */}
              <section className="space-y-5 bg-gradient-to-br from-neon-lime/10 via-black/50 to-brand-purple/10 border-2 border-neon-lime/30 p-6 md:p-8 rounded-2xl shadow-glow-lg">
                <h2 className="flex items-center text-3xl md:text-4xl font-semibold text-neon-lime mb-5 justify-center">
                  <FaBoxOpen className="mr-4 text-neon-lime/90 flex-shrink-0" /> Your Supervibe Jumpstart Engine
                </h2>
                 <p className="text-center text-gray-200 text-lg md:text-xl leading-relaxed mb-6 max-w-3xl mx-auto">
                   We're not teaching you to build the car. We're handing you the keys to a **pre-tuned, AI-boosted Cyber-Rig** ready for *your* custom paint job and mission. This is the **Golden Brick**.
                 </p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-black/50 rounded-lg border border-gray-700 hover:border-brand-green transition-all">
                        <FaFileCode className="text-4xl text-brand-green mx-auto mb-2"/>
                        <h4 className="font-semibold text-lg text-brand-green">Turnkey App</h4>
                        <p className="text-xs text-gray-400">Secure, VIBE-ready web app template.</p>
                    </div>
                     <div className="p-4 bg-black/50 rounded-lg border border-gray-700 hover:border-brand-purple transition-all">
                        <FaRobot className="text-4xl text-brand-purple mx-auto mb-2"/>
                        <h4 className="font-semibold text-lg text-brand-purple">Bot Crew</h4>
                        <p className="text-xs text-gray-400">AI agents for setup, marketing, ops.</p>
                    </div>
                     <div className="p-4 bg-black/50 rounded-lg border border-gray-700 hover:border-brand-blue transition-all">
                        <FaGamepad className="text-4xl text-brand-blue mx-auto mb-2"/>
                        <h4 className="font-semibold text-lg text-brand-blue">Game Dashboard</h4>
                        <p className="text-xs text-gray-400">Mission control, metrics, VIBE quests.</p>
                    </div>
                     <div className="p-4 bg-black/50 rounded-lg border border-gray-700 hover:border-neon-lime transition-all">
                        <FaHandHoldingDollar className="text-4xl text-neon-lime mx-auto mb-2"/>
                        <h4 className="font-semibold text-lg text-neon-lime">87/13% Pact</h4>
                        <p className="text-xs text-gray-400">Zero upfront. Share profit *after* you win.</p>
                    </div>
                 </div>
                 {/* // TODO: Add visual: [Prompt: Cyberpunk interface displaying the Jumpstart Kit components as selectable modules - App, Bot Crew, Dashboard, Vibe Pact] */}
              </section>

              {/* Section 3: The Speedrun Levels */}
              <section className="space-y-6">
                <h2 className="flex items-center justify-center text-3xl md:text-4xl font-semibold text-brand-blue mb-6">
                  <FaLevelUpAlt className="mr-3 text-brand-blue/80" /> Speedrun Levels: Vibe to XTRs
                </h2>
                {/* // TODO: Add visual: [Prompt: Dynamic, cyberpunk skill-tree or mission flowchart graphic, nodes lighting up as levels progress, showing connections between quests, bot assists, and the Rilmonetometer] */}
                <div className="p-2 border border-brand-blue/30 rounded-lg bg-black/30 my-6 max-w-4xl mx-auto">
                  <Image src={PLACEHOLDER_URL} alt="Supervibe Speedrun Levels / Skill Tree Mockup" width={800} height={450} className="rounded-md opacity-70" loading="lazy" />
                  <p className="text-xs text-center text-gray-400 mt-1 italic">Your path: Less theory, more doing, faster rewards.</p>
                </div>

                <div className="space-y-8">
                  {/* Simplified Level descriptions - focusing on action/outcome */}
                  <Card className="bg-gray-900/50 border border-gray-700">
                    <CardHeader><CardTitle className="text-xl text-gray-400">Level 1: IGNITION <FaPlay className="inline ml-2 text-gray-500"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">Bot helps pick & personalize your template. **Quest:** Launch your site (<1hr). **Peldi Tactic:** Initial Niche Definition.</p></CardContent>
                  </Card>
                  <Card className="bg-purple-900/20 border border-brand-purple/40">
                    <CardHeader><CardTitle className="text-xl text-brand-purple">Level 2: TRACTION <FaBullseye className="inline ml-2 text-purple-500"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">Bot tests outreach. `AI Validation` checks vibes. Talk to first leads. **Quest:** First Client/Sale! **Rilmonetometer ACTIVATED.** **Peldi Tactic:** Desk Research + Qualitative Feedback.</p></CardContent>
                  </Card>
                  <Card className="bg-green-900/20 border border-brand-green/40">
                    <CardHeader><CardTitle className="text-xl text-brand-green">Level 3: SYSTEMIZE <FaArrowsSpin className="inline ml-2 text-green-500"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">Bot automates tasks. Dashboard shows profit. Document one process. **Quest:** Consistent Cash Flow (1 Month). **Earn Real XTRs!** **Peldi Tactic:** Accountability Chart (You/Bot), Pick Page.</p></CardContent>
                  </Card>
                  <Card className="bg-orange-900/20 border border-brand-orange/40">
                     <CardHeader><CardTitle className="text-xl text-brand-orange">Level 4: BOT CREW <FaUsers className="inline ml-2 text-orange-500"/></CardTitle></CardHeader>
                     <CardContent><p className="text-sm text-gray-300">Deploy specialized bots. Track their performance. Define *your* high-value tasks. **Quest:** Delegate 50%+ Ops OR Double Profit. **Peldi Tactic:** Skills Maps, Team Agreements.</p></CardContent>
                  </Card>
                   <Card className="bg-neon-lime/10 border-2 border-neon-lime/50 shadow-glow-md">
                     <CardHeader><CardTitle className="text-xl text-neon-lime">Level 5: AUTOPILOT <FaTachometerAlt className="inline ml-2 text-lime-400"/></CardTitle></CardHeader>
                     <CardContent><p className="text-sm text-gray-200">System runs mostly on AI & processes. You guide strategy. **Quest:** Profitable <5hrs/wk Ops (3 Months). **Max XTR Flow!** **Peldi Tactic:** CEO Clarity, Run As If To Sell.</p></CardContent>
                  </Card>
                  <Card className="bg-gray-900/50 border border-gray-700">
                     <CardHeader><CardTitle className="text-xl text-gray-400">Level 6: NEXT JUMP <FaShareAlt className="inline ml-2 text-gray-500"/></CardTitle></CardHeader>
                     <CardContent><p className="text-sm text-gray-300">Package your Golden Bricks. AI scouts next opportunities. **Quest:** Onboard a friend OR achieve exit/valuation goal. **Peldi Tactic:** Restart Speedrun, 2.0x speed!</p></CardContent>
                  </Card>
                </div>
                {/* // TODO: Refine quest details/metrics based on initial user feedback and technical feasibility. */}
                {/* // TODO: Add more contextual links to /selfdev, /purpose-profit, /repo-xml within level descriptions. */}
              </section>

              {/* Section 4: The Engine (Kept concise) */}
              <section className="space-y-5 pt-8 border-t border-gray-700">
                <h2 className="flex items-center justify-center text-3xl md:text-4xl font-semibold text-brand-cyan mb-4">
                  <FaCubes className="mr-3 text-brand-cyan/80" /> Your AI Engine
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                    <div className="p-5 bg-gray-800/60 rounded-xl border border-gray-700">
                        <FaRobot className="text-5xl text-brand-purple mx-auto mb-3"/>
                        <h4 className="font-semibold text-xl text-brand-purple mb-1">Smart Bot Crew</h4>
                        <p className="text-sm text-gray-400">Handles the grind, learns from you.</p>
                    </div>
                     <div className="p-5 bg-gray-800/60 rounded-xl border border-gray-700">
                        <FaGamepad className="text-5xl text-brand-blue mx-auto mb-3"/>
                        <h4 className="font-semibold text-xl text-brand-blue mb-1">VIBE OS Dashboard</h4>
                        <p className="text-sm text-gray-400">Your intuitive mission control.</p>
                    </div>
                     <div className="p-5 bg-gray-800/60 rounded-xl border border-gray-700">
                        <FaShieldHalved className="text-5xl text-brand-green mx-auto mb-3"/>
                        <h4 className="font-semibold text-xl text-brand-green mb-1">Solid Foundation</h4>
                        <p className="text-sm text-gray-400">Secure, scalable oneSitePls tech.</p>
                    </div>
                 </div>
              </section>

              {/* Section 5: Call to Action */}
              <section className="text-center border-t-2 border-neon-lime/40 pt-12 mt-12">
                <h2 className="text-4xl md:text-5xl font-bold text-neon-lime mb-6 uppercase tracking-wide">Ready to Vibe, {userName}?</h2>
                <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-5 max-w-3xl mx-auto">
                  Stop watching tutorials, start launching realities. This kit is your shortcut. **Pimp your *own* future, or pimp your friend's.**
                </p>
                <p className="font-semibold text-xl text-neon-lime mb-6">
                    Launch Cost: 0. Success Cost: 13% Profit Tip.
                </p>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-neon-lime via-brand-green to-cyan-400 text-black font-extrabold py-4 px-10 rounded-full text-xl shadow-glow-lg hover:scale-105 transform transition duration-300 animate-bounce"
                  onClick={() => {
                    const formElement = document.getElementById('jumpstart-form');
                    formElement?.scrollIntoView({ behavior: 'smooth' });
                   }}
                >
                  <FaRocket className="mr-3"/> INITIATE SPEEDRUN!
                </Button>

                 <div id="jumpstart-form" className="mt-16 max-w-lg mx-auto">
                    <h3 className="text-2xl font-semibold text-neon-lime mb-5">Secure Your Kit / Ask Anything:</h3>
                    <SupportForm />
                     {/* // TODO: Customize SupportForm for Jumpstart context if needed (e.g., different placeholder text). */}
                 </div>
              </section>

            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}