// /app/info/[id]/page.tsx
import { notFound } from 'next/navigation';
import { supabase } from '@/hooks/supabase';
import RentCarInterface from '@/components/RentCarInterface';
import { motion } from 'framer-motion';

export default async function RentCarPage({ params }: { params: { id: string } }) {
  const { data: car, error } = await supabase
    .from('cars')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !car) return notFound();

  // Use the new jsonb field 'specs' to display extended car details
  const specs = car.specs || {
    version: 'v12',
    electric: false,
    color: 'Cyber Blue',
    theme: 'cyber',
    horsepower: 900,
    torque: '750Nm',
    acceleration: '2.9s 0-60mph',
    topSpeed: '210mph'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="min-h-screen bg-gray-900 text-white p-4"
    >
      <RentCarInterface preselectedCar={car} />
      <section className="mt-8">
        <h2 className="text-2xl font-bold cyber-text mb-6">Car Specifications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-3">Performance</h3>
            <p>
              <span className="text-cyan-400">Version:</span> {specs.version}
            </p>
            <p>
              <span className="text-cyan-400">Electric:</span> {specs.electric ? 'Yes' : 'No'}
            </p>
            <p>
              <span className="text-cyan-400">Horsepower:</span> {specs.horsepower}
            </p>
            <p>
              <span className="text-cyan-400">Torque:</span> {specs.torque}
            </p>
            <p>
              <span className="text-cyan-400">0-60mph:</span> {specs.acceleration}
            </p>
            <p>
              <span className="text-cyan-400">Top Speed:</span> {specs.topSpeed}
            </p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-3">Aesthetics</h3>
            <p>
              <span className="text-cyan-400">Color:</span> {specs.color}
            </p>
            <p>
              <span className="text-cyan-400">Theme:</span> {specs.theme}
            </p>
            {/* Add additional aesthetic specs as desired */}
          </div>
        </div>
      </section>
    </motion.div>
  );
}

