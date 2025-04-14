"use client";
import Head from "next/head";
import { cn } from "@/lib/utils"
import Link from "next/link"; // Import Link for internal navigation
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SupportForm from "@/components/SupportForm";
// Assuming you might want a flag or simple text for language switch
import { FaGlobe } from "react-icons/fa6"; // Example icon import if needed

export default function AboutEnPage() {
  return (
    <>
      {/* SEO Optimizations */}
      <Head>
        <title>Pavel Solovyov - AI-Driven Development & Validation | oneSitePls</title>
        <meta
          name="description"
          content="Leveraging 13+ years of coding experience to pioneer the VIBE methodology for AI-accelerated development, validation, and secure web solutions with oneSitePls."
        />
        <meta
          name="keywords"
          content="developer, TypeScript, VIBE, AI development, AI validation, secure development, Framer, Supabase, Next.js, oneSitePls, Pavel Solovyov, mentorship, workflow automation"
        />
      </Head>
      <div className="relative min-h-screen">
        {/* Language Switcher Link */}
        <Link href="/about" legacyBehavior>
          <a className="fixed top-10 right-4 z-5 p-2 bg-black/70 border border-[#39FF14]/50 rounded-md text-[#39FF14] hover:bg-[#39FF14] hover:text-black transition-colors text-sm font-mono shadow-glow-sm">
            <FaGlobe className="h-5 w-5" />
          </a>
        </Link>

        {/* Enhanced Cyberpunk SVG Background */}
        <div className="absolute inset-0 z-0">
          {/* Existing SVG Background */}
          <svg
            className="w-full h-full opacity-70 animate-pulse-slow"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1000 1000"
          >
            {/* SVG paths and elements */}
            <defs>
              <linearGradient id="cyberBgEn" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#000000", stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: "#111111", stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <rect width="1000" height="1000" fill="url(#cyberBgEn)" />
            <path
              d="M0,200 H1000 M0,400 H1000 M0,600 H1000 M0,800 H1000"
              stroke="#39FF14"
              strokeWidth="2"
              opacity="0.5"
            />
            <path
              d="M200,0 V1000 M400,0 V1000 M600,0 V1000 M800,0 V1000"
              stroke="#39FF14"
              strokeWidth="2"
              opacity="0.5"
            />
            <circle cx="500" cy="500" r="300" stroke="#39FF14" strokeWidth="1" fill="none" opacity="0.3" />
            <circle cx="500" cy="500" r="200" stroke="#FF00FF" strokeWidth="1" fill="none" opacity="0.2" />
          </svg>
        </div>
        {/* Adjusted padding for mobile */}
        <div className="relative z-10 container mx-auto px-2 sm:px-4 py-4 pt-24">
          <Card className="max-w-4xl mx-auto bg-black text-white rounded-3xl shadow-[0_0_15px_#39FF14]">
            <CardHeader>
              <CardTitle className="text-2xl md:text-4xl font-bold text-center text-[#39FF14] font-orbitron">
                Pavel Solovyov: AI-Driven Development
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Personal Info */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="w-36 h-36 md:w-48 md:h-48 border-4 border-[#39FF14] shadow-[0_0_10px_#39FF14]">
                  <AvatarImage
                    src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//135398606.png"
                    alt="Pavel Solovyov Avatar"
                  />
                  <AvatarFallback>PS</AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h2 className="text-2xl md:text-3xl font-bold text-[#39FF14] font-orbitron">Pavel Solovyov</h2>
                  <p className="text-base md:text-lg text-gray-300">Nizhny Novgorod, Russia | 04.03.1989</p>
                  {/* Contact Info */}
                  <div className="mt-4 space-y-2 text-sm md:text-base">
                    <p>
                      <strong>Email:</strong>{" "}
                      <a href="mailto:salavey13@gmail.com" className="text-[#39FF14] hover:underline">
                        salavey13@gmail.com
                      </a>
                    </p>
                    <p>
                      <strong>Telegram:</strong>{" "}
                      <a href="https://t.me/salavey13" target="_blank" rel="noopener noreferrer" className="text-[#39FF14] hover:underline">
                        t.me/salavey13
                      </a>
                    </p>
                    <p>
                      <strong>GitHub:</strong>{" "}
                      <a href="https://github.com/salavey13" target="_blank" rel="noopener noreferrer" className="text-[#39FF14] hover:underline">
                        github.com/salavey13
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Professional Overview */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Who Am I? An AI-Era Strategist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    I'm Pavel Solovyov, with 13+ years in coding, evolving from Java/C++ to pioneering AI-assisted development workflows. Today, I focus less on writing boilerplate and more on being a <strong>digital solutions architect</strong>, leveraging AI as a powerful force multiplier ("carry team lead") to automate routine tasks. This allows a strategic focus on <strong>architecture, UX, complex business logic, and rapid validation</strong>. My project{" "}
                    <a
                      href="https://github.com/salavey13/carTest"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#39FF14] hover:underline"
                    >
                      carTest
                    </a>{" "}
                    serves as a practical testbed where developers learn to interact with AI via pull requests. As the founder of{" "}
                    <a
                      href="https://onesitepls.framer.ai" // Assuming this is the main marketing site link
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#39FF14] hover:underline"
                    >
                      oneSitePls
                    </a>
                    , I aim to make modern web development more accessible, and through mentorship, help others harness AI effectively. The goal isn't just faster code, but efficiently <strong>building the *right* things</strong>.
                  </p>
                </CardContent>
              </Card>

              {/* Skills */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Core Skills
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm md:text-base">
                    <div>
                      <h4 className="text-[#39FF14] font-bold">Languages</h4>
                      <p className="text-gray-300">TypeScript, Java, C++, Groovy</p>
                    </div>
                    <div>
                      <h4 className="text-[#39FF14] font-bold">Platforms & Tools</h4>
                      <p className="text-gray-300">Framer, Supabase, StackBlitz, Next.js, GitHub</p>
                    </div>
                    <div>
                      <h4 className="text-[#39FF14] font-bold">Web Development</h4>
                      <p className="text-gray-300">React, HTML, CSS, RESTful APIs</p>
                    </div>
                    <div>
                      <h4 className="text-[#39FF14] font-bold">Methodologies & Focus</h4>
                       <p className="text-gray-300">
                         Agile, Scrum, VIBE, <strong>AI-Assisted Development & Workflow Optimization</strong>
                       </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* VIBE Methodology */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    The VIBE Methodology: Beyond Just Code
                  </CardTitle>
                </CardHeader>
                <CardContent>
                   <p className="text-sm md:text-base text-gray-300 mb-4">
                     My VIBE method is a pragmatic response to the current AI landscape. It asks: how do we deliver value when AI can generate code with impressive accuracy? VIBE leverages AI, shifting the developer focus from line-by-line coding to <strong>system architecture, UX flows, and strategic direction</strong>. It's about using AI effectively, not just using AI.
                   </p>
                   {/* Image 1 */}
                   <img
                       src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/00.png"
                       alt="VIBE Methodology Visualization - AI-assisted strategy and automation"
                       className="rounded-lg overflow-hidden shadow-[0_0_10px_#39FF14] my-4 w-full object-cover"
                       style={{ aspectRatio: '16/9' }}
                       loading="lazy"
                   />
                   <p className="text-sm md:text-base text-gray-300 mb-4">
                     <strong>AI as Partner:</strong> I view AI as a <strong>"God-tier genius who never sleeps"</strong> – a partner handling laborious coding tasks, freeing up human developers for high-level design and complex problem-solving. Generating entire subsystems in days, not weeks, becomes feasible, accelerating innovation.
                   </p>
                   <p className="text-sm md:text-base text-gray-300">
                     <strong>More than Code – Idea Validation:</strong> Why build fast if you're building the wrong thing? VIBE integrates <strong>AI-driven business validation</strong> to <strong>"fail faster"</strong> on weak ideas and accelerate promising ones. Using AI for market analysis, identifying user pain points, competitor research, and lean MVP testing (like the 5-step framework) drastically <strong>reduces the risk</strong> of building products nobody needs. It's not just faster – it's a fundamentally smarter way to build. This is core to projects like{" "}
                     <a
                       href="https://github.com/salavey13/carTest"
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-[#39FF14] hover:underline"
                     >
                       carTest
                     </a>{" "}
                     and{" "}
                     <a
                       href="https://onesitepls.framer.ai" // Repeat marketing link for consistency if desired
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-[#39FF14] hover:underline"
                     >
                       oneSitePls
                     </a>
                     .
                   </p>
                </CardContent>
              </Card>

             {/* VIBE CODING + SECURE DEVELOPMENT */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    VIBE Coding + Secure Development: Speed & Reliability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    {/* Existing Video */}
                    <iframe
                      width="100%"
                      style={{ aspectRatio: '16/9' }}
                      src="https://www.youtube.com/embed/Tw18-4U7mts"
                      title="VIBE Coding and Secure Development Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-lg overflow-hidden shadow-[0_0_10px_#39FF14]"
                      loading="lazy"
                    ></iframe>
                  </div>
                  <p className="text-sm md:text-base mb-4 text-gray-300">
                    <strong>VIBE Coding:</strong> Generating 60kb of functional code in 48 hours demonstrates the power of AI assistance. However, velocity without discipline introduces risks:
                  </p>
                   <ul className="list-disc list-inside space-y-2 text-sm md:text-base mb-4 text-gray-300 pl-4">
                     <li>Exposed API keys</li>
                     <li>Database vulnerabilities</li>
                     <li>Bypassed subscription logic</li>
                   </ul>

                  {/* Image 2 */}
                  <img
                      src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/11.png"
                      alt="Secure AI Development Pipeline - VIBE Coding with Security"
                      className="rounded-lg overflow-hidden shadow-[0_0_10px_#39FF14] my-4 w-full object-cover"
                      style={{ aspectRatio: '16/9' }}
                      loading="lazy"
                  />

                   <p className="text-sm md:text-base mb-4 text-gray-300">
                     <strong>My Approach:</strong> My 13 years in <strong>enterprise security</strong> inform how I apply VIBE safely. Security checks are integrated throughout the AI-assisted workflow, ensuring speed doesn't compromise robustness. It's about <strong>resource optimization</strong>: maximizing AI efficiency while retaining human oversight on critical aspects like security and overall strategy.
                   </p>
                  {/* Security Steps Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-900 p-4 rounded-lg border border-[#39FF14]/30">
                      <h4 className="font-bold text-[#39FF14] mb-2 text-sm md:text-base">1. AI + Security First</h4>
                      <p className="text-xs md:text-sm text-gray-300">
                        AI generations undergo automated static analysis & OWASP checks.
                      </p>
                    </div>
                    <div className="bg-gray-900 p-4 rounded-lg border border-[#39FF14]/30">
                      <h4 className="font-bold text-[#39FF14] mb-2 text-sm md:text-base">2. Zero Trust Principles</h4>
                      <p className="text-xs md:text-sm text-gray-300">
                        Every PR is scanned for vulnerabilities before merging via automated tests.
                      </p>
                    </div>
                    <div className="bg-gray-900 p-4 rounded-lg border border-[#39FF14]/30">
                      <h4 className="font-bold text-[#39FF14] mb-2 text-sm md:text-base">3. Secure Git Flow</h4>
                      <p className="text-xs md:text-sm text-gray-300">
                        Change history integrity and controlled access via Telegram bot integration.
                      </p>
                    </div>
                  </div>
                  <p className="text-sm md:text-base mt-4 text-gray-300">
                    Want to see how this secure VIBE workflow is implemented? Check out the tooling and process demonstrated via{" "}
                    <a href="/repo-xml" className="text-[#39FF14] hover:underline">
                      /repo-xml
                    </a>.
                  </p>
                </CardContent>
              </Card>

              {/* Security Background */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                 <CardHeader>
                   <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                     Foundation: 13 Years in Security
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Security Experience */}
                     <div className="space-y-4">
                       <h3 className="font-bold text-[#39FF14] text-base md:text-lg">Enterprise Experience</h3>
                       <ul className="list-disc list-inside space-y-2 text-sm text-gray-300 pl-4">
                         <li>Developed security features for Avaya Aura AS5300 (C++)</li>
                         <li>Implemented zero-downtime IPv6 support</li>
                         <li>Qualys Certified Specialist (Vulnerability Management)</li>
                         <li>Delivered 4 major releases of ABRE decision engine (Java/Groovy)</li>
                         <li>Applying this foundation to <strong>securely integrate AI</strong> into modern workflows</li>
                       </ul>
                     </div>

                     {/* VIBE Security Framework Summary */}
                     <div className="space-y-4">
                       <h3 className="font-bold text-[#39FF14] text-base md:text-lg">VIBE Security Framework</h3>
                       <div className="flex items-start space-x-3">
                         <div className="text-[#39FF14] mt-1 text-lg">⚡</div>
                         <div>
                            <p className="text-sm text-gray-300">
                              <strong>AI Generation → Auto-Audit:</strong>
                              <br />
                              All AI-generated PRs automatically checked via:
                            </p>
                           <ul className="list-[square] list-inside text-xs text-gray-300 mt-1 pl-4">
                             <li>Static Code Analysis (SAST)</li>
                             <li>OWASP Top 10 Patterns</li>
                             <li>Injection & Vulnerability Tests</li>
                           </ul>
                         </div>
                       </div>
                       <p className="text-sm text-gray-300 mt-4">This ensures AI-driven speed doesn't compromise security posture.</p>
                     </div>
                   </div>

                   {/* Video Integration */}
                   <div className="mt-6">
                     <iframe
                       width="100%"
                       style={{ aspectRatio: '16/9' }}
                       src="https://www.youtube.com/embed/tHQnW0Vid9I"
                       title="Combining VIBE Development with Enterprise Security Video"
                       className="rounded-lg overflow-hidden shadow-[0_0_10px_#39FF14] mt-4"
                       frameBorder="0"
                       allowFullScreen
                       loading="lazy"
                     ></iframe>
                     <p className="text-xs text-gray-400 mt-2 text-center md:text-left">
                       Applying enterprise security principles (from Avaya experience) to VIBE development.
                     </p>
                   </div>

                   {/* CV Highlights */}
                   <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                     <div className="bg-gray-900 p-3 rounded-lg border border-[#39FF14]/20">
                       <h4 className="font-bold text-[#39FF14] text-sm">13+ Years</h4>
                       <p className="text-xs text-gray-300">Enterprise Dev (C++/Java/TS)</p>
                     </div>
                     <div className="bg-gray-900 p-3 rounded-lg border border-[#39FF14]/20">
                       <h4 className="font-bold text-[#39FF14] text-sm">4 Releases</h4>
                       <p className="text-xs text-gray-300">Secure Avaya Systems</p>
                     </div>
                     <div className="bg-gray-900 p-3 rounded-lg border border-[#39FF14]/20">
                       <h4 className="font-bold text-[#39FF14] text-sm">AI + Zero Trust</h4>
                       <p className="text-xs text-gray-300">Approach in all projects</p>
                     </div>
                   </div>
                 </CardContent>
              </Card>

              {/* Experience */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Professional Experience
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-sm md:text-base">
                  <div>
                    <h3 className="text-lg font-bold text-[#39FF14] mb-1">
                      Founder/Developer, oneSitePls (2023 - Present)
                    </h3>
                    <p className="text-gray-300">
                      Launched a platform focused on simplified, <strong>AI-enhanced</strong> web development. Created{" "}
                      <a
                        href="https://github.com/salavey13/carTest"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#39FF14] hover:underline"
                      >
                        carTest
                      </a>{" "}
                      with 'selfdev' features to train developers in <strong>AI-assisted</strong> coding workflows.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#39FF14] mb-1">
                      Senior Software Engineer, Orion Innovation (Avaya) (2010 - 2023)
                    </h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-2 pl-4">
                      <li>
                        <strong>Java Developer (2016-2023):</strong> Enhanced Avaya Business Rules Engine and microservices for Avaya Aura AS5300, focusing on reliability principles relevant in the <strong>AI era</strong>.
                      </li>
                      <li>
                        <strong>C++ Developer (2010-2016):</strong> Maintained Avaya Aura AS5300 client application, adding IPv6 and implementing <strong>fundamental security practices</strong>.
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Certifications */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                 <CardHeader>
                   <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                     Certifications
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <ul className="list-disc list-inside text-gray-300 space-y-2 text-sm md:text-base pl-4">
                     <li>Qualys Advanced Vulnerability Management (2021)</li>
                   </ul>
                 </CardContent>
              </Card>

              {/* Education */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Education
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm md:text-base">
                  <p className="text-gray-300">
                    <strong>Lobachevsky State University of Nizhny Novgorod</strong>
                    <br />
                    Bachelor's Degree, IT, Computational Mathematics and Cybernetics (2006-2010)
                  </p>
                  <p className="text-gray-300 mt-2">
                    <strong>Languages:</strong> English (C2 - Fluent)
                  </p>
                </CardContent>
              </Card>

              {/* Mentorship */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Mentorship: Navigating the AI Future
                  </CardTitle>
                </CardHeader>
                <CardContent>
                   <p className="text-sm md:text-base text-gray-300">
                     Helping developers shift from traditional coding to <strong>strategic thinking</strong> in the AI world. Practical training via{" "}
                     <a
                       href="https://github.com/salavey13/carTest"
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-[#39FF14] hover:underline"
                     >
                       carTest
                     </a>{" "}
                     and the{" "}
                     <a
                       href="https://onesitepls.framer.ai" // Marketing link
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-[#39FF14] hover:underline"
                     >
                       oneSitePls
                     </a>{" "}
                     platform, coupled with Telegram support and a free tier, aims to enable effective use of <strong>modern AI tools</strong> to focus on delivering value.
                   </p>
                </CardContent>
              </Card>

              {/* Paid Support */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Paid Support & Consulting
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300 mb-4">
                    Need targeted help with code, strategy, or implementing VIBE workflows? Fill out the form to leverage AI effectively!
                  </p>
                  <SupportForm /> {/* Assuming this form is language-agnostic or you'll create an EN version */}
                </CardContent>
              </Card>

              {/* Project Overview: Cyber-Garage */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Project: The Cyber-Garage (AI-Powered)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                   {/* Image 3 */}
                  <img
                      src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/22.png"
                      alt="Cyber-Garage - AI-Powered Car Rental Ecosystem"
                      className="rounded-lg overflow-hidden shadow-[0_0_10px_#39FF14] my-4 w-full object-cover"
                      style={{ aspectRatio: '16/9' }}
                      loading="lazy"
                  />
                   <p className="text-sm md:text-base text-gray-300">
                     This isn't just a page; it's part of a <strong>living ecosystem</strong> built on VIBE principles. Here, <strong>AI assistants</strong> actively participate in development (via{" "}
                     <a href="/repo-xml" className="text-[#39FF14] hover:underline">
                       /repo-xml
                     </a>
                     ), Telegram bots automate tasks, and the "Cyber-Garage" itself is a platform for experimenting with <strong>AI validation</strong> and rapid feature iteration (e.g., AR tours, AI-driven car recommendations). It's a chance to contribute to a project where <strong>AI is a practical tool, not just hype</strong>. Let's expand this world together!
                   </p>
                </CardContent>
              </Card>

              {/* How to Use /repo-xml */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                 <CardHeader>
                   <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                     Using /repo-xml: AI-Assisted Contribution Workflow
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <p className="text-sm md:text-base text-gray-300">
                     Want to contribute code? The{" "}
                     <a href="/repo-xml" className="text-[#39FF14] hover:underline">
                       /repo-xml
                     </a>{" "}
                     subpage streamlines interaction with AI development assistants:
                   </p>
                   <ol className="list-decimal list-inside mt-4 space-y-2 text-sm md:text-base text-gray-300 pl-4">
                     <li>
                       <strong>Task to Bot:</strong> Send your task description (e.g., "Add AR tours to `/repo-xml`") to the <strong>oneSitePlsBot</strong> on Telegram.
                     </li>
                     <li>
                       <strong>(Optional) Use Grok:</strong> If needed, use the integrated Grok interface (link on `/repo-xml`) for code generation.
                     </li>
                     <li>
                       <strong>Parse Files:</strong> Paste the AI-generated code into the `/repo-xml` parser. Select the files intended for modification.
                     </li>
                     <li>
                       <strong>Create PR:</strong> Click "Create request." The tool generates the Pull Request details based on the parsed code. Submit it.
                     </li>
                     <li>
                       <strong>Extract Context:</strong> Use the "Extract" feature on `/repo-xml` to gather project file contents for providing better context to the AI (Bot or Grok) for follow-up tasks or iterations.
                     </li>
                   </ol>
                   <p className="text-sm md:text-base mt-4 text-gray-300">
                     This workflow minimizes direct GitHub interaction, focusing on leveraging <strong>AI assistants and automation</strong>. Submit the PR, I get notified, merge it, and your contribution is live. Let's ride these AI waves together!
                   </p>
                 </CardContent>
               </Card>


              {/* Call to Action */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Ready to Collaborate?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    Want to build something impactful using AI-driven methods, adopt these workflows, or level up your team’s efficiency? Connect on{" "}
                    <a href="https://t.me/salavey13" target="_blank" rel="noopener noreferrer" className="text-[#39FF14] hover:underline">
                      Telegram
                    </a>{" "}
                    or email at{" "}
                    <a href="mailto:salavey13@gmail.com" className="text-[#39FF14] hover:underline">
                      salavey13@gmail.com
                    </a>
                    .
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
