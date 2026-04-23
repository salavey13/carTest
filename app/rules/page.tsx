"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { useAppContext } from '@/contexts/AppContext'; // Для dbUser.user_id
import { ServiceCard } from '@/components/ServiceCard'; // Reuse

// Hardcoded для MVP
const rig = { id: 'rule-cube-basic', name: 'Куб Базовый', price: 800, image: 'https://.../cube.jpg' };
const rigger = { id: 'rule-master-default', name: 'Дефолтный Риггер', price: 500, image: 'https://.../rigger.jpg' };
const sessionTypes = [
  { title: 'Растяжка', icon: '🧘', items: [{ icon: '🔥', text: 'Глубокая релаксация' }] },
  { title: 'Акробатика', icon: '🤸', items: [{ icon: '💪', text: 'Динамичные позы' }] },
  { title: 'Фото-сессия', icon: '📸', items: [{ icon: '🌟', text: 'Профессиональные снимки' }] },
];

// How-to на русском
const howToSteps = [
  { icon: '1️⃣', text: 'Выберите время и длительность сессии.' },
  { icon: '2️⃣', text: 'Определите тип сессии (растяжка, акробатика и т.д.).' },
  { icon: '3️⃣', text: 'Добавьте риггера (опционально) и подтвердите бронирование с 1% депозитом в XTR.' },
];

// FAQ на русском
const faqItems = [
  { question: 'Что такое 1% депозит в XTR?', answer: 'Это анти-спам фильтр и демонстрация стабильной валюты. Сумма ~1% от цены сессии, возвращается при отмене.' },
  { question: 'Можно ли отменить бронирование?', answer: 'Да, через историю бронирований. Депозит вернется автоматически.' },
  { question: 'Нужен ли риггер?', answer: 'Опционально. Для самостоятельных сессий — бесплатно, с риггером — доплата.' },
  { question: 'Что если время занято?', answer: 'Система покажет доступные слоты в реал-тайм. Пересечения блокируются.' },
  { question: 'Как оплатить?', answer: 'Через Telegram Invoice в XTR. Полная оплата на месте.' },
];

