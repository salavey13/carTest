// /app/settings/page.tsx
"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch"; // Assuming you have a Switch component
import { Label } from "@/components/ui/label"; // Assuming you have a Label component
import { FaBell, FaTint, FaMoon, FaQuestionCircle, FaEnvelope } from "react-icons/fa";
import Modal from "@/components/ui/Modal"; // Import the Modal component
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";

export default function SettingsPage() {
  const { dbUser, isLoading } = useAppContext(); // Example: loading user settings

  // Initialize states from dbUser.metadata or defaults
  const [notificationsEnabled, setNotificationsEnabled] = useState(dbUser?.metadata?.notifications_enabled ?? true);
  const [waterRemindersEnabled, setWaterRemindersEnabled] = useState(dbUser?.metadata?.water_reminders_enabled ?? true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(dbUser?.metadata?.dark_mode_enabled ?? true); // Assuming dark mode is default
  const [promotionalMessagesEnabled, setPromotionalMessagesEnabled] = useState(dbUser?.metadata?.promotional_messages_enabled ?? false);

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const handleSettingChange = (setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean, settingName: string) => {
    setter(value);
    toast.success(`Настройка "${settingName}" ${value ? "включена" : "выключена"}`);
    // Here you would typically save this to the backend using an action
    // e.g., updateUserSetting(userId, { [settingName]: value });
    console.log(`Setting ${settingName} changed to ${value}`);
  };

  const handleSendFeedback = () => {
    if (!feedbackMessage.trim()) {
        toast.error("Сообщение обратной связи не может быть пустым.");
        return;
    }
    // Logic to send feedback
    console.log("Feedback submitted:", feedbackMessage);
    toast.success("Спасибо за ваш отзыв!");
    setFeedbackMessage("");
    setIsFeedbackModalOpen(false);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-brand-green animate-pulse">Загрузка настроек...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-2xl"
      >
        <Card className="bg-card/80 backdrop-blur-md border-border shadow-xl">
          <CardHeader className="text-center">
            <FaTools className="text-5xl text-brand-purple mx-auto mb-3 drop-shadow-lg" />
            <CardTitle className="text-3xl font-bold text-brand-purple cyber-text">
              Настройки
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {/* Notification Settings */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border-border">
              <Label htmlFor="notifications-switch" className="flex items-center text-lg">
                <FaBell className="mr-3 text-brand-green" /> Уведомления о тренировках
              </Label>
              <Switch
                id="notifications-switch"
                checked={notificationsEnabled}
                onCheckedChange={(value) => handleSettingChange(setNotificationsEnabled, value, "Уведомления о тренировках")}
                className="data-[state=checked]:bg-brand-green"
              />
            </div>

            {/* Water Reminders */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border-border">
              <Label htmlFor="water-reminders-switch" className="flex items-center text-lg">
                <FaTint className="mr-3 text-brand-blue" /> Напоминания о воде
              </Label>
              <Switch
                id="water-reminders-switch"
                checked={waterRemindersEnabled}
                onCheckedChange={(value) => handleSettingChange(setWaterRemindersEnabled, value, "Напоминания о воде")}
                className="data-[state=checked]:bg-brand-blue"
              />
            </div>
            
            {/* Dark Mode */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border-border">
              <Label htmlFor="dark-mode-switch" className="flex items-center text-lg">
                <FaMoon className="mr-3 text-brand-purple" /> Темная тема
              </Label>
              <Switch
                id="dark-mode-switch"
                checked={darkModeEnabled}
                onCheckedChange={(value) => {
                  handleSettingChange(setDarkModeEnabled, value, "Темная тема");
                  // Add logic to actually toggle dark mode theme if not handled globally by OS preference
                  document.documentElement.classList.toggle('dark', value);
                }}
                className="data-[state=checked]:bg-brand-purple"
              />
            </div>

            {/* Promotional Messages */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border-border">
              <Label htmlFor="promo-switch" className="flex items-center text-lg">
                <FaEnvelope className="mr-3 text-brand-orange" /> Рекламные сообщения
              </Label>
              <Switch
                id="promo-switch"
                checked={promotionalMessagesEnabled}
                onCheckedChange={(value) => handleSettingChange(setPromotionalMessagesEnabled, value, "Рекламные сообщения")}
                className="data-[state=checked]:bg-brand-orange"
              />
            </div>

            {/* Feedback Button */}
            <div className="mt-8 text-center">
              <Button 
                variant="outline" 
                onClick={() => setIsFeedbackModalOpen(true)}
                className="border-brand-pink text-brand-pink hover:bg-brand-pink/10 hover:text-brand-pink font-mono text-lg px-8 py-3"
              >
                <FaQuestionCircle className="mr-2" /> Обратная связь
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        title="Обратная связь"
        confirmText="Отправить"
        onConfirm={handleSendFeedback}
      >
        <p className="mb-3">Поделитесь вашими идеями или сообщите о проблеме. Мы ценим ваш вклад!</p>
        <textarea
          value={feedbackMessage}
          onChange={(e) => setFeedbackMessage(e.target.value)}
          placeholder="Ваше сообщение..."
          rows={4}
          className="w-full p-2 rounded-md bg-input border border-border text-foreground focus:ring-brand-pink focus:border-brand-pink"
        />
      </Modal>
    </div>
  );
}