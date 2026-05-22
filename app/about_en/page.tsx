"use client";

import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SupportForm from "@/components/SupportForm";

const projects = [
  {
    title: "Franchize Engine + VIP Bike Rental",
    desc: "A repeatable model where a full web business surface is hydrated from a single SQL crew seed plus market items. /vipbikerental is the live flagship proof.",
    cta: "Open /vipbikerental",
    href: "/vipbikerental",
  },
  {
    title: "WBlanding",
    desc: "Built as an operator-ready commercial surface: conversion entry, crew flow, referral and invoicing mechanics, plus practical action modules for execution.",
    cta: "Open /wblanding",
    href: "/wblanding",
  },
  {
    title: "BOSS_QUEST.HTML",
    desc: "My latest client protocol: one request + a few images become an execution plan run by BOSS end-to-end. Clients stay focused on acceptance and polish, not process chaos.",
    cta: "Read BOSS_QUEST.HTML",
    href: "https://github.com/salavey13/carTest/blob/main/BOSS_QUEST.HTML",
  },
];

const engagement = [
  "Start from real business intent (not heavyweight specs).",
  "Translate intent into a concrete execution map and working slices.",
  "Ship quickly, validate on live usage, then polish with measurable iterations.",
];

export default function AboutEnPage() {
  return (
    <>
      <Head>
        <title>Pavel Solovyov — AI Product Engineer</title>
        <meta
          name="description"
          content="Updated English about page with flagship demos: Franchize/VIP Bike hydration, WBlanding, and BOSS_QUEST.HTML client workflow."
        />
      </Head>

      <main className="min-h-screen bg-[#060606] text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-12 space-y-6">
          <div className="flex justify-end">
            <Link
              href="/about"
              className="rounded-md border border-cyan-400/40 px-3 py-1.5 text-xs md:text-sm text-cyan-300 hover:bg-cyan-300 hover:text-black transition-colors"
            >
              RU version
            </Link>
          </div>

          <Card className="border-cyan-400/30 bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-2xl md:text-4xl text-cyan-300">Pavel Solovyov — AI Product Engineer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-zinc-200">
              <p className="text-sm md:text-base">
                I design and deliver AI-assisted product systems where the main outcome is a working business tool, not a documentation-heavy delay loop.
              </p>
              <p className="text-sm md:text-base">
                My delivery rhythm is: intent capture → execution blueprint → fast shipping of working slices → validation-driven polish.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-300">
                <p>Location: Nizhny Novgorod / remote-first</p>
                <p>Telegram: @salavey13</p>
                <p>GitHub: github.com/salavey13</p>
                <p>Stack: Next.js, TypeScript, Supabase, Telegram, AI workflows</p>
              </div>
            </CardContent>
          </Card>



          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-violet-400/30 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl text-violet-300">Mysterious partner: Julia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-zinc-200">
                <p>Julia is my recurring team persona and creative partner layer across product storytelling and client communication.</p>
                <p>She represents the same style values as my delivery model: sharp, practical, and cinematic without losing execution discipline.</p>
              </CardContent>
            </Card>

            <Card className="border-violet-400/30 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-xl text-violet-300">Julia / avatar</CardTitle>
              </CardHeader>
              <CardContent>
                <Image
                  src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//135398606.png"
                  alt="Julia mysterious partner avatar"
                  width={640}
                  height={640}
                  className="w-full rounded-xl border border-violet-300/40 object-cover"
                  unoptimized
                />
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-emerald-400/30 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl text-emerald-300">Flagship integrations & demos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {projects.map((item) => (
                  <article key={item.title} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-zinc-300">{item.desc}</p>
                    <Link
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      className="mt-3 inline-block text-sm text-cyan-300 underline hover:text-cyan-200"
                    >
                      {item.cta}
                    </Link>
                  </article>
                ))}
              </CardContent>
            </Card>

            <Card className="border-fuchsia-400/30 bg-zinc-950">
              <CardHeader>
                <CardTitle className="text-xl text-fuchsia-300">Engagement model</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-zinc-200">
                  {engagement.map((step) => (
                    <li key={step} className="border-l-2 border-fuchsia-400/40 pl-3">
                      {step}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          <Card className="border-amber-400/30 bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl text-amber-300">What clients get</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-zinc-200">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-semibold text-white">Speed with structure</p>
                <p className="mt-2">Fast first value without sacrificing architecture and operational clarity.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-semibold text-white">Operational continuity</p>
                <p className="mt-2">Interfaces and data flows that can continue into production, not throwaway demos.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-semibold text-white">Clear acceptance loop</p>
                <p className="mt-2">Client-visible checkpoints and polishing passes instead of vague “we’re still in progress”.</p>
              </div>
            </CardContent>
          </Card>


          <Card className="border-emerald-400/30 bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl text-emerald-300">Quick contact / Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-300">Want to discuss a launch, franchize hydration path, or BOSS-mode delivery for your case? Send a request here.</p>
              <SupportForm />
            </CardContent>
          </Card>

        </div>
      </main>
    </>
  );
}
