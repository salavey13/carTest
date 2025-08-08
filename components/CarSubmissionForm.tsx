"use client";
import React, { useState, useEffect, useId } from "react";
import { supabaseAdmin, uploadImage } from "@/hooks/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
// ИЗМЕНЕНИЕ: Полностью удален импорт из 'lucide-react'
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { v4 as uuidv4 } from 'uuid';
import type { Database } from "@/types/database.types";

type VehicleData = Partial<Database['public']['Tables']['cars']['Row']>;
type SpecItem = { id: string; key: string; value: string };
type GalleryItem = { id: string; url: string };
type BikeSubtype = 'road' | 'enduro'; // Визуальный подтип для формы

interface CarSubmissionFormProps {
  ownerId?: string;
  vehicleToEdit?: VehicleData | null;
  onSuccess?: () => void;
}

// Оригинальные спеки для шоссейных мотоциклов
const roadBikeSpecKeys = ["engine_cc", "horsepower", "weight_kg", "top_speed_kmh", "type", "seat_height_mm"];
// Новые спеки для эндуро/кросс
const enduroBikeSpecKeys = ["engine_cc", "dry_weight_kg", "seat_height_mm", "suspension_travel_mm", "ground_clearance_mm", "bike_class", "horsepower", "fuel_tank_capacity_l"];

