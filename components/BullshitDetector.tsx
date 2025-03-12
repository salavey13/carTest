"use client";
import { useState, useEffect } from "react";
import { analyzeMessage } from "@/app/actions";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";

const evilAxisMembers = {
  laugh: { name: "Donald Trump", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//trump.png" },
  eyeroll: { name: "Kim Jong-un", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//kim.png" },
  mocking: { name: "Bashar al-Assad", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//assad.png" },
  disbelief: { name: "Vladimir Putin", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//putin-sarcastic.png" },
  smirk: { name: "Xi Jinping", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png" },
  neutral: { name: "Vladimir Putin", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//putin-sarcastic.png" }, // Added for "smirk"
};

// Animation variants
const balloonVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function BullshitDetector() {
  const { user } = useTelegram();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [hasSubscription, setHasSubscription] = useState(false);

  // Check subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (user) {
        const { data, error } = await supabaseAdmin
          .from("users")
          .select("status")
          .eq("user_id", user.id.toString())
          .single();
        if (error) {
          toast.error("Error checking subscription");
        } else {
          setHasSubscription(data?.status === "pro" || data?.status === "admin");
        }
      }
    };
    checkSubscription();
  }, [user]);

  // Handle message analysis
  const handleAnalyze = async () => {
    if (!user) {
      toast.error("Please log in via Telegram");
      return;
    }
    if (!input.trim()) {
      toast.error("Please enter a message to analyze.");
      return;
    }
    setLoading(true);
    setResponse(null); // Clear previous response
    try {
      const result = await analyzeMessage(input);
      setResponse({
        analyzed_content: result.analyzed_content || input,
        emotional_comment: result.emotional_comment || "Hmm, interesting...",
        animation: result.animation || "neutral",
        bullshit_percentage: result.bullshit_percentage || 50,
        content_summary: result.content_summary || "No summary available.",
      });
      toast.success("Analysis complete!");
    } catch (error) {
      toast.error("Failed to analyze message");
    } finally {
      setLoading(false);
    }
  };

  // Voiceover placeholder
  useEffect(() => {
    if (response?.emotional_comment) {
      console.log("Voiceover placeholder:", response.emotional_comment);
    }
  }, [response]);

  // Determine Evil Axis member
  const member = response ? evilAxisMembers[response.animation] || evilAxisMembers.neutral : null;

  return (
    <div className="pt-32 flex flex-col min-h-screen bg-gray-900 px-4 py-6 sm:p-6">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-gradient bg-gradient-to-r from-red-500 to-purple-500 text-transparent bg-clip-text">
          Bullshit Detector
        </h1>

        {/* Response Section (Above Input) */}
        {response && (
          <motion.div
            className="mb-6 space-y-4"
            initial="hidden"
            animate="visible"
            variants={balloonVariants}
          >
            {/* Analyzed Message */}
            <div className="p-3 bg-gray-800 rounded-lg border-l-4 border-yellow-500">
              <p className="text-sm sm:text-base italic text-gray-300 font-mono">
                "{response.analyzed_content}"
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Bullshit Level: {response.bullshit_percentage}%
              </p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Summary: {response.content_summary}
              </p>
            </div>

            {/* Image and Balloon */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              {/* Comic Balloon */}
              <motion.div
                className="relative p-4 bg-white rounded-lg shadow-lg w-full sm:w-80 comic-bubble sm:mr-4"
                variants={balloonVariants}
              >
                <p className="text-sm sm:text-lg font-bold text-black">{member!.name} says:</p>
                <p className="text-black font-comic text-sm sm:text-base">{response.emotional_comment}</p>
                <div className="absolute -bottom-3 left-6 w-0 h-0 border-t-[10px] border-t-white border-x-[6px] border-x-transparent" />
              </motion.div>
              {/* Evil Axis Member Image */}
              <div className="w-32 sm:w-36 h-auto aspect-[9/16] rounded-lg overflow-hidden sm:ml-4">
                <img src={member!.image} alt={member!.name} className="w-full h-full object-cover" />
              </div>

            </div>
          </motion.div>
        )}

        {/* Loading Animation */}
        {loading && (
          <div className="mb-6 flex justify-center items-center pt-24">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Input Section (Chatbot Style) */}
        <div className="mt-auto sticky bottom-0 bg-gray-900 pt-4">
          <div className="relative flex items-center w-full">
            <textarea
              className="w-full p-3 pr-12 bg-gray-800 text-white placeholder-gray-400 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none shadow-md text-sm sm:text-base"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleAnalyze()}
              placeholder="Enter a message or Telegram channel URL"
              disabled={loading}
            />
            <button
              className={`absolute right-2 p-2 rounded-full ${
                loading ? "bg-gray-600 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
              } transition-all`}
              onClick={handleAnalyze}
              disabled={loading}
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          {!hasSubscription && (
            <div className="mt-2 text-center text-xs text-yellow-800 bg-yellow-100 p-2 rounded-lg">
              Enjoying the Bullshit Detector?{" "}
              <a href="/buy-subscription" className="underline">Subscribe</a> to remove this message!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
