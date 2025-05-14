"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  FaBrain, FaBell, FaBed, FaCalendarCheck, FaToolbox, FaEnvelope,
  FaComments, FaShieldVirus, FaSliders, FaUserGear, FaCircleQuestion, 
  FaMoon
} from "react-icons/fa6";
import Modal from "@/components/ui/Modal";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { updateUserSettings } from "@/app/actions";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { debugLogger as logger } from "@/lib/debugLogger";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea"; // Added Textarea import

interface SettingConfig {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  colorClass: string;
}

const settingDefinitions: SettingConfig[] = [
  { key: 'morning_protocols_enabled', icon: <FaBell className="text-brand-yellow" />, title: "Протоколы Пробуждения", description: "Получать утренние VIBE-настройки и задачи для максимального заряда на день.", colorClass: "data-[state=checked]:bg-brand-yellow" },
  { key: 'deep_work_cycles_enabled', icon: <FaBrain className="text-brand-green" />, title: "Циклы Глубокой Работы", description: "Активировать напоминания для Pomodoro-сессий и периодов гиперфокуса.", colorClass: "data-[state=checked]:bg-brand-green" },
  { key: 'mind_sync_calendar_enabled', icon: <FaCalendarCheck className="text-brand-blue" />, title: "Дата-Синхронизация Разума", description: "Интеграция с календарем для оптимизации когнитивных нагрузок (концепт).", colorClass: "data-[state=checked]:bg-brand-blue" },
  { key: 'neuro_feedback_sleep_focus', icon: <FaBed className="text-brand-cyan" />, title: "Нейро-Обратная Связь", description: "Анализ качества сна и фокуса для адаптации VIBE-протоколов (концепт).", colorClass: "data-[state=checked]:bg-brand-cyan" },
  { key: 'experimental_alpha_protocols', icon: <FaShieldVirus className="text-brand-orange" />, title: "Альфа-Протоколы", description: "Доступ к экспериментальным VIBE-модулям и фичам до их официального релиза.", colorClass: "data-[state=checked]:bg-brand-orange" },
  { key: 'promotional_messages_enabled', icon: <FaEnvelope className="text-gray-400" />, title: "Партнерские Сообщения", description: "Получать информацию о новых возможностях и коллаборациях в экосистеме CyberVibe.", colorClass: "data-[state=checked]:bg-gray-500" },
];

type SettingsProfile = Record<string, boolean>;

const getDefaultSettings = (): SettingsProfile => {
  const defaults: SettingsProfile = {};
  settingDefinitions.forEach(s => {
    defaults[s.key] = !(s.key === 'promotional_messages_enabled' || s.key === 'experimental_alpha_protocols');
  });
  defaults['dark_mode_enabled'] = true;
  return defaults;
};

