import React, { useState, useEffect } from "react";
import { User, Todo as TodoEntity } from "@/api/entities";
import { updateStatCount } from "@/api/functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, ChevronDown, ChevronRight, Home, Briefcase, User as UserIcon, ShoppingBag, Users, Heart, DollarSign, MoreHorizontal, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import { appCache } from "@/components/utils/appCache";
import { trackTodo } from "@/utils/trackingContext";

import AddTodoDialog from "../components/todos/AddTodoDialog";
import TodoCard from "../components/todos/TodoCard";
import VoiceCommandInput from "../components/todos/VoiceCommandInput";
import { canCreateTask } from "@/components/utils/tierManager";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { incrementUsage, decrementUsage } from "@/components/utils/usageSync";

const categoryConfig = {
  home: { label: "Home", icon: Home, color: "bg-blue-500" },
  work: { label: "Work", icon: Briefcase, color: "bg-purple-500" },
  personal: { label: "Personal", icon: UserIcon, color: "bg-pink-500" },
  errands: { label: "Errands", icon: ShoppingBag, color: "bg-orange-500" },
  family: { label: "Family", icon: Users, color: "bg-rose-500" },
  health: { label: "Health", icon: Heart, color: "bg-green-500" },
  finance: { label: "Finance", icon: DollarSign, color: "bg-cyan-500" },
  other: { label: "Other", icon: MoreHorizontal, color: "bg-slate-500" }
};

