"use client";
import { FixedHeader } from "./components/FixedHeader";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { createCrew, sendServiceInvoice, notifyAdmin } from "@/app/actions";
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrewsListSimplified } from "./components/CrewsListSimplified";
import { WarehouseAuditTool } from "./components/WarehouseAuditTool";
import { ExitIntentPopup } from "./components/ExitIntentPopup";
import { FaRocket, FaUsers, FaFlagCheckered, FaUserPlus, FaCalendarCheck, FaFire, FaPaperPlane, FaBell, FaStar, FaQuoteLeft, FaClock, FaSkullCrossbones, FaGhost, FaBolt } from 'react-icons/fa6';
import { Loader2, Zap, ShieldQuestion, FileText, TrendingDown, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import Image from 'next/image';
import { supabaseAdmin } from '@/hooks/supabase';

// --- UTILS & TYPES ---
interface Testimonial {
  id: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
  content: string;
  rating: number;
  created_at: string;
}

const generateSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+|-+$/g, '');

// --- ANIMATION VARIANTS ---
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

export default function WarehouseLandingPage() {
  const { dbUser, isLoading: appContextLoading } = useAppContext();
  const router = useRouter();
  const [showAudit, setShowAudit] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hqLocation, setHqLocation] = useState("56.3269,44.0059"); // Nizhny Novgorod default
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCrew, setCreatedCrew] = useState<{ slug: string; name: string } | null>(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Testimonials state
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialContent, setTestimonialContent] = useState("");
  const [testimonialRating, setTestimonialRating] = useState(5);
  const [isSubmittingTestimonial, setIsSubmittingTestimonial] = useState(false);

  const footerLinkClass = "text-sm text-muted-foreground hover:text-brand-cyan font-mono flex items-center gap-1.5 transition-colors duration-200 hover:text-glow";
  
  const auditRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSlug(generateSlug(name)); }, [name]);

  // Load approved testimonials
  useEffect(() => {
    const loadTestimonials = async () => {
      const { data, error } = await supabaseAdmin
        .from('testimonials')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (!error && data) {
        setTestimonials(data as Testimonial[]);
      }
    };
    loadTestimonials();
  }, []);

  const scrollToAudit = () => {
    setTimeout(() => {
      auditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // --- FORM HANDLERS (Keep existing logic, updated styling later) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) { toast.error("Ошибка: не удалось определить ID пользователя."); return; }
    if (!slug) { toast.error("Slug не может быть пустым."); return; }
    setIsSubmitting(true);
    try {
      const result = await createCrew({
        name, slug, description, logo_url: logoUrl, owner_id: dbUser.user_id, hq_location: hqLocation,
      });
      if (result.success && result.data) {
        toast.success(`Склад "${result.data.name}" создан!`);
        setCreatedCrew({ slug: result.data.slug, name: result.data.name });
        await notifyAdmin(`🎉 New Warehouse: ${result.data.name} by ${dbUser.username}`);
      } else { throw new Error(result.error); }
    } catch (error) { toast.error("Ошибка при создании склада."); } finally { setIsSubmitting(false); }
  };

  const handleInvite = async () => {
    if (!createdCrew) return;
    const inviteUrl = `https://t.me/oneBikePlsBot/app?startapp=crew_${createdCrew.slug}_join_crew`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Join ${createdCrew.name}`)}`, "_blank");
  };

  const handleSendInvoice = async (serviceType: 'quick_setup' | 'team_training', amount: number) => {
    if (!dbUser?.user_id) { toast.error("Login required"); return; }
    setIsSendingInvoice(true);
    try {
      const services = {
        quick_setup: { name: "🎯 Быстрый старт", description: "Настройка и интеграция за 24 часа", amount },
        team_training: { name: "👨‍🏫 Обучение команды", description: "Мастер-класс для персонала", amount }
      };
      const res = await sendServiceInvoice(dbUser.user_id, serviceType, services[serviceType].name, services[serviceType].description, amount);
      if (res.success) toast.success("Счет отправлен в Telegram!");
      else throw new Error(res.error);
    } catch (e) { toast.error("Ошибка отправки счета"); } finally { setIsSendingInvoice(false); }
  };

  const handlePlanAction = async (planType: string, action: () => void) => {
    action();
    if (dbUser?.user_id) await sendComplexMessage(dbUser.user_id, `Вы выбрали тариф ${planType}. Скоро свяжемся!`, []);
  };

  const handleSubmitTestimonial = async () => {
    if (!dbUser?.user_id || !testimonialContent.trim()) return;
    setIsSubmittingTestimonial(true);
    try {
      await supabaseAdmin.from('testimonials').insert({
        user_id: dbUser.user_id, username: dbUser.username, avatar_url: dbUser.avatar_url,
        content: testimonialContent, rating: testimonialRating, is_approved: false
      });
      toast.success("Отзыв отправлен на модерацию!");
      setTestimonialContent("");
    } catch { toast.error("Ошибка"); } finally { setIsSubmittingTestimonial(false); }
  };

  // Admin Broadcast
  const handleBroadcast = async () => {
    if (dbUser?.role !== 'admin') return;
    const msg = prompt("Message:");
    if (!msg) return;
    setIsBroadcasting(true);
    await fetch('/api/broadcast', { method: 'POST', body: JSON.stringify({ message: msg, senderId: dbUser.user_id }) });
    setIsBroadcasting(false);
    toast.success("Sent!");
  };

  if (appContextLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-500 selection:text-white">
      <FixedHeader />
      
      {/* --- HERO SECTION: The "Pirate Copy" Hook --- */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-black">
        <div className="absolute inset-0 w-full h-full z-0 opacity-40">
             {/* Glitchy overlay video */}
             <video className="w-full h-full object-cover" autoPlay loop muted playsInline 
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-882e5db9-d256-42f2-a77a-da36b230f67e-0.mp4" 
             />
             <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-zinc-900/90" />
        </div>

        <div className="relative z-10 container mx-auto px-4 text-center">
          <motion.div 
             initial={{ opacity: 0, scale: 0.8 }} 
             animate={{ opacity: 1, scale: 1 }} 
             className="mb-6 inline-block"
          >
             <span className="px-4 py-1.5 rounded-full border border-indigo-500/50 bg-indigo-500/10 text-indigo-300 text-sm font-mono tracking-widest uppercase backdrop-blur-md">
                Vibe Coding v1.0
             </span>
          </motion.div>

          <motion.h1 
            className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 tracking-tighter leading-[1.1]"
            initial="hidden" animate="visible" variants={fadeInUp}
          >
            Stop Paying for <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x">
              Corporate Air.
            </span>
          </motion.h1>

          <motion.p 
            className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }}
          >
            We copied the big WMS features, stripped the bloat, and made it free.
            <br className="hidden md:block"/>
            <span className="text-white font-semibold">Save 73% on fines</span> without the enterprise price tag.
          </motion.p>

          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          >
            <Button 
              onClick={() => { setShowAudit(true); scrollToAudit(); toast("Let's find your lost money 💸"); }} 
              size="lg" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 text-lg rounded-full font-bold shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:shadow-[0_0_30px_rgba(79,70,229,0.7)] transition-all transform hover:-translate-y-1"
            >
              <FaSkullCrossbones className="mr-2" /> CALCULATE YOUR LOSSES
            </Button>
            <Link href="https://t.me/oneBikePlsBot/app" target="_blank">
              <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 px-8 py-6 text-lg rounded-full font-medium backdrop-blur-sm">
                <FaRocket className="mr-2 text-indigo-400" /> Launch Telegram App
              </Button>
            </Link>
          </motion.div>
          
          <motion.p 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
             className="mt-6 text-sm text-gray-500 font-mono"
          >
             *No credit card required. No sales calls. Just code.
          </motion.p>
        </div>
      </section>

      {/* --- AUDIT TOOL: The "Pain Calculator" --- */}
      {showAudit && (
        <section id="audit-tool" className="py-20 px-4 bg-zinc-900 border-y border-zinc-800" ref={auditRef}>
          <div className="container mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">The Price of Chaos</h2>
              <p className="text-gray-400">See exactly how much "manual mode" is costing you per month.</p>
            </div>
            <WarehouseAuditTool />
          </div>
        </section>
      )}

      {/* --- THE MANIFESTO: "Why we exist" --- */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            className="prose prose-lg prose-indigo mx-auto"
          >
            <h3 className="text-indigo-600 font-bold uppercase tracking-wide text-sm mb-2">The Pirate Manifesto</h3>
            <h2 className="text-4xl font-black text-zinc-900 mb-8">Marketplaces were milking us like cows. Until we changed the game.</h2>
            
            <p className="text-xl text-zinc-600 mb-6">
              We used to be like you. Stock counts lying. Employees "forgetting." Excel spreadsheets breathing their last breath.
              Fines arriving as if we personally insulted Wildberries.
            </p>
            
            <div className="bg-zinc-100 p-8 rounded-2xl border-l-4 border-indigo-500 my-8">
              <p className="italic font-medium text-zinc-800 text-lg m-0">
                "Why is a warehouse such a hellhole, when essentially you just need to know where things are and who touched them?"
              </p>
            </div>

            <p>
              We turned off emotions and turned on minimal order.
              <br/>
              <strong>The Chaos disappears when you stop being friends with it.</strong>
            </p>
            <p>
              Surprisingly, fines started to drop... not because we got smarter, but because the warehouse stopped living like an underground club without lights.
              And here's the trick: <strong>We didn't buy a million-ruble ERP. We built a script.</strong>
            </p>
            
            <p className="font-bold text-zinc-900">
              Now we're giving that script to you. Because paying for air is a crime.
            </p>
          </motion.div>
        </div>
      </section>

      {/* --- COMPARISON: The "Scam" vs Us --- */}
      <section className="py-24 bg-zinc-50 border-t border-zinc-200">
        <div className="container mx-auto px-4 max-w-6xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-black text-zinc-900 mb-6">David vs. The Corporate Goliaths</h2>
             <p className="text-xl text-zinc-600">They sell you complexity. We give you clarity.</p>
           </div>

           <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* The "Bad" Guys */}
              <motion.div 
                whileHover={{ scale: 0.98 }}
                className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 relative overflow-hidden grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
              >
                 <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">OLD SCHOOL</div>
                 <h3 className="text-2xl font-bold text-zinc-400 mb-6">Standard ERPs (MoiSklad, etc.)</h3>
                 <ul className="space-y-4">
                    <li className="flex items-center text-zinc-500 gap-3"><XCircle className="text-red-400"/> Expensive monthly subscriptions</li>
                    <li className="flex items-center text-zinc-500 gap-3"><XCircle className="text-red-400"/> "Monstrous" interfaces</li>
                    <li className="flex items-center text-zinc-500 gap-3"><XCircle className="text-red-400"/> Requires 2 weeks training</li>
                    <li className="flex items-center text-zinc-500 gap-3"><XCircle className="text-red-400"/> Support takes days to reply</li>
                 </ul>
              </motion.div>

              {/* The "Good" Guys */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-zinc-900 p-8 rounded-3xl shadow-2xl border border-indigo-500/30 relative overflow-hidden group"
              >
                 <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"/>
                 <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">VIBE CODED</div>
                 <h3 className="text-2xl font-bold text-white mb-6">WarehouseBot</h3>
                 <ul className="space-y-4 relative z-10">
                    <li className="flex items-center text-white gap-3"><CheckCircle2 className="text-green-400"/> <span className="font-bold">Free Tier</span> for starters</li>
                    <li className="flex items-center text-white gap-3"><CheckCircle2 className="text-green-400"/> Runs in Telegram (Mobile First)</li>
                    <li className="flex items-center text-white gap-3"><CheckCircle2 className="text-green-400"/> Zero training needed</li>
                    <li className="flex items-center text-white gap-3"><CheckCircle2 className="text-green-400"/> Founder support via DM</li>
                 </ul>
                 <div className="mt-8">
                    <Button className="w-full bg-white text-black hover:bg-indigo-50 font-bold rounded-xl py-6">
                       Switch to the Vibe Side <ArrowRight className="ml-2 w-4 h-4"/>
                    </Button>
                 </div>
              </motion.div>
           </div>
        </div>
      </section>

      {/* --- FEATURES: Speed Focus --- */}
      <section id="features" className="py-24 bg-black text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-black text-center mb-16">
             Features Built for <span className="text-indigo-500">Speed</span>, Not Compliance.
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
             {[
                { icon: FaBolt, title: "Instant Sync", desc: "API updates to WB/Ozon in real-time. Stop overselling ghost stock." },
                { icon: FaGhost, title: "Ghost Stock Killer", desc: "Visual voxel map helps you find lost items in seconds, not hours." },
                { icon: FaUsers, title: "Gamified Crews", desc: "Points & streaks for employees. Turn boring packing into a high-score game." },
             ].map((f, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i*0.1 }}
                  className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 hover:border-indigo-500 transition-colors group"
                >
                   <f.icon className="w-10 h-10 text-zinc-500 group-hover:text-indigo-400 mb-4 transition-colors"/>
                   <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                   <p className="text-zinc-400">{f.desc}</p>
                </motion.div>
             ))}
          </div>
        </div>
      </section>

      {/* --- PRICING: The Undercut --- */}
      <section id="pricing" className="py-24 bg-zinc-50">
         <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-16">
               <h2 className="text-3xl md:text-5xl font-black text-zinc-900 mb-4">Pricing for Humans</h2>
               <p className="text-lg text-zinc-600">We monetize complexity, not existence. Use the tool for free.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
               {/* Free Tier */}
               <div className="bg-white p-8 rounded-2xl border-2 border-zinc-100 shadow-lg hover:border-zinc-300 transition-all">
                  <h3 className="text-xl font-bold text-zinc-900">The Pirate License</h3>
                  <div className="text-4xl font-black mt-4 mb-2">0₽</div>
                  <p className="text-sm text-zinc-500 mb-6">Forever free. No credit card.</p>
                  <ul className="space-y-3 mb-8 text-sm text-zinc-600">
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> 1 Warehouse</li>
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> 100 SKUs</li>
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Basic Telegram Bot</li>
                  </ul>
                  <Button 
                    onClick={() => handlePlanAction('free', () => toast.success("Welcome aboard!"))}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold"
                  >Start Free</Button>
               </div>

               {/* Pro Tier */}
               <div className="bg-indigo-600 p-8 rounded-2xl shadow-2xl transform md:-translate-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-white text-indigo-600 text-xs font-bold px-3 py-1">BEST VALUE</div>
                  <h3 className="text-xl font-bold text-white">Pro Automation</h3>
                  <div className="text-4xl font-black text-white mt-4 mb-2">4,900₽</div>
                  <p className="text-sm text-indigo-200 mb-6">per month. Cancel anytime.</p>
                  <ul className="space-y-3 mb-8 text-sm text-white">
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-300"/> 3 Warehouses</li>
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-300"/> 500+ SKUs</li>
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-300"/> Full API Sync (WB/Ozon)</li>
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-300"/> Shift Management</li>
                  </ul>
                  <Button 
                     onClick={() => handlePlanAction('pro', () => toast.info("Pro selection started"))}
                     className="w-full bg-white text-indigo-600 hover:bg-indigo-50 font-bold"
                  >Go Pro</Button>
               </div>

               {/* One-Time Service */}
               <div className="bg-white p-8 rounded-2xl border-2 border-green-100 shadow-lg hover:border-green-300 transition-all">
                  <h3 className="text-xl font-bold text-zinc-900">Quick Setup</h3>
                  <div className="text-4xl font-black mt-4 mb-2">10k₽</div>
                  <p className="text-sm text-zinc-500 mb-6">One-time payment.</p>
                  <ul className="space-y-3 mb-8 text-sm text-zinc-600">
                     <li className="flex gap-2"><Zap className="w-4 h-4 text-green-500"/> Done-for-you setup</li>
                     <li className="flex gap-2"><Zap className="w-4 h-4 text-green-500"/> Staff Training (2h)</li>
                     <li className="flex gap-2"><Zap className="w-4 h-4 text-green-500"/> Custom Integration</li>
                  </ul>
                  <Button 
                     onClick={() => handleSendInvoice('quick_setup', 10000)}
                     disabled={isSendingInvoice}
                     className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                  >
                     {isSendingInvoice ? <Loader2 className="animate-spin"/> : "Hire Us Once"}
                  </Button>
               </div>
            </div>
         </div>
      </section>

      {/* --- CTA: CREATE WAREHOUSE --- */}
      <section id="invite" className="py-24 bg-gradient-to-br from-indigo-900 to-black text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
           <motion.div initial={{ scale: 0.9 }} whileInView={{ scale: 1 }} viewport={{ once: true }}>
             <h2 className="text-4xl md:text-6xl font-black mb-8">Ready to Stop the Bleeding?</h2>
             
             {!createdCrew ? (
                <div className="max-w-md mx-auto bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/20 shadow-2xl">
                   <h3 className="text-2xl font-bold mb-6">Create Your HQ</h3>
                   <form onSubmit={handleSubmit} className="space-y-4 text-left">
                      <div>
                         <Label className="text-white/80 text-xs uppercase tracking-wider">Warehouse Name</Label>
                         <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Main Base" className="bg-black/40 border-white/20 text-white focus:border-indigo-500" />
                      </div>
                      <div>
                         <Label className="text-white/80 text-xs uppercase tracking-wider">Unique Slug</Label>
                         <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="main-base" className="bg-black/40 border-white/20 text-white focus:border-indigo-500" />
                      </div>
                      <Button type="submit" disabled={isSubmitting} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-6 text-lg rounded-xl mt-4">
                         {isSubmitting ? <Loader2 className="animate-spin"/> : "Initialize System 🚀"}
                      </Button>
                   </form>
                </div>
             ) : (
                <div className="bg-green-500/20 p-8 rounded-3xl border border-green-500/50 max-w-lg mx-auto">
                   <h3 className="text-3xl font-bold text-green-400 mb-4">System Initialized!</h3>
                   <p className="mb-6 text-lg">Warehouse <strong>{createdCrew.name}</strong> is active.</p>
                   <Button onClick={handleInvite} className="bg-white text-green-800 hover:bg-gray-100 font-bold py-4 px-8 rounded-full text-xl shadow-lg">
                      <FaUserPlus className="mr-2"/> Invite Crew via Telegram
                   </Button>
                </div>
             )}
           </motion.div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-black text-zinc-500 py-12 border-t border-zinc-800">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
           <div className="mb-4 md:mb-0">
              <p className="font-mono text-sm">© {new Date().getFullYear()} CyberVibe / @SALAVEY13</p>
           </div>
           <div className="flex gap-6">
              <Link href="#" className="hover:text-indigo-400 transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-indigo-400 transition-colors">Terms</Link>
              <Link href="#" className="hover:text-indigo-400 transition-colors">The Code</Link>
           </div>
        </div>
      </footer>

      <ExitIntentPopup />
    </div>
  );
}