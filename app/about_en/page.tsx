"use client";

import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SupportForm from "@/components/SupportForm";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";

export default function HolisticMarketplacePage() {
  return (
    <>
      <Head>
        <title>oneSitePls — Cyber Garage & Local Services | VIBE Marketplace</title>
        <meta name="description" content="AI-powered dev studio + local services marketplace: VIP bike rentals, sauna sessions, yoga masters, and SelfDev mentorship — all via oneSitePls." />
      </Head>

      <div className="relative min-h-screen bg-background text-foreground">
        {/* Background hero */}
        <section className="relative min-h-[520px] flex items-center justify-center text-center p-6 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <Image
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/hero-4f94e671-c5c8-4405-ab08-8f9a47e1ad69.jpg"
              alt="Hero"
              layout="fill"
              objectFit="cover"
              className="brightness-60"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto text-white">
            <h1 className="font-orbitron text-5xl sm:text-6xl md:text-7xl leading-tight uppercase tracking-tight">
              <span className="block">CYBER-GARAGE × LOCAL VIBES</span>
              <span className="block text-primary">Rent. Heal. Ride. Level Up.</span>
            </h1>
            <p className="mt-6 text-lg text-foreground/80 max-w-3xl mx-auto">
              A practical ecosystem: AI-driven product development meets local services — VIP bike rentals, saunas, yoga, and coaching. Test offers, get stars, and scale with VIBE.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/rent-bike" legacyBehavior>
                <a>
                  <Button size="lg" variant="accent" className="font-orbitron">
                    <VibeContentRenderer content="::FaMotorcycle:: ВЫБРАТЬ БАЙК" />
                  </Button>
                </a>
              </Link>

              <Link href="/about" legacyBehavior>
                <a>
                  <Button size="lg" variant="ghost" className="font-orbitron">
                    <VibeContentRenderer content="::FaInfoCircle:: Подробнее о проекте" />
                  </Button>
                </a>
              </Link>

            </div>
          </div>
        </section>

        {/* Services grid */}
        <main className="container mx-auto px-4 py-12 space-y-12">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-card/90 border-border">
              <CardHeader>
                <CardTitle className="font-orbitron text-2xl flex items-center gap-3">
                  <VibeContentRenderer content="::FaMotorcycle::" /> VIP Bike Rentals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Premium bikes, safety gear, and an easy booking flow. Perfect for riders who want an honest, powerful experience — hourly or daily.
                </p>
                <ul className="list-disc list-inside text-sm space-y-2 mb-4">
                  <li>Clean & serviced motorcycles</li>
                  <li>OSAGO / insurance included</li>
                  <li>Protective gear & quick service</li>
                </ul>
                <div className="flex gap-3">
                  <Link href="/rent-bike">
                    <a><Button>Забронировать байк</Button></a>
                  </Link>
                  <Link href="/vipbikerental">
                    <a><Button variant="secondary">Подробнее</Button></a>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/90 border-border">
              <CardHeader>
                <CardTitle className="font-orbitron text-2xl flex items-center gap-3">
                  <VibeContentRenderer content="::FaFire::" /> Sauna & Recovery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Quick recovery space, private sauna sessions, and easy scheduling — perfect for riders, founders, and anyone who needs a warm reset.
                </p>
                <ul className="list-disc list-inside text-sm space-y-2 mb-4">
                  <li>Private sessions by time-slot</li>
                  <li>Optional add-ons: aromatherapy, towels</li>
                  <li>Book as an individual or small group</li>
                </ul>
                <div className="flex gap-3">
                  <Link href="/sauna">
                    <a><Button>Забронировать сауну</Button></a>
                  </Link>
                  <Link href="/about#sauna">
                    <a><Button variant="secondary">Подробнее</Button></a>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/90 border-border">
              <CardHeader>
                <CardTitle className="font-orbitron text-2xl flex items-center gap-3">
                  <VibeContentRenderer content="::FaPersonRunning::" /> Rent a Vibe Master (Yoga / Coach)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Book local practitioners — yoga masters, therapists, or niche service providers. Perfect for small groups and ongoing clients.
                </p>
                <ul className="list-disc list-inside text-sm space-y-2 mb-4">
                  <li>One-off sessions or recurring classes</li>
                  <li>Pay via Telegram Stars (XTR) — fast & simple</li>
                  <li>Service discovery and vetting built-in</li>
                </ul>
                <div className="flex gap-3">
                  <Link href="/rent_a_vibe_master">
                    <a><Button>Забронировать мастера</Button></a>
                  </Link>
                  <Link href="/selfdev">
                    <a><Button variant="secondary">Как это работает</Button></a>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Combined about + selfdev pitch */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-black/80 border-border">
                <CardHeader>
                  <CardTitle className="text-2xl font-orbitron flex items-center gap-3">
                    <VibeContentRenderer content="::FaGlobe::" /> oneSitePls — About & VIBE Philosophy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300 mb-4">
                    I’m Pavel — I build workflows that make AI genuinely useful. VIBE is about using AI to amplify strategy, validate ideas fast, and ship real value.
                  </p>

                  <h4 className="font-bold text-accent-text mb-2">What’s here</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 mb-4">
                    <li>AI-assisted contribution studio (<Link href="/repo-xml"><a className="text-accent-text hover:underline">/repo-xml</a></Link>)</li>
                    <li>Fast validation — fake-door MVPs powered by AI</li>
                    <li>Secure AI dev: SAST + PR scanning built-in</li>
                  </ul>

                  <p className="text-sm text-gray-300">If you want help shipping, mentoring, or validating — use the form on the right to request support. Payments happen via Telegram Stars (XTR).</p>
                </CardContent>
              </Card>

              <Card className="bg-black/80 border-border">
                <CardHeader>
                  <CardTitle className="text-2xl font-orbitron flex items-center gap-3">
                    <VibeContentRenderer content="::FaLightbulb::" /> SelfDev: Become Your Own Product
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300 mb-4">
                    SelfDev is the practical path: build your services around your authenticity, use AI to scale outputs, and start with high-value offers — then productize.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/60 rounded-lg border border-border">
                      <h5 className="font-semibold text-accent-text mb-2">Start</h5>
                      <p className="text-xs text-muted-foreground">Offer a high-value service for a small niche and validate it fast.</p>
                    </div>
                    <div className="p-4 bg-muted/60 rounded-lg border border-border">
                      <h5 className="font-semibold text-accent-text mb-2">Scale</h5>
                      <p className="text-xs text-muted-foreground">Use AI to create content, automate outreach, and build repeatable products.</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 mt-4">
                    Want to gamify your learning? Check <Link href="/selfdev/gamified"><a className="text-accent-text hover:underline">Gamified SelfDev</a></Link>.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Right column: Support form / CTA (uses your existing support flow) */}
            <aside>
              <Card className="bg-black/85 border-border sticky top-24">
                <CardHeader>
                  <CardTitle className="text-xl font-orbitron flex items-center gap-3">
                    <VibeContentRenderer content="::FaHandsHelping::" /> Get Help / Pay with Stars
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300 mb-4">
                    Need a quick consult, VIP support, or product validation? Choose a level and pay with Telegram Stars (XTR). I’ll get notified and respond via Telegram.
                  </p>
                  <div className="mb-4">
                    <SupportForm />
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <p className="mb-2"><strong>Why Stars?</strong> Fast, low-friction micropayments. Works well for local services and short consults.</p>
                    <p>Prefer direct contact? <Link href="mailto:salavey13@gmail.com"><a className="text-accent-text hover:underline">Email me</a></Link> or message <Link href="https://t.me/salavey13"><a className="text-accent-text hover:underline">Telegram</a></Link>.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/60 border-border mt-6">
                <CardContent>
                  <h4 className="font-semibold text-accent-text mb-2">Quick Links</h4>
                  <ul className="text-sm list-inside space-y-2">
                    <li><Link href="/vipbikerental"><a className="hover:underline">VIP Bike Details</a></Link></li>
                    <li><Link href="/sauna"><a className="hover:underline">Sauna Info</a></Link></li>
                    <li><Link href="/rent_a_vibe_master"><a className="hover:underline">Hire a Vibe Master</a></Link></li>
                    <li><Link href="/repo-xml"><a className="hover:underline">/repo-xml Studio</a></Link></li>
                  </ul>
                </CardContent>
              </Card>
            </aside>
          </section>

          {/* Footer CTA */}
          <section className="py-10 text-center">
            <p className="text-sm text-muted-foreground mb-4">Want to have this marketplace on your feed? Invite friends, book a session, or request VIP assistance — we scale with you.</p>
            <div className="flex justify-center gap-3">
              <Link href="/repo-xml"><a><Button variant="outline">Contribute / Remix</Button></a></Link>
              <Link href="/selfdev"><a><Button variant="secondary">Start SelfDev</Button></a></Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}