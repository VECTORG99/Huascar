import type { KeyboardEvent } from "react";

import type { Tab } from "@/types/agent";

interface TabNavigationProps {
  activeTab: Tab;
  historyCount: number;
  onTabChange: (tab: Tab) => void;
}

export function TabNavigation({ activeTab, historyCount, onTabChange }: TabNavigationProps) {
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const nextTab = activeTab === "terminal" ? "history" : "terminal";
    onTabChange(nextTab);
    queueMicrotask(() => document.getElementById(`tab-${nextTab}`)?.focus());
  };
  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 ${
      activeTab === tab
        ? "bg-black text-emerald-400 border-b-2 border-emerald-500"
        : "text-zinc-500 hover:text-zinc-300"
    }`;

  return (
    <div className="flex gap-1 border-b border-zinc-800" role="tablist" aria-label="Vistas del panel">
      <button type="button" id="tab-terminal" role="tab" aria-selected={activeTab === "terminal"} aria-controls="panel-terminal" className={tabClass("terminal")} onClick={() => onTabChange("terminal")} onKeyDown={onTabKeyDown}>Terminal</button>
      <button type="button" id="tab-history" role="tab" aria-selected={activeTab === "history"} aria-controls="panel-history" className={tabClass("history")} onClick={() => onTabChange("history")} onKeyDown={onTabKeyDown}>
        Historial
        {historyCount > 0 && (
          <span className="ml-2 text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full" aria-label={`${historyCount} ejecuciones`}>
            {historyCount}
          </span>
        )}
      </button>
    </div>
  );
}
