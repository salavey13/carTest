"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useRouter } from "next/navigation";
import { uploadVideoToYouTube, getYouTubeAnalytics } from "@/app/youtube_actions/actions";
import { toast } from "sonner";
import Link from "next/link";

export default function YouTubeAdminPage() {
  const { dbUser, isAdmin } = useAppContext();
  const router = useRouter();
  const [isAdminChecked, setIsAdminChecked] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [analytics, setAnalytics] = useState<any[]>([]);

  useEffect(() => {
    if (dbUser) {
      const adminStatus = isAdmin();
      setIsAdminChecked(adminStatus);
      setIsLoading(false);
      if (!adminStatus) router.push("/");
    }
  }, [dbUser, isAdmin, router]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await getYouTubeAnalytics();
        setAnalytics(data);
      } catch (error) {
        console.error("Ошибка при загрузке аналитики:", error);
        toast.error("Не удалось загрузить аналитику");
      }
    };
    if (isAdminChecked) fetchAnalytics();
  }, [isAdminChecked]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Пожалуйста, выберите видеофайл");

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("tags", tags);

    const result = await uploadVideoToYouTube(formData);
    if (result.success) {
      toast.success("Видео успешно загружено!");
      setFile(null);
      setTitle("");
      setDescription("");
      setTags("");
    } else {
      toast.error("Ошибка загрузки: " + result.error);
    }
  };

  if (isLoading) return <p className="text-center text-muted-foreground animate-pulse-slow">Загрузка...</p>;
  if (!isAdminChecked) return null;

  return (
    <div className="container mx-auto p-4 pt-24 bg-background min-h-screen">
      <h1 className="text-3xl font-bold text-primary mb-6 animate-glitch text-glow">Панель управления YouTube</h1>
      <form onSubmit={handleUpload} className="space-y-6 mb-8 max-w-lg mx-auto">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="border border-muted p-3 w-full bg-card text-foreground rounded shadow-glow"
        />
        <input
          type="text"
          placeholder="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border border-muted p-3 w-full bg-card text-foreground rounded shadow-glow"
        />
        <textarea
          placeholder="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          ClassName="border border-muted p-3 w-full bg-card text-foreground rounded shadow-glow"
        />
        <input
          type="text"
          placeholder="Теги (через запятую)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="border border-muted p-3 w-full bg-card text-foreground rounded shadow-glow"
        />
        <button type="submit" className="bg-primary text-primary-foreground p-3 rounded shadow-glow hover:shadow-glow">
          Загрузить видео
        </button>
      </form>
      <h2 className="text-2xl font-semibold text-secondary mb-4 text-glow">Аналитика YouTube</h2>
      {analytics.length > 0 ? (
        <ul className="space-y-4">
          {analytics.map((item) => (
            <li key={item.videoId} className="p-4 bg-card rounded-lg shadow-lg">
              <p className="text-muted-foreground">Видео ID: {item.videoId}</p>
              <p className="text-muted-foreground">Просмотры: {item.views}</p>
              <p className="text-muted-foreground">Лайки: {item.likes}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground animate-pulse-slow">Данные аналитики отсутствуют.</p>
      )}
      <div className="mt-8 p-4 bg-card rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold text-secondary mb-2">Кастомизация страниц</h3>
        <p className="text-muted-foreground mb-4">
          Для интеграции внешних данных и AI вы можете использовать страницу <code>/repo-xml</code> как пример.
        </p>
        <Link href="/repo-xml" className="bg-secondary text-secondary-foreground p-2 rounded shadow-glow hover:shadow-glow">
          Перейти к /repo-xml
        </Link>
      </div>
      <nav className="mt-8 flex justify-center space-x-4">
        <Link href="/yt" className="text-primary hover:underline">Персонажи</Link>
        <Link href="/tasks" className="text-primary hover:underline">Задачи</Link>
      </nav>
    </div>
  );
}