export default function RulesPage() {
  const { dbUser, isLoading, error: authError } = useAppContext(); // Используем dbUser вместо userId
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({ start: '', end: '', sessionType: '', rigger: false, extras: [], notes: '' });
  const [calendar, setCalendar] = useState(null);
  const [price, setPrice] = useState(0);
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState(null);
  const [isFetching, setIsFetching] = useState(true);

  const [emblaRef, emblaApi] = useEmblaCarousel({ axis: 'y', dragFree: false, loop: false });

  useEffect(() => {
    const fetchData = async () => {
      if (!dbUser?.user_id) {
        setError('Пользователь не авторизован');
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      try {
        console.log('[CLIENT DEBUG] Starting fetch for calendar: /api/rules/rule-cube-basic/calendar');
        const calRes = await fetch('/api/rules/rule-cube-basic/calendar');
        if (!calRes.ok) {
          console.error('[CLIENT DEBUG] Calendar fetch failed with status:', calRes.status, 'body:', await calRes.text());
          throw new Error('Не удалось загрузить календарь');
        }
        const calData = await calRes.json();
        console.log('[CLIENT DEBUG] Calendar data loaded:', calData);
        setCalendar(calData || []);

        console.log('[CLIENT DEBUG] Starting fetch for bookings: /api/my/bookings?userId=', dbUser.user_id);
        const bookRes = await fetch(`/api/my/bookings?userId=${dbUser.user_id}`);
        if (!bookRes.ok) {
          console.error('[CLIENT DEBUG] Bookings fetch failed with status:', bookRes.status, 'body:', await bookRes.text());
          throw new Error('Не удалось загрузить бронирования');
        }
        const bookData = await bookRes.json();
        console.log('[CLIENT DEBUG] Bookings data loaded:', bookData);
        setBookings(bookData || []);
      } catch (err) {
        console.error('[CLIENT DEBUG] Fetch data error:', err.message, err.stack);
        setError('Ошибка загрузки данных. Попробуйте позже.');
      } finally {
        setIsFetching(false);
      }
    };

    if (!isLoading && dbUser?.user_id) fetchData();
    else if (!isLoading && !dbUser) setError('Пользователь не авторизован');

    // Load draft from localStorage
    const draft = localStorage.getItem('rulesDraft');
    if (draft) setFormData(JSON.parse(draft));
  }, [dbUser, isLoading]);

  useEffect(() => {
    // Save draft to localStorage
    localStorage.setItem('rulesDraft', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    if (emblaApi) {
      emblaApi.on('pointerDown', (evt) => {
        const startX = evt.clientX;
        const startY = evt.clientY;
        const handleDrag = (e: PointerEvent) => {
          const deltaX = Math.abs(e.clientX - startX);
          const deltaY = Math.abs(e.clientY - startY);
          if (deltaX > deltaY && deltaX > 10) { // Left/right drag
            e.preventDefault();
            emblaApi.off('pointerMove', handleDrag);
          }
        };
        emblaApi.on('pointerMove', handleDrag);
      });
    }
  }, [emblaApi]);

  const updateForm = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const calculatePrice = () => {
    let base = rig.price;
    if (formData.rigger) base += rigger.price;
    setPrice(base);
  };

  useEffect(calculatePrice, [formData]);

  const handleBook = async () => {
    if (!dbUser?.user_id) {
      setError('Пользователь не авторизован');
      return;
    }

    const payload = { ...formData, price, userId: dbUser.user_id, riggerId: formData.rigger ? rigger.id : null };
    const res = await fetch('/api/rules/book', { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) {
      alert('Invoice sent!');
      localStorage.removeItem('rulesDraft');
      // Refresh bookings
      const bookRes = await fetch(`/api/my/bookings?userId=${dbUser.user_id}`);
      if (bookRes.ok) setBookings(await bookRes.json() || []);
    } else {
      setError('Ошибка бронирования. Попробуйте снова.');
    }
  };

  const handleCancel = async (id: string) => {
    if (!dbUser?.user_id) {
      setError('Пользователь не авторизован');
      return;
    }

    if (confirm('Отменить бронирование?')) {
      await fetch(`/api/rentals/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
      // Refresh bookings
      const bookRes = await fetch(`/api/my/bookings?userId=${dbUser.user_id}`);
      if (bookRes.ok) setBookings(await bookRes.json() || []);
    }
  };

  if (authError) return <div className="text-red-500 p-4">Ошибка авторизации: {authError.message}</div>;
  if (isLoading || isFetching) return <div className="p-4">Загрузка...</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  const steps = [
    <Card key="step1">
      <CardHeader><CardTitle>Выберите время</CardTitle></CardHeader>
      <CardContent>
        <input type="datetime-local" onChange={e => updateForm('start', e.target.value)} value={formData.start} />
        <input type="datetime-local" onChange={e => updateForm('end', e.target.value)} value={formData.end} />
      </CardContent>
    </Card>,
    <Card key="step2">
      <CardHeader><CardTitle>Тип сессии</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        {sessionTypes.map(type => (
          <Button key={type.title} onClick={() => updateForm('sessionType', type.title)} variant={formData.sessionType === type.title ? 'default' : 'outline'}>
            {type.title}
          </Button>
        ))}
      </CardContent>
    </Card>,
    <Card key="step3">
      <CardHeader><CardTitle>Риггер?</CardTitle></CardHeader>
      <CardContent>
        <Button onClick={() => updateForm('rigger', !formData.rigger)} variant={formData.rigger ? 'default' : 'outline'}>
          {formData.rigger ? 'С риггером' : 'Самостоятельно'}
        </Button>
        <div>Заметки: <textarea onChange={e => updateForm('notes', e.target.value)} value={formData.notes} /></div>
        <div className="sticky bottom-0 bg-background p-4 border-t">Цена: {price} RUB</div>
        <Button onClick={handleBook} disabled={!dbUser?.user_id}>Забронировать и оплатить 1%</Button>
      </CardContent>
    </Card>,
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-green-100 text-foreground">
      <section className="relative h-48 bg-lavender-200 text-center pt-16 wave-anim">
        <h1 className="text-4xl font-bold">ПравИла: Забронируйте сессию</h1>
        <p className="text-lg">Самостоятельное бронирование для снижения звонков на 80%+</p>
      </section>
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex flex-col">
          <img src={rig.image} alt={rig.name} className="h-64 object-cover" />
        </div>
      </div>
      <section className="p-4 grid gap-4">
        {sessionTypes.map(type => <ServiceCard key={type.title} {...type} borderColorClass="border-blue-500" />)}
      </section>
      <Card className="m-4">
        <CardHeader><CardTitle>{rigger.name}</CardTitle></CardHeader>
        <CardContent>
          <img src={rigger.image} alt={rigger.name} className="h-32" />
          <Button onClick={() => updateForm('rigger', !formData.rigger)}>Включить/Выключить</Button>
        </CardContent>
      </Card>
      <section className="p-4">
        <h2 className="text-2xl font-bold mb-4">Как забронировать:</h2>
        <ul className="space-y-2">
          {howToSteps.map(step => (
            <li key={step.icon} className="flex items-center gap-2">
              <span>{step.icon}</span> {step.text}
            </li>
          ))}
        </ul>
      </section>
      <Accordion type="single" collapsible className="p-4">
        {faqItems.map((item, i) => (
          <AccordionItem value={`item-${i}`} key={i}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
          <div ref={emblaRef} className="h-[400px] overflow-hidden">
            <div className="flex flex-col">{steps}</div>
          </div>
        </motion.div>
      </AnimatePresence>
      <section className="p-4">
        <h2 className="text-2xl font-bold mb-4">История бронирований</h2>
        {bookings?.length ? (
          bookings.map(booking => (
            <Card key={booking.rental_id} className="mb-4">
              <CardContent>
                <p>{booking.metadata?.session_type || 'Неизвестно'} {format(new Date(booking.requested_start_date), 'dd.MM.yy HH:mm')}</p>
                <Button variant="destructive" onClick={() => handleCancel(booking.rental_id)} disabled={!dbUser?.user_id}>Отменить</Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <p>Бронирований пока нет.</p>
        )}
      </section>
    </div>
  );
}
