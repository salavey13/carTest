"use client";
import React, { useState, useEffect, useId } from "react";
import { supabaseAdmin, uploadImage } from "@/hooks/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { X, Car, Bike, PlusCircle, Image as ImageIcon } from "lucide-react";
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
type VehicleType = 'car' | 'bike';

interface CarSubmissionFormProps {
  ownerId?: string;
  vehicleToEdit?: VehicleData | null;
  onSuccess?: () => void;
}

const carSpecKeys = ["version", "electric", "color", "theme", "horsepower", "torque", "acceleration", "topSpeed"];
const bikeSpecKeys = ["engine_cc", "horsepower", "weight_kg", "top_speed_kmh", "type", "seat_height_mm"];

export function CarSubmissionForm({ ownerId, vehicleToEdit, onSuccess }: CarSubmissionFormProps) {
  const isEditMode = !!vehicleToEdit;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>('bike');
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
        make: vehicleToEdit.make || "",
        model: vehicleToEdit.model || "",
        description: vehicleToEdit.description || "",
        daily_price: vehicleToEdit.daily_price?.toString() || "",
        image_url: vehicleToEdit.image_url || "",
      });
      setVehicleType(vehicleToEdit.type === 'car' ? 'car' : 'bike');
      setImagePreview(vehicleToEdit.image_url || null);
      setImageFile(null);
      
      if (vehicleToEdit.specs && typeof vehicleToEdit.specs === 'object') {
        const specEntries = Object.entries(vehicleToEdit.specs);
        const regularSpecs = specEntries
          .filter(([key]) => key !== 'gallery')
          .map(([key, value]) => ({ id: uuidv4(), key, value: String(value) }));
        setSpecs(regularSpecs);

        const galleryUrls = (vehicleToEdit.specs as any).gallery || [];
        setGallery(galleryUrls.map((url: string) => ({ id: uuidv4(), url })));
      } else {
        setSpecs([]);
        setGallery([]);
      }
    } else {
      setFormData({ make: "", model: "", description: "", daily_price: "", image_url: "" });
      setSpecs([]);
      setGallery([]);
      setImageFile(null);
      setImagePreview(null);
      setVehicleType('bike');
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

  // RESTORED & IMPROVED FUNCTIONALITY
  const addNewSpec = () => {
    const currentSpecKeys = specs.map(s => s.key);
    const availableKeys = vehicleType === 'bike' ? bikeSpecKeys : carSpecKeys;
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
    toast.info(isEditMode ? "Обновление транспорта..." : "Добавление транспорта...");

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
        specs: specsObject,
        daily_price: Number(formData.daily_price),
        image_url: imageUrl,
        type: vehicleType,
      };

      if (isEditMode) {
        const { error } = await supabaseAdmin.from("cars").update(vehicleData).eq('id', vehicleToEdit.id!);
        if (error) throw error;
        toast.success("Транспорт успешно обновлен!");
      } else {
        const id = `${formData.make.toLowerCase().replace(/\s+/g, "-")}-${formData.model.toLowerCase().replace(/\s+/g, "-")}-${uuidv4().substring(0,8)}`;
        const { error } = await supabaseAdmin.from("cars").insert([{ ...vehicleData, id, owner_id: ownerId! }]);
        if (error) throw error;
        toast.success("Транспорт успешно добавлен в гараж!");
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
      className="space-y-6 bg-black/30 p-4 md:p-6 rounded-xl border border-border"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex justify-center gap-4 p-2 bg-input/50 rounded-lg border border-dashed border-border">
          <Button type="button" onClick={() => setVehicleType('bike')} variant={vehicleType === 'bike' ? 'secondary' : 'ghost'} className="gap-2"><Bike /> Мотоцикл</Button>
          <Button type="button" onClick={() => setVehicleType('car')} variant={vehicleType === 'car' ? 'secondary' : 'ghost'} className="gap-2"><Car /> Автомобиль</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-mono text-brand-purple mb-1.5 block">Марка</Label>
          <Input value={formData.make} onChange={e => setFormData(p => ({ ...p, make: e.target.value }))} placeholder={vehicleType === 'bike' ? 'Ducati' : 'Tesla'} className="input-cyber" required/>
        </div>
        <div>
          <Label className="text-sm font-mono text-brand-purple mb-1.5 block">Модель</Label>
          <Input value={formData.model} onChange={e => setFormData(p => ({ ...p, model: e.target.value }))} placeholder={vehicleType === 'bike' ? 'Panigale V4' : 'Cybertruck'} className="input-cyber" required/>
        </div>
      </div>
      <div>
        <Label className="text-sm font-mono text-brand-purple mb-1.5 block">Описание</Label>
        <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Краткое, но зажигательное описание..." className="textarea-cyber" required/>
      </div>

      <div>
        <h3 className="text-lg font-mono text-brand-purple mb-2">Характеристики</h3>
        <div className="space-y-2">
          {specs.map((spec) => (
            <motion.div key={spec.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 items-center">
              <Input value={spec.key} onChange={e => handleSpecChange(spec.id, 'key', e.target.value)} placeholder="Ключ" className="input-cyber flex-[2]" />
              <Input value={spec.value} onChange={e => handleSpecChange(spec.id, 'value', e.target.value)} placeholder="Значение" className="input-cyber flex-[3]" />
              <Button type="button" onClick={() => removeSpec(spec.id)} variant="destructive" size="icon" className="h-9 w-9 flex-shrink-0"><X className="h-4 w-4" /></Button>
            </motion.div>
          ))}
          <Button type="button" onClick={addNewSpec} variant="outline" className="w-full gap-2"><PlusCircle className="h-4 w-4" /> Добавить характеристику</Button>
        </div>
      </div>

      {isEditMode && (
      <div>
        <h3 className="text-lg font-mono text-brand-cyan mb-2">Фотогалерея</h3>
        <div className="space-y-2">
          {gallery.map(item => (
            <motion.div key={item.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 items-center">
              <ImageIcon className="h-5 w-5 text-brand-cyan flex-shrink-0" />
              <Input value={item.url} onChange={e => handleGalleryChange(item.id, e.target.value)} placeholder="https://.../image.jpg" className="input-cyber" />
              <Button type="button" onClick={() => removeGalleryItem(item.id)} variant="destructive" size="icon" className="h-9 w-9 flex-shrink-0"><X className="h-4 w-4" /></Button>
            </motion.div>
          ))}
          <Button type="button" onClick={addNewGalleryItem} variant="outline" className="w-full gap-2"><PlusCircle className="h-4 w-4" /> Добавить фото в галерею</Button>
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
              <Label className="text-sm font-mono text-brand-purple mb-1.5 block">Цена за день (₽)</Label>
              <Input type="number" value={formData.daily_price} onChange={e => setFormData(p => ({ ...p, daily_price: e.target.value }))} placeholder="999" className="input-cyber" required />
          </div>
          <div>
              <Label className="text-sm font-mono text-brand-purple mb-1.5 block">Главное изображение</Label>
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

      <Button type="submit" disabled={isSubmitting} className="w-full text-lg">
        {isSubmitting 
          ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: Обработка..." /> 
          : isEditMode
            ? <VibeContentRenderer content="::FaSave:: Обновить Данные" />
            : <VibeContentRenderer content="::FaPlusCircle:: Добавить в Гараж" />
        }
      </Button>
    </motion.form>
  );
}