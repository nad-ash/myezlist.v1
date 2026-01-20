
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

// Parse date string (YYYY-MM-DD) as local date to avoid timezone shift
const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const categories = [
  { value: "home", label: "Home", icon: "🏠" },
  { value: "work", label: "Work", icon: "💼" },
  { value: "personal", label: "Personal", icon: "✨" },
  { value: "errands", label: "Errands", icon: "🛒" },
  { value: "family", label: "Family", icon: "👨‍👩‍👧‍👦" },
  { value: "health", label: "Health", icon: "💪" },
  { value: "finance", label: "Finance", icon: "💰" },
  { value: "other", label: "Other", icon: "📌" },
];

const priorities = [
  { value: "low", label: "Low Priority", icon: "🌱" },
  { value: "medium", label: "Medium Priority", icon: "⚡" },
  { value: "high", label: "High Priority", icon: "🔥" },
];

const statuses = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export default function AddTodoDialog({ open, onClose, onSave, editTodo = null, isInFamily = false, isOwner = true }) {
  const [todo, setTodo] = useState({
    title: "",
    description: "",
    status: "pending",
    priority: "medium",
    category: "personal",
    due_date: "",
    due_time: "", // Added due_time field
    shared_with_family: false, // Family sharing toggle
  });

  useEffect(() => {
    if (editTodo) {
      setTodo({
        title: editTodo.title || "",
        description: editTodo.description || "",
        status: editTodo.status || "pending",
        priority: editTodo.priority || "medium",
        category: editTodo.category || "personal",
        due_date: editTodo.due_date || "",
        due_time: editTodo.due_time || "", // Added due_time field
        shared_with_family: editTodo.shared_with_family || false,
      });
    } else {
      resetForm();
    }
  }, [editTodo, open]);

  const handleSave = () => {
    if (todo.title.trim()) {
      // Convert empty strings to null for date fields (database expects null, not "")
      const todoData = {
        ...todo,
        due_date: todo.due_date || null,
        due_time: todo.due_time || null,
      };
      onSave(todoData);
      resetForm();
    }
  };

  const resetForm = () => {
    setTodo({
      title: "",
      description: "",
      status: "pending",
      priority: "medium",
      category: "personal",
      due_date: "",
      due_time: "", // Added due_time field
      shared_with_family: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetForm();
      }
      onClose();
    }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {editTodo ? "Edit Task" : "Add New Task"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              placeholder="What needs to be done?"
              value={todo.title}
              onChange={(e) => setTodo({ ...todo, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              maxLength={100}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add more details..."
              value={todo.description}
              onChange={(e) => setTodo({ ...todo, description: e.target.value })}
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={todo.category}
                onValueChange={(value) => setTodo({ ...todo, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={todo.priority}
                onValueChange={(value) => setTodo({ ...todo, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.icon} {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {editTodo && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={todo.status}
                onValueChange={(value) => setTodo({ ...todo, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Due Date & Time (Optional)</Label> {/* Updated label */}
            <div className="grid grid-cols-2 gap-2"> {/* Grid for date and time inputs */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      "dark:!bg-slate-700 dark:!border-slate-500 dark:!text-slate-200 dark:hover:!bg-slate-600",
                      !todo.due_date && "text-slate-500 dark:!text-slate-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {todo.due_date ? format(parseLocalDate(todo.due_date), 'MMM d') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 dark:bg-slate-800 dark:border-slate-600">
                  <Calendar
                    mode="single"
                    selected={todo.due_date ? parseLocalDate(todo.due_date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        // Format as YYYY-MM-DD using local date components to avoid timezone issues
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setTodo({ ...todo, due_date: `${year}-${month}-${day}` });
                      } else {
                        setTodo({ ...todo, due_date: "" });
                      }
                    }}
                    className="dark:bg-slate-800 dark:text-slate-200"
                  />
                </PopoverContent>
              </Popover>

              {/* Time Input Field */}
              <Input
                type="time"
                value={todo.due_time}
                onChange={(e) => setTodo({ ...todo, due_time: e.target.value })}
                placeholder="Time"
                className="text-base dark:bg-slate-700 dark:border-slate-500 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Family Sharing Toggle - only show if user is in a family AND owns the task */}
          {/* When editing another family member's task, hide the toggle to prevent encryption key issues */}
          {isInFamily && (!editTodo || isOwner) && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-pink-500" />
                <div>
                  <Label htmlFor="share-family" className="font-medium text-slate-800 dark:text-slate-200">
                    Share with Family
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Family members can see this task
                  </p>
                </div>
              </div>
              <Switch
                id="share-family"
                checked={todo.shared_with_family}
                onCheckedChange={(checked) => setTodo({ ...todo, shared_with_family: checked })}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="!text-slate-700 dark:!text-slate-200 !border-slate-300 dark:!border-slate-500 dark:!bg-slate-700 dark:hover:!bg-slate-600"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!todo.title.trim()}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {editTodo ? "Update Task" : "Add Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
