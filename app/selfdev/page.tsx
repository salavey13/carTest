"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sendTelegramInvoice } from "../actions";

export default function SelfDevPage() {
  const buyBoost = async (type: string, amount: number, title: string, description: string) => {
    const chatId = "413553377"; // Replace with dynamic user chat ID in production
    const payload = `selfdev_boost_${type}_${Date.now()}`;

    const result = await sendTelegramInvoice(chatId, title, description, payload, amount, 0);
    if (result.success) {
      alert(`Invoice for ${title} sent! Pay with XTR in Telegram, bro!`);
    } else {
      alert("Oops, invoice failed. Retry, my man!");
    }
  };

  const boosts = [
    { type: "priority_review", title: "Priority Review Pass", desc: "Your pull request merged in 24 hours!", amount: 50 },
    { type: "cyber_extractor_pro", title: "Cyber-Extractor Pro", desc: "Full project tree + AI context suggestions.", amount: 100 },
    { type: "custom_command", title: "Custom Bot Command", desc: "Tailored command for oneSitePlsBot.", amount: 200 },
    { type: "ai_code_review", title: "AI Code Review", desc: "Grok audits your code with pro tips.", amount: 75 },
    { type: "neon_avatar", title: "Neon Avatar", desc: "Custom cyberpunk avatar for your profile.", amount: 150 },
    { type: "vibe_session", title: "VIBE Mentorship Session", desc: "1-on-1 with me to master VIBE!", amount: 300 },
    { type: "ar_tour_generator", title: "AR Tour Generator", desc: "AI builds AR tours for your cars.", amount: 250 },
    { type: "code_warp_drive", title: "Code Warp Drive", desc: "Bot writes a feature in 12 hours.", amount: 400 },
    { type: "cyber_garage_key", title: "Cyber-Garage VIP Key", desc: "Exclusive access to premium car listings.", amount: 500 },
    { type: "tsunami_rider", title: "Tsunami Rider Badge", desc: "Bragging rights + priority in all queues.", amount: 1000 },
    { type: "bot_overclock", title: "Bot Overclock", desc: "Double oneSitePlsBot speed for 30 days.", amount: 600 },
    { type: "neural_tuner", title: "Neural Tuner", desc: "AI picks cars by your vibe, custom algo.", amount: 350 },
    { type: "repo_stealth_mode", title: "Repo Stealth Mode", desc: "Hide your PRs from others for secrecy.", amount: 200 },
    { type: "glitch_fx_pack", title: "Glitch FX Pack", desc: "Cyberpunk UI effects for your pages.", amount: 120 },
    { type: "infinite_extract", title: "Infinite Extractor", desc: "Unlimited file extractions, no cooldown.", amount: 800 },
  ];

  return (
    <div className="relative min-h-screen">
      {/* Cyberpunk SVG Background */}
      <div className="absolute inset-0 z-0">
        <svg className="w-full h-full opacity-70 animate-pulse-slow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
          <defs>
            <linearGradient id="cyberBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: "#000000", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "#111111", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <rect width="1000" height="1000" fill="url(#cyberBg)" />
          <path d="M0,200 H1000 M0,400 H1000 M0,600 H1000 M0,800 H1000" stroke="#39FF14" strokeWidth="2" opacity="0.5" />
          <path d="M200,0 V1000 M400,0 V1000 M600,0 V1000 M800,0 V1000" stroke="#39FF14" strokeWidth="2" opacity="0.5" />
          <circle cx="500" cy="500" r="300" stroke="#39FF14" strokeWidth="1" fill="none" opacity="0.3" />
        </svg>
      </div>
      <div className="relative z-10 container mx-auto p-4 pt-24">
        <Card className="max-w-4xl mx-auto bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
          <CardHeader>
            <CardTitle className="text-2xl md:text-4xl font-bold text-center text-[#39FF14]">
              Boosts Market: Твой Кибер-Базар
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm md:text-base text-center">
              Добро пожаловать в Boosts Market, братан! Это твой портал в мир AI-ускорителей — от прокачки кода до эксклюзивных фич. Всё за XTR, всё для тебя, чтобы оседлать цунами технологий. Выбирай, плати, взлетаем!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {boosts.map((boost) => (
                <div key={boost.type} className="flex justify-between items-center p-4 bg-gray-900 rounded-xl shadow-[0_0_5px_#39FF14]">
                  <div>
                    <p className="text-[#39FF14] font-bold">{boost.title}</p>
                    <p className="text-sm">{boost.desc}</p>
                  </div>
                  <Button
                    onClick={() => buyBoost(boost.type, boost.amount, boost.title, boost.desc)}
                    className="bg-[#39FF14] text-black hover:bg-[#2ecc11] font-semibold"
                  >
                    {boost.amount} XTR
                  </Button>
                </div>
              ))}
            </div>

            <p className="text-sm md:text-base text-center mt-6">
              Не видишь нужного буста? Пиши в <a href="https://t.me/salavey13" className="text-[#39FF14] hover:underline">Telegram</a>, и я замутим что-то космическое под тебя! Го зарабатывать звёзды и править кибер-миром, мой * boy!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}