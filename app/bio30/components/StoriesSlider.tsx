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
    <section className="section section--stories" aria-labelledby="stories-title">
      <div className="container container--stories pd pd__hg">
        <div className="aside" data-anim="fade" data-delay="0.1">
          <div className="col gp gp--xs">
            <h2 id="stories-title" className="title fs__lg fw__bd gradient">
              Истории успеха
            </h2>
            <p className="subtitle fs__lg fw__rg opc opc--50 bw0">
              Реальные отзывы от наших клиентов
            </p>
          </div>
        </div>
        <div className="bside" data-anim="fade" data-delay="0.2">
          <div className="stories-slider row gp gp--md" style={{ overflowX: 'auto', paddingBottom: 'var(--sm)' }}>
            {stories.map((story, index) => (
              <motion.div 
                key={index} 
                className="story"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                style={{ flexShrink: 0 }}
              >
                <Image
                  src={story.image}
                  alt={story.name}
                  fill
                  style={{ objectFit: 'cover', borderRadius: 'var(--md)' }}
                  loading="lazy"
                  decoding="async"
                />
                <div className="content--story">
                  <div className="row ctr">
                    <div className="quote__center">
                      <span className="quote_01"></span>
                    </div>
                  </div>
                  <div className="col gp gp--xl">
                    <span className="title fs__sm fw__md align align--center opc opc--50">
                      {story.quote}
                    </span>
                  </div>
                  <div className="row ctr gp gp--xs">
                    <div className="profile"></div>
                    <div className="col gp gp--zr">
                      <span className="title fs__md fw__bd">{story.name}</span>
                      <span className="subtitle fs__md fw__md opc opc--50">
                        {story.followers || 'Проверенный отзыв'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StoriesSlider;