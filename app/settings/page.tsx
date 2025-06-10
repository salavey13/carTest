"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
// Removed direct Fa6Icons imports, VibeContentRenderer will handle them
import Modal from "@/components/ui/Modal";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { updateUserSettings as updateGeneralUserSettings } from "@/app/actions"; // General user settings
import { 
    getArbitrageScannerSettings, 
    updateArbitrageUserSettings 
} from "@/app/elon/arbitrage_scanner_actions"; // Arbitrage specific settings
import type { 
    ArbitrageSettings, 
    ExchangeName 
} from "@/app/elon/arbitrage_scanner_types";
import { 
    DEFAULT_ARBITRAGE_SETTINGS, 
    ALL_POSSIBLE_EXCHANGES_CONST, 
    DEFAULT_TRACKED_ASSETS_FOR_NETWORK_FEES 
} from "@/app/elon/arbitrage_scanner_types";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { debugLogger as logger } from "@/lib/debugLogger";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

// Simplified General Settings
interface GeneralSettingConfig {
  key: string;
  iconName: string; // Icon name for VibeContentRenderer, e.g., "FaMoon"
  title: string;
  description: string;
  colorClass: string;
}

const generalSettingDefinitions: GeneralSettingConfig[] = [
   { 
    key: 'dark_mode_enabled', 
    iconName: "FaMoon", 
    title: "Системная Тема", 
    description: "Активация протокола 'Вечная Ночь' для комфорта глаз.", 
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

const getDefaultGeneralSettings = (): GeneralSettingsProfile => {
  const defaults: GeneralSettingsProfile = {};
  generalSettingDefinitions.forEach(s => {
    // Default experimental_alpha_protocols to false, others based on their definition or true
    defaults[s.key] = s.key === 'experimental_alpha_protocols' ? false : true;
  });
  // Ensure dark_mode_enabled default if not in definitions
  if (defaults['dark_mode_enabled'] === undefined) {
    defaults['dark_mode_enabled'] = true;
  }
  return defaults;
};

export default function SettingsPage() {
  const { dbUser, isLoading: isAppContextLoading, error: appContextError } = useAppContext();
  
  const [generalSettingsProfile, setGeneralSettingsProfile] = useState<GeneralSettingsProfile | null>(null);
  const [arbitrageSettings, setArbitrageSettings] = useState<ArbitrageSettings | null>(null);
  const [isLoadingArbitrageSettings, setIsLoadingArbitrageSettings] = useState(false);

  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingArbitrage, setIsSavingArbitrage] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAppContextLoading && dbUser) {
      logger.debug("[SettingsPage] AppContext loaded, dbUser found. Metadata:", dbUser.metadata);
      const userGeneralSettings = dbUser.metadata?.settings_profile as GeneralSettingsProfile | undefined;
      const defaultGeneral = getDefaultGeneralSettings();
      const mergedGeneral = { ...defaultGeneral, ...userGeneralSettings };
      setGeneralSettingsProfile(mergedGeneral);
      logger.debug("[SettingsPage] General settings profile initialized:", mergedGeneral);

      if (typeof mergedGeneral.dark_mode_enabled === 'boolean') {
        document.documentElement.classList.toggle('dark', mergedGeneral.dark_mode_enabled);
      }
    } else if (!isAppContextLoading && !dbUser) {
      logger.warn("[SettingsPage] AppContext loaded, but no dbUser. Using default general settings.");
      const defaults = getDefaultGeneralSettings();
      setGeneralSettingsProfile(defaults);
      document.documentElement.classList.toggle('dark', defaults.dark_mode_enabled);
    }
    if(appContextError) {
      logger.error("[SettingsPage] AppContext error:", appContextError);
      setPageError("Ошибка загрузки данных пользователя.");
    }
  }, [dbUser, isAppContextLoading, appContextError]);

  const loadArbitrageSettings = useCallback(async () => {
    if (!dbUser?.user_id) return;
    setIsLoadingArbitrageSettings(true);
    try {
      const result = await getArbitrageScannerSettings(dbUser.user_id);
      if (result.success && result.data) {
        setArbitrageSettings(result.data);
        logger.debug("[SettingsPage] Arbitrage settings loaded:", result.data);
      } else {
        toast.error("Failed to load arbitrage settings: " + (result.error || "Using defaults."));
        setArbitrageSettings({ ...DEFAULT_ARBITRAGE_SETTINGS });
      }
    } catch (error) {
      toast.error("Error loading arbitrage settings. Using defaults.");
      logger.error("[SettingsPage] Error loading arbitrage settings", error);
      setArbitrageSettings({ ...DEFAULT_ARBITRAGE_SETTINGS });
    }
    setIsLoadingArbitrageSettings(false);
  }, [dbUser?.user_id]);

  useEffect(() => {
    if (dbUser?.user_id) {
      loadArbitrageSettings();
    }
  }, [dbUser?.user_id, loadArbitrageSettings]);


  const handleGeneralSettingChange = useCallback(async (settingKey: string, value: boolean) => {
    if (!generalSettingsProfile || !dbUser?.id) {
      toast.error("Профиль пользователя не загружен. Попробуйте позже.");
      return;
    }

    const newSettings = { ...generalSettingsProfile, [settingKey]: value };
    setGeneralSettingsProfile(newSettings);

    if (settingKey === 'dark_mode_enabled') {
      document.documentElement.classList.toggle('dark', value);
    }

    const settingDef = generalSettingDefinitions.find(s => s.key === settingKey);
    const settingTitleForToast = settingDef ? settingDef.title : settingKey;
    const toastMessage = `Настройка "${settingTitleForToast}" ${value ? "включена" : "выключена"}`;

    setIsSavingGeneral(true);
    try {
      const currentMetadata = dbUser.metadata || {};
      const updatedMetadata = { ...currentMetadata, settings_profile: newSettings };
      const result = await updateGeneralUserSettings(dbUser.id, updatedMetadata);
      if (result.success) {
        toast.success(toastMessage);
      } else {
        toast.error(`Ошибка сохранения: ${result.error || "Неизвестная ошибка"}`);
        setGeneralSettingsProfile(prev => ({ ...prev!, [settingKey]: !value }));
        if (settingKey === 'dark_mode_enabled') document.documentElement.classList.toggle('dark', !value);
      }
    } catch (e) {
      toast.error("Критическая ошибка при сохранении общих настроек.");
      setGeneralSettingsProfile(prev => ({ ...prev!, [settingKey]: !value }));
      if (settingKey === 'dark_mode_enabled') document.documentElement.classList.toggle('dark', !value);
    } finally {
      setIsSavingGeneral(false);
    }
  }, [generalSettingsProfile, dbUser]);

  const handleArbitrageSettingChange = (key: keyof Omit<ArbitrageSettings, "exchangeFees" | "networkFees">, value: any) => {
    setArbitrageSettings(prev => {
        if (!prev) return null;
        let processedValue = value;
        if (key === 'minSpreadPercent' || key === 'defaultTradeVolumeUSD') {
            processedValue = parseFloat(value);
            if (isNaN(processedValue)) processedValue = key === 'minSpreadPercent' ? 0.0 : 0;
        }
        return { ...prev, [key]: processedValue };
    });
  };

  const handleArbitrageExchangeEnabledToggle = (exchangeName: ExchangeName, checked: boolean) => {
    setArbitrageSettings(prev => {
      if (!prev) return null;
      const newEnabledExchanges = checked
        ? [...prev.enabledExchanges, exchangeName]
        : prev.enabledExchanges.filter(ex => ex !== exchangeName);
      return { ...prev, enabledExchanges: newEnabledExchanges };
    });
  };
  
  const handleArbitrageExchangeFeeChange = (exchange: ExchangeName, type: 'maker' | 'taker', valueStr: string) => {
    setArbitrageSettings(prev => {
        if (!prev) return null;
        const value = parseFloat(valueStr);
        if (isNaN(value) || value < 0) return prev;
        const updatedExchangeFees = {
            ...prev.exchangeFees,
            [exchange]: { ...(prev.exchangeFees[exchange] || { maker: 0, taker: 0 }), [type]: value / 100 }
        };
        return { ...prev, exchangeFees: updatedExchangeFees };
    });
  };

  const handleArbitrageNetworkFeeChange = (assetSymbol: string, valueStr: string) => {
    setArbitrageSettings(prev => {
        if (!prev) return null;
        const value = parseFloat(valueStr);
        if (isNaN(value) || value < 0) return prev;
        const updatedNetworkFees = { ...prev.networkFees, [assetSymbol]: value };
        return { ...prev, networkFees: updatedNetworkFees };
    });
  };

  const handleArbitrageTrackedPairChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pairs = e.target.value.split(',').map(p => p.trim().toUpperCase()).filter(p => p.length > 2 && p.includes('/'));
    handleArbitrageSettingChange('trackedPairs', pairs);
  };

  const handleSaveArbitrageSettings = async () => {
    if (!dbUser?.user_id || !arbitrageSettings) {
      toast.error("Пользователь или настройки арбитража не определены.");
      return;
    }
    setIsSavingArbitrage(true);
    try {
      const result = await updateArbitrageUserSettings(dbUser.user_id, arbitrageSettings);
      if (result.success) {
        toast.success("Настройки арбитражного сканера сохранены!");
        if (result.data) setArbitrageSettings(result.data);
      } else {
        toast.error("Ошибка сохранения настроек арбитража: " + (result.error || "Неизвестная ошибка"));
      }
    } catch (error) {
      toast.error("Критическая ошибка при сохранении настроек арбитража.");
      logger.error("[SettingsPage] Error saving arbitrage settings", error);
    }
    setIsSavingArbitrage(false);
  };
  
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

  if (isAppContextLoading || generalSettingsProfile === null || isLoadingArbitrageSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
        <div className="flex flex-col items-center">
            <VibeContentRenderer content="::FaSliders className='text-6xl text-brand-purple animate-pulse mb-6'::" />
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
        className="container mx-auto max-w-3xl"
      >
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-purple/60 shadow-2xl shadow-purple-glow mb-8"> 
          <CardHeader className="text-center p-6 md:p-8 border-b border-brand-purple/40">
            <VibeContentRenderer content="::FaUserGear className='text-6xl text-brand-purple mx-auto mb-4 filter drop-shadow-[0_0_10px_hsl(var(--brand-purple-rgb))]'::" />
            <CardTitle className="text-3xl md:text-4xl font-orbitron font-bold text-brand-purple cyber-text glitch" data-text="ОБЩИЕ НАСТРОЙКИ">
              ОБЩИЕ НАСТРОЙКИ
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1 text-sm md:text-base">
              Основные параметры твоего VIBE OS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6 md:p-8">
            {generalSettingDefinitions.map((setting) => (
              <SettingToggle
                key={setting.key}
                iconName={setting.iconName}
                title={setting.title}
                description={setting.description}
                isChecked={generalSettingsProfile?.[setting.key] ?? false}
                onCheckedChange={(value) => handleGeneralSettingChange(setting.key, value)}
                switchColorClass={setting.colorClass}
                isDisabled={isSavingGeneral}
              />
            ))}
          </CardContent>
        </Card>

        {arbitrageSettings && (
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-cyan/60 shadow-2xl shadow-cyan-glow">
            <CardHeader className="text-center p-6 md:p-8 border-b border-brand-cyan/40">
                <VibeContentRenderer content="::FaRobot className='text-6xl text-brand-cyan mx-auto mb-4 filter drop-shadow-[0_0_10px_hsl(var(--brand-cyan-rgb))]'::" />
                <CardTitle className="text-3xl md:text-4xl font-orbitron font-bold text-brand-cyan cyber-text glitch" data-text="ARBITRAGE SEEKER">
                    ARBITRAGE SEEKER
                </CardTitle>
                <CardDescription className="text-muted-foreground font-mono mt-1 text-sm md:text-base">
                    Конфигурация параметров симулятора арбитражного сканера.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="arbMinSpread" className="text-brand-cyan/90 font-orbitron">
                            <VibeContentRenderer content="::FaPercentage className='inline mr-1.5'::" />Мин. Спред (%)
                        </Label>
                        <Input id="arbMinSpread" type="number" step="0.01" value={arbitrageSettings.minSpreadPercent} onChange={e => handleArbitrageSettingChange('minSpreadPercent', e.target.value)} className="input-cyber border-brand-cyan/50 focus:ring-brand-cyan" disabled={isSavingArbitrage}/>
                    </div>
                    <div>
                        <Label htmlFor="arbTradeVolume" className="text-brand-cyan/90 font-orbitron">
                           <VibeContentRenderer content="::FaDollarSign className='inline mr-1.5'::" />Объем Сделки (USD)
                        </Label>
                        <Input id="arbTradeVolume" type="number" step="100" value={arbitrageSettings.defaultTradeVolumeUSD} onChange={e => handleArbitrageSettingChange('defaultTradeVolumeUSD', e.target.value)} className="input-cyber border-brand-cyan/50 focus:ring-brand-cyan" disabled={isSavingArbitrage}/>
                    </div>
                </div>
                <div>
                    <Label className="text-brand-cyan/90 font-orbitron mb-2 block">
                        <VibeContentRenderer content="::FaExchangeAlt className='inline mr-1.5'::" />Активные Биржи (симуляция)
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {ALL_POSSIBLE_EXCHANGES_CONST.map(ex => (
                            <div key={ex} className="flex items-center space-x-2 p-2 bg-dark-bg/60 rounded border border-gray-700">
                                <Checkbox id={`arbEx-${ex}`} checked={arbitrageSettings.enabledExchanges.includes(ex)} onCheckedChange={(checked) => handleArbitrageExchangeEnabledToggle(ex, !!checked)} className="border-brand-cyan data-[state=checked]:bg-brand-cyan" disabled={isSavingArbitrage}/>
                                <Label htmlFor={`arbEx-${ex}`} className="text-sm font-medium text-light-text leading-none">{ex}</Label>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <Label htmlFor="arbTrackedPairs" className="text-brand-cyan/90 font-orbitron">
                        <VibeContentRenderer content="::FaListUl className='inline mr-1.5'::" />Отслеживаемые Пары (через запятую)
                    </Label>
                    <Input id="arbTrackedPairs" type="text" value={arbitrageSettings.trackedPairs.join(', ')} onChange={handleArbitrageTrackedPairChange} placeholder="BTC/USDT, ETH/USDT" className="input-cyber border-brand-cyan/50 focus:ring-brand-cyan" disabled={isSavingArbitrage}/>
                </div>
                
                <div className="space-y-4">
                    <h4 className="text-lg font-orbitron text-brand-cyan/90 mt-4">
                        <VibeContentRenderer content="::FaDollarSign className='inline mr-1.5'::" />Комиссии Бирж (%)
                    </h4>
                    <ScrollArea className="h-[250px] p-2 border border-brand-cyan/30 rounded-md simple-scrollbar bg-dark-bg/30">
                        <div className="space-y-3 pr-2">
                        {ALL_POSSIBLE_EXCHANGES_CONST.map(ex => (
                            <div key={`arbFee-${ex}`} className="p-2.5 bg-dark-bg/70 rounded-md border border-gray-700/50">
                                <p className="text-sm font-semibold text-brand-cyan mb-1.5">{ex}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label htmlFor={`arbFee-${ex}-maker`} className="text-xs text-gray-400">Maker Fee (%)</Label>
                                        <Input id={`arbFee-${ex}-maker`} type="number" step="0.001" placeholder="0.1"
                                            value={((arbitrageSettings.exchangeFees[ex]?.maker || 0) * 100).toFixed(4)}
                                            onChange={e => handleArbitrageExchangeFeeChange(ex, 'maker', e.target.value)}
                                            className="input-cyber text-xs h-8 border-brand-cyan/40 focus:ring-brand-cyan" disabled={isSavingArbitrage}/>
                                    </div>
                                    <div>
                                        <Label htmlFor={`arbFee-${ex}-taker`} className="text-xs text-gray-400">Taker Fee (%)</Label>
                                        <Input id={`arbFee-${ex}-taker`} type="number" step="0.001" placeholder="0.1"
                                            value={((arbitrageSettings.exchangeFees[ex]?.taker || 0) * 100).toFixed(4)}
                                            onChange={e => handleArbitrageExchangeFeeChange(ex, 'taker', e.target.value)}
                                            className="input-cyber text-xs h-8 border-brand-cyan/40 focus:ring-brand-cyan" disabled={isSavingArbitrage}/>
                                    </div>
                                </div>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                </div>
                <div className="space-y-4">
                    <h4 className="text-lg font-orbitron text-brand-cyan/90 mt-4">
                       <VibeContentRenderer content="::FaNetworkWired className='inline mr-1.5'::" />Сетевые Комиссии (USD)
                    </h4>
                    <ScrollArea className="h-[200px] p-2 border border-brand-cyan/30 rounded-md simple-scrollbar bg-dark-bg/30">
                        <div className="space-y-3 pr-2">
                        {DEFAULT_TRACKED_ASSETS_FOR_NETWORK_FEES.map(assetSymbol => (
                            <div key={`arbNetFee-${assetSymbol}`} className="p-2.5 bg-dark-bg/70 rounded-md border border-gray-700/50">
                                <Label htmlFor={`arbNetFee-${assetSymbol}-input`} className="text-sm text-brand-cyan mb-1 block">{assetSymbol} Network Fee (USD)</Label>
                                <Input id={`arbNetFee-${assetSymbol}-input`} type="number" step="0.01" placeholder="e.g., 5"
                                    value={arbitrageSettings.networkFees[assetSymbol] || 0}
                                    onChange={e => handleArbitrageNetworkFeeChange(assetSymbol, e.target.value)}
                                    className="input-cyber text-xs h-8 border-brand-cyan/40 focus:ring-brand-cyan" disabled={isSavingArbitrage}/>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                </div>
                <Button onClick={handleSaveArbitrageSettings} disabled={isSavingArbitrage || isSavingGeneral} className="w-full bg-brand-cyan hover:bg-brand-cyan/80 text-black font-orbitron">
                    {isSavingArbitrage ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: Сохранение..." /> : <VibeContentRenderer content="::FaSave className='mr-2':: Сохранить Настройки Арбитража" />}
                </Button>
            </CardContent>
        </Card>
        )}

        <div className="mt-10 pt-6 border-t border-brand-purple/30 text-center">
            <Button
            variant="outline"
            onClick={() => setIsFeedbackModalOpen(true)}
            className="border-brand-pink text-brand-pink hover:bg-brand-pink/20 hover:text-white font-orbitron text-lg px-8 py-3 shadow-lg hover:shadow-pink-glow transition-all duration-300 transform hover:scale-105" 
            disabled={isSavingGeneral || isSavingArbitrage}
            >
            <VibeContentRenderer content="::FaComments className='mr-2.5'::" /> VIBE-ОТЗЫВ
            </Button>
        </div>
      </motion.div>

      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        title="Форма Нейро-Обратной Связи"
        confirmText="Отправить Сигнал"
        onConfirm={handleSendFeedback}
        icon={<VibeContentRenderer content="::FaCircleQuestion className='text-brand-pink'::" />}
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
  iconName: string; // Expects string like "FaMoon"
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
        "flex items-center justify-between p-3.5 bg-dark-bg/50 rounded-lg border border-gray-700/70 hover:border-brand-purple/60 transition-all duration-200 ease-out shadow-md hover:shadow-lg",
        isDisabled && "opacity-70 cursor-not-allowed"
      )}
    >
      <Label htmlFor={uniqueId} className={cn("flex items-center text-md flex-grow pr-4", isDisabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <span className="text-2xl mr-3.5 flex-shrink-0 w-7 text-center">
            <VibeContentRenderer content={`::${iconName}::`} />
        </span>
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