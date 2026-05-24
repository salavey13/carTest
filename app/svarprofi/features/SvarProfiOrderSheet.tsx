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
import { CheckCircle2, Send, UserCheck, UserX, AlertCircle } from 'lucide-react'
import { useAppContext } from '@/contexts/AppContext'
import { submitSvarProfiOrder, type SvarProfiOrderPayload } from './actions'

// ─────────────────────────────────────────────────────
// SvarProfi ORDERX — auth-aware text request to admin
// ─────────────────────────────────────────────────────
// Uses useAppContext() for auth state:
//   - dbUser: Database["public"]["Tables"]["users"]["Row"]
//     Fields: user_id, name, first_name, telegram_username, status, role, metadata
//   - isAuthenticated: boolean
//
// Authenticated path:
//   - Identity auto-filled from dbUser
//   - Request sent as "from @nickname, authenticated"
//   - Admin can reply via TG using user_id
//
// Anonymous path:
//   - Contact field appears (TG / phone / email)
//   - Admin can reach back via provided contact_method
//
// Server action uses sendMessage() from /gateway/telegram/sendMessage.ts
// to notify franchise admin via TG bot.
// ─────────────────────────────────────────────────────

interface OrderSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  submitted: boolean
  onSubmitted: (v: boolean) => void
  /** Optional: which product card triggered the order */
  vehicleSlug?: string
}

export function SvarProfiOrderSheet({
  open,
  onOpenChange,
  submitted,
  onSubmitted,
  vehicleSlug,
}: OrderSheetProps) {
  const { dbUser, isAuthenticated } = useAppContext()

  // Extract user identity from dbUser
  const telegramNickname = dbUser?.telegram_username ?? ''
  const telegramUserId = dbUser?.user_id ?? ''
  const displayName = dbUser?.name || dbUser?.first_name || ''
  const userStatus = dbUser?.status ?? ''
  const userRole = dbUser?.role ?? ''

  const isAuth = isAuthenticated && !!telegramNickname

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    contact_method: '',   // fallback contact for non-auth users
    product_type: '',
    dimensions: '',
    comment: '',
  })

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    const payload: SvarProfiOrderPayload = {
      auth_status: isAuth ? 'authenticated' : 'anonymous',
      name: isAuth ? displayName || `@${telegramNickname}` : form.name,
      product_type: form.product_type,
      dimensions: form.dimensions || undefined,
      comment: form.comment || undefined,
      vehicle_slug: vehicleSlug || undefined,
    }

    if (isAuth) {
      payload.telegram_nickname = telegramNickname
      payload.telegram_user_id = telegramUserId
    } else {
      payload.phone = form.phone || undefined
      payload.email = form.email || undefined
      payload.contact_method = form.contact_method || undefined
    }

    try {
      const result = await submitSvarProfiOrder(payload)

      if (result.ok) {
        onSubmitted(true)
        setTimeout(() => {
          onOpenChange(false)
          onSubmitted(false)
          setForm({ name: '', phone: '', email: '', contact_method: '', product_type: '', dimensions: '', comment: '' })
        }, 2500)
      } else {
        setSubmitError(result.error || 'Ошибка отправки')
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setIsSubmitting(false)
    }
  }, [isAuth, displayName, telegramNickname, telegramUserId, form, vehicleSlug, onSubmitted, onOpenChange])

  // Minimum fields required: product_type + (identity for auth OR name+contact for anon)
  const canSubmit = isAuth
    ? !!form.product_type
    : !!form.name && !!form.product_type && (!!form.phone || !!form.contact_method)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-[#1A1D23] text-[#E8ECF1] border-[#3A4250] sm:max-w-md overflow-y-auto">
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
            {/* Auth status indicator */}
            {isAuth ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#43A047]/30 bg-[#43A047]/10 p-3">
                <UserCheck className="h-4 w-4 shrink-0 text-[#43A047]" />
                <div>
                  <p className="text-sm font-medium text-[#43A047]">
                    Авторизован: @{telegramNickname}
                  </p>
                  <p className="text-xs text-[#8A92A0]">
                    Заявка отправлена от вашего имени{userStatus ? ` (${userStatus})` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-[#D4740E]/30 bg-[#D4740E]/10 p-3">
                <UserX className="h-4 w-4 shrink-0 text-[#D4740E]" />
                <div>
                  <p className="text-sm font-medium text-[#D4740E]">
                    Вы не авторизованы
                  </p>
                  <p className="text-xs text-[#8A92A0]">
                    Укажите контакт, чтобы мы могли связаться с вами
                  </p>
                </div>
              </div>
            )}

            {/* Name — pre-filled for auth, editable for anon */}
            {!isAuth && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Ваше имя *</label>
                <Input
                  className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                  placeholder="Иван Петров"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
            )}

            {/* Phone — required for anon, optional for auth */}
            {!isAuth && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Телефон</label>
                <Input
                  className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                  placeholder="+7 (___) ___-__-__"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
            )}

            {/* Email — optional for anon */}
            {!isAuth && (
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
            )}

            {/* Contact method — for anon users to specify how to reach them */}
            {!isAuth && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Как с вами связаться? *</label>
                <Input
                  className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                  placeholder="@telegram_nickname, WhatsApp, телефон"
                  value={form.contact_method}
                  onChange={(e) => setForm(f => ({ ...f, contact_method: e.target.value }))}
                />
                <p className="mt-1 text-[11px] text-[#8A92A0]">
                  Укажите удобный способ связи: Telegram, WhatsApp, телефон
                </p>
              </div>
            )}

            {/* Product type — always shown */}
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

            {/* Dimensions */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Приблизительные размеры</label>
              <Input
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1]"
                placeholder="Например: 12×6×4 м"
                value={form.dimensions}
                onChange={(e) => setForm(f => ({ ...f, dimensions: e.target.value }))}
              />
            </div>

            {/* Comment */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Комментарий</label>
              <Textarea
                className="border-[#3A4250] bg-[#242830] text-[#E8ECF1] min-h-[80px]"
                placeholder="Опишите ваш проект..."
                value={form.comment}
                onChange={(e) => setForm(f => ({ ...f, comment: e.target.value }))}
              />
            </div>

            {/* Error display */}
            {submitError && (
              <div className="flex items-center gap-2 rounded-lg border border-[#C0392B]/30 bg-[#C0392B]/10 p-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#C0392B]" />
                <p className="text-sm text-[#C0392B]">{submitError}</p>
              </div>
            )}

            <p className="text-[11px] text-[#8A92A0]">
              Нажимая «Отправить заявку», вы соглашаетесь на обработку персональных данных.
            </p>

            <Button
              className="w-full bg-[#2E7DBF] text-white hover:bg-[#2563A0] h-12 text-base"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}