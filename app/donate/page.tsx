import DonationComponent from "@/components/DonationComponent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support Our Project | Tupabase",
  description: "Help us build amazing tools by donating stars. Get exclusive benefits and learn how to create your own donation system!",
  openGraph: {
    images: ["https://yourdomain.com/og-donate.jpg"],
  },
};

export default function Page() {
  return (
    <div className="bg-gradient-to-br from-purple-900 to-blue-900 min-h-screen">
      <DonationComponent />
    </div>
  );
}