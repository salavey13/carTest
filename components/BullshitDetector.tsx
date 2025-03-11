"use client";
import { useState, useEffect } from "react";
import { analyzeMessage } from "@/app/actions"; // Adjust path as needed
import { useTelegram } from "@/hooks/useTelegram"; // Adjust path as needed
import { supabaseAdmin } from "@/hooks/supabase"; // Adjust path as needed
import { motion } from "framer-motion";
import { toast } from "sonner";

const evilAxisMembers = {
  happy: { name: "Donald Trump", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//trump.png" },
  angry: { name: "Kim Jong-un", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//kim.png" },
  sad: { name: "Bashar al-Assad", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//assad.png" },
  sarcastic: { name: "Vladimir Putin", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//putin-sarcastic.png" },
  neutral: { name: "Xi Jinping", image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png" },
};

// Comic balloon animation variants
const balloonVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function BullshitDetector() {
  const { user, isInTelegramContext } = useTelegram();
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
    if (!hasSubscription) {
      toast.error("You need a Pro or Admin subscription to use this feature.");
      return;
    }
    if (!input.trim()) {
      toast.error("Please enter a message to analyze.");
      return;
    }
    setLoading(true);
    try {
      const result = await analyzeMessage(input);
      setResponse({
        analyzed_content: input, // Placeholder; adjust based on actual Coze API response
        emotional_comment: result.data?.emotional_comment || "Hmm, interesting...",
        emotion: result.data?.emotion || "neutral", // Assume 'emotion' field exists
        bullshit_percentage: result.data?.bullshit_percentage || 50,
      });
      toast.success("Analysis complete!");
    } catch (error) {
      toast.error("Failed to analyze message");
    } finally {
      setLoading(false);
    }
  };

  // Placeholder for future Eleven Labs voiceover
  const handleVoiceover = async (text: string) => {
    // Future implementation: const audio = await elevenLabsAPI.generateVoiceover(text);
    // Play audio here
    console.log("Voiceover placeholder:", text);
  };

  useEffect(() => {
    if (response?.emotional_comment) {
      handleVoiceover(response.emotional_comment);
    }
  }, [response]);

  // Determine Evil Axis member based on emotion
  const member = response ? evilAxisMembers[response.emotion] || evilAxisMembers.neutral : null;

  return (
    <div className="py-16 bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto p-6 bg-card rounded-xl shadow-lg border border-muted">
        <h1 className="text-3xl font-bold text-center mb-8 text-gradient bg-gradient-to-r from-red-500 to-purple-500 text-transparent bg-clip-text">
          Bullshit Detector
        </h1>

        {/* Input Section */}
        <textarea
          className="w-full p-3 border rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a message or Telegram channel URL"
          disabled={loading || !hasSubscription}
        />
        <button
          className={`w-full mt-4 p-3 rounded-lg font-mono text-lg ${
            loading
              ? "bg-gray-600 cursor-not-allowed animate-pulse"
              : "bg-purple-600 hover:bg-purple-700 text-white"
          } transition-all`}
          onClick={handleAnalyze}
          disabled={loading || !hasSubscription}
        >
          {loading ? "Analyzing..." : "Detect Bullshit"}
        </button>
        {!hasSubscription && (
          <p className="text-red-400 text-sm mt-2 text-center">
            Upgrade to Pro or Admin to unlock this feature!
          </p>
        )}

        {/* Response Section */}
        {response && (
          <div className="mt-8 space-y-6">
            {/* Analyzed Message in Quotes */}
            <div className="p-4 bg-gray-800 rounded-lg border-l-4 border-yellow-500">
              <p className="text-lg italic text-gray-300 font-mono">
                "{response.analyzed_content}"
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Bullshit Level: {response.bullshit_percentage}%
              </p>
            </div>

            {/* Comic Balloon with Evil Axis Member */}
            <motion.div
              className="relative p-6 bg-white rounded-lg shadow-lg max-w-md mx-auto comic-bubble"
              variants={balloonVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="flex items-start">
                <img
                  src={member!.image}
                  alt={member!.name}
                  className="w-16 h-16 rounded-full mr-4"
                />
                <div>
                  <p className="text-lg font-bold text-black">{member!.name} says:</p>
                  <p className="text-black font-comic">{response.emotional_comment}</p>
                </div>
              </div>
              {/* Balloon tail */}
              <div className="absolute -bottom-3 left-10 w-0 h-0 border-t-[12px] border-t-white border-x-[8px] border-x-transparent"></div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Comic Balloon CSS */}
      <style jsx>{`
        .comic-bubble {
          position: relative;
          background: white;
          border: 2px solid black;
          border-radius: 15px;
        }
        .font-comic {
          font-family: "Comic Sans MS", "Chalkboard", sans-serif;
        }
      `}</style>
    </div>
  );
}
