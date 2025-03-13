"use client";

import { useState } from "react";
import WheelOfFortune from "@/components/WheelOfFortune";
import CaptchaVerification from "@/components/CaptchaVerification";

export default function WheelOfFortunePage() {
  const [isCaptchaPassed, setIsCaptchaPassed] = useState(false);

  return (
    <div className="min-h-screen pt-24 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-12">
        <CaptchaVerification onCaptchaSuccess={() => setIsCaptchaPassed(true)} />
        {isCaptchaPassed && <WheelOfFortune />}
      </div>
    </div>
  );
}
