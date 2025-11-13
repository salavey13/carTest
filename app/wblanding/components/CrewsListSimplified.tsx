'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/contexts/AppContext';
import { getAllPublicCrews } from '@/app/rentals/actions';

export const CrewsListSimplified = () => {
  const { userCrewInfo } = useAppContext();
  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const crewsResult = await getAllPublicCrews();
        if (crewsResult.success && crewsResult.data) setCrews(crewsResult.data);
        else setError(crewsResult.error || "Не удалось загрузить список складов.");
      } catch (e) {
        setError(e.message || "Неизвестная ошибка на клиенте.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="text-center py-10 text-lg text-gray-600">Загрузка складов...</div>;
  if (error) return <div className="text-center py-10 text-red-500 font-medium">{error}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {crews.map((crew) => {
        const isEditable = userCrewInfo && userCrewInfo.id === crew.id;
        return (
          <Link href={`/wb/${crew.slug}`} key={crew.id} className="block group">
            <div className={cn(
              "p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1",
              isEditable ? "bg-blue-50 border-2 border-blue-500" : "bg-white"
            )}>
              <div className="flex items-start gap-4 mb-4">
                <Image 
                  src={crew.logo_url || '/placeholder.svg'} 
                  alt={`${crew.name} Logo`} 
                  width={64} 
                  height={64} 
                  className={cn(
                    "rounded-full border-2 transition-colors",
                    isEditable ? "border-blue-500" : "border-gray-200 group-hover:border-blue-500"
                  )}
                />
                <div>
                  <h2 className={cn(
                    "text-xl font-bold group-hover:text-blue-600",
                    isEditable ? "text-blue-600" : "text-blue-800"
                  )}>{crew.name}</h2>
                  <p className="text-xs text-gray-500">by @{crew.owner_username}</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-4">{crew.description}</p>
              <div className="grid grid-cols-3 gap-2 border-t pt-4">
                <div className="text-center">
                  <span className="block text-lg font-bold text-gray-900">{crew.member_count || 0}</span>
                  <span className="text-xs text-gray-500">Сотрудников</span>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-bold text-gray-900">{crew.vehicle_count || 0}</span>
                  <span className="text-xs text-gray-500">Единиц</span>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-bold text-blue-600">N/A</span>
                  <span className="text-xs text-gray-500">Миссий</span>
                </div>
              </div>
              {isEditable && (
                <p className="text-center text-blue-600 font-semibold mt-4 px-3 py-1 bg-blue-100 rounded-full text-sm">
                  {userCrewInfo.is_owner ? "Ваш склад (владелец)" : "Ваш склад (участник)"}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
};