export default function SettingsPage() {
  const { dbUser, isLoading: isAppContextLoading, error: appContextError } = useAppContext();
  const [settingsProfile, setSettingsProfile] = useState<SettingsProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAppContextLoading && dbUser) {
      logger.debug("[SettingsPage] AppContext loaded, dbUser found. Metadata:", dbUser.metadata);
      const userSettings = dbUser.metadata?.settings_profile as SettingsProfile | undefined;
      const defaultSettings = getDefaultSettings();
      const mergedSettings = { ...defaultSettings, ...userSettings };
      setSettingsProfile(mergedSettings);
      logger.debug("[SettingsPage] Settings profile initialized:", mergedSettings);

      if (typeof mergedSettings.dark_mode_enabled === 'boolean') {
        document.documentElement.classList.toggle('dark', mergedSettings.dark_mode_enabled);
      }

    } else if (!isAppContextLoading && !dbUser) {
      logger.warn("[SettingsPage] AppContext loaded, but no dbUser. Using default settings.");
      setSettingsProfile(getDefaultSettings());
       document.documentElement.classList.toggle('dark', getDefaultSettings().dark_mode_enabled);
    }
     if(appContextError) {
      logger.error("[SettingsPage] AppContext error:", appContextError);
      setPageError("Ошибка загрузки данных пользователя.");
    }
  }, [dbUser, isAppContextLoading, appContextError]);

  const handleSettingChange = useCallback(async (settingKey: string, value: boolean) => {
    if (!settingsProfile || !dbUser?.id) {
      toast.error("Профиль пользователя не загружен. Попробуйте позже.");
      return;
    }

    const newSettings = { ...settingsProfile, [settingKey]: value };
    setSettingsProfile(newSettings);

    if (settingKey === 'dark_mode_enabled') {
      document.documentElement.classList.toggle('dark', value);
      logger.log(`[SettingsPage] Dark mode toggled to: ${value}`);
    }

    const settingDef = settingDefinitions.find(s => s.key === settingKey);
    const settingTitleForToast = settingDef ? settingDef.title : (settingKey === 'dark_mode_enabled' ? "Темная тема" : settingKey);
    const toastMessage = `Настройка "${settingTitleForToast}" ${value ? "включена" : "выключена"}`;

    setIsSaving(true);
    try {
      const currentMetadata = dbUser.metadata || {};
      const updatedMetadata = {
          ...currentMetadata,
          settings_profile: newSettings,
      };

      const result = await updateUserSettings(dbUser.id, updatedMetadata);
      if (result.success) {
        toast.success(toastMessage);
        logger.log(`[SettingsPage] Setting ${settingKey} changed to ${value} and saved. Full new settings:`, newSettings);
      } else {
        toast.error(`Ошибка сохранения: ${result.error || "Неизвестная ошибка"}`);
        logger.error(`[SettingsPage] Failed to save setting ${settingKey}:`, result.error);
        setSettingsProfile(prev => ({ ...prev!, [settingKey]: !value }));
        if (settingKey === 'dark_mode_enabled') {
          document.documentElement.classList.toggle('dark', !value);
          logger.log(`[SettingsPage] Reverted dark mode toggle to: ${!value}`);
        }
      }
    } catch (e) {
      toast.error("Критическая ошибка при сохранении настроек.");
      logger.fatal("[SettingsPage] Critical error saving settings:", e);
      setSettingsProfile(prev => ({ ...prev!, [settingKey]: !value }));
       if (settingKey === 'dark_mode_enabled') {
          document.documentElement.classList.toggle('dark', !value);
          logger.log(`[SettingsPage] Reverted dark mode toggle on catch to: ${!value}`);
        }
    } finally {
      setIsSaving(false);
    }
  }, [settingsProfile, dbUser]);

  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim()) {
        toast.error("Сообщение обратной связи не может быть пустым.");
        return;
    }
    logger.log("Feedback submitted (client-side):", { userId: dbUser?.id, message: feedbackMessage });
    toast.success("Спасибо за ваш VIBE-отзыв! Мы его изучим.");
    setFeedbackMessage("");
    setIsFeedbackModalOpen(false);
  };

  if (isAppContextLoading || settingsProfile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
        <div className="flex flex-col items-center">
            <FaSliders className="text-6xl text-brand-purple animate-pulse mb-6" />
            <h1 className="text-2xl text-brand-purple animate-pulse font-orbitron tracking-wider">КАЛИБРОВКА НЕЙРО-ИНТЕРФЕЙСА...</h1>
            {pageError && <p className="text-red-500 mt-2 font-mono">{pageError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pt-24 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-2xl"
      >
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-purple/60 shadow-2xl shadow-purple-glow"> 
          <CardHeader className="text-center p-6 md:p-8 border-b border-brand-purple/40">
            <FaUserGear className="text-6xl text-brand-purple mx-auto mb-4 drop-shadow-[0_0_10px_theme(colors.brand-purple)]" />
            <CardTitle className="text-3xl md:text-4xl font-orbitron font-bold text-brand-purple cyber-text glitch" data-text="НЕЙРО-ИНТЕРФЕЙС">
              НЕЙРО-ИНТЕРФЕЙС
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1 text-sm md:text-base">
              Тонкая настройка твоего VIBE OS для пиковой производительности.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 p-6 md:p-8">
            {settingDefinitions.map((setting) => (
              <SettingToggle
                key={setting.key}
                icon={setting.icon}
                title={setting.title}
                description={setting.description}
                isChecked={settingsProfile?.[setting.key] ?? false}
                onCheckedChange={(value) => handleSettingChange(setting.key, value)}
                switchColorClass={setting.colorClass}
                isDisabled={isSaving}
              />
            ))}

             <SettingToggle
                 key="dark_mode_enabled"
                 icon={<FaMoon className="text-brand-purple"/>}
                 title="Системная Тема"
                 description="Активация протокола 'Вечная Ночь' для комфорта глаз."
                 isChecked={settingsProfile.dark_mode_enabled ?? true}
                 onCheckedChange={(value) => handleSettingChange('dark_mode_enabled', value)}
                 switchColorClass="data-[state=checked]:bg-brand-purple" 
                 isDisabled={isSaving}
             />

            <div className="mt-10 pt-6 border-t border-brand-purple/30 text-center">
              <Button
                variant="outline"
                onClick={() => setIsFeedbackModalOpen(true)}
                className="border-brand-pink text-brand-pink hover:bg-brand-pink/20 hover:text-white font-orbitron text-lg px-8 py-3 shadow-lg hover:shadow-pink-glow transition-all duration-300 transform hover:scale-105" 
                disabled={isSaving}
              >
                <FaComments className="mr-2.5" /> VIBE-ОТЗЫВ
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        title="Форма Нейро-Обратной Связи"
        confirmText="Отправить Сигнал"
        onConfirm={handleSendFeedback}
        icon={<FaCircleQuestion className="text-brand-pink" />} 
        dialogClassName="bg-dark-card border-brand-pink text-light-text"
        titleClassName="text-brand-pink"
        confirmButtonClassName="bg-brand-pink hover:bg-brand-pink/80 text-black"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <p className="mb-3 font-mono text-sm text-muted-foreground">Твои мысли – топливо для эволюции VIBE OS. Делись идеями, сообщай о сбоях в Матрице.</p>
        <Textarea
          value={feedbackMessage}
          onChange={(e) => setFeedbackMessage(e.target.value)}
          placeholder="Твой сигнал в ноосферу..."
          rows={5}
          className="w-full p-3 rounded-md bg-input border border-border text-foreground focus:ring-2 focus:ring-ring focus:border-ring font-mono text-sm placeholder-muted-foreground/70 textarea-cyber simple-scrollbar" 
        />
      </Modal>
    </div>
  );
}

interface SettingToggleProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
  switchColorClass: string;
  isDisabled?: boolean;
}

const SettingToggle: React.FC<SettingToggleProps> = ({ icon, title, description, isChecked, onCheckedChange, switchColorClass, isDisabled }) => {
  const uniqueId = `switch-${title.replace(/\s+/g, '-')}`;
  return (
    <div className={cn(
        "flex items-center justify-between p-3.5 bg-dark-bg/50 rounded-lg border border-gray-700/70 hover:border-brand-purple/60 transition-all duration-200 ease-out shadow-md hover:shadow-lg",
        isDisabled && "opacity-70 cursor-not-allowed"
      )}
    >
      <Label htmlFor={uniqueId} className={cn("flex items-center text-md flex-grow pr-4", isDisabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <span className="text-2xl mr-3.5 flex-shrink-0 w-7 text-center">{icon}</span>
        <div className="flex-grow">
          <VibeContentRenderer content={`**${title}**`} className="font-orbitron text-light-text text-base" />
          <p className="text-xs text-muted-foreground font-mono mt-1">{description}</p>
        </div>
      </Label>
      <Switch
        id={uniqueId}
        checked={isChecked}
        onCheckedChange={onCheckedChange}
        className={cn(switchColorClass, "flex-shrink-0")}
        disabled={isDisabled}
        aria-label={title}
      />
    </div>
  );
};