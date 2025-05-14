"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAdmin } from "@/hooks/supabase";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FaYoutube, FaCircleCheck, FaClock, FaCalendarDays, FaPlus, FaPencil, FaTrash, FaDumbbell, FaExclamationTriangle, FaThList
} from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label"; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const notifyYtTeam = async (message: string) => {
  try {
    const { data: ytTeamMembers, error } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("role", "ytTeam");

    if (error) throw error;
    for (const member of ytTeamMembers) {
      console.log(`Notifying ${member.user_id}: ${message}`);
    }
  } catch (error) {
    console.error("Error notifying ytTeam:", error);
  }
};

export default function TasksPage() {
  const { user, isAdmin } = useAppContext();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    deadline: "",
    priority: "medium"
  });
  const [editingTask, setEditingTask] = useState<any>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
          const { data, error } = await supabaseAdmin
            .from("tasks")
            .select("*")
            .order("created_at", { ascending: false });
          if (error) {
            toast.error("Ошибка загрузки директив");
            console.error("Task fetch error:", error);
          } else {
            setTasks(data || []);
          }
      } catch(e) {
          toast.error("Непредвиденная ошибка при загрузке директив.");
          console.error("Task fetch exception:", e);
      } finally {
         setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin()) {
      toast.error("Только Администраторы могут создавать директивы");
      return;
    }
    try {
      const taskData = {
        title: newTask.title,
        description: newTask.description,
        status: "todo",
        deadline: newTask.deadline || null,
        priority: newTask.priority,
        assigned_to: user?.id.toString(), 
        created_at: new Date().toISOString(),
      };
      const { data: task, error } = await supabaseAdmin
        .from("tasks")
        .insert(taskData)
        .select()
        .single();
      if (error) throw error;
      setTasks([task, ...tasks]);
      setNewTask({ title: "", description: "", deadline: "", priority: "medium" });
      toast.success("Директива создана!");
      await notifyYtTeam(`Новая директива: ${task.title}`);
    } catch (error: any) {
      toast.error(`Ошибка создания директивы: ${error.message}`);
      console.error("Create task error:", error);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    if (!isAdmin()) {
      toast.error("Только Администраторы могут изменять директивы");
      return;
    }
    try {
      const { data: task, error } = await supabaseAdmin
        .from("tasks")
        .update({
          title: editingTask.title,
          description: editingTask.description,
          deadline: editingTask.deadline || null, 
          priority: editingTask.priority,
          status: editingTask.status
        })
        .eq("id", editingTask.id)
        .select()
        .single();
      if (error) throw error;
      setTasks(tasks.map(t => t.id === task.id ? task : t));
      setEditingTask(null); 
      toast.success("Директива обновлена!");
    } catch (error: any) {
      toast.error(`Ошибка обновления директивы: ${error.message}`);
      console.error("Update task error:", error);
    }
  };

  const handleDeleteTask = async (id: string) => {
     if (!window.confirm("Вы уверены, что хотите удалить эту директиву?")) {
       return;
     }
     if (!isAdmin()) {
      toast.error("Только Администраторы могут удалять директивы");
      return;
    }
    try {
      const { error } = await supabaseAdmin
        .from("tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== id));
      toast.success("Директива удалена!");
    } catch (error: any)      toast.error(`Ошибка удаления директивы: ${error.message}`);
      console.error("Delete task error:", error);
    }
  };

  const getPriorityClasses = (priority: string): string => {
    switch (priority) {
      case "high": return "border-l-4 border-destructive bg-destructive/10";
      case "medium": return "border-l-4 border-brand-yellow bg-brand-yellow/10";
      case "low": return "border-l-4 border-brand-green bg-brand-green/10";
      default: return "border-l-4 border-muted bg-muted/10";
    }
  };
  const getPriorityBadgeClasses = (priority: string): string => {
     switch (priority) {
      case "high": return "bg-destructive text-destructive-foreground";
      case "medium": return "bg-brand-yellow text-black";
      case "low": return "bg-brand-green text-black";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case "done": return <FaCircleCheck className="text-brand-green" />;
      case "in_progress": return <FaClock className="text-brand-yellow animate-pulse" />;
      default: return <FaThList className="text-muted-foreground" />; // FaThList for "todo"
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pt-24 pb-16">
      <div className="container mx-auto max-w-4xl">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-4">
          <h1 className="text-4xl md:text-5xl font-orbitron font-bold flex items-center gap-3 text-shadow-cyber" data-text="YT DIRECTIVES">
            <FaYoutube className="text-red-500 text-5xl drop-shadow-[0_0_8px_theme(colors.red.500)]" /> YT DIRECTIVES
          </h1>
          <div className="flex flex-wrap gap-3 justify-center sm:justify-end">
            <Button asChild variant="outline" className="border-brand-green text-brand-green hover:bg-brand-green/20 hover:text-white shadow-md hover:shadow-brand-green/30 transition-all">
                <Link href="/start-training"><FaDumbbell className="mr-2 h-4 w-4" /> Тренировка</Link>
            </Button>
            <Button asChild variant="secondary" className="bg-brand-blue text-black hover:bg-brand-blue/80 shadow-md hover:shadow-brand-blue/30 transition-all">
              <Link href="/yt">Персонажи YT</Link>
            </Button>
            {isAdmin() && (
              <Button asChild variant="outline" className="border-brand-purple text-brand-purple hover:bg-brand-purple/20 hover:text-white shadow-md hover:shadow-brand-purple/30 transition-all">
                <Link href="/youtubeAdmin">Админ YT</Link>
              </Button>
            )}
          </div>
        </header>

        {isAdmin() && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8 bg-dark-card/80 backdrop-blur-md p-6 rounded-xl shadow-xl border border-brand-purple/50"
          >
            <h2 className="text-2xl font-orbitron text-brand-purple mb-4">
              {editingTask ? "Изменить Директиву" : "Новая Директива"}
            </h2>
            <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask} className="space-y-4">
              <div>
                <Label htmlFor="task-title" className="block text-muted-foreground mb-1.5 font-mono text-sm">Заголовок</Label>
                <Input
                  id="task-title" type="text"
                  value={editingTask?.title || newTask.title}
                  onChange={(e) => editingTask ? setEditingTask({...editingTask, title: e.target.value}) : setNewTask({...newTask, title: e.target.value})}
                  className="input-cyber" required placeholder="Название директивы..."
                />
              </div>
              <div>
                <Label htmlFor="task-desc" className="block text-muted-foreground mb-1.5 font-mono text-sm">Описание</Label>
                <Textarea
                  id="task-desc"
                  value={editingTask?.description || newTask.description}
                  onChange={(e) => editingTask ? setEditingTask({...editingTask, description: e.target.value}) : setNewTask({...newTask, description: e.target.value})}
                  className="textarea-cyber simple-scrollbar" rows={3} placeholder="Детали и цели..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="task-deadline" className="block text-muted-foreground mb-1.5 font-mono text-sm">Дедлайн</Label>
                  <Input
                    id="task-deadline" type="date"
                    value={editingTask?.deadline || newTask.deadline}
                    onChange={(e) => editingTask ? setEditingTask({...editingTask, deadline: e.target.value}) : setNewTask({...newTask, deadline: e.target.value})}
                    className="input-cyber"
                  />
                </div>
                <div>
                  <Label htmlFor="task-priority" className="block text-muted-foreground mb-1.5 font-mono text-sm">Приоритет</Label>
                   <Select value={editingTask?.priority || newTask.priority} onValueChange={(value) => editingTask ? setEditingTask({...editingTask, priority: value}) : setNewTask({...newTask, priority: value})}>
                    <SelectTrigger id="task-priority" className="input-cyber"><SelectValue placeholder="Выберите приоритет" /></SelectTrigger>
                    <SelectContent><SelectItem value="high">Высокий</SelectItem><SelectItem value="medium">Средний</SelectItem><SelectItem value="low">Низкий</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              {editingTask && (
                <div>
                  <Label htmlFor="task-status" className="block text-muted-foreground mb-1.5 font-mono text-sm">Статус</Label>
                   <Select value={editingTask.status} onValueChange={(value) => setEditingTask({...editingTask, status: value})}>
                     <SelectTrigger id="task-status" className="input-cyber"><SelectValue placeholder="Выберите статус" /></SelectTrigger>
                     <SelectContent><SelectItem value="todo">К выполнению</SelectItem><SelectItem value="in_progress">В процессе</SelectItem><SelectItem value="done">Выполнено</SelectItem></SelectContent>
                   </Select>
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                {editingTask && (<Button type="button" onClick={() => setEditingTask(null)} variant="ghost" className="text-muted-foreground hover:text-light-text">Отмена</Button>)}
                <Button type="submit" variant="default" className="bg-brand-green text-black hover:bg-brand-green/80 shadow-md hover:shadow-brand-green/40">
                  <FaPlus className="mr-2 h-4 w-4" /> {editingTask ? "Обновить" : "Добавить"}
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12 flex-col gap-4">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-blue"></div>
            <p className="text-brand-blue font-orbitron text-lg animate-pulse">ЗАГРУЗКА ДИРЕКТИВ...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-dark-card/50 rounded-xl border border-border p-8">
            <FaYoutube className="mx-auto text-7xl mb-6 opacity-30 text-brand-red" />
            <p className="text-xl font-orbitron">ДИРЕКТИВЫ НЕ ОБНАРУЖЕНЫ</p>
            <p className="font-mono mt-2">Создайте первую директиву для YT-команды.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {tasks.map((task) => (
              <motion.div
                key={task.id} layout
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className={cn("bg-dark-card/90 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden border hover:border-brand-purple/70 transition-colors duration-300", getPriorityClasses(task.priority))}
              >
                <CardHeader className="px-5 py-3 border-b border-border/50">
                   <div className="flex justify-between items-start">
                     <CardTitle className="text-lg font-orbitron text-light-text flex-grow mr-2">{task.title}</CardTitle>
                     <div className="flex gap-2 flex-shrink-0">
                       {isAdmin() && (
                         <>
                           <Button variant="ghost" size="icon" onClick={() => setEditingTask(task)} className="text-brand-cyan hover:bg-brand-cyan/20 h-8 w-8" aria-label="Edit Task"><FaPencil className="h-4 w-4" /></Button>
                           <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="text-brand-red hover:bg-brand-red/20 h-8 w-8" aria-label="Delete Task"><FaTrash className="h-4 w-4" /></Button>
                         </>
                       )}
                       <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full", getPriorityBadgeClasses(task.priority))}>{task.priority}</span>
                     </div>
                   </div>
                </CardHeader>
                <CardContent className="p-5">
                  <p className="text-light-text/90 mb-4 text-sm leading-relaxed">{task.description || <span className="italic text-muted-foreground">Описание отсутствует.</span>}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground font-mono items-center">
                    <div className="flex items-center gap-1.5" title={`Статус: ${task.status.replace("_", " ")}`}>{getStatusIcon(task.status)} <span className="capitalize">{task.status.replace("_", " ")}</span></div>
                    <div className="flex items-center gap-1.5" title="Дедлайн"><FaCalendarDays /> <span>{task.deadline ? new Date(task.deadline + "T00:00:00Z").toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit', year:'numeric'}) : "Без дедлайна"}</span></div>
                    {task.assigned_to && (<div className="flex items-center gap-1.5"><span>Назначено: {task.assigned_to}</span></div>)}
                    <div className="flex items-center gap-1.5" title="Создано"><FaClock className="h-3 w-3"/> <span>{new Date(task.created_at).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit', year:'numeric'})}</span></div>
                  </div>
                </CardContent>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}