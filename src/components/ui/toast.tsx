import * as React from "react";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
}

let _addToast: ((type: ToastType, text: string) => void) | null = null;

/** Show a non-blocking toast notification instead of window.alert / confirm. */
export function toast(text: string, type: ToastType = "info") {
  _addToast?.(type, text);
}

export function toastSuccess(text: string) { toast(text, "success"); }
export function toastError(text: string) { toast(text, "error"); }
export function toastWarning(text: string) { toast(text, "warning"); }

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />,
  error: <XCircle className="h-5 w-5 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
  info: <Info className="h-5 w-5 text-sky-500 shrink-0" />,
};

const bgMap: Record<ToastType, string> = {
  success: "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40",
  error: "border-red-500/30 bg-red-50 dark:bg-red-950/40",
  warning: "border-amber-500/30 bg-amber-50 dark:bg-amber-950/40",
  info: "border-sky-500/30 bg-sky-50 dark:bg-sky-950/40",
};

export function ToastProvider() {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const idRef = React.useRef(0);

  React.useEffect(() => {
    _addToast = (type, text) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, type, text }]);
      window.setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        4000,
      );
    };
    return () => { _addToast = null; };
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg",
            "animate-[slideIn_0.25s_ease-out] backdrop-blur-sm",
            "max-w-sm text-sm text-ink-body",
            bgMap[t.type],
          ].join(" ")}
          role="status"
        >
          {iconMap[t.type]}
          <span className="flex-1 pt-0.5">{t.text}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-ink-muted hover:text-ink-body"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
