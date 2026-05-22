"use client";

import Head from "next/head";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SupportForm from "@/components/SupportForm";

const portfolioProof = [
  {
    title: "Franchize Engine / VIP Bike Rental",
    result: "Hydrated a full niche business surface from a single SQL seed + market items.",
    details: "The `/vipbikerental` flow shows how a reusable franchise template can be bootstrapped fast, then iterated as a real product system.",
    href: "/vipbikerental",
  },
  {
    title: "WBlanding",
    result: "Converted a landing into an operator cockpit.",
    details: "Integrated crew actions, audit tooling, referral mechanics, and invoicing pathways into one execution-oriented commercial surface.",
    href: "/wblanding",
  },
  {
    title: "BOSS_QUEST.HTML",
    result: "Latest client workflow protocol.",
    details: "Turns a raw client request + a couple of images into a practical execution quest where the client mainly accepts and requests polish.",
    href: "https://github.com/salavey13/carTest/blob/main/BOSS_QUEST.HTML",
  },
];

export default function AboutEnPage() {
  return (
    <>
      <Head>
        <title>Pavel Solovyov — Portfolio / AI Product Engineer</title>
        <meta name="description" content="Portfolio page for Pavel Solovyov featuring Franchize/VIP Bike, WBlanding and BOSS_QUEST workflow." />
      </Head>

      <main className="min-h-screen bg-[#050507] text-zinc-100">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-16 md:pt-24 space-y-8">
          <div className="flex justify-between items-center gap-3">
            <p className="text-xs md:text-sm tracking-[0.16em] text-zinc-400 uppercase">about_en / portfolio-mode</p>
            <Link href="/about" className="rounded-md border border-emerald-400/40 px-3 py-1.5 text-xs md:text-sm text-emerald-300 hover:bg-emerald-300 hover:text-black transition-colors">RU CV</Link>
          </div>

          <Card className="border-cyan-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-3xl md:text-5xl text-cyan-300">Pavel Solovyov — AI Product Engineer</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-zinc-200">
              <p className="text-base md:text-lg">I build AI-assisted product systems that sell, operate, and scale — not just demo pages.</p>
              <p className="text-sm md:text-base">My engagement style is BOSS-mode delivery: fast intent capture, clear execution map, working releases, and measurable polishing loops.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-300">
                <p>Location: Nizhny Novgorod / remote-first</p><p>Telegram: @salavey13</p>
                <p>GitHub: github.com/salavey13</p><p>Stack: Next.js, TypeScript, Supabase, Telegram, AI workflows</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-fuchsia-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-fuchsia-300">Portfolio proof (live system examples)</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {portfolioProof.map((item) => (
                <article key={item.title} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-cyan-200">{item.result}</p>
                  <p className="mt-3 text-sm text-zinc-300">{item.details}</p>
                  <Link href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} className="mt-3 inline-block text-sm text-cyan-300 underline hover:text-cyan-200">Open case</Link>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card className="border-amber-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-amber-300">How clients work with me</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 text-sm text-zinc-200">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-semibold text-white">For founders / operators</p>
                <p className="mt-2">You bring intent, constraints, and references. I return an execution-ready product path with visible checkpoints.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-semibold text-white">For teams</p>
                <p className="mt-2">I plug into existing flows and accelerate delivery with AI + architecture discipline, not chaotic one-off hacks.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-violet-300">Julia partner layer</CardTitle></CardHeader>
            <CardContent className="text-sm text-zinc-200">
              Julia is the recurring presentation companion in my brand narrative: mystery, tone, and cinematic consistency. It supports communication while my core role remains product architecture and delivery ownership.
            </CardContent>
          </Card>

          <Card className="border-emerald-400/30 bg-zinc-950/90">
            <CardHeader><CardTitle className="text-2xl text-emerald-300">Quick contact / Support</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-300">If you want to launch a micro-business app from a rough brief — send context here and I will propose a concrete build path.</p>
              <SupportForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
