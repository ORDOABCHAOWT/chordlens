import type { PropsWithChildren, ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Grid2X2, MoreHorizontal } from "lucide-react";

interface WindowShellProps extends PropsWithChildren {
  className: string;
  title?: string;
  titleContent?: ReactNode;
  actions?: boolean;
}

async function windowAction(action: "close" | "minimize" | "maximize") {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const current = getCurrentWindow();
  if (action === "close") await current.close();
  if (action === "minimize") await current.minimize();
  if (action === "maximize") await current.toggleMaximize();
}

export function TrafficLights() {
  return (
    <div className="traffic-lights" aria-label="Window controls">
      <button className="traffic red" aria-label="Close" onClick={() => void windowAction("close")} />
      <button className="traffic yellow" aria-label="Minimize" onClick={() => void windowAction("minimize")} />
      <button className="traffic green" aria-label="Maximize" onClick={() => void windowAction("maximize")} />
    </div>
  );
}

export function WindowShell({ className, title, titleContent, actions, children }: WindowShellProps) {
  return (
    <section className={`window-shell ${className}`}>
      <header className="window-titlebar" data-tauri-drag-region>
        <TrafficLights />
        <div className="window-title" data-tauri-drag-region>{titleContent ?? title}</div>
        {actions && (
          <div className="window-title-actions">
            <button aria-label="Window layout"><Grid2X2 size={16} strokeWidth={1.55} /></button>
            <button aria-label="More options"><MoreHorizontal size={18} strokeWidth={1.55} /></button>
          </div>
        )}
      </header>
      {children}
    </section>
  );
}
