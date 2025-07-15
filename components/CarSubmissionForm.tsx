"use client";
import React, { useState } from "react";
import { supabaseAdmin, uploadImage, generateCarEmbedding } from "@/hooks/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { X, Car, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";

interface CarSubmissionFormProps {
  ownerId?: string;
}

type VehicleType = 'car' | 'bike';

const carSpecKeys = ["version", "electric", "color", "theme", "horsepower", "torque", "acceleration", "topSpeed"];
const bikeSpecKeys = ["engine_cc", "horsepower", "weight_kg", "top_speed_kmh", "type", "seat_height_mm"];

export function CarSubmissionForm({ ownerId }: CarSubmissionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>('bike');
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    description: "",
    specs: {} as Record<string, string>,
    daily_price: "",
    image_url: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const specKeys = vehicleType === 'bike' ? bikeSpecKeys : carSpecKeys;

  const generatedId = `${formData.make.toLowerCase().replace(/\s+/g, "-")}-${formData.model.toLowerCase().replace(/\s+/g, "-")}`;
  const rentLink = formData.make && formData.model ? `/rent/${generatedId}` : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) {
        toast.error("Ошибка: ID пользователя не найден. Авторизуйтесь заново.");
        return;
    }
    setIsSubmitting(true);
    toast.info("Запускаю добавление транспорта...");

    try {
      const bucketName = "carpix"; // Unified bucket name

      let imageUrl = formData.image_url;
      if (imageFile) {
        const uploadResult = await uploadImage(bucketName, imageFile);
        if (uploadResult.success && uploadResult.publicUrl) {
            imageUrl = uploadResult.publicUrl;
            toast.success("Изображение загружено!");
        } else {
            throw new Error(uploadResult.error || "Не удалось загрузить изображение.");
        }
      }

      const vehicleData = {
        id: generatedId,
        make: formData.make,
        model: formData.model,
        description: formData.description,
        specs: formData.specs,
        owner_id: ownerId,
        daily_price: Number(formData.daily_price),
        image_url: imageUrl,
        rent_link: rentLink,
        type: vehicleType,
      };

      const { data: existingCar, error: fetchError } = await supabaseAdmin.from("cars").select('id').eq('id', generatedId).maybeSingle();
      if(fetchError) throw new Error(`Ошибка проверки транспорта: ${fetchError.message}`);
      if(existingCar) throw new Error(`Транспорт с ID '${generatedId}' уже существует.`);
      
      const { data, error: insertError } = await supabaseAdmin.from("cars").insert([vehicleData]).select().single();

      if (insertError) throw insertError;
      
      // Grant admin status on first submission
      const { data: user, error: userError } = await supabaseAdmin.from("users").select("status").eq("user_id", ownerId).single();
      if(user && user.status !== 'admin') {
          await supabaseAdmin.from("users").update({ status: 'admin' }).eq("user_id", ownerId);
          toast.success("Статус Админа получен! Добро пожаловать в элиту.");
      }

      setFormData({ make: "", model: "", description: "", specs: {}, daily_price: "", image_url: "" });
      setImageFile(null);
      toast.success("Транспорт успешно добавлен в гараж!");

    } catch (error) {
      toast.error(`Ошибка: ${(error instanceof Error ? error.message : "Неизвестная ошибка")}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addNewSpec = () => {
    const usedKeys = Object.keys(formData.specs);
    const nextKey = specKeys.find(key => !usedKeys.includes(key)) || `custom_spec_${Object.keys(formData.specs).length + 1}`;
    setFormData(prev => ({ ...prev, specs: { ...prev.specs, [nextKey]: "" } }));
  };

  const removeSpec = (keyToRemove: string) => {
    setFormData(prev => {
        const newSpecs = { ...prev.specs };
        delete newSpecs[keyToRemove];
        return { ...prev, specs: newSpecs };
    });
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6 bg-black/30 p-4 md:p-6 rounded-xl border border-border"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
    >
      <div className="flex justify-center gap-4 p-2 bg-input/50 rounded-lg border border-dashed border-border">
          <Button type="button" onClick={() => setVehicleType('bike')} variant={vehicleType === 'bike' ? 'secondary' : 'ghost'} className="gap-2"><Bike /> Мотоцикл</Button>
          <Button type="button" onClick={() => setVehicleType('car')} variant={vehicleType === 'car' ? 'secondary' : 'ghost'} className="gap-2"><Car /> Автомобиль</Button>
      </div>

      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-mono text-muted-foreground mb-1.5 block">Марка</Label>
          <Input value={formData.make} onChange={e => setFormData(p => ({ ...p, make: e.target.value }))} placeholder={vehicleType === 'bike' ? 'Ducati' : 'Tesla'} className="input-cyber" required/>
        </div>
        <div>
          <Label className="text-sm font-mono text-muted-foreground mb-1.5 block">Модель</Label>
          <Input value={formData.model} onChange={e => setFormData(p => ({ ...p, model: e.target.value }))} placeholder={vehicleType === 'bike' ? 'Panigale V4' : 'Cybertruck'} className="input-cyber" required/>
        </div>
      </motion.div>

      <div>
        <Label className="text-sm font-mono text-muted-foreground mb-1.5 block">Описание</Label>
        <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Краткое, но зажигательное описание..." className="textarea-cyber" required/>
      </div>

      <div>
        <h3 className="text-lg font-mono text-muted-foreground mb-2">Характеристики</h3>
        <div className="space-y-2">
          {Object.entries(formData.specs).map(([key, value], index) => (
            <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
              <Input value={key} onChange={e => { const newSpecs = { ...formData.specs }; delete newSpecs[key]; newSpecs[e.target.value] = value; setFormData(p => ({ ...p, specs: newSpecs })); }} placeholder={specKeys[index] || 'Ключ'} className="input-cyber flex-[2]" />
              <Input value={value} onChange={e => setFormData(p => ({ ...p, specs: { ...p.specs, [key]: e.target.value } }))} placeholder="Значение" className="input-cyber flex-[3]" />
              <Button type="button" onClick={() => removeSpec(key)} variant="destructive" size="icon" className="h-9 w-9 flex-shrink-0"><X className="h-4 w-4" /></Button>
            </motion.div>
          ))}
          <Button type="button" onClick={addNewSpec} variant="outline" className="w-full">
            <VibeContentRenderer content="::FaPlus:: Добавить характеристику"/>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
              <Label className="text-sm font-mono text-muted-foreground mb-1.5 block">Цена за день (XTR)</Label>
              <Input type="number" value={formData.daily_price} onChange={e => setFormData(p => ({ ...p, daily_price: e.target.value }))} placeholder="999" className="input-cyber" required />
          </div>
          <div>
              <Label className="text-sm font-mono text-muted-foreground mb-1.5 block">Изображение (URL или файл)</Label>
              <div className="flex gap-2">
                  <Input value={formData.image_url} onChange={e => setFormData(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." className="input-cyber" />
                  <Button asChild variant="outline" className="flex-shrink-0"><Label htmlFor="image-upload" className="cursor-pointer"><VibeContentRenderer content="::FaUpload::" /></Label></Button>
                  <input id="image-upload" type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="hidden" />
              </div>
          </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full text-lg">
        {isSubmitting ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: ДОБАВЛЕНИЕ..." /> : <VibeContentRenderer content="::FaPlusCircle:: ДОБАВИТЬ В ГАРАЖ" />}
      </Button>
    </motion.form>
  );
}