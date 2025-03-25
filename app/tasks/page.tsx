"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAdmin } from "@/hooks/supabase";
import { toast } from "sonner";
import Link from "next/link";

// Custom action to notify ytTeam members
const notifyYtTeam = async (message: string) => {
  try {
    const { data: ytTeamMembers, error } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("role", "ytTeam");

    if (error) throw error;

    // Simulate sending notifications to ytTeam members (replace with actual notification logic if available)
    for (const member of ytTeamMembers) {
      console.log(`Notifying ${member.user_id}: ${message}`);
      // Here, you’d integrate with a notification service if available
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
  });

  // Fetch tasks on mount
  useEffect(() => {
    const fetchTasks = async () => {
      const { data, error } = await supabaseAdmin.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching tasks:", error);
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
    if (!isAdmin()) {
      toast.error("Only admins can create tasks");
      return;
    }
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    try {
      const taskData = {
        title: newTask.title,
        description: newTask.description,
        status: "todo",
        deadline: newTask.deadline || null, // Handle empty deadline as null
        assigned_to: user.id.toString(), // Auto-set to current user
        created_at: new Date().toISOString(),
      };

      const { data: task, error } = await supabaseAdmin.from("tasks").insert(taskData).select().single();
      if (error) throw error;

      setTasks([task, ...tasks]);
      setNewTask({ title: "", description: "", deadline: "" });
      toast.success("Task created successfully!");

      // Notify ytTeam members
      await notifyYtTeam(`New task created: ${task.title}`);
    } catch (error) {
      toast.error("Failed to create task");
      console.error(error);
    }
  };

  if (loading) return <p className="text-center text-gray-500 pt-24">Loading tasks...</p>;

  return (
    <div className="container mx-auto p-4 pt-24 bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold text-white mb-6">Tasks</h1>

      {isAdmin() ? (
        <form onSubmit={handleCreateTask} className="mb-8 space-y-4 max-w-lg mx-auto">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Task Title</label>
            <input
              type="text"
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-700 text-white rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Description</label>
            <textarea
              placeholder="Description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-700 text-white rounded"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Deadline</label>
            <input
              type="date"
              value={newTask.deadline}
              onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-700 text-white rounded"
            />
          </div>
          <button
            type="submit"
            className="w-full p-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Task
          </button>
        </form>
      ) : (
        <p className="text-center text-gray-500 mb-8">Only admins can create tasks</p>
      )}

      <ul className="space-y-4">
        {tasks.map((task) => (
          <li key={task.id} className="p-4 bg-gray-800 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold text-white">{task.title}</h2>
            <p className="text-gray-300">{task.description || "No description"}</p>
            <p className="text-sm text-gray-400">Status: {task.status}</p>
            <p className="text-sm text-gray-400">Assigned to: {task.assigned_to}</p>
            <p className="text-sm text-gray-400">Deadline: {task.deadline || "Not set"}</p>
            <p className="text-sm text-gray-400">Created: {new Date(task.created_at).toLocaleDateString()}</p>
          </li>
        ))}
      </ul>

      <nav className="mt-8 flex justify-center space-x-4">
        <Link href="/yt" className="text-blue-400 hover:underline">Characters</Link>
        <Link href="/youtubeAdmin" className="text-blue-400 hover:underline">YouTube Admin</Link>
      </nav>
    </div>
  );
}