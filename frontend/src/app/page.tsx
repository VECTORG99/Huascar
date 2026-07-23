"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AgentForm } from "@/components/dashboard/AgentForm";
import { ExecutionHistory } from "@/components/dashboard/ExecutionHistory";
import { TabNavigation } from "@/components/dashboard/TabNavigation";
import { TerminalOutput } from "@/components/dashboard/TerminalOutput";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useExecutionHistory } from "@/hooks/useExecutionHistory";
import { getRoles } from "@/lib/api";
import type { AgentConfig, AgentRole, HistoryRecord, Tab } from "@/types/agent";

export default function Home() {
  const [role, setRole] = useState("PR_REVIEWER");
  const [roles, setRoles] = useState<AgentRole[]>([
    { id: "PR_REVIEWER", name: "PR_REVIEWER" },
    { id: "SCAFFOLDER", name: "SCAFFOLDER" }
  ]);
  const [task, setTask] = useState("");
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("terminal");
  const { history, historyLoading, expandedId, setExpandedId, fetchHistory } = useExecutionHistory();
  const { logs, jsonResponse, loading, execute } = useAgentExecution(role, task, agentConfig, fetchHistory);

  useEffect(() => {
    getRoles()
      .then(data => {
        if (data?.length) {
          setRoles(data);
          setRole(current => data.some(agentRole => agentRole.id === current) ? current : data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get("role");
      const taskParam = params.get("task");
      const configParam = params.get("config");
      if (roleParam) setRole(roleParam);
      if (taskParam) setTask(taskParam);
      if (configParam) {
        try { setAgentConfig(JSON.parse(configParam)); }
        catch { /* ignore malformed config */ }
      }
      if (roleParam || taskParam || configParam) window.history.replaceState({}, "", "/");
    });
  }, []);

  const handleReexecute = (record: HistoryRecord) => {
    setRole(record.role);
    setTask(record.task);
    setActiveTab("terminal");
    setExpandedId(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-8 font-sans">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400 tracking-tight">Huascar Builder</h1>
          <p className="text-zinc-400">Agent Deployment Dashboard</p>
        </div>
        <Link href="/agents/new" className="w-fit rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20">
          Crear agente
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <AgentForm
          role={role}
          roles={roles}
          task={task}
          loading={loading}
          onRoleChange={setRole}
          onTaskChange={setTask}
          onDeploy={execute}
        />

        <div className="flex flex-col gap-6">
          <TabNavigation activeTab={activeTab} historyCount={history.length} onTabChange={setActiveTab} />
          {activeTab === "terminal" && <TerminalOutput logs={logs} jsonResponse={jsonResponse} />}
          {activeTab === "history" && (
            <ExecutionHistory
              history={history}
              loading={historyLoading}
              expandedId={expandedId}
              onRefresh={fetchHistory}
              onToggle={setExpandedId}
              onReexecute={handleReexecute}
            />
          )}
        </div>
      </div>
    </div>
  );
}