// Colorful theme category colors
const categoryColorfulColors = {
  home: { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-900" },
  work: { bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-900" },
  personal: { bg: "bg-pink-100", border: "border-pink-400", text: "text-pink-900" },
  errands: { bg: "bg-orange-100", border: "border-orange-400", text: "text-orange-900" },
  family: { bg: "bg-rose-100", border: "border-rose-400", text: "text-rose-900" },
  health: { bg: "bg-green-100", border: "border-green-400", text: "text-green-900" },
  finance: { bg: "bg-cyan-100", border: "border-cyan-400", text: "text-cyan-900" },
  other: { bg: "bg-slate-100", border: "border-slate-400", text: "text-slate-900" }
};

const priorityOrder = { high: 1, medium: 2, low: 3 };

export default function TodosPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedTasks, setExpandedTasks] = useState({});
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isColorfulTheme, setIsColorfulTheme] = useState(false);
  const queryClient = useQueryClient();

  // Check authentication on mount
  useEffect(() => {
    loadUser();
    
    // Check initial theme
    setIsColorfulTheme(document.documentElement.classList.contains('theme-colorful'));
    
    // Watch for theme changes
    const observer = new MutationObserver(() => {
      setIsColorfulTheme(document.documentElement.classList.contains('theme-colorful'));
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const loadUser = async () => {
    try {
      // ALWAYS fetch fresh user to ensure correct user context
      console.log('🔄 Todos: Fetching user from API');
      const currentUser = await User.me();
      
      // Validate cached user
      const cachedUser = appCache.getUser();
      if (cachedUser && cachedUser.id !== currentUser.id) {
        console.log('⚠️ Todos: Different user detected! Clearing all cache');
        appCache.clearAll();
      }
      
      appCache.setUser(currentUser);
      setUser(currentUser);
    } catch (error) {
      console.error("Authentication required:", error);
      User.redirectToLogin(createPageUrl("Todos"));
    } finally {
      setIsLoadingUser(false);
    }
  };

  // CRITICAL FIX: Filter todos by current user's email
  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['todos', user?.email],
    queryFn: () => TodoEntity.filter({ created_by: user.email }, '-created_date'),
    enabled: !!user && !!user.email,
  });

  const createTodoMutation = useMutation({
    mutationFn: ({ todoData, trackingContext }) => TodoEntity.create(todoData, trackingContext),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setShowAddDialog(false);
      setEditingTodo(null);

      try {
        // Increment tasks count
        await incrementUsage('current_tasks');

        // Update statistics - atomic increment total_tasks
        await updateStatCount('total_tasks', 1);

        queryClient.invalidateQueries({ queryKey: ['statistics'] });
      } catch (error) {
        console.error("Error updating statistics after todo creation:", error);
      }
    },
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, todoData, trackingContext }) => TodoEntity.update(id, todoData, trackingContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setShowAddDialog(false);
      setEditingTodo(null);
    },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: ({ id, trackingContext }) => TodoEntity.delete(id, trackingContext),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });

      // Decrement tasks count
      await decrementUsage('current_tasks');
    },
  });

  const handleSubmit = async (todoData) => {
    if (!user) return;

    const todoDataWithUser = {
      ...todoData,
      created_by: user.email,
    };

    if (editingTodo) {
      updateTodoMutation.mutate({ 
        id: editingTodo.id, 
        todoData: todoDataWithUser,
        trackingContext: trackTodo.update(user.id)
      });
    } else {
      try {
        const canCreate = await canCreateTask();
        if (!canCreate.canCreate) {
          setUpgradeMessage(canCreate.message);
          setShowAddDialog(false);
          setShowUpgradePrompt(true);
          return;
        }
      } catch (error) {
        console.error("Error checking task creation limits:", error);
        setUpgradeMessage("Failed to check task creation limits. Please try again.");
        setShowAddDialog(false);
        setShowUpgradePrompt(true);
        return;
      }
      createTodoMutation.mutate({ 
        todoData: todoDataWithUser,
        trackingContext: trackTodo.create(user.id, todoData.title)
      });
    }
  };

  const handleToggleComplete = (todo) => {
    const newStatus = todo.status === 'completed' ? 'pending' : 'completed';
    const wasCompleted = todo.status === 'completed';
    
    const trackingContext = wasCompleted 
      ? trackTodo.reactivate(user.id, todo.title)
      : trackTodo.complete(user.id, todo.title);
    
    updateTodoMutation.mutate({
      id: todo.id,
      todoData: {
        ...todo,
        status: newStatus,
        completed_date: newStatus === 'completed' ? new Date().toISOString() : null,
      },
      trackingContext
    });
  };

  const handleToggleFavorite = (todo) => {
    updateTodoMutation.mutate({
      id: todo.id,
      todoData: { ...todo, is_favorite: !todo.is_favorite }
    });
  };

  const handleEdit = (todo) => {
    setEditingTodo(todo);
    setShowAddDialog(true);
  };

  const handleDelete = (todo) => {
    if (confirm(`Delete "${todo.title}"?`)) {
      deleteTodoMutation.mutate({ 
        id: todo.id,
        trackingContext: trackTodo.delete(user.id)
      });
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const handleVoiceCommandAdd = async (taskData) => {
    if (!user) return;

    try {
      const canCreate = await canCreateTask();
      if (!canCreate.canCreate) {
        setUpgradeMessage(canCreate.message);
        setShowUpgradePrompt(true);
        return;
      }
    } catch (error) {
      console.error("Error checking task creation limits for voice command:", error);
      setUpgradeMessage("Failed to check task creation limits for voice command. Please try again.");
      setShowUpgradePrompt(true);
      return;
    }

    const taskDataWithUser = {
      ...taskData,
      created_by: user.email,
    };
    createTodoMutation.mutate(taskDataWithUser);
  };

  // Filter by status
  const filteredTodos = todos.filter(todo => {
    if (selectedStatus === 'all') return true;
    if (selectedStatus === 'active') return todo.status !== 'completed';
    if (selectedStatus === 'completed') return todo.status === 'completed';
    return true;
  });

  // Group by category and sort by priority
  const todosByCategory = filteredTodos.reduce((acc, todo) => {
    const category = todo.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(todo);
    return acc;
  }, {});

  // Sort tasks within each category by priority
  Object.keys(todosByCategory).forEach(category => {
    todosByCategory[category].sort((a, b) => {
      const priorityA = priorityOrder[a.priority] || 99;
      const priorityB = priorityOrder[b.priority] || 99;
      return priorityA - priorityB;
    });
  });

  const totalActive = todos.filter(t => t.status !== 'completed').length;
  const totalCompleted = todos.filter(t => t.status === 'completed').length;
  const progress = todos.length > 0 ? (totalCompleted / todos.length) * 100 : 0;

  const getCategoryStats = (tasks) => {
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return { pending, inProgress, completed };
  };

  if (isLoadingUser || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">
          {isLoadingUser ? "Checking authentication..." : "Loading tasks..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent dark:from-purple-400 dark:via-pink-400 dark:to-rose-400">
                My Tasks
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {totalActive} active • {totalCompleted} completed
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {todos.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Overall Progress</span>
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Voice Command Input */}
        <VoiceCommandInput onTaskAdded={handleVoiceCommandAdd} />

        {/* Add Task Button */}
        <Button
          onClick={async () => {
            try {
              const canCreate = await canCreateTask();
              if (!canCreate.canCreate) {
                setUpgradeMessage(canCreate.message);
                setShowUpgradePrompt(true);
                return;
              }
              setEditingTodo(null);
              setShowAddDialog(true);
            } catch (error) {
              console.error("Error checking task creation limits:", error);
              setUpgradeMessage("Failed to check task creation limits. Please try again.");
              setShowUpgradePrompt(true);
            }
          }}
          className="w-full mb-6 h-12 text-base bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 hover:from-purple-600 hover:via-pink-600 hover:to-rose-600 shadow-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add New Task
        </Button>

        {/* Status Filter */}
        {todos.length > 0 && (
          <div className="mb-6">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 pb-2">
                {['all', 'active', 'completed'].map((status) => (
                  <Badge
                    key={status}
                    variant={selectedStatus === status ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer whitespace-nowrap text-sm px-4 py-2 flex-shrink-0",
                      selectedStatus === status
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
                    )}
                    onClick={() => setSelectedStatus(status)}
                  >
                    {status === 'all' && 'All Tasks'}
                    {status === 'active' && `Active (${totalActive})`}
                    {status === 'completed' && `Completed (${totalCompleted})`}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Category Sections */}
        {todos.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-100 via-pink-100 to-rose-100 dark:from-purple-900/30 dark:via-pink-900/30 dark:to-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-purple-500 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">Ready to get things done?</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Add your first task and start being productive!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.keys(todosByCategory).map((category) => {
              const config = categoryConfig[category] || categoryConfig.other;
              const Icon = config.icon;
              const tasks = todosByCategory[category];
              const stats = getCategoryStats(tasks);
              const isExpanded = expandedCategories[category];
              
              const colorfulColors = categoryColorfulColors[category] || categoryColorfulColors.other;

              return (
                <div 
                  key={category} 
                  className={cn(
                    "rounded-xl border shadow-sm overflow-hidden",
                    isColorfulTheme 
                      ? `${colorfulColors.bg} border-2 ${colorfulColors.border}` 
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  )}
                >
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", config.color)}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{config.label}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                          {stats.pending > 0 && <span>Open: {stats.pending}</span>}
                          {stats.inProgress > 0 && <span>In Progress: {stats.inProgress}</span>}
                          {stats.completed > 0 && <span>Completed: {stats.completed}</span>}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  {/* Tasks List */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          "border-t",
                          isColorfulTheme 
                            ? colorfulColors.border 
                            : "border-slate-200 dark:border-slate-700"
                        )}
                      >
                        <div className="p-3 space-y-2">
                          {tasks.map((todo) => (
                            <TodoCard
                              key={todo.id}
                              todo={todo}
                              onToggleComplete={handleToggleComplete}
                              onToggleFavorite={handleToggleFavorite}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              isExpanded={expandedTasks[todo.id]}
                              onToggleExpand={() => toggleTask(todo.id)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddTodoDialog
        open={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          setEditingTodo(null);
        }}
        onSave={handleSubmit}
        editTodo={editingTodo}
      />

      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        title="Task Limit Reached"
        message={upgradeMessage}
        featureName="Additional Tasks"
      />
    </div>
  );
}