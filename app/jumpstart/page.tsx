// PR Title: feat: Create Supervibe Jumpstart Playbook page for AI-accelerated maker journey
"use client";

// Привет! Эта страница описывает новую концепцию "Supervibe Jumpstart". 
// Мы предлагаем готовый, работающий шаблон AI-усиленного бизнеса (например, сайт для нишевых услуг), 
// управляемый через Telegram-бота и дашборд. Пользователь получает его бесплатно, 
// учится VIBE/SelfDev на практике, зарабатывает и делится 13% прибыли как "чаевыми" за систему.
// Цель - ускорить путь мейкера к прибыльности и независимости с помощью AI.



import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FaRocket, FaGamepad, FaBoxOpen, FaBullseye, FaHandHoldingDollar, FaBrain, FaCubes, FaUsers, FaChartLine, FaRobot, FaMoneyBillWave, FaExternalLinkAlt, FaArrowUpRightFromSquare, FaLightbulb, FaRoad, FaFileCode, FaEye, FaArrowsSpin, FaNetworkWired, FaComments, FaWandMagicSparkles, FaListCheck, FaEnvelopeOpenText // Corrected icons
} from "react-icons/fa6"; // Corrected import
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import SupportForm from "@/components/SupportForm"; // Assuming you want the form here too

// Generic placeholder for images
const PLACEHOLDER_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMzOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMzOCIgZmlsbD0iIzMxMzEzMSIvPjwvc3ZnPg==";

