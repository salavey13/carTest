"use client";

import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin } from "@/hooks/supabase";
import { toast } from "sonner";
import { Loader2, Trophy } from "lucide-react";
import { notifyCaptchaSuccess, notifySuccessfulUsers, generateCaptchaImage } from "@/app/actions";
// Add the prop type
interface CaptchaVerificationProps {
  onCaptchaSuccess: () => void;
}
export default function CaptchaVerification({ onCaptchaSuccess }: CaptchaVerificationProps) {
  const { dbUser, isLoading, isAdmin } = useTelegram();
  const [settings, setSettings] = useState<{
    string_length: number;
    character_set: "letters" | "numbers" | "both";
    case_sensitive: boolean;
  } | null>(null);
  const [editingSettings, setEditingSettings] = useState(settings);
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [captchaString, setCaptchaString] = useState(""); // Hidden text for verification
  const [userInput, setUserInput] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [successfulUsers, setSuccessfulUsers] = useState<any[]>([]);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  // Fetch settings and generate initial CAPTCHA image on mount
  useEffect(() => {
    const fetchSettingsAndImage = async () => {
      try {
        const { data, error } = await supabaseAdmin
          .from("settings")
          .select("string_length, character_set, case_sensitive")
          .eq("id", 1)
          .single();
        if (error) throw error;

        setSettings(data);
        setEditingSettings(data);

        const { image, text } = await generateCaptchaImage(data.string_length, data.character_set);
        setCaptchaImage(image);
        setCaptchaString(text);
        setIsSettingsLoaded(true);
      } catch (err) {
        console.error("Ошибка загрузки настроек или CAPTCHA:", err);
        toast.error("Не удалось загрузить CAPTCHA.");
        setIsSettingsLoaded(true); // Proceed even if it fails
      }
    };
    fetchSettingsAndImage();
  }, []);

  // Check if user has already completed CAPTCHA
  useEffect(() => {
    if (dbUser && !isLoading) {
      const metadata = dbUser.metadata as any;
      if (metadata?.captchaSuccess) {
        setIsSuccess(true);
      }
    }
  }, [dbUser, isLoading]);

  // Fetch successful users for admin panel
  useEffect(() => {
    if (isAdmin()) {
      const fetchSuccessfulUsers = async () => {
        try {
          const { data, error } = await supabaseAdmin
            .from("users")
            .select("*")
            .filter("metadata->captchaSuccess", "eq", true);
          if (error) throw error;
          setSuccessfulUsers(data || []);
        } catch (err) {
          console.error("Ошибка загрузки пользователей:", err);
          toast.error("Не удалось загрузить пользователей, прошедших CAPTCHA.");
        }
      };
      fetchSuccessfulUsers();
    }
  }, [isAdmin]);

  // Update handleSubmit to call onCaptchaSuccess
  const handleSubmit = async () => {
    if (!settings || !dbUser) return;

    const userInputToCheck = settings.case_sensitive ? userInput : userInput.toLowerCase();
    const captchaToCheck = settings.case_sensitive ? captchaString : captchaString.toLowerCase();

    if (userInputToCheck === captchaToCheck) {
      try {
        const currentMetadata = dbUser.metadata || {};
        const updatedMetadata = {
          ...currentMetadata,
          captchaSuccess: true,
        };
        const { error } = await supabaseAdmin
          .from("users")
          .update({ metadata: updatedMetadata })
          .eq("user_id", dbUser.user_id);
        if (error) throw error;

        setIsSuccess(true);
        onCaptchaSuccess(); // Call the callback to notify the parent
        toast.success("CAPTCHA успешно пройдена!");

        const notifyResult = await notifyCaptchaSuccess(dbUser.user_id, dbUser.username);
        if (!notifyResult.success) {
          console.error("Ошибка уведомления админов:", notifyResult.error);
          toast.error("Не удалось уведомить админов.");
        }
      } catch (err) {
        console.error("Ошибка обновления метаданных:", err);
        toast.error("Не удалось обновить статус. Попробуйте снова.");
      }
    } else {
      setError("Неверная CAPTCHA. Попробуйте снова.");
      setUserInput("");
    }
  };

  // Handle refreshing CAPTCHA image
  const handleRefreshCaptcha = async () => {
    if (!settings) return;
    try {
      const { image, text } = await generateCaptchaImage(settings.string_length, settings.character_set);
      setCaptchaImage(image);
      setCaptchaString(text);
      setUserInput("");
      setError("");
    } catch (err) {
      console.error("Ошибка обновления CAPTCHA:", err);
      toast.error("Не удалось обновить CAPTCHA.");
    }
  };

  // Handle saving settings in admin panel
  const handleSaveSettings = async () => {
    if (!editingSettings) return;
    try {
      await supabaseAdmin.from("settings").update(editingSettings).eq("id", 1);
      setSettings(editingSettings);
      const { image, text } = await generateCaptchaImage(editingSettings.string_length, editingSettings.character_set);
      setCaptchaImage(image);
      setCaptchaString(text);
      toast.success("Настройки успешно обновлены!");
    } catch (err) {
      console.error("Ошибка обновления настроек:", err);
      toast.error("Не удалось обновить настройки. Попробуйте снова.");
    }
  };

  // Handle sending notifications to successful users
  const handleNotify = async () => {
    if (successfulUsers.length === 0) return;

    try {
      const userIds = successfulUsers.map((user) => user.user_id);
      const notifyResult = await notifySuccessfulUsers(userIds);
      if (notifyResult.success) {
        toast.success("Уведомления успешно отправлены!");
      } else {
        throw new Error(notifyResult.error);
      }
    } catch (err) {
      console.error("Ошибка отправки уведомлений:", err);
      toast.error("Не удалось отправить уведомления. Попробуйте снова.");
    }
  };

  // Loading state
  if (isLoading || !isSettingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-green-900 mt-6">
        <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
      </div>
    );
  }

  // Login check
  if (!dbUser) {
    return (
      <div className="text-center p-8 bg-green-800 text-white rounded-lg mt-6">
        <h2 className="text-2xl font-bold mb-4">Пожалуйста, Войдите</h2>
        <p>Вам нужно войти, чтобы использовать CAPTCHA.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 pt-24 bg-green-900 min-h-screen text-white">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Проверка CAPTCHA</h1>
        <p className="text-lg text-green-200">Пройдите CAPTCHA, чтобы продолжить.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-16 items-center justify-center">
        <div className="flex flex-col items-center">
          {isSuccess ? (
            <div className="mt-4 p-3 bg-green-800 rounded-lg inline-block">
              <p className="text-lg">CAPTCHA успешно пройдена!</p>
            </div>
          ) : (
            <div className="captcha-challenge">
              <p>Пожалуйста, введите текст с изображения:</p>
              {captchaImage && <img src={captchaImage} alt="CAPTCHA" className="mt-2 rounded-md" />}
              <button
                onClick={handleRefreshCaptcha}
                className="mt-2 text-yellow-400 underline hover:text-yellow-300"
              >
                Обновить CAPTCHA
              </button>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Введите CAPTCHA здесь"
                className="w-full p-2 mt-2 border border-green-600 bg-green-900 text-white rounded-md placeholder-green-300"
              />
              <button
                onClick={handleSubmit}
                className="mt-4 px-6 py-3 bg-yellow-400 text-green-900 rounded-full font-bold text-lg flex items-center justify-center gap-2 mx-auto hover:bg-yellow-300"
              >
                Отправить
              </button>
              {error && <p className="text-red-400 mt-2">{error}</p>}
            </div>
          )}
        </div>

        {isAdmin() && (
          <div className="bg-green-800 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              Панель Администратора
            </h2>

            {/* CAPTCHA Settings */}
            <div className="settings-section mb-6">
              <h3 className="text-lg font-semibold mb-2">Настройки CAPTCHA</h3>
              <label className="block mb-2">
                Длина строки:
                <input
                  type="number"
                  min="4"
                  max="8"
                  value={editingSettings?.string_length || 4}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      string_length: parseInt(e.target.value),
                    })
                  }
                  className="w-full p-2 mt-1 border border-green-600 bg-green-900 text-white rounded-md"
                />
              </label>
              <label className="block mb-2">
                Набор символов:
                <select
                  value={editingSettings?.character_set || "both"}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      character_set: e.target.value as "letters" | "numbers" | "both",
                    })
                  }
                  className="w-full p-2 mt-1 border border-green-600 bg-green-900 text-white rounded-md"
                >
                  <option value="letters">Буквы</option>
                  <option value="numbers">Цифры</option>
                  <option value="both">Буквы и цифры</option>
                </select>
              </label>
              <label className="block mb-2">
                Чувствительность к регистру:
                <select
                  value={editingSettings?.case_sensitive ? "true" : "false"}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      case_sensitive: e.target.value === "true",
                    })
                  }
                  className="w-full p-2 mt-1 border border-green-600 bg-green-900 text-white rounded-md"
                >
                  <option value="true">Да</option>
                  <option value="false">Нет</option>
                </select>
              </label>
              <button
                onClick={handleSaveSettings}
                className="mt-4 px-6 py-3 bg-yellow-400 text-green-900 rounded-full font-bold text-lg flex items-center justify-center gap-2 mx-auto hover:bg-yellow-300"
              >
                Сохранить настройки
              </button>
            </div>

            {/* Success Checker */}
            <div className="success-checker">
              <h3 className="text-lg font-semibold mb-2">Пользователи, прошедшие CAPTCHA</h3>
              {successfulUsers.length > 0 ? (
                <>
                  <div className="max-h-60 overflow-y-auto bg-green-900 rounded-md p-2">
                    {successfulUsers.map((user) => (
                      <div key={user.user_id} className="p-2 border-b border-green-700 last:border-b-0">
                        <p className="font-medium">{user.full_name || user.username || user.user_id}</p>
                        <p className="text-sm text-green-300">ID: {user.user_id}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleNotify}
                    className="mt-4 px-6 py-3 bg-yellow-400 text-green-900 rounded-full font-bold text-lg flex items-center justify-center gap-2 mx-auto hover:bg-yellow-300"
                  >
                    Уведомить пользователей
                  </button>
                </>
              ) : (
                <p>Пока нет пользователей, прошедших CAPTCHA.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
