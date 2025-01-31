// app/admin/page.tsx (Admin Page)
'use client';
import { useTelegram } from '@/hooks/useTelegram';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/hooks/supabase"

export default function AdminPage() {
  const { user } = useTelegram();
  const router = useRouter();
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);

  useEffect(() => {
    const verifyAdmin = async () => {
      if (!user?.id) {
        router.push('/');
        return;
      }

      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (data?.role !== 'admin') {
        router.push('/');
      } else {
        setIsVerifiedAdmin(true);
      }
    };

    verifyAdmin();
  }, [user, router]);

  if (!isVerifiedAdmin) return <div className="min-h-screen bg-gray-900" />;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
        <CarSubmissionForm />
        <Link href="/" className="mt-4 inline-block text-cyan-400">
          ← Back to Test
        </Link>
      </div>
    </div>
  );
}

