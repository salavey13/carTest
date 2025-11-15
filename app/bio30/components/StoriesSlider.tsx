"use client";

import React from 'react';
import { Story } from '../types';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface StoriesSliderProps {
  stories: Story[];
}

const StoriesSlider: React.FC<StoriesSliderProps> = ({ stories }) => {
  return (
    <section className="py-12 md:py-16 bg-muted" aria-labelledby="stories-title">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
          {/* Text Content - Left */}
          <motion.div 
            className="w-full lg:w-1/2"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 id="stories-title" className="text-2xl md:text-3xl lg:text-4xl font-bold gradient-text mb-2">
              Истории успеха
            </h2>
            <p className="text-lg text-muted-foreground opacity-50">
              Реальные отзывы от наших клиентов
            </p>
          </motion.div>
          
          {/* Stories Slider - Right */}
          <motion.div 
            className="w-full lg:w-1/2"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4">
              {stories.map((story, index) => (
                <motion.div 
                  key={story.link}
                  className="flex-shrink-0 w-[280px] md:w-[320px] relative aspect-[1/1.8] rounded-lg overflow-hidden"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Image
                    src={story.image}
                    alt={story.name}
                    fill
                    sizes="(max-width: 768px) 280px, 320px"
                    style={{ objectFit: 'cover' }}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                    {/* Quote Icon */}
                    <div className="flex justify-center mb-3">
                      <svg className="w-8 h-8 text-white opacity-50" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9.983 3v7.391c0 2.908-2.35 5.259-5.258 5.259h-.73v6.35h.73c6.214 0 11.258-5.045 11.258-11.259v-7.741h-6.001zm12.001 0v7.391c0 2.908-2.35 5.259-5.258 5.259h-.731v6.35h.731c6.214 0 11.258-5.045 11.258-11.259v-7.741h-6.001z"/>
                      </svg>
                    </div>
                    
                    {/* Quote Text */}
                    <div className="flex flex-col gap-2 mb-4">
                      <span className="text-sm font-medium text-white text-center drop-shadow-md">
                        {story.quote}
                      </span>
                    </div>
                    
                    {/* Profile */}
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm"></div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white drop-shadow-md">{story.name}</span>
                        <span className="text-xs text-white/70 drop-shadow-md">
                          {story.followers || 'Проверенный отзыв'}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default StoriesSlider;