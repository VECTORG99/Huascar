import type { Tab } from "@/types/agent";

interface TabNavigationProps {
  activeTab: Tab;
  historyCount: number;
  onTabChange: (tab: Tab) => void;
}

export function TabNavigation({ activeTab, historyCount, onTabChange }: TabNavigationProps) {
  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
      activeTab === tab
        ? "bg-black text-emerald-400 border-b-2 border-emerald-500"
        : "text-zinc-500 hover:text-zinc-300"
    }`;

  return (
    <div className="flex gap-1 border-b border-zinc-800">
      <div className={tabClass("terminal")} onClick={() => onTabChange("terminal")}>Terminal</div>
      <div className={tabClass("history")} onClick={() => onTabChange("history")}>
        Historial
        {historyCount > 0 && (
          <span className="ml-2 text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">
            {historyCount}
          </span>
        )}
      </div>
    </div>
  );
}