export default function JumpstartPage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const userName = user?.first_name || 'Viberider'; // Default name

  useEffect(() => {
    setIsMounted(true);
    debugLogger.log("[JumpstartPage] Mounted.");
  }, []);

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">Loading Jumpstart Protocol...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      {/* Subtle Background */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-black via-purple-900/10 to-blue-900/10 opacity-30 z-0"
        style={{ mixBlendMode: 'overlay' }}
      ></div>

      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-5xl mx-auto bg-black/85 backdrop-blur-lg text-white rounded-3xl border border-neon-lime/40 shadow-[0_0_30px_rgba(174,255,0,0.3)]">
            <CardHeader className="text-center border-b border-neon-lime/30 pb-6">
              <FaRocket className="text-6xl text-neon-lime mx-auto mb-4 animate-pulse" />
              <CardTitle className="text-3xl md:text-5xl font-bold text-neon-lime cyber-text glitch uppercase tracking-wider" data-text="Supervibe Jumpstart">
                Supervibe Jumpstart
              </CardTitle>
              <p className="text-md md:text-lg text-gray-300 mt-4 font-mono">
                Skip the Grind. Get an AI-Powered Business. Learn by Earning. Keep 87%.
              </p>
            </CardHeader>

            <CardContent className="space-y-16 p-4 md:p-8">

              {/* Section 1: The Problem */}
              <section className="space-y-5">
                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-pink mb-4">
                  <FaRoad className="mr-3 text-brand-pink/80" /> The Old Way Sucks: Why Makers Stall
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                      You've got the vision, the hustle. You know AI can 10x things. But the typical maker journey is a slow, uncertain climb:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 mt-4 text-base md:text-lg">
                      <li>Endless building *before* validation.</li>
                      <li>The "Show me the money!" paradox.</li>
                      <li>Learning theory (like <Link href="/selfdev" className="text-brand-blue hover:underline">SelfDev</Link> or <Link href="/purpose-profit" className="text-brand-purple hover:underline">Purpose & Profit</Link>) feels disconnected from making rent.</li>
                      <li>You're forced into being CEO before you've even proven you're a Successful Maker.</li>
                    </ul>
                    <p className="mt-4 text-brand-pink font-semibold text-lg">It's time to speedrun this shit.</p>
                  </div>
                  <div className="p-2 border border-brand-pink/30 rounded-lg bg-black/30 opacity-70">
                     {/* Placeholder for Peldi's cracked ladder visual */}
                     <Image src={PLACEHOLDER_URL} alt="Old, slow maker journey visualized" width={600} height={338} className="rounded-md" loading="lazy" />
                     <p className="text-xs text-center text-gray-400 mt-1 italic">The traditional path: Slow, risky, frustrating.</p>
                  </div>
                </div>
              </section>

              {/* Section 2: The Solution */}
              <section className="space-y-5 bg-neon-lime/5 border border-neon-lime/20 p-6 rounded-xl">
                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-neon-lime mb-4">
                  <FaBoxOpen className="mr-3 text-neon-lime/80" /> The Solution: Your Supervibe Jumpstart Kit
                </h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                   <div className="p-2 border border-neon-lime/30 rounded-lg bg-black/30">
                      {/* Placeholder for Rocket Ship visual */}
                      <Image src={PLACEHOLDER_URL} alt="Supervibe Jumpstart Rocket Ship" width={600} height={338} className="rounded-md" loading="lazy" />
                      <p className="text-xs text-center text-gray-400 mt-1 italic">Blast past the grind with AI.</p>
                   </div>
                   <div>
                      <p className="text-gray-200 text-base md:text-lg leading-relaxed mb-4">
                        Stop building boilerplate. We hand you a **Golden Brick**: an AI-enhanced, nearly complete business template, ready for *your* unique spin.
                      </p>
                      <strong className="text-neon-lime font-semibold">What's in the Kit:</strong>
                      <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 mt-2 text-base md:text-lg">
                        <li><strong className="text-neon-lime">Proven App Template:</strong> Secure, VIBE-structured (e.g., Niche Service Site).</li>
                        <li><strong className="text-neon-lime">Your "Bot Manager" Agent:</strong> AI to handle setup, basic tasks, powered by our <Link href="/repo-xml" className="text-brand-blue hover:underline">Supervibe Studio</Link> tech.</li>
                        <li><strong className="text-neon-lime">Gamified Dashboard:</strong> Track progress, manage AI, learn VIBE contextually.</li>
                        <li><strong className="text-neon-lime">The Deal:</strong> Free upfront. Launch, earn, learn. Share 13% profit as a "tip".</li>
                      </ul>
                    </div>
                </div>
              </section>

              {/* Section 3: The "Game" */}
              <section className="space-y-6">
                <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-blue mb-6">
                  <FaGamepad className="mr-3 text-brand-blue/80" /> The Game: Levels to F*ck Off Independence
                </h2>
                {/* Placeholder for Dashboard Mockup */}
                <div className="p-2 border border-brand-blue/30 rounded-lg bg-black/30 my-6 max-w-3xl mx-auto">
                  <Image src={PLACEHOLDER_URL} alt="Gamified Supervibe Dashboard Mockup" width={800} height={450} className="rounded-md" loading="lazy" />
                  <p className="text-xs text-center text-gray-400 mt-1 italic">Your Mission Control: Track quests, cash flow, and VIBE mastery.</p>
                </div>

                <div className="space-y-8">
                  {/* Level 0 */}
                  <div className="p-4 bg-gray-800/40 border border-gray-600 rounded-lg">
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">Level 0: Kit Unboxing <span className="text-sm font-mono">(Instant Maker!)</span></h3>
                    <p className="text-sm text-gray-300">Get access, meet your Bot Manager. <strong className="text-gray-400">Quest:</strong> Quick setup.</p>
                  </div>
                  {/* Level 1 */}
                  <div className="p-4 bg-purple-900/30 border border-brand-purple/40 rounded-lg">
                    <h3 className="text-xl font-semibold text-brand-purple mb-2">Level 1: Niche Down & Launch <span className="text-sm font-mono">(You ARE the Niche!)</span></h3>
                    <p className="text-sm text-gray-300">Bot guides customization (branding, payments). <strong className="text-brand-purple">Quest:</strong> Go Live! </p>
                    <p className="text-xs font-mono text-purple-400 mt-1">Meter Check: `Validation Score: 20/100`</p>
                  </div>
                  {/* Level 2 */}
                  <div className="p-4 bg-blue-900/30 border border-brand-blue/40 rounded-lg">
                    <h3 className="text-xl font-semibold text-brand-blue mb-2">Level 2: First Contact & Cash <span className="text-sm font-mono">(Successful Maker Training)</span></h3>
                    <p className="text-sm text-gray-300">Bot handles basic outreach/support. Learn VIBE contextually. <strong className="text-brand-blue">Quest:</strong> First Sale!</p>
                    <p className="text-xs font-mono text-blue-400 mt-1">Meter Check: `Rilmonetometer: ACTIVATED`, `Community Score: 10/100`</p>
                  </div>
                  {/* Level 3 */}
                  <div className="p-4 bg-green-900/30 border border-brand-green/40 rounded-lg">
                     <h3 className="text-xl font-semibold text-brand-green mb-2">Level 3: Optimize & Systemize <span className="text-sm font-mono">(Founder Mode)</span></h3>
                     <p className="text-sm text-gray-300">Analyze dashboard metrics. Train Bot further. Document a process. <strong className="text-brand-green">Quest:</strong> 1 Month Profitability.</p>
                     <p className="text-xs font-mono text-green-400 mt-1">Meter Check: `Systemization: 40/100`, `$100 F*ck Off Score: 25/100`</p>
                  </div>
                  {/* Level 4 */}
                  <div className="p-4 bg-orange-900/30 border border-brand-orange/40 rounded-lg">
                    <h3 className="text-xl font-semibold text-brand-orange mb-2">Level 4: Scale & Delegate <span className="text-sm font-mono">(CEO Mindset)</span></h3>
                    <p className="text-sm text-gray-300">Make strategic choices. Enhance Bot or delegate tasks to VA. <strong className="text-brand-orange">Quest:</strong> Double Profit OR Halve Your Time.</p>
                    <p className="text-xs font-mono text-orange-400 mt-1">Meter Check: `Delegation: 60/100`, `Founder Focus: 70/100`</p>
                  </div>
                   {/* Level 5 */}
                  <div className="p-4 bg-neon-lime/10 border border-neon-lime/40 rounded-lg shadow-[0_0_15px_rgba(174,255,0,0.2)]">
                    <h3 className="text-xl font-semibold text-neon-lime mb-2">Level 5: F*ck Off Independence <span className="text-sm font-mono">(Owner/Entrepreneur!)</span></h3>
                    <p className="text-sm text-gray-300">Business runs via Bot/Systems. Your focus shifts. <strong className="text-neon-lime">Quest:</strong> 3 Months Profit, <5hrs/wk Ops.</p>
                    <p className="text-xs font-mono text-neon-lime mt-1">Meter Check: `Business Resilience: 90/100`, `$100 F*ck Off Score: 100/100!!`</p>
                  </div>
                </div>
              </section>

              {/* Section 4: The Engine */}
              <section className="space-y-5">
                <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-cyan mb-4">
                  <FaCubes className="mr-3 text-brand-cyan/80" /> The Engine: How the Magic Works
                </h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <FaRobot className="text-4xl text-brand-purple mx-auto mb-2"/>
                        <h4 className="font-semibold text-lg text-brand-purple">Bot Manager</h4>
                        <p className="text-xs text-gray-400">AI Agent for setup, tasks, comms. Learns from you.</p>
                    </div>
                     <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <FaNetworkWired className="text-4xl text-brand-blue mx-auto mb-2"/>
                        <h4 className="font-semibold text-lg text-brand-blue">Supervibe OS</h4>
                        <p className="text-xs text-gray-400">Your dashboard + embedded VIBE/SelfDev learning.</p>
                    </div>
                     <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <FaShieldHalved className="text-4xl text-brand-green mx-auto mb-2"/> {/* FaShieldHalved from fa6 */}
                        <h4 className="font-semibold text-lg text-brand-green">oneSitePls Infra</h4>
                        <p className="text-xs text-gray-400">Secure hosting, updates, core tech managed.</p>
                    </div>
                 </div>
                 <p className="text-center text-gray-400 text-sm mt-4">Powered by tech detailed in the <Link href="/repo-xml" className="text-brand-blue hover:underline">Supervibe Studio</Link>.</p>
              </section>

              {/* Section 5: Call to Action */}
              <section className="text-center border-t border-neon-lime/30 pt-10 mt-12">
                <h2 className="text-3xl md:text-4xl font-bold text-neon-lime mb-6">Ready to Launch Your AI Speedrun, {userName}?</h2>
                <p className="text-gray-300 text-base md:text-lg leading-relaxed mb-4">
                  This is for makers who want momentum NOW. Built on the VIBE principles by someone who gets the grind (see <Link href="/about" className="text-brand-blue hover:underline">my story</Link>).
                </p>
                <p className="text-gray-400 text-sm mb-6">
                  Perfect for: Your Friends | Niche Experts | Aspiring Solo Founders | Anyone tired of "analysis paralysis".
                </p>
                <p className="font-semibold text-lg text-neon-lime mb-4">
                    The "Catch": 13% profit share AFTER you succeed. Zero risk to start.
                </p>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-neon-lime to-brand-green text-black font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce"
                  onClick={() => {
                    // Placeholder action - ideally scroll to form or open modal/link
                    const formElement = document.getElementById('jumpstart-form');
                    formElement?.scrollIntoView({ behavior: 'smooth' });
                   }}
                >
                  <FaRocket className="mr-2"/> Apply for Your Jumpstart Kit!
                </Button>

                 {/* Optional: Add Support Form Here */}
                 <div id="jumpstart-form" className="mt-12 max-w-md mx-auto">
                    <h3 className="text-xl font-semibold text-neon-lime mb-4">Get on the Waitlist / Ask Questions:</h3>
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