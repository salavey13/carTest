"use client";
import React, { useState } from "react";
import { createDonation } from "../lib/api"; // ваш API вызов

export default function DonationStars({ streamId, onDonate }: { streamId: string; onDonate?: (d:any)=>void }) {
  const [amountStars, setAmountStars] = useState(50);
  const packs = [50, 200, 500, 1000];

  async function donate() {
    // open checkout — backend создаёт Stripe PaymentIntent и возвращает clientSecret / redirect
    const res = await createDonation({ streamId, stars: amountStars });
    if (res.ok) {
      onDonate?.(await res.json());
    }
  }

  return (
    <div className="p-3 rounded shadow bg-white">
      <div className="mb-2 font-medium">Поддержать звёздами</div>
      <div className="flex gap-2 mb-3">
        {packs.map(p => (
          <button key={p} onClick={() => setAmountStars(p)}
            className={`px-3 py-1 rounded ${amountStars===p ? 'bg-yellow-400' : 'bg-gray-100'}`}>
            ⭐ {p}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={donate} className="px-4 py-2 bg-blue-600 text-white rounded">Отдать {amountStars} ⭐</button>
      </div>
    </div>
  );
}