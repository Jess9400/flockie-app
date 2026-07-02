"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useEsc } from "@/lib/use-esc";

// Shared, branded replacements for window.confirm / prompt / alert.
//   const confirm = useConfirm();  -> await confirm({...}) resolves the reason
//                                     object on confirm, or null on cancel.
//   const toast = useToast();      -> toast("Saved", "success")
// One <FeedbackProvider> is mounted in AppShell so both are available app-wide.

type ConfirmReason = { value: string; label: string };

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Show a radio list of reasons (e.g. member removal / report). */
  reasons?: ConfirmReason[];
  /** Require a reason (or free text) before confirm is enabled. */
  reasonRequired?: boolean;
  /** Show an optional free-text field; its value is folded into `reason`. */
  allowFreeText?: boolean;
  freeTextPlaceholder?: string;
};

export type ConfirmResult = {
  /** Selected radio value ("" when no reasons list). */
  value: string;
  /** Free-text field value ("" when not shown / left blank). */
  note: string;
  /** Convenience: selected label + note joined (for logging / simple use). */
  reason: string;
};

type ToastVariant = "success" | "error";
type ToastState = { id: number; message: string; variant: ToastVariant };

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<ConfirmResult | null>>(
  async () => null
);
const ToastCtx = createContext<(message: string, variant?: ToastVariant) => void>(() => {});

export const useConfirm = () => useContext(ConfirmCtx);
export const useToast = () => useContext(ToastCtx);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Confirm ────────────────────────────────────────────────────────────
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [choice, setChoice] = useState("");
  const [freeText, setFreeText] = useState("");
  const resolver = useRef<((r: ConfirmResult | null) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setChoice(o.reasons?.[0]?.value ?? "");
    setFreeText("");
    setOpts(o);
    return new Promise<ConfirmResult | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: ConfirmResult | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  useEsc(() => settle(null), opts != null);

  const selectedLabel = opts?.reasons?.find((r) => r.value === choice)?.label ?? "";
  const composedReason = [
    opts?.reasons ? selectedLabel : "",
    opts?.allowFreeText ? freeText.trim() : "",
  ]
    .filter(Boolean)
    .join(" — ");
  const canConfirm = !opts?.reasonRequired || composedReason.length > 0;

  // ── Toasts ─────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const nextId = useRef(1);
  const toast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((cur) => [...cur, { id, message, variant }]);
    setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={toast}>
        {children}

        {mounted &&
          opts &&
          createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
              onClick={() => settle(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={opts.title}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-3xl border-[3px] border-ink bg-white p-6 shadow-[0_6px_0_0_rgba(10,37,69,1)]"
              >
                <h2 className="text-xl font-extrabold text-ink">{opts.title}</h2>
                {opts.message && (
                  <p className="mt-1.5 text-sm font-medium text-muted">{opts.message}</p>
                )}

                {opts.reasons && (
                  <div className="mt-4 space-y-2">
                    {opts.reasons.map((r) => (
                      <label
                        key={r.value}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5 text-sm font-bold ${
                          choice === r.value
                            ? "border-ink bg-flockie-blue text-white"
                            : "border-ink/20 bg-white text-ink"
                        }`}
                      >
                        <input
                          type="radio"
                          name="confirm-reason"
                          className="sr-only"
                          checked={choice === r.value}
                          onChange={() => setChoice(r.value)}
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                )}

                {opts.allowFreeText && (
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    placeholder={opts.freeTextPlaceholder ?? "Add a note (optional)…"}
                    rows={2}
                    maxLength={300}
                    className="mt-3 w-full rounded-2xl border-2 border-ink/20 px-3 py-2 text-sm font-medium outline-none focus:border-flockie-blue"
                  />
                )}

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => settle(null)}
                    className="flex-1 rounded-full border-2 border-ink bg-white py-2.5 text-sm font-bold text-ink"
                  >
                    {opts.cancelLabel ?? "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={!canConfirm}
                    onClick={() =>
                      settle({ value: choice, note: freeText.trim(), reason: composedReason })
                    }
                    className={`flex-1 rounded-full border-2 border-ink py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
                      opts.destructive ? "bg-red-600" : "bg-flockie-coral"
                    }`}
                  >
                    {opts.confirmLabel ?? "Confirm"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {mounted &&
          toasts.length > 0 &&
          createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6">
              {toasts.map((t) => (
                <div
                  key={t.id}
                  className={`pointer-events-auto max-w-sm rounded-2xl border-2 border-ink px-4 py-2.5 text-sm font-bold shadow-[0_4px_0_0_rgba(10,37,69,1)] ${
                    t.variant === "error" ? "bg-red-600 text-white" : "bg-flockie-blue text-white"
                  }`}
                >
                  {t.message}
                </div>
              ))}
            </div>,
            document.body
          )}
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}
