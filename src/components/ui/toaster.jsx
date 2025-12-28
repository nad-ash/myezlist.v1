import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss, remove } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, duration, onOpenChange, open, ...props }) {
        // Filter out onOpenChange (not supported by div) and open (we handle visibility ourselves)
        return (
          <ToastWithAutoDismiss 
            key={id} 
            id={id}
            title={title}
            description={description}
            action={action}
            duration={duration}
            dismiss={dismiss}
            remove={remove}
            {...props}
          />
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

// Component that handles auto-dismiss with duration
function ToastWithAutoDismiss({ id, title, description, action, duration, dismiss, remove, ...props }) {
  useEffect(() => {
    // Auto-dismiss after duration (default 5000ms is handled by TOAST_REMOVE_DELAY)
    if (duration) {
      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, dismiss]);

  return (
    <Toast {...props}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && (
          <ToastDescription>{description}</ToastDescription>
        )}
      </div>
      {action}
      <ToastClose onClick={() => remove(id)} />
    </Toast>
  );
} 