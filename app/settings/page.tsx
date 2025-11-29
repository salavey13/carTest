"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { updateUserSettings as updateGeneralUserSettings } from "@/app/actions"; 
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { debugLogger as logger } from "@/lib/debugLogger";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/Loading";
import { useTheme } from "next-themes"; // IMPORT NEXT-THEMES

interface GeneralSettingConfig {
  key: string;
  iconName: string; 
  title: string;
  description: string;
  colorClass: string;
}

const generalSettingDefinitions: GeneralSettingConfig[] = [
   { 
    key: 'dark_mode_enabled', 
    iconName: "FaMoon", 
    title: "Системная Тема (Dark Mode)", 
    description: "Активация протокола 'Вечная Ночь'. Выключите для светлой темы.", 
    colorClass: "data-[state=checked]:bg-brand-purple" 
  },
  { 
    key: 'experimental_alpha_protocols', 
    iconName: "FaShieldVirus", 
    title: "Альфа-Протоколы", 
    description: "Доступ к экспериментальным VIBE-модулям и фичам до их релиза.", 
    colorClass: "data-[state=checked]:bg-brand-orange" 
  },
];

type GeneralSettingsProfile = Record<string, boolean>;

export default function SettingsPage() {
  const { dbUser, isLoading: isAppContextLoading } = useAppContext();
  const { setTheme, resolvedTheme } = useTheme(); // Use next-themes hook
  
  const [generalSettingsProfile, setGeneralSettingsProfile] = useState<GeneralSettingsProfile | null>(null);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Initialize settings from DB or defaults
  useEffect(() => {
    if (!isAppContextLoading) {
      const userSettings = (dbUser?.metadata?.settings_profile as GeneralSettingsProfile) || {};
      
      // Determine initial dark mode state: 
      // 1. DB setting (priority)
      // 2. Current resolved theme from next-themes
      const isDark = userSettings.dark_mode_enabled ?? (resolvedTheme === 'dark');

      const mergedSettings = {
        dark_mode_enabled: isDark,
        experimental_alpha_protocols: userSettings.experimental_alpha_protocols ?? false,
      };

      setGeneralSettingsProfile(mergedSettings);
      
      // Sync visual theme if it differs from DB/Logic
      if (isDark && resolvedTheme !== 'dark') setTheme('dark');
      if (!isDark && resolvedTheme === 'dark') setTheme('light');
    }
  }, [dbUser, isAppContextLoading, resolvedTheme, setTheme]);

  const handleGeneralSettingChange = useCallback(async (settingKey: string, value: boolean) => {
    if (!generalSettingsProfile) return;

    // 1. Optimistic UI Update
    const newSettings = { ...generalSettingsProfile, [settingKey]: value };
    setGeneralSettingsProfile(newSettings);

    // 2. Apply Theme Immediately if key matches
    if (settingKey === 'dark_mode_enabled') {
      setTheme(value ? 'dark' : 'light');
    }

    // 3. Save to DB if user exists
    if (dbUser?.user_id) {
      setIsSavingGeneral(true);
      try {
        const currentMetadata = dbUser.metadata || {};
        const updatedMetadata = { ...currentMetadata, settings_profile: newSettings }; 
        const result = await updateGeneralUserSettings(dbUser.user_id, updatedMetadata);
        
        if (result.success) {
          toast.success("Настройки сохранены");
        } else {
          throw new Error(result.error);
        }
      } catch (e: any) {
        toast.error("Ошибка сохранения: " + e.message);
        // Revert on error
        setGeneralSettingsProfile(prev => ({ ...prev!, [settingKey]: !value }));
        if (settingKey === 'dark_mode_enabled') setTheme(!value ? 'dark' : 'light');
      } finally {
        setIsSavingGeneral(false);
      }
    } else {
        toast.info("Настройка применена локально (войдите для сохранения).");
    }
  }, [generalSettingsProfile, dbUser, setTheme]);

  if (isAppContextLoading || generalSettingsProfile === null) {
    return <Loading text="ЗАГРУЗКА КОНФИГА..." />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pt-24 pb-10 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="container mx-auto max-w-3xl space-y-8"
      >
        <Card className="border-border bg-card"> 
          <CardHeader className="text-center p-6 border-b border-border">
            <VibeContentRenderer content="::FaUserGear className='text-5xl text-primary mx-auto mb-4'::" />
            <CardTitle className="text-3xl font-orbitron font-bold">ОБЩИЕ НАСТРОЙКИ</CardTitle>
            <CardDescription>Персонализация твоего VIBE OS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            {generalSettingDefinitions.map((setting) => (
              <SettingToggle
                key={setting.key}
                iconName={setting.iconName}
                title={setting.title}
                description={setting.description}
                isChecked={generalSettingsProfile[setting.key] ?? false}
                onCheckedChange={(value) => handleGeneralSettingChange(setting.key, value)}
                switchColorClass={setting.colorClass}
                isDisabled={isSavingGeneral}
              />
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

interface SettingToggleProps {
  iconName: string; 
  title: string;
  description: string;
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
  switchColorClass: string;
  isDisabled?: boolean;
}

const SettingToggle: React.FC<SettingToggleProps> = ({ iconName, title, description, isChecked, onCheckedChange, switchColorClass, isDisabled }) => {
  const uniqueId = `switch-${title.replace(/\s+/g, '-')}`;
  return (
    <div className={cn(
        "flex items-center justify-between p-4 rounded-lg border border-input transition-all duration-200",
        isDisabled && "opacity-70 cursor-not-allowed"
      )}
    >
      <Label htmlFor={uniqueId} className="flex items-center gap-4 cursor-pointer flex-grow">
        <span className="text-2xl text-primary">
            <VibeContentRenderer content={`::${iconName}::`} />
        </span>
        <div>
          <div className="font-bold text-base">{title}</div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </Label>
      <Switch
        id={uniqueId}
        checked={isChecked}
        onCheckedChange={onCheckedChange}
        className={cn(switchColorClass)}
        disabled={isDisabled}
      />
    </div>
  );
};