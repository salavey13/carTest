'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/contexts/AppContext';
import { getAllPublicCrews } from '@/app/rentals/actions';
import { Loader2, Users, Box } from 'lucide-react';

export const CrewsListSimplified = () => {
  const { userCrewInfo } = useAppContext();
  const [crews, setCrews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllPublicCrews().then(res => {
       if(res.data) setCrews(res.data);
       setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500"/></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {crews.map((crew) => {
        const isOwn = userCrewInfo && userCrewInfo.id === crew.id;
        return (
          <Link href={`/wb/${crew.slug}`} key={crew.id} className="block group">
            <div className={cn(
              "bg-zinc-900 border rounded-xl p-6 transition-all duration-300 relative overflow-hidden",
              isOwn ? "border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]" : "border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800"
            )}>
              {isOwn && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1">ACTIVE HQ</div>}
              
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                    <Image 
                        src={crew.logo_url || '/placeholder.svg'} 
                        alt="Logo" width={48} height={48} 
                        className="rounded-lg bg-black object-cover border border-zinc-700"
                    />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{crew.name}</h2>
                  <p className="text-xs text-zinc-500 font-mono">@{crew.owner_username}</p>
                </div>
              </div>
              
              <div className="flex gap-4 mt-4 border-t border-white/5 pt-4">
                 <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Users className="w-4 h-4 text-zinc-600"/> 
                    <span>{crew.member_count || 0}</span>
                 </div>
                 <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Box className="w-4 h-4 text-zinc-600"/> 
                    <span>{crew.vehicle_count || 0} items</span>
                 </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};