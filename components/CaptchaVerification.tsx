"use client";

import { useState, useEffect, useRef } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin } from "@/hooks/supabase";
import { toast } from "sonner";
import { Loader2, Trophy } from "lucide-react";
import { notifyCaptchaSuccess, notifySuccessfulUsers } from "@/app/actions";

interface CaptchaSettings {
  string_length: number;
  character_set: "letters" | "numbers" | "both";
  case_sensitive: boolean;
  noise_level: number; // 0-100 (dots count)
  font_size: number; // 20-50
  background_color: string; // Hex code
  text_color: string; // Hex code
  distortion: number; // 0-1 (rotation intensity)
}

interface CaptchaVerificationProps {
  onCaptchaSuccess: () => void;
}

export default function CaptchaVerification({ onCaptchaSuccess }: CaptchaVerificationProps) {
  const { dbUser, isLoading, isAdmin } = useTelegram();
  const [settings, setSettings] = useState<CaptchaSettings | null>(null);
  const [editingSettings, setEditingSettings] = useState<CaptchaSettings | null>(null);
  const [captchaText, setCaptchaText] = useState<string>("");
  const [userInput, setUserInput] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [successfulUsers, setSuccessfulUsers] = useState<any[]>([]);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate and draw CAPTCHA
  const generateCaptcha = () => {
    if (!settings || !canvasRef.current) return;

    const chars =
      settings.character_set === "letters"
        ? "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
        : settings.character_set === "numbers"
        ? "0123456789"
        : "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const text = Array.from(
      { length: settings.string_length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    canvas.width = Math.max(200, settings.string_length * 30 + 60);

    // Background
    ctx.fillStyle = settings.background_color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw distorted text
    ctx.font = `${settings.font_size}px Arial`;
    ctx.fillStyle = settings.text_color;
    for (let i = 0; i < text.length; i++) {
      ctx.save();
      ctx.translate(30 + i * 30, canvas.height / 2 + settings.font_size / 2);
      ctx.rotate((Math.random() - 0.5) * settings.distortion);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }

    // Add noise
    for (let i = 0; i < settings.noise_level; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1, 0, 2 * Math.PI);
      ctx.fillStyle = "#999";
      ctx.fill();
    }

    setCaptchaText(text);
  };

  // Fetch settings and generate initial CAPTCHA
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabaseAdmin
          .from("settings")
          .select("string_length, character_set, case_sensitive, noise_level, font_size, background_color, text_color, distortion")
          .eq("id", 1)
          .single();
        if (error) throw error;

        const defaultSettings: CaptchaSettings = {
          string_length: 4,
          character_set: "both",
          case_sensitive: false,
          noise_level: 50,
          font_size: 30,
          background_color: "#f0f0f0",
          text_color: "#333333",
          distortion: 0.4,
          ...data,
        };

        setSettings(defaultSettings);
        setEditingSettings(defaultSettings);
        setIsSettingsLoaded(true);
      } catch (err) {
        console.error("Ошибка загрузки настроек:", err);
        toast.error("Не удалось загрузить настройки CAPTCHA.");
        setIsSettingsLoaded(true);
      }
    };
    fetchSettings();
  }, []);

  // Draw CAPTCHA when settings are loaded
  useEffect(() => {
    if (isSettingsLoaded && settings) {
      generateCaptcha();
    }
  }, [isSettingsLoaded, settings]);

  // Check if user has already completed CAPTCHA
  useEffect(() => {
    if (dbUser && !isLoading) {
      const metadata = dbUser.metadata as any;
      if (metadata?.captchaSuccess) {
        setIsSuccess(true);
        onCaptchaSuccess();
      }
    }
  }, [dbUser, isLoading, onCaptchaSuccess]);

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

  // Handle CAPTCHA submission
  const handleSubmit = async () => {
    if (!settings || !dbUser) return;

    const userInputToCheck = settings.case_sensitive ? userInput : userInput.toLowerCase();
    const captchaToCheck = settings.case_sensitive ? captchaText : captchaText.toLowerCase();

    if (userInputToCheck === captchaToCheck) {
      try {
        const currentMetadata = dbUser.metadata || {};
        const updatedMetadata = { ...currentMetadata, captchaSuccess: true };
        const { error } = await supabaseAdmin
          .from("users")
          .update({ metadata: updatedMetadata })
          .eq("user_id", dbUser.user_id);
        if (error) throw error;

        setIsSuccess(true);
        onCaptchaSuccess();
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

  // Handle refreshing CAPTCHA
  const handleRefreshCaptcha = () => {
    generateCaptcha();
    setUserInput("");
    setError("");
  };

  // Handle saving settings in admin panel
  const handleSaveSettings = async () => {
    if (!editingSettings) return;
    try {
      await supabaseAdmin.from("settings").update(editingSettings).eq("id", 1);
      setSettings(editingSettings);
      generateCaptcha();
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

  if (isLoading || !isSettingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-green-900 mt-6">
        <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
      </div>
    );
  }

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
              <canvas ref={canvasRef} height={60} className="mt-2 rounded-md" />
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
              <label className="block mb-2">
                Уровень шума (0-100):
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editingSettings?.noise_level || 50}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      noise_level: parseInt(e.target.value),
                    })
                  }
                  className="w-full p-2 mt-1 border border-green-600 bg-green-900 text-white rounded-md"
                />
              </label>
              <label className="block mb-2">
                Размер шрифта (20-50):
                <input
                  type="number"
                  min="20"
                  max="50"
                  value={editingSettings?.font_size || 30}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      font_size: parseInt(e.target.value),
                    })
                  }
                  className="w-full p-2 mt-1 border border-green-600 bg-green-900 text-white rounded-md"
                />
              </label>
              <label className="block mb-2">
                Цвет фона:
                <input
                  type="color"
                  value={editingSettings?.background_color || "#f0f0f0"}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      background_color: e.target.value,
                    })
                  }
                  className="w-full h-10 mt-1 border border-green-600 bg-green-900 rounded-md"
                />
              </label>
              <label className="block mb-2">
                Цвет текста:
                <input
                  type="color"
                  value={editingSettings?.text_color || "#333333"}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      text_color: e.target.value,
                    })
                  }
                  className="w-full h-10 mt-1 border border-green-600 bg-green-900 rounded-md"
                />
              </label>
              <label className="block mb-2">
                Искажение (0-1):
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={editingSettings?.distortion || 0.4}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings!,
                      distortion: parseFloat(e.target.value),
                    })
                  }
                  className="w-full p-2 mt-1 border border-green-600 bg-green-900 text-white rounded-md"
                />
              </label>
              <button
                onClick={handleSaveSettings}
                className="mt-4 px-6 py-3 bg-yellow-400 text-green-900 rounded-full font-bold text-lg flex items-center justify-center gap-2 mx-auto hover:bg-yellow-300"
              >
                Сохранить настройки
              </button>
            </div>

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
