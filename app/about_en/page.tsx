"use client";

import React from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import BikeShowcase from "@/components/BikeShowcase";
import SupportForm from "@/components/SupportForm";
import { FaMotorcycle, FaHotTubPerson, FaUserTie, FaTelegram, FaRocket } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export default function AboutMergedPage() {
  const telegramBot = "https://t.me/oneSitePlsBot";
  const rentYogStart = `${telegramBot}?start=rent_a_yog`;
  const vipStart = `${telegramBot}?start=vip_rent`;
  const saunaStart = `${telegramBot}?start=sauna_rent`;

  return (
    <>
      <Head>
        <title>Pavel / oneSitePls — Bikes · Sauna · SelfDev · Rent the Vibe</title>
        <meta
          name="description"
          content="oneSitePls — AI-accelerated studio for bikers, sauna hosts, yogs and self-dev practitioners. Fast support via Telegram Stars (XTR)."
        />
      </Head>

      <div className="relative min-h-screen bg-gradient-to-b from-black/80 to-slate-900 text-foreground">
        {/* background hero */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/hero-4f94e671-c5c8-4405-ab08-8f9a47e1ad69.jpg"
            alt="oneSitePls hero"
            layout="fill"
            objectFit="cover"
            className="opacity-40"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-black/60 to-transparent" />
        </div>

        <main className="relative z-10 container mx-auto px-4 pt-24 pb-12">
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-5xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-6xl font-orbitron font-black tracking-tight text-amber-300 drop-shadow-lg">
              oneSitePls — VIBE: Bikes · Sauna · SelfDev
            </h1>
            <p className="mt-4 text-lg md:text-xl text-amber-100/80 max-w-3xl mx-auto">
              AI-enabled studio for people who do things IRL. Rent bikes, host a sauna, book a Vibe Master (yog/coach) or level-up with SelfDev. Pay with Telegram Stars (XTR). No bullshit.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/rent-bike">
                <Button size="lg" variant="ghost" className="font-orbitron flex items-center gap-2">
                  <FaMotorcycle /> Browse Bikes
                </Button>
              </Link>
              <a href={saunaStart} target="_blank" rel="noreferrer">
                <Button size="lg" variant="secondary" className="font-orbitron flex items-center gap-2">
                  <FaHotTubPerson /> Book Sauna (one click)
                </Button>
              </a>
              <a href={rentYogStart} target="_blank" rel="noreferrer">
                <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-slate-900 flex items-center gap-2">
                  Rent a Vibe Master (yog) — quick start
                </Button>
              </a>
            </div>
            <p className="mt-3 text-xs text-amber-200/60 italic">Payments via Telegram Stars (XTR) — fast micro-payments, low friction.</p>
          </motion.header>

          {/* main grid */}
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left — Bikes showcase */}
            <section className="lg:col-span-2 space-y-6">
              <Card className="bg-black/60 border border-border">
                <CardHeader>
                  <CardTitle className="text-2xl font-orbitron text-accent-text flex items-center gap-3">
                    <FaMotorcycle /> VIPBIKE — Rental & Community
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Full-service rental, maintenance, and community spot. From weekend cruisers to sportbikes — choose your vibe. Simple booking, clear terms, friendly people.
                  </p>

                  <BikeShowcase />

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-accent-text">What you get</h4>
                      <ul className="list-disc list-inside text-sm text-foreground/80">
                        <li>Serviced bikes</li>
                        <li>OSAGO + full gear</li>
                        <li>Pickup at Striginsky 13B</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-accent-text">Quick actions</h4>
                      <div className="flex flex-col gap-3">
                        <Link href="/rent-bike"><Button variant="outline">Open Catalog</Button></Link>
                        <a href={vipStart} target="_blank" rel="noreferrer"><Button>Contact via Telegram</Button></a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sauna + Rent the VibeMaster */}
              <Card className="mt-6 bg-black/60 border border-border">
                <CardHeader>
                  <CardTitle className="text-2xl font-orbitron text-amber-300 flex items-center gap-3">
                    <FaHotTubPerson /> Sauna · Private Sessions · Vibe Master (rent_a_yog)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-foreground/80 mb-4">
                        LÖYLY VIBE — intimate sauna sessions for reset, health and social connection. Also: book a Vibe Master (yog/guide/coach) to run private sessions on-site or in pop-up locations (park, garage, rider meet).
                      </p>
                      <ul className="list-disc list-inside text-sm text-foreground/80">
                        <li>Hourly or package bookings</li>
                        <li>VIP/Group options (sauna + instructor)</li>
                        <li>Mobile pop-ups — we can bring the vibe to you</li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-semibold text-accent-text">Book a vibe</h4>
                      <div className="flex flex-col gap-2">
                        <a href={saunaStart} target="_blank" rel="noreferrer"><Button>Book Sauna — Telegram</Button></a>
                        <a href={rentYogStart} target="_blank" rel="noreferrer"><Button variant="outline">Rent a Vibe Master (yog)</Button></a>
                        <Link href="/sauna-rent"><Button variant="ghost">Sauna details</Button></Link>
                      </div>
                      <p className="text-xs text-foreground/60 mt-2 italic">Prefer a human touch? Use the support form below and choose VIP support — we'll arrange everything.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SelfDev condensed */}
              <Card className="mt-6 bg-black/60 border border-border">
                <CardHeader>
                  <CardTitle className="text-2xl font-orbitron text-brand-cyan flex items-center gap-3">
                    <FaUserTie /> SelfDev · Mentorship · AI Acceleration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/80 mb-4">
                    SelfDev is the playbook: become the product, use AI to multiply output, validate ideas before you build. Use /repo-xml studio to ship tiny verified PRs and learn on real code — fast feedback loops, real results.
                  </p>

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="how">
                      <AccordionTrigger>How SelfDev helps you</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc list-inside text-sm text-foreground/80">
                          <li>AI-assisted idea validation (fake-door MVPs)</li>
                          <li>Content-for-growth templates (turn 1 interview into 50 assets)</li>
                          <li>Outbound + personalization playbook for real clients</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="start">
                      <AccordionTrigger>Start now</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          <p className="text-sm text-foreground/80">Want help applying SelfDev to your sauna, bikes, or service? Book a quick audit (1★) or a strategy call (3★) via Stars — use the support form below or open Telegram.</p>
                          <div className="flex gap-2">
                            <a href={telegramBot} target="_blank" rel="noreferrer"><Button variant="outline"><FaTelegram /> Open Bot</Button></a>
                            <Link href="/repo-xml"><Button variant="ghost">Open Studio</Button></Link>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </section>

            {/* Right column — support & promos */}
            <aside className="space-y-6 lg:col-span-1">
              <Card className="bg-black/70 border border-border p-4">
                <CardHeader>
                  <CardTitle className="text-lg font-orbitron text-accent-text">Quick Support — Pay with Stars</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/80 mb-3">Need help setting up bookings, launching rent_a_yog, or a VIP onboarding? Use the form below — payments go via Telegram Stars (XTR). Fast, simple, human follow-up.</p>

                  {/* SupportForm uses existing support flow */}
                  <div className="mt-4">
                    <SupportForm />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/60 border border-border p-4">
                <CardHeader>
                  <CardTitle className="text-lg font-orbitron text-amber-300">Mini Cases & Promos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-foreground/80">
                  <div className="space-y-1">
                    <strong>Test flow: 3★</strong>
                    <p className="text-xs">One friend used full-rent flow for 3 stars — proof it's working. We'll replicate and scale.</p>
                  </div>
                  <div className="space-y-1">
                    <strong>First 5 Vibe Hosts</strong>
                    <p className="text-xs">Free onboarding call if you commit a 10★ package for a month of support.</p>
                  </div>
                  <div className="space-y-1">
                    <strong>Affiliate</strong>
                    <p className="text-xs">Refer a host — get 1★ credit per successful first booking.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/60 border border-border p-4">
                <CardHeader>
                  <CardTitle className="text-lg font-orbitron text-brand-green">Contact & Social</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-foreground/80">
                  <p>Telegram: <a href="https://t.me/salavey13" target="_blank" rel="noreferrer" className="text-accent-text hover:underline">t.me/salavey13</a></p>
                  <p className="mt-2">Open the bot for one-click actions:</p>
                  <div className="mt-3 flex gap-2">
                    <a href={rentYogStart} target="_blank" rel="noreferrer"><Button size="sm">Rent a yog</Button></a>
                    <a href={vipStart} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">VIP rent</Button></a>
                    <a href={saunaStart} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost">Sauna</Button></a>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>

          <footer className="mt-12 text-center text-xs text-foreground/60">
            <p>oneSitePls — built on VIBE methodology. Payments via Telegram Stars (XTR). No middlemen, fast value.</p>
            <p className="mt-2">Want me to wire a 'rent_a_yog' quick flow (forms + repo-xml template + bot hook)? Send 3★ to start and I’ll ship the first draft in 24h.</p>
          </footer>
        </main>
      </div>
    </>
  );
}