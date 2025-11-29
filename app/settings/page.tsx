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
import Modal from "@/components/ui/Modal";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { updateUserSettings as updateGeneralUserSettings } from "@/app/actions"; 
import { 
    getArbitrageScannerSettings, 
    updateArbitrageUserSettings 
} from "@/app/elon/arbitrage_scanner_actions"; 
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
import { Loading } from "@/components/Loading";
import { useTheme } from "next-themes"; // Explicit import

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

const getDefaultGeneralSettings = (): GeneralSettingsProfile => {
  const defaults: GeneralSettingsProfile = {};
  generalSettingDefinitions.forEach(s => {
    defaults[s.key] = s.key === 'experimental_alpha_protocols' ? false : true;
  });
  if (defaults['dark_mode_enabled'] === undefined) {
    defaults['dark_mode_enabled'] = true;
  }
  return defaults;
};

export default function SettingsPage() {
  const { dbUser, isLoading: isAppContextLoading, error: appContextError } = useAppContext();
  const { setTheme, resolvedTheme } = useTheme(); // Hook for theme control
  
  const [generalSettingsProfile, setGeneralSettingsProfile] = useState<GeneralSettingsProfile | null>(null);
  const [arbitrageSettings, setArbitrageSettings] = useState<ArbitrageSettings | null>(null);
  const [isLoadingArbitrageSettings, setIsLoadingArbitrageSettings] = useState(false);

  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingArbitrage, setIsSavingArbitrage] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  // --- INIT & SYNC ---
  useEffect(() => {
    if (!isAppContextLoading && dbUser) {
      logger.debug("[SettingsPage] AppContext loaded, dbUser found. Metadata:", dbUser.metadata);
      const userGeneralSettings = (dbUser.metadata?.settings_profile as GeneralSettingsProfile) || {};
      const defaultGeneral = getDefaultGeneralSettings();
      
      // Decide dark mode based on DB first, fallback to current resolved
      const isDarkInDb = userGeneralSettings.dark_mode_enabled;
      const initialDarkMode = isDarkInDb !== undefined ? isDarkInDb : (resolvedTheme === 'dark');

      const mergedGeneral = { 
          ...defaultGeneral, 
          ...userGeneralSettings,
          dark_mode_enabled: initialDarkMode 
      };

      setGeneralSettingsProfile(mergedGeneral);
      
      // Force Theme Sync
      if (initialDarkMode && resolvedTheme !== 'dark') setTheme('dark');
      if (!initialDarkMode && resolvedTheme === 'dark') setTheme('light');

    } else if (!isAppContextLoading && !dbUser) {
      logger.warn("[SettingsPage] AppContext loaded, but no dbUser. Using default general settings.");
      const defaults = getDefaultGeneralSettings();
      setGeneralSettingsProfile(defaults);
      setTheme(defaults.dark_mode_enabled ? 'dark' : 'light');
    }

    if(appContextError) {
      logger.error("[SettingsPage] AppContext error:", appContextError);
      setPageError("Ошибка загрузки данных пользователя.");
    }
  }, [dbUser, isAppContextLoading, appContextError, setTheme, resolvedTheme]);

  // --- ARBITRAGE LOADING ---
  const loadArbitrageSettings = useCallback(async () => {
    if (!dbUser?.user_id) return;
    setIsLoadingArbitrageSettings(true);
    try {
      const result = await getArbitrageScannerSettings(dbUser.user_id);
      if (result.success && result.data) {
        setArbitrageSettings(result.data);
        logger.debug("[SettingsPage] Arbitrage settings loaded:", result.data);
      } else {
        // Silent fallback or toast
        setArbitrageSettings({ ...DEFAULT_ARBITRAGE_SETTINGS }); 
      }
    } catch (error) {
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

  // --- HANDLERS ---

  const handleGeneralSettingChange = useCallback(async (settingKey: string, value: boolean) => {
    if (!generalSettingsProfile) return;

    const newSettings = { ...generalSettingsProfile, [settingKey]: value };
    setGeneralSettingsProfile(newSettings);

    // Immediate Theme Switch
    if (settingKey === 'dark_mode_enabled') {
      setTheme(value ? 'dark' : 'light');
    }

    if (!dbUser?.user_id) { 
      toast.info("Настройка применена локально (войдите для сохранения).");
      return;
    }

    const settingDef = generalSettingDefinitions.find(s => s.key === settingKey);
    const settingTitleForToast = settingDef ? settingDef.title : settingKey;

    setIsSavingGeneral(true);
    try {
      const currentMetadata = dbUser.metadata || {};
      const updatedMetadata = { ...currentMetadata, settings_profile: newSettings }; 
      const result = await updateGeneralUserSettings(dbUser.user_id, updatedMetadata);
      if (result.success) {
        toast.success(`${settingTitleForToast}: ${value ? "ВКЛ" : "ВЫКЛ"}`);
      } else {
        toast.error(`Ошибка сохранения: ${result.error}`);
        // Revert
        setGeneralSettingsProfile(prev => ({ ...prev!, [settingKey]: !value }));
        if (settingKey === 'dark_mode_enabled') setTheme(!value ? 'dark' : 'light');
      }
    } catch (e) {
      toast.error("Критическая ошибка при сохранении.");
      setGeneralSettingsProfile(prev => ({ ...prev!, [settingKey]: !value }));
    } finally {
      setIsSavingGeneral(false);
    }
  }, [generalSettingsProfile, dbUser, setTheme]);

  // Arbitrage Handlers (Restored from previous context)
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
      toast.error("Нет данных для сохранения.");
      return;
    }
    setIsSavingArbitrage(true);
    try {
      const result = await updateArbitrageUserSettings(dbUser.user_id, arbitrageSettings);
      if (result.success) {
        toast.success("Настройки арбитража сохранены!");
        if (result.data) setArbitrageSettings(result.data);
      } else {
        toast.error("Ошибка сохранения: " + result.error);
      }
    } catch (error) {
      toast.error("Сбой сети при сохранении.");
    }
    setIsSavingArbitrage(false);
  };
  
  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim()) {
        toast.error("Пустое сообщение.");
        return;
    }
    logger.log("Feedback submitted:", { userId: dbUser?.user_id, message: feedbackMessage });
    toast.success("Отзыв отправлен!");
    setFeedbackMessage("");
    setIsFeedbackModalOpen(false);
  };

  if (isAppContextLoading || generalSettingsProfile === null) {
    return <Loading text="ЗАГРУЗКА ПРОФИЛЯ..." />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pt-24 pb-10 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="container mx-auto max-w-3xl space-y-8"
      >
        {/* GENERAL SETTINGS */}
        <Card className="border-border bg-card shadow-md"> 
          <CardHeader className="text-center p-6 border-b border-border">
            <VibeContentRenderer content="::FaUserGear className='text-6xl text-primary mx-auto mb-4'::" />
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

        {/* ARBITRAGE SETTINGS (Conditional) */}
        {generalSettingsProfile.experimental_alpha_protocols && arbitrageSettings && (
        <Card className="border-border bg-card shadow-md border-t-4 border-t-brand-cyan">
            <CardHeader className="text-center p-6 border-b border-border">
                <VibeContentRenderer content="::FaRobot className='text-6xl text-brand-cyan mx-auto mb-4'::" />
                <CardTitle className="text-3xl font-orbitron font-bold text-brand-cyan">
                    ARBITRAGE SEEKER
                </CardTitle>
                <CardDescription>Конфигурация Альфа-Сканера.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
                {/* Inputs Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="arbMinSpread" className="text-brand-cyan font-orbitron mb-2 block">
                            <VibeContentRenderer content="::FaPercent className='inline mr-1.5'::" />Мин. Спред (%)
                        </Label>
                        <Input id="arbMinSpread" type="number" step="0.01" value={arbitrageSettings.minSpreadPercent} onChange={e => handleArbitrageSettingChange('minSpreadPercent', e.target.value)} className="input-cyber" disabled={isSavingArbitrage}/>
                    </div>
                    <div>
                        <Label htmlFor="arbTradeVolume" className="text-brand-cyan font-orbitron mb-2 block">
                           <VibeContentRenderer content="::FaDollarSign className='inline mr-1.5'::" />Объем (USD)
                        </Label>
                        <Input id="arbTradeVolume" type="number" step="100" value={arbitrageSettings.defaultTradeVolumeUSD} onChange={e => handleArbitrageSettingChange('defaultTradeVolumeUSD', e.target.value)} className="input-cyber" disabled={isSavingArbitrage}/>
                    </div>
                </div>
                
                {/* Exchanges */}
                <div>
                    <Label className="text-brand-cyan font-orbitron mb-2 block">
                        <VibeContentRenderer content="::FaRightLeft className='inline mr-1.5'::" />Активные Биржи
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {ALL_POSSIBLE_EXCHANGES_CONST.map(ex => (
                            <div key={ex} className="flex items-center space-x-2 p-2 bg-accent/20 rounded border border-border">
                                <Checkbox id={`arbEx-${ex}`} checked={arbitrageSettings.enabledExchanges.includes(ex)} onCheckedChange={(checked) => handleArbitrageExchangeEnabledToggle(ex, !!checked)} className="border-primary data-[state=checked]:bg-primary" disabled={isSavingArbitrage}/>
                                <Label htmlFor={`arbEx-${ex}`} className="text-sm font-medium leading-none">{ex}</Label>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pairs */}
                <div>
                    <Label htmlFor="arbTrackedPairs" className="text-brand-cyan font-orbitron mb-2 block">
                        <VibeContentRenderer content="::FaListUl className='inline mr-1.5'::" />Отслеживаемые Пары
                    </Label>
                    <Input id="arbTrackedPairs" type="text" value={arbitrageSettings.trackedPairs.join(', ')} onChange={handleArbitrageTrackedPairChange} placeholder="BTC/USDT, ETH/USDT" className="input-cyber" disabled={isSavingArbitrage}/>
                </div>
                
                {/* Fees Sections (Collapsed in ScrollAreas) */}
                <div className="space-y-2">
                    <h4 className="text-lg font-orbitron text-brand-cyan">
                        <VibeContentRenderer content="::FaCoins className='inline mr-1.5'::" />Комиссии Бирж (%)
                    </h4>
                    <ScrollArea className="h-[200px] p-2 border border-border rounded-md bg-accent/10">
                        <div className="space-y-3 pr-2">
                        {ALL_POSSIBLE_EXCHANGES_CONST.map(ex => (
                            <div key={`arbFee-${ex}`} className="p-2.5 bg-card rounded-md border border-border">
                                <p className="text-sm font-semibold text-primary mb-1.5">{ex}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label htmlFor={`arbFee-${ex}-maker`} className="text-xs text-muted-foreground">Maker</Label>
                                        <Input id={`arbFee-${ex}-maker`} type="number" step="0.001" 
                                            value={((arbitrageSettings.exchangeFees[ex]?.maker || 0) * 100).toFixed(4)}
                                            onChange={e => handleArbitrageExchangeFeeChange(ex, 'maker', e.target.value)}
                                            className="input-cyber text-xs h-8" disabled={isSavingArbitrage}/>
                                    </div>
                                    <div>
                                        <Label htmlFor={`arbFee-${ex}-taker`} className="text-xs text-muted-foreground">Taker</Label>
                                        <Input id={`arbFee-${ex}-taker`} type="number" step="0.001" 
                                            value={((arbitrageSettings.exchangeFees[ex]?.taker || 0) * 100).toFixed(4)}
                                            onChange={e => handleArbitrageExchangeFeeChange(ex, 'taker', e.target.value)}
                                            className="input-cyber text-xs h-8" disabled={isSavingArbitrage}/>
                                    </div>
                                </div>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                </div>

                <Button onClick={handleSaveArbitrageSettings} disabled={isSavingArbitrage} className="w-full bg-brand-cyan text-black hover:bg-brand-cyan/90">
                    {isSavingArbitrage ? "Сохранение..." : <><VibeContentRenderer content="::FaSave className='mr-2'::" /> Сохранить Настройки</>}
                </Button>
            </CardContent>
        </Card>
        )}

        {/* FEEDBACK */}
        <div className="mt-10 pt-6 border-t border-border text-center">
            <Button
            variant="outline"
            onClick={() => setIsFeedbackModalOpen(true)}
            className="border-brand-pink text-brand-pink hover:bg-brand-pink/20 font-orbitron text-lg px-8 py-3 shadow-lg hover:shadow-pink-glow transition-all" 
            disabled={isSavingGeneral}
            >
            <VibeContentRenderer content="::FaComments className='mr-2.5'::" /> VIBE-ОТЗЫВ
            </Button>
        </div>
      </motion.div>

      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        title="Форма Нейро-Обратной Связи"
        confirmText="Отправить"
        onConfirm={handleSendFeedback}
        icon={<VibeContentRenderer content="::FaCircleQuestion className='text-brand-pink'::" />}
        dialogClassName="bg-card border-brand-pink"
        titleClassName="text-brand-pink"
      >
        <p className="mb-3 font-mono text-sm text-muted-foreground">Твои мысли – топливо для эволюции.</p>
        <Textarea
          value={feedbackMessage}
          onChange={(e) => setFeedbackMessage(e.target.value)}
          placeholder="Пиши сюда..."
          rows={5}
          className="textarea-cyber" 
        />
      </Modal>
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