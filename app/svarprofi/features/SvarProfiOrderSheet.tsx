'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Send } from 'lucide-react'

// ─────────────────────────────────────────────────────
// SvarProfi Order Sheet — notification-only form
// ─────────────────────────────────────────────────────

export function SvarProfiOrderSheet({
  open,
  onOpenChange,
  submitted,
  onSubmitted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  submitted: boolean
  onSubmitted: (v: boolean) => void
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    product_type: '',
    dimensions: '',
    comment: '',
  })

  const handleSubmit = useCallback(() => {
    // Notification-only: just mark as submitted (real backend would POST)
    onSubmitted(true)
    setTimeout(() => {
      onOpenChange(false)
      onSubmitted(false)
      setForm({ name: '', phone: '', email: '', product_type: '', dimensions: '', comment: '' })
    }, 2500)
  }, [onSubmitted, onOpenChange])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-[#1A1D23] text-[#E8ECF1] border-[#3A4250] sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-[#E8ECF1]">Оставить заявку</SheetTitle>
        </SheetHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2E7DBF]/20">
              <CheckCircle2 className="h-8 w-8 text-[#2E7DBF]" />
            </div>
            <h3 className="text-xl font-bold">Заявка отправлена!</h3>
            <p className="text-center text-sm text-[#8A92A0]">
              Менеджер свяжется с вами для уточнения деталей и расчёта стоимости.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Ваше имя *</label>
              <Input
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                placeholder="Иван Петров"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Телефон *</label>
              <Input
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                placeholder="+7 (___) ___-__-__"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                placeholder="ivan@example.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Тип конструкции *</label>
              <Select value={form.product_type} onValueChange={(v) => setForm(f => ({ ...f, product_type: v }))}>
                <SelectTrigger className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent className="border-[#3A4250] bg-[#242830]">
                  <SelectItem value="Каркас">Каркас</SelectItem>
                  <SelectItem value="Навес">Навес</SelectItem>
                  <SelectItem value="Ограждение">Ограждение</SelectItem>
                  <SelectItem value="Лестница">Лестница</SelectItem>
                  <SelectItem value="Индивидуальный проект">Индивидуальный проект</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Приблизительные размеры</label>
              <Input
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                placeholder="Например: 12×6×4 м"
                value={form.dimensions}
                onChange={(e) => setForm(f => ({ ...f, dimensions: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Комментарий</label>
              <Textarea
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1] min-h-[80px]"
                placeholder="Опишите ваш проект..."
                value={form.comment}
                onChange={(e) => setForm(f => ({ ...f, comment: e.target.value }))}
              />
            </div>

            <p className="text-[11px] text-[#8A92A0]">
              Нажимая «Отправить заявку», вы соглашаетесь на обработку персональных данных.
            </p>

            <Button
              className="w-full bg-[#2E7DBF] text-white hover:bg-[#2563A0] h-12 text-base"
              onClick={handleSubmit}
              disabled={!form.name || !form.phone || !form.product_type}
            >
              <Send className="mr-2 h-4 w-4" /> Отправить заявку
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}