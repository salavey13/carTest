"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useAppToast } from "@/hooks/useAppToast";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * CarSubmissionForm
 *
 * Универсальная форма для отправки сущностей в таблицу `public.cars`
 * Поддерживает типы: car, bike, cross, sauna, blog, stream
 *
 * Особенности:
 * - Общие поля: id, make, model, description, daily_price, image_url, rent_link, type, specs(JSON)
 * - Blog: cover_url, excerpt, content (html/markdown), tags
 * - Stream: overlaySections JSON (структура секций для overlay)
 * - Gallery: добавление/удаление URL картинок
 * - Шаблоны JSON для быстрого старта, кнопка "Copy to clipboard" для работы с ботом
 * - Превью изображений
 * - Отправка POST /api/cars (делайте server-side обработчик на вашем api)
 */

type AllowedType = "car" | "bike" | "cross" | "sauna" | "blog" | "stream";

const RANDOM_UNSPLASH = (seed = "") =>
  `https://source.unsplash.com/random/1200x800/?cyber,${encodeURIComponent(seed)}&sig=${Date.now() % 100000}`;

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

export default function CarSubmissionForm() {
  const { dbUser } = useAppContext();
  const toast = useAppToast();

  // Base fields
  const [id, setId] = useState<string>(() => uid("demo-"));
  const [type, setType] = useState<AllowedType>("car");
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [dailyPrice, setDailyPrice] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState<string>(RANDOM_UNSPLASH("hero"));
  const [rentLink, setRentLink] = useState<string>("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(dbUser?.user_id ?? null);
  const [isTest, setIsTest] = useState<boolean>(true);

  // Generic JSON specs
  const [specsText, setSpecsText] = useState<string>(() =>
    JSON.stringify(
      {
        features: ["demo-feature-1", "demo-feature-2"],
        extra: { color: "black", weightKg: 0 },
      },
      null,
      2,
    ),
  );

  // Blog-specific
  const [blogExcerpt, setBlogExcerpt] = useState<string>("");
  const [blogContent, setBlogContent] = useState<string>("<p>Введите HTML/Markdown (рендерится безопасно на сервере)</p>");
  const [blogTags, setBlogTags] = useState<string>("");

  // Stream-specific
  const defaultOverlayTemplate = useMemo(
    () =>
      JSON.stringify(
        {
          title: "Пример стрима",
          sections: [
            {
              id: "sec-1",
              title: "Вступление",
              durationSec: 60,
              showImage: true,
              image: RANDOM_UNSPLASH("intro"),
              text: "Короткое вступление. Текст, который стример видит на панели.",
            },
            {
              id: "sec-2",
              title: "Main topic",
              durationSec: 300,
              showImage: true,
              image: RANDOM_UNSPLASH("topic"),
              text: "Основная секция: сюда можно добавить ссылку на видос и т.д.",
            },
          ],
        },
        null,
        2,
      ),
    [],
  );
  const [overlayJson, setOverlayJson] = useState<string>(defaultOverlayTemplate);

  // UI state
  const [loading, setLoading] = useState(false);

  // Helpers
  const allowedTypes: AllowedType[] = ["car", "bike", "cross", "sauna", "blog", "stream"];

  const addGalleryImage = useCallback(() => {
    setGallery((g) => [...g, RANDOM_UNSPLASH("gallery")]);
  }, []);

  const removeGalleryImage = useCallback((idx: number) => {
    setGallery((g) => g.filter((_, i) => i !== idx));
  }, []);

  const tryParseJson = useCallback((txt: string) => {
    try {
      const parsed = JSON.parse(txt);
      return { ok: true, parsed };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }, []);

  const copyOverlayToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(overlayJson);
      toast.success("Overlay JSON скопирован в буфер обмена");
    } catch (e) {
      toast.error("Не удалось скопировать в буфер обмена");
    }
  }, [overlayJson, toast]);

  const generateJsonForBot = useCallback(() => {
    // Простая подсказка/шаблон, который можно скопировать и отправить боту
    const payload = {
      action: "generate_stream_overlay",
      streamer: make || model || id,
      hint: "Создай структуру секций для 30-минутного стрима: intro, main, q&a, outro",
      exampleOutput: tryParseJson(overlayJson).ok ? JSON.parse(overlayJson) : null,
    };
    return JSON.stringify(payload, null, 2);
  }, [make, model, id, overlayJson, tryParseJson]);

  const clearForm = useCallback(() => {
    setId(uid("demo-"));
    setType("car");
    setMake("");
    setModel("");
    setDescription("");
    setDailyPrice(0);
    setImageUrl(RANDOM_UNSPLASH("hero"));
    setRentLink("");
    setGallery([]);
    setSpecsText(JSON.stringify({ features: [], extra: {} }, null, 2));
    setBlogExcerpt("");
    setBlogContent("");
    setBlogTags("");
    setOverlayJson(defaultOverlayTemplate);
    setIsTest(true);
  }, [defaultOverlayTemplate]);

  // Build payload and validate
  const buildPayload = useCallback(() => {
    // parse specs
    const specsResult = tryParseJson(specsText);
    if (!specsResult.ok) {
      return { ok: false, error: "Поле specs невалидный JSON: " + specsResult.error };
    }

    const base = {
      id,
      make: make || (type === "blog" ? (model || "blog-post") : model || "unknown"),
      model: model || make || "unknown",
      description: description || (type === "blog" ? blogExcerpt || "blog post" : "no description"),
      embedding: null, // server can compute embedding
      daily_price: Number(dailyPrice || 0),
      image_url: imageUrl,
      rent_link: rentLink || `/${type}/${id}`,
      is_test_result: isTest,
      type,
      specs: specsResult.parsed,
      owner_id: ownerId || null,
    };

    // type-specific augmentation
    if (type === "blog") {
      base["specs"] = {
        ...specsResult.parsed,
        content: blogContent,
        excerpt: blogExcerpt,
        tags: blogTags.split(",").map((t) => t.trim()).filter(Boolean),
        gallery,
      };
      base["image_url"] = imageUrl || (gallery[0] ?? RANDOM_UNSPLASH("blog"));
    } else if (type === "stream") {
      // overlayJson must be valid
      const overlayResult = tryParseJson(overlayJson);
      if (!overlayResult.ok) {
        return { ok: false, error: "Overlay JSON невалидный: " + overlayResult.error };
      }
      base["specs"] = {
        ...specsResult.parsed,
        overlay: overlayResult.parsed,
        gallery,
      };
    } else {
      // vehicles & sauna
      base["specs"] = {
        ...specsResult.parsed,
        gallery,
      };
    }

    return { ok: true, payload: base };
  }, [
    id,
    type,
    make,
    model,
    description,
    dailyPrice,
    imageUrl,
    rentLink,
    isTest,
    specsText,
    blogContent,
    blogExcerpt,
    blogTags,
    overlayJson,
    tryParseJson,
    ownerId,
    gallery,
  ]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setLoading(true);
      try {
        const built = buildPayload();
        if (!built.ok) {
          toast.error(built.error || "Ошибка подготовки данных");
          setLoading(false);
          return;
        }
        const body = built.payload;

        // POST to api - adjust endpoint to your backend
        const res = await fetch("/api/cars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const json = await res.json().catch(() => ({ success: false, error: "Invalid JSON response" }));
        if (!res.ok || !json.success) {
          const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
          toast.error(`Ошибка API: ${msg}`);
          setLoading(false);
          return;
        }

        toast.success("Успех — запись добавлена/обновлена");
        clearForm();
      } catch (err: any) {
        console.error("Submit error", err);
        toast.error("Не удалось отправить запись: " + (err?.message || "Unknown"));
      } finally {
        setLoading(false);
      }
    },
    [buildPayload, toast, clearForm],
  );

  // Small UI helpers
  const previewSpecValid = tryParseJson(specsText).ok;
  const previewOverlayValid = tryParseJson(overlayJson).ok;

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4 bg-card/80 border border-border rounded-xl shadow-md space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Добавить / Редактировать сущность (Cars/Blog/Stream)</h2>
        <div className="text-xs text-muted-foreground">Тип: {type}</div>
        <div className="ml-auto flex gap-2">
          <Button type="button" onClick={() => { setId(uid("demo-")); toast.info("ID обновлён"); }}>New ID</Button>
          <Button type="button" variant="ghost" onClick={() => { setImageUrl(RANDOM_UNSPLASH(id)); toast.info("Случайная обложка обновлена"); }}>
            Random Image
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col text-sm">
          ID
          <input className="input-cyber mt-1" value={id} onChange={(e) => setId(e.target.value)} />
        </label>

        <label className="flex flex-col text-sm">
          Тип
          <select className="input-cyber mt-1" value={type} onChange={(e) => setType(e.target.value as AllowedType)}>
            {allowedTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          Владелец (owner_id)
          <input className="input-cyber mt-1" value={ownerId ?? ""} onChange={(e) => setOwnerId(e.target.value || null)} placeholder={dbUser?.user_id ?? "user_id"} />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col text-sm">
          Make / Title
          <input className="input-cyber mt-1" value={make} onChange={(e) => setMake(e.target.value)} placeholder={type === "blog" ? "Заголовок статьи / Make" : "Make / Brand"} />
        </label>

        <label className="flex flex-col text-sm">
          Model / Subtitle
          <input className="input-cyber mt-1" value={model} onChange={(e) => setModel(e.target.value)} placeholder={type === "blog" ? "Subtitle / Short title" : "Model"} />
        </label>
      </div>

      <label className="flex flex-col text-sm">
        Краткое описание
        <textarea className="input-cyber mt-1 min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col text-sm">
          Цена / amount
          <input className="input-cyber mt-1" type="number" value={dailyPrice} onChange={(e) => setDailyPrice(Number(e.target.value || 0))} />
        </label>

        <label className="flex flex-col text-sm">
          Rent / Link
          <input className="input-cyber mt-1" value={rentLink} onChange={(e) => setRentLink(e.target.value)} placeholder="/path-or-external-link" />
        </label>

        <label className="flex flex-col text-sm">
          Test record
          <div className="mt-1 flex items-center gap-2">
            <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
            <span className="text-xs text-muted-foreground">Пометить как тестовую запись</span>
          </div>
        </label>
      </div>

      {/* Cover image preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
        <div className="col-span-1 md:col-span-1">
          <div className="text-sm mb-2">Обложка / Основное изображение</div>
          <div className="w-full h-44 relative rounded-lg overflow-hidden border border-border bg-muted/40">
            <Image src={imageUrl || RANDOM_UNSPLASH(id)} alt="preview" fill style={{ objectFit: "cover" }} />
          </div>
          <input className="input-cyber mt-2" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        </div>

        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm mb-2">Галерея (gallery)</div>
            <div className="flex gap-2">
              <Button onClick={addGalleryImage} size="sm">Добавить случайное</Button>
              <Button onClick={() => { setGallery([]); toast.info("Галерея очищена"); }} variant="ghost" size="sm">Очистить</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {gallery.length === 0 && <div className="text-xs text-muted-foreground col-span-full">Галерея пуста — добавьте изображения</div>}
            {gallery.map((g, i) => (
              <div key={i} className="relative h-24 rounded overflow-hidden border border-border bg-muted/20">
                <Image src={g} alt={`gallery-${i}`} fill style={{ objectFit: "cover" }} />
                <div className="absolute top-1 right-1 flex gap-1">
                  <button type="button" onClick={() => navigator.clipboard?.writeText(g).then(() => toast.success("URL скопирован"))} className="p-1 bg-black/50 rounded text-xs">Copy</button>
                  <button type="button" onClick={() => removeGalleryImage(i)} className="p-1 bg-red-600/70 rounded text-xs">X</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Blog specific */}
      {type === "blog" && (
        <div className="p-3 rounded-md border border-border bg-muted/40 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <strong>Blog: дополнительные поля</strong>
              <div className="text-xs text-muted-foreground">Заполните основное содержимое и теги</div>
            </div>
            <div className="text-xs">
              <Button size="sm" onClick={() => { setBlogContent("<p>Новая статья: расскажи про движение и цели</p>"); toast.info("Шаблон контента добавлен"); }}>Шаблон</Button>
            </div>
          </div>

          <label className="flex flex-col text-sm">
            Excerpt
            <input className="input-cyber mt-1" value={blogExcerpt} onChange={(e) => setBlogExcerpt(e.target.value)} />
          </label>

          <label className="flex flex-col text-sm">
            Content (HTML/Markdown)
            <textarea className="input-cyber mt-1 min-h-[140px]" value={blogContent} onChange={(e) => setBlogContent(e.target.value)} />
          </label>

          <label className="flex flex-col text-sm">
            Tags (comma separated)
            <input className="input-cyber mt-1" value={blogTags} onChange={(e) => setBlogTags(e.target.value)} placeholder="vip, sauna, roadmap" />
          </label>
        </div>
      )}

      {/* Stream specific */}
      {type === "stream" && (
        <div className="p-3 rounded-md border border-border bg-muted/40 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <strong>Stream: Overlay / Sections</strong>
              <div className="text-xs text-muted-foreground">JSON-структура секций, которые стример может переключать на телефоне</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setOverlayJson(defaultOverlayTemplate); toast.info("Восстановлен шаблон overlay"); }}>Вставить шаблон</Button>
              <Button size="sm" variant="ghost" onClick={copyOverlayToClipboard}>Copy overlay JSON</Button>
            </div>
          </div>

          <label className="flex flex-col text-sm">
            Overlay JSON
            <textarea className={cn("input-cyber mt-1 min-h-[180px]", !previewOverlayValid && "border-red-500 ring-red-200")} value={overlayJson} onChange={(e) => setOverlayJson(e.target.value)} />
            {!previewOverlayValid && <div className="text-xs text-red-400 mt-1">JSON невалиден — исправьте перед сохранением</div>}
          </label>

          <div className="text-xs text-muted-foreground">
            Генерация подсказки для бота: <pre className="text-[10px] break-words rounded bg-black/10 p-2">{generateJsonForBot()}</pre>
            <div className="mt-1"><Button size="sm" onClick={() => { navigator.clipboard?.writeText(generateJsonForBot()).then(() => toast.success("Подсказка боту скопирована")); }}>Скопировать подсказку для бота</Button></div>
          </div>
        </div>
      )}

      {/* Specs JSON (shared) */}
      <div className="p-3 rounded-md border border-border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <div>
            <strong>Specs (JSON)</strong>
            <div className="text-xs text-muted-foreground">Общая спецификация / параметры для сущности</div>
          </div>
          <div className="text-xs">
            <Button size="sm" onClick={() => { setSpecsText(JSON.stringify({ features: ["fast","durable"], extra: {} }, null, 2)); toast.info("Шаблон specs вставлен"); }}>Шаблон</Button>
          </div>
        </div>

        <textarea className={cn("input-cyber w-full min-h-[140px] font-mono text-sm", !previewSpecValid && "border-red-500 ring-red-200")} value={specsText} onChange={(e) => setSpecsText(e.target.value)} />
        {!previewSpecValid && <div className="text-xs text-red-400 mt-1">В specs JSON найдена ошибка</div>}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading} className="px-6">
          {loading ? "Сохраняем..." : "Сохранить / Отправить"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(buildPayload().payload ?? {}, null, 2)); toast.success("Payload скопирован в буфер"); }}>
          Copy payload
        </Button>
        <Button type="button" variant="outline" onClick={() => { clearForm(); toast.info("Форма очищена"); }}>
          Сброс
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Подсказка: API ожидает объект, совместимый со схемой <code>public.cars</code>. Поле <code>type</code> можно использовать для фильтрации (car / bike / cross / sauna / blog / stream).
      </div>
    </form>
  );
}