"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAdmin } from "@/hooks/supabase";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
// Using Fa6 icons for consistency
import { FaYoutube, FaCheckCircle, FaClock, FaCalendarDays, FaPlus, FaPencil, FaTrash } from "react-icons/fa6";
import { Button } from "@/components/ui/button"; // Use Button component
import { Input } from "@/components/ui/input"; // Use Input component
import { Textarea } from "@/components/ui/textarea"; // Use Textarea component
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"; // Use Select component

const notifyYtTeam = async (message: string) => {
  try {
    const { data: ytTeamMembers, error } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("role", "ytTeam");

    if (error) throw error;
    for (const member of ytTeamMembers) {
      console.log(`Notifying ${member.user_id}: ${message}`);
      // TODO: Implement actual Telegram notification logic here
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
      setLoading(true); // Start loading
      try {
          const { data, error } = await supabaseAdmin
            .from("tasks")
            .select("*")
            .order("created_at", { ascending: false });
          if (error) {
            toast.error("Failed to load tasks");
            console.error("Task fetch error:", error);
          } else {
            setTasks(data || []);
          }
      } catch(e) {
          toast.error("An unexpected error occurred while fetching tasks.");
          console.error("Task fetch exception:", e);
      } finally {
         setLoading(false); // End loading regardless of outcome
      }
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
        assigned_to: user?.id.toString(), // Assuming user ID is string or number
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
    } catch (error: any) {
      toast.error(`Failed to create task: ${error.message}`);
      console.error("Create task error:", error);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const { data: task, error } = await supabaseAdmin
        .from("tasks")
        .update({
          title: editingTask.title,
          description: editingTask.description,
          deadline: editingTask.deadline || null, // Ensure null if empty
          priority: editingTask.priority,
          status: editingTask.status
        })
        .eq("id", editingTask.id)
        .select()
        .single();
      if (error) throw error;

      setTasks(tasks.map(t => t.id === task.id ? task : t));
      setEditingTask(null); // Close edit form
      toast.success("Task updated!");
    } catch (error: any) {
      toast.error(`Failed to update task: ${error.message}`);
      console.error("Update task error:", error);
    }
  };

  const handleDeleteTask = async (id: string) => {
     if (!window.confirm("Are you sure you want to delete this task?")) {
       return;
     }
    try {
      const { error } = await supabaseAdmin
        .from("tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;

      setTasks(tasks.filter(t => t.id !== id));
      toast.success("Task deleted!");
    } catch (error: any) {
      toast.error(`Failed to delete task: ${error.message}`);
      console.error("Delete task error:", error);
    }
  };

  // Using Tailwind classes consistent with the theme (adjust if needed)
  const getPriorityClasses = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive/80 border-destructive text-destructive-foreground"; // Use theme colors
      case "medium": return "bg-brand-yellow/80 border-brand-yellow text-accent-foreground";
      case "low": return "bg-brand-green/80 border-brand-green text-black"; // Adjust text color if needed
      default: return "bg-muted border-border text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done": return <FaCheckCircle className="text-brand-green" />;
      case "in_progress": return <FaClock className="text-brand-yellow animate-pulse" />;
      default: return <FaClock className="text-muted-foreground" />; // 'todo' or others
    }
  };

  return (
    // Use theme background and text colors
    <div className="pt-24 p-4 bg-dark-bg text-light-text min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <h1 className="text-3xl font-orbitron font-bold text-light-text flex items-center gap-2 cyber-text" data-text="YouTube Tasks">
            <FaYoutube className="text-red-500 text-4xl" /> YouTube Tasks
          </h1>
          {/* Use Button component */}
          <div className="flex gap-3">
            <Button asChild variant="secondary">
              <Link href="/yt">Characters</Link>
            </Button>
            <Button asChild variant="outline" className="border-brand-purple text-brand-purple hover:bg-brand-purple/10 hover:text-brand-purple">
              <Link href="/youtubeAdmin">Admin Panel</Link>
            </Button>
          </div>
        </div>

        {/* Form Section */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} // Added exit animation
            className="mb-8 bg-dark-card p-6 rounded-lg shadow-lg border border-border"
          >
            <h2 className="text-xl font-semibold text-light-text mb-4 font-orbitron">
              {editingTask ? "Edit Directive" : "Create New Directive"}
            </h2>
            {/* Use form components */}
            <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask} className="space-y-4">
              <div>
                <Label htmlFor="task-title" className="block text-muted-foreground mb-1">Title</Label>
                <Input
                  id="task-title"
                  type="text"
                  value={editingTask?.title || newTask.title}
                  onChange={(e) => editingTask
                    ? setEditingTask({...editingTask, title: e.target.value})
                    : setNewTask({...newTask, title: e.target.value})
                  }
                  className="input-cyber" // Use theme input style
                  required
                  placeholder="Directive Title..."
                />
              </div>
              <div>
                <Label htmlFor="task-desc" className="block text-muted-foreground mb-1">Description</Label>
                <Textarea
                  id="task-desc"
                  value={editingTask?.description || newTask.description}
                  onChange={(e) => editingTask
                    ? setEditingTask({...editingTask, description: e.target.value})
                    : setNewTask({...newTask, description: e.target.value})
                  }
                  className="textarea-cyber" // Use theme textarea style
                  rows={3}
                  placeholder="Details and objectives..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="task-deadline" className="block text-muted-foreground mb-1">Deadline</Label>
                  <Input
                    id="task-deadline"
                    type="date"
                    value={editingTask?.deadline || newTask.deadline}
                     onChange={(e) => {
                       const value = e.target.value; // Format YYYY-MM-DD
                       if (editingTask) {
                         setEditingTask({...editingTask, deadline: value });
                       } else {
                         setNewTask({...newTask, deadline: value });
                       }
                     }}
                    className="input-cyber"
                  />
                </div>
                <div>
                  <Label htmlFor="task-priority" className="block text-muted-foreground mb-1">Priority</Label>
                   <Select
                     value={editingTask?.priority || newTask.priority}
                     onValueChange={(value) => editingTask
                       ? setEditingTask({...editingTask, priority: value})
                       : setNewTask({...newTask, priority: value})
                     }
                   >
                    <SelectTrigger id="task-priority" className="input-cyber">
                      <SelectValue placeholder="Select Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editingTask && (
                <div>
                  <Label htmlFor="task-status" className="block text-muted-foreground mb-1">Status</Label>
                   <Select
                      value={editingTask.status}
                      onValueChange={(value) => setEditingTask({...editingTask, status: value})}
                   >
                     <SelectTrigger id="task-status" className="input-cyber">
                       <SelectValue placeholder="Select Status" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="todo">To Do</SelectItem>
                       <SelectItem value="in_progress">In Progress</SelectItem>
                       <SelectItem value="done">Done</SelectItem>
                     </SelectContent>
                   </Select>
                </div>
              )}
              <div className="flex justify-end gap-3 mt-4">
                {editingTask && (
                  <Button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    variant="ghost" // Use ghost variant for cancel
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="default" // Use default variant for submit/update
                >
                  <FaPlus className="mr-2 h-4 w-4" /> {editingTask ? "Update Task" : "Add Task"}
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Task List Section */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FaYoutube className="mx-auto text-5xl mb-4 opacity-50" />
            <p>No directives found. Create the first one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                layout // Add layout animation
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} // Added exit animation
                transition={{ duration: 0.3 }}
                // Use theme card style
                className="bg-dark-card rounded-lg shadow-md overflow-hidden border border-border"
              >
                 {/* Priority indicator header */}
                 <div className={`px-4 py-2 border-b border-border ${getPriorityClasses(task.priority)}`}>
                   <div className="flex justify-between items-center">
                     <h3 className="text-lg font-semibold font-orbitron">{task.title}</h3>
                     {/* Use icon buttons for actions */}
                     <div className="flex gap-2">
                       {isAdmin && (
                         <>
                           <Button
                             variant="ghost" size="icon"
                             onClick={() => setEditingTask(task)}
                             className="text-light-text hover:bg-white/10 h-7 w-7"
                             aria-label="Edit Task"
                           >
                             <FaPencil className="h-4 w-4" />
                           </Button>
                           <Button
                              variant="ghost" size="icon"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-destructive hover:bg-destructive/20 hover:text-destructive h-7 w-7"
                              aria-label="Delete Task"
                           >
                             <FaTrash className="h-4 w-4" />
                           </Button>
                         </>
                       )}
                     </div>
                   </div>
                 </div>
                {/* Task details */}
                <div className="p-4">
                  <p className="text-light-text mb-4 text-sm">{task.description || <span className="italic text-muted-foreground">No description provided.</span>}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground font-mono items-center">
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(task.status)}
                      <span className="capitalize">{task.status.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FaCalendarDays />
                      <span>{task.deadline ? new Date(task.deadline + "T00:00:00Z").toLocaleDateString() : "No deadline"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="capitalize">Priority: <span className="font-semibold">{task.priority}</span></span>
                    </div>
                    {task.assigned_to && (
                       <div className="flex items-center gap-1.5">
                         <span>Assigned: {task.assigned_to}</span>
                       </div>
                    )}
                     <div className="flex items-center gap-1.5">
                         <FaClock className="h-3 w-3"/>
                         <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
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