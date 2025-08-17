"use client";
import React, { useEffect, useId, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { supabaseAdmin, uploadImage } from "@/hooks/supabase";
import type { Database } from "@/types/database.types";

type VehicleData = Partial<Database["public"]["Tables"]["cars"]["Row"]>;

type CarType = "car" | "bike" | "cross" | "sauna" | "blog" | "stream";
type SpecItem = { id: string; key: string; value: string };
type GalleryItem = { id: string; url: string };

/**
 * Universal CarSubmissionForm (components/CarSubmissionForm.tsx)
 * - supports types: car, bike, cross, sauna, blog, stream
 * - writes to public.cars using supabaseAdmin (insert/update)
 * - for blog & stream stores extra data in specs JSONB
 */

interface Props {
  ownerId?: string | null;
  vehicleToEdit?: VehicleData | null;
  onSuccess?: (row?: any) => void;
}

export function CarSubmissionForm({ ownerId = null, vehicleToEdit = null, onSuccess }: Props) {
  const formId = useId();
  const isEdit = !!vehicleToEdit;

  // core fields
  const [type, setType] = useState<CarType>((vehicleToEdit?.type as CarType) ?? "bike");
  const [make, setMake] = useState(vehicleToEdit?.make ?? "");
  const [model, setModel] = useState(vehicleToEdit?.model ?? "");
  const [description, setDescription] = useState(vehicleToEdit?.description ?? "");
  const [dailyPrice, setDailyPrice] = useState<string>(vehicleToEdit?.daily_price ? String(vehicleToEdit.daily_price) : "0");
  const [imageUrl, setImageUrl] = useState(vehicleToEdit?.image_url ?? "");
  const [rentLink, setRentLink] = useState(vehicleToEdit?.rent_link ?? "");
  const [isTest, setIsTest] = useState<boolean>(!!vehicleToEdit?.is_test_result);
  const [ownerIdState, setOwnerIdState] = useState<string | null>(ownerId ?? (vehicleToEdit?.owner_id ?? null));

  // gallery and specs (for bikes etc.)
  const [specs, setSpecs] = useState<SpecItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(vehicleToEdit?.image_url ?? null);

  // blog/stream editors
  const [blogTitle, setBlogTitle] = useState<string>((vehicleToEdit?.specs as any)?.title ?? "");
  const [blogSlug, setBlogSlug] = useState<string>(vehicleToEdit?.model ?? "");
  const [blogExcerpt, setBlogExcerpt] = useState<string>((vehicleToEdit?.specs as any)?.excerpt ?? "");
  const [blogContent, setBlogContent] = useState<string>((vehicleToEdit?.specs as any)?.content ?? "");
  const [streamTitle, setStreamTitle] = useState<string>((vehicleToEdit?.specs as any)?.title ?? "");
  const [streamSlug, setStreamSlug] = useState<string>((vehicleToEdit?.model ?? ""));
  const [streamSpecsRaw, setStreamSpecsRaw] = useState<string>(() => {
    if (vehicleToEdit?.specs) return JSON.stringify(vehicleToEdit.specs, null, 2);
    return "";
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // hydrate specs & gallery from edit
    if (vehicleToEdit?.specs && typeof vehicleToEdit.specs === "object") {
      const s = vehicleToEdit.specs as Record<string, any>;
      const entries = Object.entries(s).filter(([k]) => k !== "gallery");
      setSpecs(entries.map(([key, value]) => ({ id: uuidv4(), key, value: String(value) })));
      const g = Array.isArray(s.gallery) ? s.gallery.map((url: string) => ({ id: uuidv4(), url })) : [];
      setGallery(g);

      // blog/stream fields
      if (vehicleToEdit.type === "blog") {
        setBlogTitle(s.title ?? "");
        setBlogSlug(vehicleToEdit.model ?? "");
        setBlogExcerpt(s.excerpt ?? "");
        setBlogContent(s.content ?? "");
      }
      if (vehicleToEdit.type === "stream") {
        setStreamTitle(s.title ?? "");
        setStreamSlug(vehicleToEdit.model ?? "");
        setStreamSpecsRaw(JSON.stringify(s, null, 2));
      }
    }
  }, [vehicleToEdit]);

  // helpers for specs/gallery
  function addSpec() {
    setSpecs((prev) => [...prev, { id: uuidv4(), key: "", value: "" }]);
  }
  function updateSpec(id: string, field: "key" | "value", value: string) {
    setSpecs((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }
  function removeSpec(id: string) {
    setSpecs((prev) => prev.filter((p) => p.id !== id));
  }
  function addGallery() {
    setGallery((g) => [...g, { id: uuidv4(), url: "" }]);
  }
  function updateGallery(id: string, url: string) {
    setGallery((g) => g.map((it) => (it.id === id ? { ...it, url } : it)));
  }
  function removeGallery(id: string) {
    setGallery((g) => g.filter((it) => it.id !== id));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(imageUrl || null);
    }
  }

  // sample stream JSON
  function insertSampleStream() {
    const sample = {
      title: "Demo VIP Stream",
      slug: `demo-${Date.now()}`,
      startAt: null,
      endAt: null,
      sections: [
        { id: `s-${Date.now()}-1`, title: "Intro", type: "text", text: "Привет, VIP!", durationSec: 12 },
        { id: `s-${Date.now()}-2`, title: "Sauna Pack", type: "image", mediaUrl: "https://source.unsplash.com/random/1200x800/?sauna", durationSec: 18 },
      ],
    };
    setStreamSpecsRaw(JSON.stringify(sample, null, 2));
    setStreamTitle(String(sample.title));
    setStreamSlug(String(sample.slug));
    toast.success("Sample stream inserted — отредактируй по вкусу");
  }

  // validation + build specs object
  function buildSpecsObject(): Record<string, any> {
    const obj: Record<string, any> = {};
    specs.forEach((s) => {
      if (s.key) obj[s.key] = s.value;
    });
    const galleryUrls = gallery.map((g) => g.url).filter(Boolean);
    if (galleryUrls.length) obj.gallery = galleryUrls;

    // blog type fields override (store inside specs)
    if (type === "blog") {
      obj.title = blogTitle || make || "Blog post";
      obj.slug = blogSlug || model || `${(blogTitle || "post").toLowerCase().replace(/\s+/g, "-")}`;
      obj.excerpt = blogExcerpt;
      obj.content = blogContent;
      if (!obj.cover_url && imageUrl) obj.cover_url = imageUrl;
    }

    // stream type: parse raw JSON if provided, otherwise use streamTitle/sections as minimal
    if (type === "stream") {
      if (streamSpecsRaw) {
        try {
          const parsed = JSON.parse(streamSpecsRaw);
          return { ...obj, ...parsed };
        } catch (e) {
          // if invalid JSON, still include basic fields and a note
          obj._parse_error = "Invalid JSON in stream specs";
          obj.title = streamTitle || make || "Stream";
          obj.slug = streamSlug || model || `stream-${Date.now()}`;
          return obj;
        }
      } else {
        obj.title = streamTitle || make || "Stream";
        obj.slug = streamSlug || model || `stream-${Date.now()}`;
      }
    }

    return obj;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    toast.info(isEdit ? "Обновляю..." : "Сохраняю...");

    try {
      if (!isEdit && !ownerIdState) {
        throw new Error("ownerId required for creation (login required)");
      }

      // upload image if provided
      let finalImageUrl = imageUrl;
      if (imageFile) {
        const up = await uploadImage("carpix", imageFile);
        if (!up.success) throw new Error(up.error || "Image upload failed");
        finalImageUrl = up.publicUrl;
        toast.success("Изображение загружено");
      }

      if (!finalImageUrl) {
        throw new Error("Укажите изображение (url или загрузку)");
      }

      // build payload
      const specsObject = buildSpecsObject();

      const payload: Partial<Database["public"]["Tables"]["cars"]["Insert"]> = {
        make: make || (type === "blog" ? (specsObject.title ?? "blog") : "unknown"),
        model: model || (type === "blog" ? (specsObject.slug ?? `blog-${Date.now()}`) : `item-${Date.now()}`),
        description: description || (specsObject.excerpt ?? ""),
        specs: specsObject,
        daily_price: Number(dailyPrice || 0),
        image_url: finalImageUrl,
        rent_link: rentLink || "",
        is_test_result: Boolean(isTest),
        type: type,
        owner_id: ownerIdState ?? null,
      };

      if (isEdit && vehicleToEdit?.id) {
        const { error } = await supabaseAdmin.from("cars").update(payload).eq("id", vehicleToEdit.id);
        if (error) throw error;
        toast.success("Успешно обновлено");
        onSuccess?.(payload);
      } else {
        // generate id if not provided
        const id = `${(payload.make || "item").toString().toLowerCase().replace(/\s+/g, "-")}-${(payload.model || "x").toString().toLowerCase().replace(/\s+/g, "-")}-${uuidv4().slice(0, 8)}`;
        const { error } = await supabaseAdmin.from("cars").insert([{ id, ...payload }]);
        if (error) throw error;
        toast.success("Успешно добавлено в public.cars");
        onSuccess?.({ id, ...payload });
      }
    } catch (err: any) {
      console.error("CarSubmissionForm error:", err);
      toast.error(err?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.form
      key={formId}
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 bg-card/95 p-4 md:p-6 rounded-xl border border-border shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-orbitron text-foreground">Добавить / Редактировать запись</h3>
        <div className="flex items-center gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as CarType)} className="input-cyber text-sm">
            <option value="car">Car</option>
            <option value="bike">Bike</option>
            <option value="cross">Cross</option>
            <option value="sauna">Sauna</option>
            <option value="blog">Blog (post)</option>
            <option value="stream">Stream (overlay)</option>
          </select>
          <Button type="button" variant="ghost" onClick={() => { setOwnerIdState(ownerId ?? ownerIdState); toast.success("Owner ID synced"); }}>
            Sync owner
          </Button>
        </div>
      </div>

      {/* generic fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Make / Title</Label>
          <Input value={make} onChange={(e) => setMake(e.target.value)} className="input-cyber" placeholder={type === "blog" ? "Заголовок поста" : "Марка / Title"} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Model / Slug</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} className="input-cyber" placeholder={type === "blog" ? "slug-для-url" : "Модель / slug"} />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Описание (кратко)</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea-cyber" placeholder="Короткое описание" />
      </div>

      {/* bike-specific specs editor (also used for car/sauna generic extra fields) */}
      {(type === "bike" || type === "cross" || type === "car" || type === "sauna") && (
        <>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Характеристики (Specs)</h4>
            <p className="text-xs text-muted-foreground mb-2">Добавь пар ключ-значение. Галерея тоже поддерживается.</p>
            <div className="space-y-2">
              {specs.map((s) => (
                <div key={s.id} className="flex gap-2">
                  <Input value={s.key} onChange={(e) => updateSpec(s.id, "key", e.target.value)} placeholder="ключ (например engine_cc)" className="input-cyber" />
                  <Input value={s.value} onChange={(e) => updateSpec(s.id, "value", e.target.value)} placeholder="значение" className="input-cyber" />
                  <Button type="button" variant="destructive" onClick={() => removeSpec(s.id)}>Удалить</Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="button" onClick={addSpec} variant="outline">Добавить характеристику</Button>
                <Button type="button" onClick={() => { setSpecs([]); toast.success("Specs очищены"); }} variant="ghost">Очистить</Button>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Gallery (optional)</h4>
            <div className="space-y-2">
              {gallery.map((g) => (
                <div key={g.id} className="flex gap-2 items-center">
                  <div className="w-12 h-8 overflow-hidden rounded-sm bg-muted/30 border border-border">
                    {g.url ? <Image src={g.url} alt="preview" width={120} height={80} className="object-cover" /> : <div className="text-xs text-muted-foreground p-2">no</div>}
                  </div>
                  <Input value={g.url} onChange={(e) => updateGallery(g.id, e.target.value)} className="input-cyber" placeholder="https://..." />
                  <Button type="button" variant="destructive" onClick={() => removeGallery(g.id)}>Удалить</Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="button" onClick={addGallery} variant="outline">Добавить фото</Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* blog editor */}
      {type === "blog" && (
        <div>
          <h4 className="text-sm font-semibold text-foreground">Blog post — content</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input value={blogTitle} onChange={(e) => setBlogTitle(e.target.value)} className="input-cyber" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Slug</Label>
              <Input value={blogSlug} onChange={(e) => setBlogSlug(e.target.value)} className="input-cyber" />
            </div>
          </div>
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground">Excerpt</Label>
            <Textarea value={blogExcerpt} onChange={(e) => setBlogExcerpt(e.target.value)} className="textarea-cyber" />
          </div>
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground">Content (HTML allowed)</Label>
            <Textarea value={blogContent} onChange={(e) => setBlogContent(e.target.value)} className="textarea-cyber" minLength={0} />
          </div>
        </div>
      )}

      {/* stream editor */}
      {type === "stream" && (
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Stream overlay — config</h4>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={insertSampleStream}>Insert sample</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Stream title</Label>
              <Input value={streamTitle} onChange={(e) => setStreamTitle(e.target.value)} className="input-cyber" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Slug</Label>
              <Input value={streamSlug} onChange={(e) => setStreamSlug(e.target.value)} className="input-cyber" />
            </div>
          </div>
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground">Raw JSON specs (sections, media...)</Label>
            <Textarea value={streamSpecsRaw} onChange={(e) => setStreamSpecsRaw(e.target.value)} className="textarea-cyber" />
            <p className="text-xs text-muted-foreground mt-1">Если JSON некорректен — он будет сохранен с пометкой. Можно вставлять ответ бота прямо сюда.</p>
          </div>
        </div>
      )}

      {/* common media / price */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Price</Label>
          <Input type="number" value={dailyPrice} onChange={(e) => setDailyPrice(e.target.value)} className="input-cyber" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Image URL or upload</Label>
          <div className="flex gap-2">
            <Input value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="input-cyber" placeholder="https://..." />
            <label htmlFor={`file-${formId}`} className="btn input-cyber cursor-pointer p-2 border border-border rounded-md flex items-center">
              <VibeContentRenderer content="::FaUpload::" />&nbsp;Upload
            </label>
            <input id={`file-${formId}`} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </div>
        </div>
      </div>

      {imagePreview && (
        <div className="flex items-center justify-center">
          <Image src={imagePreview} alt="preview" width={420} height={240} className="rounded-lg object-cover" />
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? <><VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::" /> Сохраняю...</> :
            isEdit ? "Обновить запись" : "Добавить в public.cars"}
        </Button>

        <Button type="button" variant="secondary" onClick={() => { setIsTest((s) => !s); }} >
          {isTest ? "Marked Test" : "Mark test"}
        </Button>

        <div className="ml-auto text-xs text-muted-foreground">
          {isEdit ? "Редактирование" : "Новая запись"} • type: <span className="font-mono ml-1">{type}</span>
        </div>
      </div>
    </motion.form>
  );
}

export default CarSubmissionForm;