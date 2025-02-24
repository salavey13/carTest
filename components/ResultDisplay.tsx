import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

interface CarResult {
  id: string;
  make: string;
  model: string;
  description?: string;
  image_url?: string;
  rent_link?: string;
  similarity?: number;
  specs?: any;
}

interface ResultDisplayProps {
  result: CarResult;
  similarCars: CarResult[];
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, similarCars }) => {
  return (
    <div className="space-y-12 mt-12 max-w-5xl mx-auto px-4">
      {/* Main Result */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card p-8 rounded-2xl shadow-[0_0_20px_rgba(255,107,107,0.3)] border border-muted"
      >
        <h2 className="text-4xl font-bold text-gradient cyber-text glitch mb-6 text-center" data-text={`ТВОЙ КИБЕР-КОНЬ: ${result.make} ${result.model}`}>
          ТВОЙ КИБЕР-КОНЬ: {result.make} {result.model}
        </h2>
        <div className="relative h-72 w-full mb-6 rounded-xl overflow-hidden border border-muted shadow-[0_0_15px_rgba(255,107,107,0.5)]">
          <Image
            src={result.image_url || "/placeholder.svg"}
            alt={`${result.make} ${result.model}`}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>
        <p className="text-lg text-muted-foreground font-mono mb-6 text-center">{result.description || "Этот зверь готов рвать асфальт, братан!"}</p>
        {result.rent_link && (
          <Link
            href={result.rent_link}
            className="block mx-auto w-fit bg-primary text-primary-foreground hover:bg-secondary p-4 rounded-xl font-mono text-xl shadow-[0_0_15px_rgba(255,107,107,0.7)] hover:shadow-[0_0_25px_rgba(255,107,107,0.9)] transition-all text-glow"
          >
            ГОНЯТЬ СЕЙЧАС
          </Link>
        )}
      </motion.div>

      {/* Similar Cars */}
      {similarCars.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-popover p-8 rounded-2xl shadow-inner border border-muted"
        >
          <h3 className="text-3xl font-semibold text-secondary mb-6 cyber-text glitch text-center" data-text="ПОХОЖИЕ ТАЧКИ">
            ПОХОЖИЕ ТАЧКИ
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {similarCars.map((car) => (
              <motion.div
                key={car.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * similarCars.indexOf(car) }}
                className="bg-card p-4 rounded-xl border border-muted shadow-[0_0_15px_rgba(255,107,107,0.3)] hover:shadow-[0_0_25px_rgba(255,107,107,0.5)] transition-all"
              >
                <div className="relative h-48 w-full mb-4 rounded-lg overflow-hidden border border-muted">
                  <Image
                    src={car.image_url || "/placeholder.svg"}
                    alt={`${car.make} ${car.model}`}
                    fill
                    className="object-cover hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <h4 className="text-xl font-semibold text-primary font-mono text-center">{car.make} {car.model}</h4>
                <p className="text-sm text-muted-foreground font-mono text-center mb-4">
                  Схожесть: {car.similarity !== undefined ? (car.similarity * 100).toFixed(2) : "ХЗ"}%
                </p>
                {car.id && (
                  <Link
                    href={`/rent/${car.id}`}
                    className="block text-center text-secondary hover:text-secondary/80 font-mono text-lg transition-colors text-glow"
                  >
                    ЧЕКНУТЬ ПОДРОБНО
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ResultDisplay;
