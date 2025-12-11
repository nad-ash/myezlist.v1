
import React from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  Star,
  Trash2,
  Pencil,
  Calendar as CalendarIcon,
  ArrowUpCircle,
  Flame,
  Zap,
  Leaf,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const priorityConfig = {
  high: { color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700", icon: Flame },
  medium: { color: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700", icon: Zap },
  low: { color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700", icon: Leaf },
};

const statusIcons = {
  pending: <Circle className="w-5 h-5 text-slate-400 dark:text-slate-500" />,
  in_progress: <ArrowUpCircle className="w-5 h-5 text-blue-500 dark:text-blue-400" />,
  completed: <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />,
};

export default function TodoCard({ todo, onToggleComplete, onToggleFavorite, onEdit, onDelete, isExpanded, onToggleExpand }) {
  const priority = priorityConfig[todo.priority] || priorityConfig.medium;
  const PriorityIcon = priority.icon;
  const isCompleted = todo.status === 'completed';

  return (
    <Card className={cn(
      "transition-all duration-300 cursor-pointer",
      isCompleted 
        ? "bg-slate-50 opacity-70 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700" 
        : "bg-white hover:shadow-md border-slate-200 dark:bg-slate-800 dark:border-slate-700"
    )}>
      {/* Compact View */}
      <div className="flex items-center gap-3 p-3">
        {/* Status Icon */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(todo);
          }}
          className="flex-shrink-0 hover:scale-110 transition-transform"
        >
          {statusIcons[todo.status]}
        </button>

        {/* Title - Clickable to expand */}
        <div 
          onClick={onToggleExpand}
          className="flex-1 min-w-0 flex items-start gap-2"
        >
          <h4 className={cn(
            "font-medium text-sm leading-tight flex-1 min-w-0 break-words",
            isCompleted 
              ? "line-through text-slate-500 dark:text-slate-400" 
              : "text-slate-800 dark:text-slate-100"
          )}>
            {todo.title}
          </h4>
          
          {/* Priority Badge (always visible) */}
          <Badge variant="outline" className={cn("text-xs px-2 py-0 h-5 flex items-center gap-1 flex-shrink-0", priority.color)}>
            <PriorityIcon className="w-3 h-3" />
          </Badge>

          {todo.is_favorite && (
            <Star className="w-4 h-4 text-yellow-500 fill-current flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t border-slate-200 dark:border-slate-700 px-3 pb-3 pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Description */}
          {todo.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed break-words whitespace-pre-wrap">
              {todo.description}
            </p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {todo.status === 'in_progress' && (
              <Badge className="bg-blue-500 text-white text-xs hover:bg-blue-600">
                In Progress
              </Badge>
            )}
            {todo.due_date && (
              <Badge variant="outline" className="text-xs flex items-center gap-1 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                <CalendarIcon className="w-3 h-3" />
                {format(new Date(todo.due_date), 'MMM d, yyyy')}
                {todo.due_time && ` at ${todo.due_time}`}
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(todo);
              }}
              className={cn(
                "h-8 px-3 text-xs",
                todo.is_favorite && "text-yellow-500 dark:text-yellow-400"
              )}
            >
              <Star className={cn("w-4 h-4 mr-1", todo.is_favorite && "fill-current")} />
              Favorite
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(todo);
              }}
              className="h-8 px-3 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30"
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(todo);
              }}
              className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </motion.div>
      )}
    </Card>
  );
}
