"use client";

import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel, { EmblaOptionsType } from 'embla-carousel-react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';

type ImageGalleryProps = {
  images: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PrevButton: React.FC<{ enabled: boolean, onClick: () => void }> = ({ enabled, onClick }) => (
  <button
    className="absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-opacity hover:bg-black/80 disabled:opacity-30"
    onClick={onClick}
    disabled={!enabled}
  >
    <ChevronLeft className="h-6 w-6" />
  </button>
);

const NextButton: React.FC<{ enabled: boolean, onClick: () => void }> = ({ enabled, onClick }) => (
  <button
    className="absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-opacity hover:bg-black/80 disabled:opacity-30"
    onClick={onClick}
    disabled={!enabled}
  >
    <ChevronRight className="h-6 w-6" />
  </button>
);

export function ImageGallery({ images, open, onOpenChange }: ImageGalleryProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [prevBtnEnabled, setPrevBtnEnabled] = useState(false);
  const [nextBtnEnabled, setNextBtnEnabled] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi && emblaApi.scrollTo(index), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setPrevBtnEnabled(emblaApi.canScrollPrev());
    setNextBtnEnabled(emblaApi.canScrollNext());
  }, [emblaApi, setSelectedIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-full h-[90vh] bg-black/80 border-none p-0 flex flex-col items-center justify-center">
         <button onClick={() => onOpenChange(false)} className="absolute top-4 right-4 z-50 text-white bg-black/50 rounded-full p-2"><X/></button>
         <div className="w-full h-full flex-grow relative overflow-hidden" ref={emblaRef}>
            <div className="flex h-full">
                {images.map((src, index) => (
                    <div className="relative flex-[0_0_100%] h-full" key={index}>
                        <Image src={src} alt={`Gallery image ${index + 1}`} layout="fill" objectFit="contain" className="pointer-events-none"/>
                    </div>
                ))}
            </div>
            <PrevButton onClick={scrollPrev} enabled={prevBtnEnabled} />
            <NextButton onClick={scrollNext} enabled={nextBtnEnabled} />
         </div>
         <div className="flex-shrink-0 p-4">
             <div className="flex justify-center gap-2">
                 {images.map((_, index) => (
                     <button key={index} onClick={() => scrollTo(index)} className={cn("h-2 w-2 rounded-full bg-white transition-all", selectedIndex === index ? 'w-6 opacity-100' : 'opacity-50')}/>
                 ))}
             </div>
         </div>
      </DialogContent>
    </Dialog>
  );
}