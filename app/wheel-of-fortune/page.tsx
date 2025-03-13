import WheelOfFortune from "@/components/WheelOfFortune"
import CaptchaVerification from "@/components/CaptchaVerification"

export default function WheelOfFortunePage() {
  return (
    <div className="min-h-screen py-12">
      <CaptchaVerification/>
      <WheelOfFortune />
    </div>
  )
}