export function CarSubmissionForm({ ownerId, vehicleToEdit, onSuccess }: CarSubmissionFormProps) {
  const isEditMode = !!vehicleToEdit;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bikeSubtype, setBikeSubtype] = useState<BikeSubtype>('road'); // Состояние для подтипа
  const [formData, setFormData] = useState({
    make: "", model: "", description: "", daily_price: "", image_url: "",
  });
  const [specs, setSpecs] = useState<SpecItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const formId = useId();

  useEffect(() => {
    if (vehicleToEdit) {
      setFormData({
        make: vehicleToEdit.make || "", model: vehicleToEdit.model || "", description: vehicleToEdit.description || "",
        daily_price: vehicleToEdit.daily_price?.toString() || "", image_url: vehicleToEdit.image_url || "",
      });
      setImagePreview(vehicleToEdit.image_url || null);
      setImageFile(null);
      
      if (vehicleToEdit.specs && typeof vehicleToEdit.specs === 'object') {
        const specEntries = Object.entries(vehicleToEdit.specs);
        const regularSpecs = specEntries.filter(([key]) => key !== 'gallery').map(([key, value]) => ({ id: uuidv4(), key, value: String(value) }));
        setSpecs(regularSpecs);

        const vehicleKeys = Object.keys(vehicleToEdit.specs);
        if (vehicleKeys.some(key => ['suspension_travel_mm', 'ground_clearance_mm', 'bike_class'].includes(key))) {
            setBikeSubtype('enduro');
        } else {
            setBikeSubtype('road');
        }

        const galleryUrls = (vehicleToEdit.specs as any).gallery || [];
        setGallery(galleryUrls.map((url: string) => ({ id: uuidv4(), url })));
      } else {
        setSpecs([]);
        setGallery([]);
        setBikeSubtype('road');
      }
    } else {
      setFormData({ make: "", model: "", description: "", daily_price: "", image_url: "" });
      setSpecs([]);
      setGallery([]);
      setImageFile(null);
      setImagePreview(null);
      setBikeSubtype('road');
    }
  }, [vehicleToEdit]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(formData.image_url || null);
    }
  };

  const handleSpecChange = (id: string, field: 'key' | 'value', newValue: string) => {
    setSpecs(s => s.map(spec => spec.id === id ? { ...spec, [field]: newValue } : spec));
  };

  const addNewSpec = () => {
    const currentSpecKeys = specs.map(s => s.key);
    const availableKeys = bikeSubtype === 'enduro' ? enduroBikeSpecKeys : roadBikeSpecKeys;
    const nextKey = availableKeys.find(k => !currentSpecKeys.includes(k));
    setSpecs(currentSpecs => [...currentSpecs, { id: uuidv4(), key: nextKey || "", value: "" }]);
  };

  const removeSpec = (id: string) => setSpecs(s => s.filter(spec => spec.id !== id));
  const handleGalleryChange = (id: string, url: string) => {
    setGallery(g => g.map(item => item.id === id ? { ...item, url } : item));
  };
  const addNewGalleryItem = () => setGallery(g => [...g, { id: uuidv4(), url: "" }]);
  const removeGalleryItem = (id: string) => setGallery(g => g.filter(item => item.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId && !isEditMode) {
        toast.error("Ошибка: ID пользователя не найден. Авторизуйтесь заново.");
        return;
    }
    setIsSubmitting(true);
    toast.info(isEditMode ? "Обновление техники..." : "Добавление техники...");
    try {
      let imageUrl = formData.image_url;
      if (imageFile) {
        const uploadResult = await uploadImage("carpix", imageFile);
        if (uploadResult.success && uploadResult.publicUrl) {
            imageUrl = uploadResult.publicUrl;
            toast.success("Изображение обновлено!");
        } else {
            throw new Error(uploadResult.error || "Не удалось загрузить изображение.");
        }
      }
      if (!imageUrl) throw new Error("Необходимо указать URL изображения или загрузить файл.");
      
      const specsObject = specs.reduce((acc, { key, value }) => {
        if (key) acc[key] = value;
        return acc;
      }, {} as Record<string, any>);
      
      const galleryUrls = gallery.map(item => item.url).filter(Boolean);
      if (galleryUrls.length > 0) {
        specsObject.gallery = galleryUrls;
      }

      const vehicleData = {
        make: formData.make, model: formData.model, description: formData.description,
        specs: specsObject, daily_price: Number(formData.daily_price), image_url: imageUrl, type: 'bike',
      };

      if (isEditMode) {
        const { error } = await supabaseAdmin.from("cars").update(vehicleData).eq('id', vehicleToEdit.id!);
        if (error) throw error;
        toast.success("Техника успешно обновлена!");
      } else {
        const id = `${formData.make.toLowerCase().replace(/\s+/g, "-")}-${formData.model.toLowerCase().replace(/\s+/g, "-")}-${uuidv4().substring(0,8)}`;
        const { error } = await supabaseAdmin.from("cars").insert([{ ...vehicleData, id, owner_id: ownerId! }]);
        if (error) throw error;
        toast.success("Техника успешно добавлена в гараж!");
      }
      onSuccess?.();
    } catch (error) {
      toast.error(`Ошибка: ${(error instanceof Error ? error.message : "Неизвестная ошибка")}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      key={formId}
      onSubmit={handleSubmit}
      className="space-y-6 bg-card/50 p-4 md:p-6 rounded-xl border border-border backdrop-blur-sm"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex justify-center gap-4 p-2 bg-input/50 rounded-lg border border-dashed border-border">
          {/* ИЗМЕНЕНИЕ: Lucide иконки заменены на VibeContentRenderer */}
          <Button type="button" onClick={() => setBikeSubtype('road')} variant={bikeSubtype === 'road' ? 'secondary' : 'ghost'} className="gap-2">
            <VibeContentRenderer content="::FaRoad::"/> Шоссейный
          </Button>
          <Button type="button" onClick={() => setBikeSubtype('enduro')} variant={bikeSubtype === 'enduro' ? 'secondary' : 'ghost'} className="gap-2">
            <VibeContentRenderer content="::FaMountain::"/> Эндуро/Кросс
          </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-mono text-accent-text mb-1.5 block">Марка</Label>
          <Input value={formData.make} onChange={e => setFormData(p => ({ ...p, make: e.target.value }))} placeholder={bikeSubtype === 'road' ? 'Ducati' : 'KTM'} className="input-cyber" required/>
        </div>
        <div>
          <Label className="text-sm font-mono text-accent-text mb-1.5 block">Модель</Label>
          <Input value={formData.model} onChange={e => setFormData(p => ({ ...p, model: e.target.value }))} placeholder={bikeSubtype === 'road' ? 'Panigale V4' : '300 EXC'} className="input-cyber" required/>
        </div>
      </div>
      <div>
        <Label className="text-sm font-mono text-accent-text mb-1.5 block">Описание</Label>
        <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Краткое, но зажигательное описание..." className="textarea-cyber" required/>
      </div>

      <div>
        <h3 className="text-lg font-mono text-accent-text mb-2">Характеристики</h3>
        <p className="text-xs text-muted-foreground mb-3 -mt-2">
            {bikeSubtype === 'road' ? 'Спецификации для шоссейных мотоциклов.' : 'Спецификации для внедорожной техники.'}
        </p>
        <div className="space-y-2">
          {specs.map((spec) => (
            <motion.div key={spec.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 items-center">
              <Input value={spec.key} onChange={e => handleSpecChange(spec.id, 'key', e.target.value)} placeholder="Ключ" className="input-cyber flex-[2]" />
              <Input value={spec.value} onChange={e => handleSpecChange(spec.id, 'value', e.target.value)} placeholder="Значение" className="input-cyber flex-[3]" />
              {/* ИЗМЕНЕНИЕ: Lucide иконка заменена на VibeContentRenderer */}
              <Button type="button" onClick={() => removeSpec(spec.id)} variant="destructive" size="icon" className="h-9 w-9 flex-shrink-0">
                <VibeContentRenderer content="::FaXmark::" className="h-4 w-4" />
              </Button>
            </motion.div>
          ))}
          {/* ИЗМЕНЕНИЕ: Lucide иконка заменена на VibeContentRenderer */}
          <Button type="button" onClick={addNewSpec} variant="outline" className="w-full gap-2">
            <VibeContentRenderer content="::FaCirclePlus::" className="h-4 w-4" /> Добавить характеристику
          </Button>
        </div>
      </div>

      {isEditMode && (
      <div>
        <h3 className="text-lg font-mono text-primary mb-2">Фотогалерея</h3>
        <div className="space-y-2">
          {gallery.map(item => (
            <motion.div key={item.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 items-center">
              <div className="w-10 h-10 flex-shrink-0 bg-card/50 rounded border border-border flex items-center justify-center">
                <Image src={item.url || 'https://placehold.co/36x36/000000/31343C/png?text=??'} alt="Gallery preview" width={36} height={36} className="object-cover rounded-sm" />
              </div>
              <Input value={item.url} onChange={e => handleGalleryChange(item.id, e.target.value)} placeholder="https://.../image.jpg" className="input-cyber" />
              {/* ИЗМЕНЕНИЕ: Lucide иконка заменена на VibeContentRenderer */}
              <Button type="button" onClick={() => removeGalleryItem(item.id)} variant="destructive" size="icon" className="h-9 w-9 flex-shrink-0">
                <VibeContentRenderer content="::FaXmark::" className="h-4 w-4" />
              </Button>
            </motion.div>
          ))}
          {/* ИЗМЕНЕНИЕ: Lucide иконка заменена на VibeContentRenderer */}
          <Button type="button" onClick={addNewGalleryItem} variant="outline" className="w-full gap-2">
            <VibeContentRenderer content="::FaCirclePlus::" className="h-4 w-4" /> Добавить фото в галерею
          </Button>
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
              <Label className="text-sm font-mono text-accent-text mb-1.5 block">Цена за день (₽)</Label>
              <Input type="number" value={formData.daily_price} onChange={e => setFormData(p => ({ ...p, daily_price: e.target.value }))} placeholder="999" className="input-cyber" required />
          </div>
          <div>
              <Label className="text-sm font-mono text-accent-text mb-1.5 block">Главное изображение</Label>
              <div className="flex gap-2">
                  <Input value={formData.image_url} onChange={e => {setFormData(p => ({ ...p, image_url: e.target.value })); setImagePreview(e.target.value); setImageFile(null);}} placeholder="https://..." className="input-cyber" />
                  <Button asChild variant="outline" className="flex-shrink-0"><Label htmlFor="image-upload" className="cursor-pointer"><VibeContentRenderer content="::FaUpload::" /></Label></Button>
                  <input id="image-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </div>
          </div>
      </div>

      {imagePreview && (
          <div className="flex justify-center">
              <Image src={imagePreview} alt="Превью" width={200} height={150} className="rounded-lg object-cover" />
          </div>
      )}

      {/* Блок кнопки отправки теперь использует корректные имена иконок fa6 */}
      <Button type="submit" disabled={isSubmitting} className="w-full text-lg">
        {isSubmitting 
          ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: Обработка..." /> 
          : isEditMode
            ? <VibeContentRenderer content="::FaFloppyDisk:: Обновить Данные" />
            : <VibeContentRenderer content="::FaCirclePlus:: Добавить в Гараж" />
        }
      </Button>
    </motion.form>
  );
}