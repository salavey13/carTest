"use client";
import { useEffect, useState } from "react";
import { getTasks, createTask } from "@/app/youtube_actions/actions";
import Link from "next/link";

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({ title: "", description: "" });

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await getTasks();
        setTasks(data);
      } catch (error) {
        console.error("Ошибка при загрузке задач:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const task = await createTask({
        title: newTask.title,
        description: newTask.description,
        status: "todo",
      });
      setTasks([task, ...tasks]);
      setNewTask({ title: "", description: "" });
    } catch (error) {
      console.error("Ошибка при создании задачи:", error);
    }
  };

  if (loading) return <p className="text-center text-muted-foreground animate-pulse-slow">Загрузка...</p>;

  return (
    <div className="container mx-auto p-4 pt-24 bg-background min-h-screen">
      <h1 className="text-3xl font-bold text-primary mb-6 animate-glitch text-glow">Задачи</h1>
      <form onSubmit={handleCreateTask} className="mb-8 space-y-4 max-w-lg mx-auto">
        <input
          type="text"
          placeholder="Название задачи"
          value={newTask.title}
          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
          className="border border-muted p-3 w-full bg-card text-foreground rounded shadow-glow"
        />
        <textarea
          placeholder="Описание"
          value={newTask.description}
          onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
          className="border border-muted p-3 w-full bg-card text-foreground rounded shadow-glow"
        />
        <button type="submit" className="bg-primary text-primary-foreground p-3 rounded shadow-glow hover:shadow-glow">
          Добавить задачу
        </button>
      </form>
      <ul className="space-y-4">
        {tasks.map((task) => (
          <li key={task.id} className="p-4 bg-card rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold text-secondary">{task.title}</h2>
            <p className="text-muted-foreground">{task.description}</p>
            <p className="text-sm text-muted">Статус: {task.status}</p>
            {task.deadline && <p className="text-sm text-muted">Дедлайн: {task.deadline}</p>}
          </li>
        ))}
      </ul>
      <nav className="mt-8 flex justify-center space-x-4">
        <Link href="/yt" className="text-primary hover:underline">Персонажи</Link>
        <Link href="/youtubeAdmin" className="text-primary hover:underline">Админ YouTube</Link>
      </nav>
    </div>
  );
}