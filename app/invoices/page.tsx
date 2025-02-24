// app/invoices/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { getUserInvoices, getUserRentals } from "@/hooks/supabase";
import { supabaseAdmin } from "@/hooks/supabase"; // Add this import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Car, CreditCard, Crown } from "lucide-react";

interface Invoice {
  id: string;
  type: string;
  status: string;
  amount: number;
  metadata: { car_make?: string; car_model?: string; days?: number; subscription_id?: string };
}

interface Rental {
  rental_id: string;
  car_id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_cost: number;
  start_date: string;
  end_date: string;
  car_make?: string;
  car_model?: string;
}

interface TopFleet {
  owner_id: string;
  owner_name: string;
  total_revenue: number;
  car_count: number;
}

export default function GloryHall() {
  const { dbUser, isAdmin } = useTelegram()
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [topFleets, setTopFleets] = useState<TopFleet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!dbUser) return;

      // Fetch user invoices and rentals
      const [invoicesRes, rentalsRes] = await Promise.all([
        getUserInvoices(dbUser.user_id),
        getUserRentals(dbUser.user_id),
      ]);
      if (invoicesRes.error) console.error("Error fetching invoices:", invoicesRes.error);
      else setInvoices(invoicesRes.data || []);
      if (rentalsRes.error) console.error("Error fetching rentals:", rentalsRes.error);
      else setRentals(rentalsRes.data || []);

      // Fetch top fleets
      const { data: fleetData, error: fleetError } = await supabaseAdmin
        .rpc("get_top_fleets"); // Assumes an RPC function; adjust query as needed
      if (fleetError) console.error("Error fetching top fleets:", fleetError);
      else setTopFleets(fleetData || []);

      setLoading(false);
    };
    fetchData();
  }, [dbUser]);

  if (loading)
    return <div className="pt-20 text-center text-2xl text-[#4ECDC4] animate-pulse">Summoning Your Glory...</div>;
  if (!invoices.length && !rentals.length && !topFleets.length)
    return <div className="pt-20 text-center text-xl text-[#FF6B6B]">Your Glory Hall awaits its first triumph!</div>;

  const pendingItems = [
    ...invoices.filter((inv) => inv.status === "pending"),
    ...rentals.filter((r) => r.payment_status === "pending"),
  ];
  const completedItems = [
    ...invoices.filter((inv) => inv.status === "paid"),
    ...rentals.filter((r) => r.payment_status === "paid"),
  ];

  return (
    <div className="container mx-auto px-4 py-8 pt-20 bg-gray-900 min-h-screen">
      <h1 className="text-4xl font-bold mb-8 text-[#4ECDC4] flex items-center justify-center gap-2">
        <Trophy className="h-8 w-8" /> Glory Hall
      </h1>

      {/* Top Fleets Widget */}
      {topFleets.length > 0 && (
        <div className="mb-12 bg-gradient-to-br from-yellow-900/30 to-yellow-700/20 p-6 rounded-xl shadow-xl">
          <h2 className="text-2xl font-semibold text-yellow-400 mb-6 flex items-center gap-2">
            <Crown className="h-6 w-6" /> Top Fleet Commanders
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topFleets.map((fleet, index) => (
              <Card key={fleet.owner_id} className="bg-yellow-950/50 border-yellow-500">
                <CardHeader>
                  <CardTitle className="text-yellow-400 flex items-center gap-2">
                    #{index + 1} {fleet.owner_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white">
                    <span className="font-semibold">Revenue:</span> {fleet.total_revenue} XTR
                  </p>
                  <p className="text-gray-300">
                    <span className="font-semibold">Fleet Size:</span> {fleet.car_count} cars
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-red-500 mb-6">Quests Awaiting Payment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingItems.map((item) => (
              <Card
                key={"rental_id" in item ? item.rental_id : item.id}
                className="bg-red-950/50 border-red-500 hover:shadow-lg hover:shadow-red-500/20 transition-all"
              >
                <CardHeader>
                  <CardTitle className="text-red-400 flex items-center gap-2">
                    {"type" in item ? <CreditCard className="h-5 w-5" /> : <Car className="h-5 w-5" />}
                    {"type" in item ? (item.type === "subscription" ? "Subscription" : "Car Rental") : "Car Rental"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white">
                    <span className="font-semibold">Amount:</span> {"amount" in item ? item.amount : item.total_cost} XTR
                  </p>
                  <p className="text-gray-300">
                    <span className="font-semibold">Details:</span>{" "}
                    {"type" in item ? (
                      item.type === "car_rental" ? (
                        `${item.metadata.car_make} ${item.metadata.car_model} for ${item.metadata.days} days`
                      ) : (
                        `Sub #${item.metadata.subscription_id}`
                      )
                    ) : (
                      `${item.car_make} ${item.car_model} (${new Date(item.start_date).toLocaleDateString()} - ${new Date(
                        item.end_date
                      ).toLocaleDateString()})`
                    )}
                  </p>
                  <Badge variant="destructive" className="mt-2">
                    {"status" in item ? item.status : item.payment_status}
                  </Badge>
                </CardContent>
                <CardFooter>
                  <Button variant="destructive" className="w-full" onClick={() => {/* Payment logic */}}>
                    Pay Now
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Items */}
      {completedItems.length > 0 && (
        <div className="bg-gradient-to-br from-green-900/30 to-green-700/20 p-8 rounded-xl shadow-xl">
          <h2 className="text-2xl font-semibold text-green-400 mb-6 flex items-center gap-2">
            <Trophy className="h-6 w-6" /> Conquered Glories
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedItems.map((item) => (
              <Card
                key={"rental_id" in item ? item.rental_id : item.id}
                className="bg-green-950/50 border-green-500 hover:shadow-lg hover:shadow-green-500/20 transition-all"
              >
                <CardHeader>
                  <CardTitle className="text-green-400 flex items-center gap-2">
                    {"type" in item ? <CreditCard className="h-5 w-5" /> : <Car className="h-5 w-5" />}
                    {"type" in item ? (item.type === "subscription" ? "Subscription" : "Car Rental") : "Car Rental"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white">
                    <span className="font-semibold">Amount:</span> {"amount" in item ? item.amount : item.total_cost} XTR
                  </p>
                  <p className="text-gray-300">
                    <span className="font-semibold">Details:</span>{" "}
                    {"type" in item ? (
                      item.type === "car_rental" ? (
                        `${item.metadata.car_make} ${item.metadata.car_model} for ${item.metadata.days} days`
                      ) : (
                        `Sub #${item.metadata.subscription_id}`
                      )
                    ) : (
                      `${item.car_make} ${item.car_model} (${new Date(item.start_date).toLocaleDateString()} - ${new Date(
                        item.end_date
                      ).toLocaleDateString()})`
                    )}
                  </p>
                  <Badge variant="success" className="mt-2">
                    {"status" in item ? item.status : item.payment_status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
