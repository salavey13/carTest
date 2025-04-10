"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAdmin } from "@/hooks/supabase";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
import { FiYoutube, FiCheckCircle, FiClock, FiCalendar, FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";

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
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Failed to load tasks");
      } else {
        setTasks(data || []);
      }
      setLoading(false);
    };
    fetchTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Only admins can create tasks");
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
      toast.success("Task created!");
      await notifyYtTeam(`New task: ${task.title}`);
    } catch (error) {
      toast.error("Failed to create task");
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: task, error } = await supabaseAdmin
        .from("tasks")
        .update({
          title: editingTask.title,
          description: editingTask.description,
          deadline: editingTask.deadline,
          priority: editingTask.priority,
          status: editingTask.status
        })
        .eq("id", editingTask.id)
        .select()
        .single();
      if (error) throw error;

      setTasks(tasks.map(t => t.id === task.id ? task : t));
      setEditingTask(null);
      toast.success("Task updated!");
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const { error } = await supabaseAdmin
        .from("tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;

      setTasks(tasks.filter(t => t.id !== id));
      toast.success("Task deleted!");
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done": return <FiCheckCircle className="text-green-500" />;
      case "in_progress": return <FiClock className="text-yellow-500" />;
      default: return <FiClock className="text-gray-500" />;
    }
  };

  return (
    <div className="pt-24 p-4 bg-gray-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <FiYoutube className="text-red-500" /> YouTube Tasks
          </h1>
          <div className="flex gap-4">
            <Link href="/yt" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
              Characters
            </Link>
            <Link href="/youtubeAdmin" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition">
              Admin
            </Link>
          </div>
        </div>

        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-gray-800 p-6 rounded-lg shadow-lg"
          >
            <h2 className="text-xl font-semibold text-white mb-4">
              {editingTask ? "Edit Task" : "Create New Task"}
            </h2>
            <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={editingTask?.title || newTask.title}
                  onChange={(e) => editingTask 
                    ? setEditingTask({...editingTask, title: e.target.value})
                    : setNewTask({...newTask, title: e.target.value})
                  }
                  className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Description</label>
                <textarea
                  value={editingTask?.description || newTask.description}
                  onChange={(e) => editingTask 
                    ? setEditingTask({...editingTask, description: e.target.value})
                    : setNewTask({...newTask, description: e.target.value})
                  }
                  className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2">Deadline</label>
                  <input
                    type="date"
                    value={editingTask?.deadline || newTask.deadline}
                    onChange={(e) => editingTask 
                      ? setEditingTask({...editingTask, deadline: e.target.value})
                      : setNewTask({...newTask, deadline: e.target.value})
                    }
                    className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Priority</label>
                  <select
                    value={editingTask?.priority || newTask.priority}
                    onChange={(e) => editingTask 
                      ? setEditingTask({...editingTask, priority: e.target.value})
                      : setNewTask({...newTask, priority: e.target.value})
                    }
                    className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              {editingTask && (
                <div>
                  <label className="block text-gray-300 mb-2">Status</label>
                  <select
                    value={editingTask.status}
                    onChange={(e) => setEditingTask({...editingTask, status: e.target.value})}
                    className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-4">
                {editingTask && (
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <FiPlus /> {editingTask ? "Update Task" : "Add Task"}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FiYoutube className="mx-auto text-4xl mb-4" />
            <p>No tasks found. Create your first task!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-800 rounded-lg shadow-lg overflow-hidden"
              >
                <div className={`p-4 ${getPriorityColor(task.priority)}`}>
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">{task.title}</h3>
                    <div className="flex gap-2">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setEditingTask(task)}
                            className="p-1 bg-gray-700 rounded hover:bg-gray-600 transition"
                          >
                            <FiEdit2 className="text-white" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 bg-red-600 rounded hover:bg-red-700 transition"
                          >
                            <FiTrash2 className="text-white" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-gray-300 mb-4">{task.description || "No description"}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(task.status)}
                      <span className="capitalize">{task.status.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FiCalendar />
                      <span>{task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="capitalize">Priority: {task.priority}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Assigned to: {task.assigned_to || "Unassigned"}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
