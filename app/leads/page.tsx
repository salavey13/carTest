"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; // Assuming this path
import { cn } from '@/lib/utils'; // Assuming this path
// You might want specific icons for this page
// import { FaMagnifyingGlassDollar, FaUsers, FaTools, FaBrain, FaRocket, FaNetworkWired, FaClipboardList, FaGithub } from 'react-icons/fa6';

const LeadGenerationHQPage = () => {
  const pageTheme = {
    primaryColor: "text-brand-green",
    borderColor: "border-brand-green/50",
    shadowColor: "shadow-green-glow",
    accentColor: "text-brand-cyan",
    buttonGradient: "bg-gradient-to-r from-brand-green to-brand-cyan",
  };

  // Example Kwork Search Links (Scouts will refine these)
  const kworkSearchLinks = [
    { name: "Telegram Web Apps", url: "https://kwork.ru/projects?c=all&q=telegram+web+app" },
    { name: "Telegram Mini Apps", url: "https://kwork.ru/projects?c=all&q=telegram+mini+app" },
    { name: "TWA Development", url: "https://kwork.ru/projects?c=all&q=TWA+development" },
    { name: "Telegram Bots (Complex)", url: "https://kwork.ru/projects?c=all&q=telegram+bot+сложный" },
  ];

  const supabaseLeadsTableStructure = `
    CREATE TABLE public.leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source TEXT NOT NULL DEFAULT 'kwork', -- e.g., kwork, contra, direct
      lead_url TEXT UNIQUE, -- Link to the Kwork project or client profile
      client_name TEXT,
      project_description TEXT NOT NULL,
      raw_html_description TEXT, -- For bot processing
      budget_range TEXT,
      posted_at TIMESTAMPTZ,
      similarity_score NUMERIC(5,2), -- From your bot
      status TEXT DEFAULT 'new', -- new, contacted, interested, demo_generated, in_progress, closed_won, closed_lost
      assigned_to_medic TEXT, -- User ID of the medic
      assigned_to_carry TEXT, -- User ID of the carry (if new features needed)
      notes TEXT,
      supervibe_studio_links JSONB, -- Store generated repo-xml links
      github_issue_links JSONB, -- Store links to GitHub issues
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  const personalizedOfferPromptStructure = `
    **Objective:** Generate a personalized, compelling introductory message and offer to a potential client based on their project request and our Supervibe Studio capabilities.

    **Inputs:**
    1.  **Client's Project Description (from Kwork/Lead Source):** \`{{project_description}}\`
    2.  **Client's Name (if available):** \`{{client_name}}\`
    3.  **Budget Range (if available):** \`{{budget_range}}\`
    4.  **Supervibe Bot Analysis:**
        *   **Similarity Score (to our core offerings):** \`{{similarity_score}}\`
        *   **Key Features Requested:** \`{{key_features_requested_by_client}}\`
        *   **Features Supervibe Can Auto-Generate/Jumpstart:** \`{{supervibe_jumpstart_features}}\`
        *   **Potential Customization Points (for Medics):** \`{{customization_points}}\`
        *   **Potential New Core Features (for Carry):** \`{{new_core_features}}\`
    5.  **Your Unique Selling Propositions (USPs):**
        *   AI-Accelerated Development (Speed, Efficiency)
        *   Rapid MVP/Blueprint Generation (Fast Validation)
        *   Focus on Core Value, Not Boilerplate
        *   Transparent VIBE Process
        *   (Link to Supervibe Studio: /repo-xml)
        *   (Link to Jumpstart Kit: /jumpstart)
        *   (Link to relevant tutorial if applicable, e.g., image swap: /tutorials/image-swap)

    **Output Structure (Message to Client):**
    1.  **Personalized Greeting:** Address client by name if known.
    2.  **Acknowledge Their Need:** Briefly summarize their project from their description. "I saw your request for a Telegram Web App for {{their_project_goal}}..."
    3.  **Introduce Supervibe's Unique Angle:** "My Supervibe Studio uses AI to build Telegram Web Apps like yours significantly faster. For instance, based on your description, we can quickly generate a functional blueprint including {{mention 1-2 supervibe_jumpstart_features}}."
    4.  **Value Proposition:** "This means you can validate your core idea much quicker and with less initial investment. We focus our human expertise on building out the unique, high-value features you need, like {{mention 1-2 customization_points or new_core_features}}."
    5.  **Call to Action (Soft):** "Would you be open to seeing a quick AI-generated preview based on your requirements or discussing how we can bring your vision to life efficiently?"
    6.  **(Optional) Link to Relevant Asset:** e.g., "You can see how we approach development at our Supervibe Studio: [link to /repo-xml]" or "Learn about our rapid start with the Jumpstart Kit: [link to /jumpstart]"

    **Tone:** Confident, helpful, innovative, slightly cyberpunk (VIBE).

    **Example for Bot:**
    If project_description is "Need a TWA for online cat grooming appointments", and supervibe_jumpstart_features includes "basic scheduling UI, user registration", the offer might include: "...we can quickly generate a functional blueprint including a basic scheduling interface and user registration."
  `;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200 pt-24 pb-20 overflow-x-hidden">
      <div
        className="absolute inset-0 bg-repeat opacity-5 -z-10"
        style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--brand-green)) 1px, transparent 1px),
                            linear-gradient(to bottom, hsl(var(--brand-green)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      ></div>

      <div className="container mx-auto px-4">
        <header className="text-center mb-12 md:mb-16">
          <VibeContentRenderer content={`::FaUsersCog className="mx-auto text-6xl mb-4 ${pageTheme.primaryColor} animate-pulse"::`} />
          <h1 className={cn("text-4xl sm:text-5xl md:text-6xl font-orbitron font-bold cyber-text glitch mb-4", pageTheme.primaryColor)} data-text="CyberParty Leads HQ">
            CyberParty Leads HQ
          </h1>
          <CardDescription className="text-md sm:text-lg md:text-xl text-gray-300 font-mono max-w-3xl mx-auto">
            <VibeContentRenderer content="Welcome, Operatives! This is Mission Control for Supervibe client acquisition. Roles assigned, targets acquired, VIBE engaged. Let's transmute potential into profit." />
          </CardDescription>
        </header>

        <div className="space-y-12 md:space-y-16">
          {/* Section 1: The CyberParty Roles */}
          <Card className={cn("bg-dark-card/80 backdrop-blur-md", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content="::FaUserFriends:: The CyberParty: Roles & Mission" />
              </CardTitle>
              <CardDescription className="font-mono">Meet the crew dedicated to VIBE-powered success.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6 font-mono">
              <div className={cn("p-4 border rounded-lg bg-black/30", pageTheme.borderColor)}>
                <h3 className={cn("text-xl font-bold mb-2 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content="::FaBrain:: Carry (Pavel)" /></h3>
                <p className="text-sm text-gray-300">The Architect. Pushes new features and core innovations to Supervibe Studio. Handles complex, novel development tasks.</p>
                 <Link href="/about" className={cn("text-xs mt-2 inline-block hover:underline", pageTheme.accentColor)}>Meet the Carry</Link>
              </div>
              <div className={cn("p-4 border rounded-lg bg-black/30", pageTheme.borderColor)}>
                <h3 className={cn("text-xl font-bold mb-2 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content="::FaMedkit:: Medics (The Fixer Crew)" /></h3>
                <p className="text-sm text-gray-300">The Customization & Repair Specialists. Handle AI hallucinations (icon fixes, image swaps), video integration, and transmute base components into personalized client versions using Supervibe Studio's rapid iteration capabilities.</p>
                <p className="text-xs text-gray-400 mt-1">Leverages: <Link href="/tutorials/image-swap" className={cn("hover:underline", pageTheme.accentColor)}>Image Swap</Link>, <Link href="/tutorials/icon-swap" className={cn("hover:underline", pageTheme.accentColor)}>Icon Swap</Link>, <Link href="/tutorials/video-swap" className={cn("hover:underline", pageTheme.accentColor)}>Video Swap</Link>, <Link href="/tutorials/inception-swap" className={cn("hover:underline", pageTheme.accentColor)}>Inception Swap</Link>.</p>
              </div>
              <div className={cn("p-4 border rounded-lg bg-black/30", pageTheme.borderColor)}>
                <h3 className={cn("text-xl font-bold mb-2 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content="::FaSearchDollar:: Scout (Lead Harvester)" /></h3>
                <p className="text-sm text-gray-300">The Frontline Operative. Identifies, qualifies, and processes potential leads. Prepares tasks and context for Medics and Carry. Initiates client contact.</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Scout's Arsenal */}
          <Card className={cn("bg-dark-card/80 backdrop-blur-md", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content="::FaTools:: Scout's Arsenal: Tools & Tactics" />
              </CardTitle>
              <CardDescription className="font-mono">Equipping the Scout for maximum leverage in the digital wilds.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 font-mono">
              <div>
                <h4 className={cn("text-xl font-bold mb-3 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content="::FaBinoculars:: Phase 1: Kwork Reconnaissance" /></h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-300 pl-4">
                  <li>
                    <VibeContentRenderer content="**Targeted Searches:** Utilize predefined Kwork search links (examples below) and develop new ones to pinpoint relevant 'Telegram Web App', 'Mini App', 'TWA' requests." />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {kworkSearchLinks.map(link => (
                        <Button key={link.name} variant="outline" size="sm" asChild className={cn("text-xs", pageTheme.borderColor, pageTheme.primaryColor, `hover:${pageTheme.primaryColor}/80 hover:bg-card`)}>
                          <a href={link.url} target="_blank" rel="noopener noreferrer"><VibeContentRenderer content={`::FaExternalLinkAlt:: ${link.name}`} /></a>
                        </Button>
                      ))}
                    </div>
                  </li>
                  <li><VibeContentRenderer content="**Manual/Automated Scraping:** Copy promising Kwork project descriptions (full HTML for bot processing, plain text for quick review). <strong className={pageTheme.accentColor}>Prioritize recent listings.</strong>" /></li>
                  <li>
                    <VibeContentRenderer content="**Data Ingestion (Supabase):** Log leads into the `public.leads` table in Supabase. Capture source, URL, description, budget, etc." />
                    <Card className={cn("mt-2 bg-black/40 p-3 border text-xs overflow-x-auto simple-scrollbar", pageTheme.borderColor)}>
                      <pre className="text-gray-400 whitespace-pre-wrap">{supabaseLeadsTableStructure.trim()}</pre>
                    </Card>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className={cn("text-xl font-bold mb-3 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content="::FaRobot:: Phase 2: Lead Qualification (Bot Assistance)" /></h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-300 pl-4">
                  <li><VibeContentRenderer content={`**Similarity Scoring:** Feed raw HTML/text descriptions to a Supervibe bot (or a dedicated NLP script) to generate a similarity score against our core AI-assisted Telegram Web App capabilities. This helps filter and prioritize.`} /></li>
                  <li><VibeContentRenderer content={`**Feature Matching:** Bot identifies if requested features align with <Link href="/jumpstart" class="${cn("hover:underline", pageTheme.accentColor)}">Jumpstart Kit</Link> offerings or existing Supervibe Studio auto-generation modules.`} /></li>
                  <li><VibeContentRenderer content={`**Complexity Assessment:** Bot flags requests as 'Good Fit (High Automation Potential)', 'Medium Fit (Needs Medic Customization)', or 'Complex (Needs Carry Input)'.`} /></li>
                </ul>
              </div>

              <div>
                <h4 className={cn("text-xl font-bold mb-3 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content="::FaTasks:: Phase 3: Task Preparation (Briefing the Crew)" /></h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-300 pl-4">
                  <li>
                    <VibeContentRenderer content={`**For Medics (Customizations/Fixes):** Generate direct <Link href="/repo-xml" class="${cn("hover:underline", pageTheme.accentColor)}">Supervibe Studio</Link> links with pre-filled \`path\` (to base component/file) and \`idea\` (client's customization request) parameters. Example: \`/repo-xml?path=/components/UserProfileCard.tsx&idea=Change color scheme to dark blue and add a field for 'VIBE_LEVEL'\`. Store these in the \`supervibe_studio_links\` JSONB field in Supabase.`} />
                  </li>
                  <li><VibeContentRenderer content={`**For Carry (New Features):** If the request involves entirely new functionality beyond current Supervibe capabilities, create detailed GitHub issues. Link these issues in the \`github_issue_links\` JSONB field in Supabase.`} /></li>
                  <li><VibeContentRenderer content="**Update Lead Status:** Mark lead status in Supabase (e.g., 'processed_for_contact', 'assigned_medic', 'assigned_carry')." /></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Crafting the Irresistible Offer */}
          <Card className={cn("bg-dark-card/80 backdrop-blur-md", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content="::FaBullhorn:: Crafting the Irresistible Offer (The Prompt)" />
              </CardTitle>
              <CardDescription className="font-mono">The AI-augmented message that turns prospects into partners.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 font-mono">
              <p className="text-sm text-gray-300">
                <VibeContentRenderer content="The Scout, armed with lead data and bot analysis, uses a master prompt (template below) to generate a personalized initial contact message. This message highlights speed, AI-assistance, and a rapid path to an MVP." />
              </p>
              <Card className={cn("bg-black/40 p-3 border text-xs overflow-x-auto simple-scrollbar", pageTheme.borderColor)}>
                <pre className="text-gray-400 whitespace-pre-wrap">{personalizedOfferPromptStructure.trim()}</pre>
              </Card>
              <p className="text-sm text-gray-300">
                <VibeContentRenderer content={`This offer should always give the client a glimpse of the <strong class="${pageTheme.accentColor}">"what's in it for me"</strong> – faster validation, lower risk, and a focus on their unique value. The <Link href="/app/jumpstart" class="${cn("hover:underline", pageTheme.accentColor)}">Jumpstart Kit</Link> philosophy is key here.`} />
              </p>
            </CardContent>
          </Card>

          {/* Section 4: The Workflow */}
          <Card className={cn("bg-dark-card/80 backdrop-blur-md", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content="::FaProjectDiagram:: The Workflow: Lead to VIBE-Powered Solution" />
              </CardTitle>
              <CardDescription className="font-mono">Our CyberParty's coordinated strike.</CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-sm text-gray-300 space-y-3">
                <VibeContentRenderer content="1. **Scout:** Identifies lead on Kwork (or other source), enriches data, uses bot for qualification, prepares tasks/links." />
                <VibeContentRenderer content="2. **Scout/Bot:** Generates & sends personalized offer (potentially with AI-generated initial blueprint/mockup if feasible)." />
                <VibeContentRenderer content={`3. **Client Response:** If interested, a discovery call or further clarification follows. The <Link href="/app/game-plan" class="${cn("hover:underline", pageTheme.accentColor)}">Game Plan</Link> acts as a high-level guide for structuring these advanced conversations.`} />
                <VibeContentRenderer content={`4. **Project Kick-off:** <ul><li><VibeContentRenderer content="**Medic Crew:** Takes on customization tasks using Supervibe Studio links (e.g., specific component refactors, visual swaps). Leverages the <Link href="/app/repo-xml" class="${cn("hover:underline", pageTheme.accentColor)}">Studio's</Link> full power for rapid iteration based on client feedback." /></li><li><VibeContentRenderer content="**Carry (Pavel):** Addresses GitHub issues for new core features, expanding Supervibe Studio's capabilities." /></li></ul>`} />
                <VibeContentRenderer content={`5. **VIBE Delivery:** Client receives their AI-accelerated Telegram Web App, built with speed and precision.`} />
                <VibeContentRenderer content={`6. **Feedback & Iteration:** The <Link href="/app/repo-xml#cybervibe-section" class="${cn("hover:underline", pageTheme.accentColor)}">CyberVibe Loop</Link> ensures continuous improvement and adaptation based on client needs and your evolving capabilities.`} />
            </CardContent>
          </Card>

          {/* Section 5: Leveraging Existing Assets */}
          <Card className={cn("bg-dark-card/80 backdrop-blur-md", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content="::FaCubes:: Leveraging Existing CyberVibe Assets" />
              </CardTitle>
              <CardDescription className="font-mono">Our internal arsenal for external impact.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4 font-mono text-sm">
              <div className={cn("p-3 border rounded-md bg-black/30", pageTheme.borderColor)}>
                <h5 className={cn("font-bold mb-1", pageTheme.accentColor)}><Link href="/jumpstart" className="hover:underline">Jumpstart Kit</Link></h5>
                <p className="text-gray-300">Our primary lead magnet. Offer an AI-generated TWA shell based on client's initial idea. Shows speed and capability instantly.</p>
              </div>
              <div className={cn("p-3 border rounded-md bg-black/30", pageTheme.borderColor)}>
                <h5 className={cn("font-bold mb-1", pageTheme.accentColor)}><Link href="/repo-xml" className="hover:underline">SUPERVIBE Studio</Link></h5>
                <p className="text-gray-300">The core engine for Medics and Carry. Scouts generate deep links into it for specific customization tasks.</p>
              </div>
              <div className={cn("p-3 border rounded-md bg-black/30", pageTheme.borderColor)}>
                <h5 className={cn("font-bold mb-1", pageTheme.accentColor)}><Link href="/selfdev" className="hover:underline">SelfDev Path</Link> & <Link href="/purpose-profit" className="hover:underline">Purpose & Profit</Link></h5>
                <p className="text-gray-300">Philosophical backbone. Shapes our messaging, emphasizing value, problem-solving, and building authentic solutions, not just code.</p>
              </div>
              <div className={cn("p-3 border rounded-md bg-black/30", pageTheme.borderColor)}>
                <h5 className={cn("font-bold mb-1", pageTheme.accentColor)}><Link href="/game-plan" className="hover:underline">Game Plan</Link> & <Link href="/p-plan" className="hover:underline">VIBE Plan</Link></h5>
                <p className="text-gray-300">Internal strategic documents. Scouts can draw inspiration for offer framing and long-term client vision from these.</p>
              </div>
              <div className={cn("p-3 border rounded-md bg-black/30", pageTheme.borderColor)}>
                <h5 className={cn("font-bold mb-1", pageTheme.accentColor)}><Link href="/start-training" className="hover:underline">Tutorials & Training</Link></h5>
                <p className="text-gray-300">Demonstrate specific capabilities (image/icon/video swaps). Can be shared with clients to showcase ease of certain modifications or used to onboard new Medics.</p>
              </div>
              <div className={cn("p-3 border rounded-md bg-black/30", pageTheme.borderColor)}>
                <h5 className={cn("font-bold mb-1", pageTheme.accentColor)}><Link href="/selfdev/gamified" className="hover:underline">CyberDev OS (Gamified)</Link></h5>
                <p className="text-gray-300">Showcases the "level-up" philosophy. Can be a unique selling point – clients aren't just buying an app, they're entering an evolving system.</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Building Zion */}
          <Card className={cn("bg-dark-card/80 backdrop-blur-md", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content="::FaComments:: Building Zion: The Community Engine" />
              </CardTitle>
              <CardDescription className="font-mono">Your Telegram chat: the hub for the CyberParty and future VIBE-rs.</CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-sm text-gray-300 space-y-2">
              <p><VibeContentRenderer content="**Zion (Your Telegram Chat):** This isn't just a chat, it's your recruitment center, support hub, and idea incubator." /></p>
              <ul className="list-disc list-inside pl-4">
                <li><VibeContentRenderer content="**Medic Coordination:** Medics can discuss complex customization tasks, share solutions, and learn from each other." /></li>
                <li><VibeContentRenderer content="**Scout Feedback Loop:** Scouts share insights from lead interactions, helping refine offers and identify new market needs." /></li>
                <li><VibeContentRenderer content="**Lead Nurturing (Soft):** Potential leads (if added strategically) can see the activity, the problem-solving, and the VIBE in action." /></li>
                <li><VibeContentRenderer content="**Future Fixer Onboarding:** Promising community members showing aptitude could be trained as future Medics." /></li>
              </ul>
            </CardContent>
          </Card>

          {/* Call to Action */}
          <section className="text-center mt-16 py-8">
            <VibeContentRenderer content={`::FaRocket className="mx-auto text-6xl mb-6 ${pageTheme.primaryColor} animate-bounce"::`} />
            <h2 className={cn("text-4xl font-orbitron font-bold mb-6", pageTheme.primaryColor)} data-text="Activate the Scouts!">
              Activate the Scouts!
            </h2>
            <p className="text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-8">
              <VibeContentRenderer content="The system is primed. The team is ready. It's time to deploy the Scouts and start harvesting the opportunities. Let the VIBE flow!" />
            </p>
            <Button size="lg" className={cn("font-orbitron text-lg py-4 px-10 rounded-full text-black font-extrabold shadow-glow-lg hover:scale-105 transform transition duration-300", pageTheme.buttonGradient)}>
              <VibeContentRenderer content="::FaBolt:: INITIATE LEAD HARVEST" />
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LeadGenerationHQPage;