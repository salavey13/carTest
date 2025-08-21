"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { format } from 'date-fns';
import { useAppContext } from '@/contexts/AppContext'; // Для userId/stars

// Hardcoded для MVP
const rig = { id: 'rule-cube-basic', name: 'Cube Basic', price: 800, image: 'https://.../cube.jpg' };
const rigger = { id: 'rule-master-default', name: 'Default Rigger', price: 500, image: 'https://.../rigger.jpg' };
const sessionTypes = ['Stretching', 'Acrobatics', 'Photo'];

export default function RulesPage() {
  const { userId } = useAppContext();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({ start: '', end: '', sessionType: '', rigger: false, extras: [], notes: '' });
  const [calendar, setCalendar] = useState([]);
  const [price, setPrice] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({ axis: 'y', dragFree: false, loop: false });

  useEffect(() => {
    fetch('/api/rules/rule-cube-basic/calendar').then(res => res.json()).then(setCalendar);
  }, []);

  useEffect(() => {
    if (emblaApi) emblaApi.on('pointerDown', (evt) => {
      const { clientX } = evt;
      // Prevent left swipe: if horizontal drag > vertical, preventDefault
      // Более точная логика в onDragStart
    });
  }, [emblaApi]);

  const updateForm = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const calculatePrice = () => {
    let base = rig.price;
    if (formData.rigger) base += rigger.price;
    // Duration calc etc.
    setPrice(base);
  };

  useEffect(calculatePrice, [formData]);

  const handleBook = async () => {
    const payload = { ...formData, price, userId, riggerId: formData.rigger ? rigger.id : null };
    const res = await fetch('/api/rules/book', { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) alert('Invoice sent!');
  };

  const steps = [
    // Step 1: Time/duration/extras
    <Card key="step1">
      <CardHeader><CardTitle>Выберите время</CardTitle></CardHeader>
      <CardContent>
        {/* Time picker, disable overlaps from calendar */}
        <input type="datetime-local" onChange={e => updateForm('start', e.target.value)} />
        {/* Duration, extras */}
      </CardContent>
    </Card>,

    // Step 2: Session type
    <Card key="step2">
      <CardHeader><CardTitle>Тип сессии</CardTitle></CardHeader>
      <CardContent>
        {sessionTypes.map(type => <Button key={type} onClick={() => updateForm('sessionType', type)}>{type}</Button>)}
      </CardContent>
    </Card>,

    // Step 3: Rigger/review/notes/confirm
    <Card key="step3">
      <CardHeader><CardTitle>Rigger?</CardTitle></CardHeader>
      <CardContent>
        <Button onClick={() => updateForm('rigger', !formData.rigger)}>{formData.rigger ? 'With Rigger' : 'Self'}</Button>
        <div>Notes: <textarea onChange={e => updateForm('notes', e.target.value)} /></div>
        <div>Price: {price} RUB</div>
        <Button onClick={handleBook}>Book & Pay 1%</Button>
      </CardContent>
    </Card>,
  ];

  return (
    <div className="spa-gradient">
      {/* Hero */}
      <section>ПравИла: Book Your Session</section>

      {/* Showcase: vertical carousel for rig images (hardcoded 1) */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex flex-col">
          <img src={rig.image} alt={rig.name} />
        </div>
      </div>

      {/* Services: session types cards */}
      {sessionTypes.map(type => <Card>{type}</Card>)}

      {/* Riggers: single card */}
      <Card>{rigger.name} <Button>Toggle</Button></Card>

      {/* How-to, FAQ */}

      {/* Wizard: vertical embla */}
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div ref={emblaRef} className="h-[400px] overflow-hidden">
            <div className="flex flex-col">{steps}</div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* History: from /api/my/bookings */}
      <Button onClick={() => fetch('/api/my/bookings?userId=' + userId).then(res => res.json())}>Show History</Button>
    </div>
  );
}