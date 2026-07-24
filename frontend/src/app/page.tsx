'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { AgentForm } from '@/components/dashboard/AgentForm';
import { ExecutionHistory } from '@/components/dashboard/ExecutionHistory';
import { TabNavigation } from '@/components/dashboard/TabNavigation';
import { TerminalOutput } from '@/components/dashboard/TerminalOutput';
import { useAgentExecution } from '@/hooks/useAgentExecution';
import { useExecutionHistory } from '@/hooks/useExecutionHistory';
import { getRoles } from '@/lib/api';
import type { AgentConfig, AgentRole, HistoryRecord, Tab } from '@/types/agent';

/** Maximum task length accepted from URL parameters. */
const MAX_TASK_LENGTH = 500;

/** Strip control characters (except common whitespace) to prevent injection. */
function sanitizeTask(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, MAX_TASK_LENGTH);
}

interface UrlPrefillRequest {
  role: string | null;
  task: string | null;
}

export default function Home() {
  const [role, setRole] = useState('PR_REVIEWER');
  const [roles, setRoles] = useState<AgentRole[]>([
    { id: 'PR_REVIEWER', name: 'PR_REVIEWER' },
    { id: 'SCAFFOLDER', name: 'SCAFFOLDER' },
  ]);
  const [task, setTask] = useState('');
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('terminal');
  const [prefillRequest, setPrefillRequest] = useState<UrlPrefillRequest | null>(null);
  const { history, historyLoading, expandedId, setExpandedId, fetchHistory } = useExecutionHistory();
  const { logs, jsonResponse, loading, execute } = useAgentExecution(role, task, agentConfig, fetchHistory);

  useEffect(() => {
    getRoles()
      .then((data) => {
        if (data?.length) {
          setRoles(data);
          setRole((current) => (data.some((agentRole) => agentRole.id === current) ? current : data[0].id));
        }
      })
      .catch(() => {});
  }, []);

  // Parse URL params and show confirmation — never accept `config` param.
  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get('role');
      const taskParam = params.get('task');

      // Security: reject `config` param entirely — too dangerous for URL injection.
      // Only accept role and task, and only after user confirmation.
      if (roleParam || taskParam) {
        setPrefillRequest({
          role: roleParam,
          task: taskParam ? sanitizeTask(taskParam) : null,
        });
      }

      // Clean URL immediately to avoid bookmark/share propagation.
      if (params.toString()) {
        window.history.replaceState({}, '', '/');
      }
    });
  }, []);

  const handlePrefillAccept = useCallback(() => {
    if (!prefillRequest) return;
    const { role: reqRole, task: reqTask } = prefillRequest;

    // Validate role against known roles list.
    if (reqRole) {
      const isValidRole = roles.some((r) => r.id === reqRole);
      if (isValidRole) setRole(reqRole);
    }

    if (reqTask) setTask(reqTask);
    setPrefillRequest(null);
  }, [prefillRequest, roles]);

  const handlePrefillReject = useCallback(() => {
    setPrefillRequest(null);
  }, []);

  const handleReexecute = (record: HistoryRecord) => {
    setRole(record.role);
    setTask(record.task);
    setActiveTab('terminal');
    setExpandedId(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-8 font-sans">
      {/* URL prefill confirmation dialog */}
      {prefillRequest && (
        <div
          role="alertdialog"
          aria-labelledby="prefill-title"
          aria-describedby="prefill-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h2 id="prefill-title" className="text-lg font-semibold text-amber-400">
              ⚠️ External link detected
            </h2>
            <p id="prefill-desc" className="mt-2 text-sm text-zinc-300">
              A link is trying to pre-fill the following values. Do you want to apply them?
            </p>
            <dl className="mt-4 space-y-2 rounded border border-zinc-700 bg-zinc-800 p-3 text-sm">
              {prefillRequest.role && (
                <div>
                  <dt className="font-medium text-zinc-400">Role</dt>
                  <dd className="text-zinc-100">
                    {roles.some((r) => r.id === prefillRequest.role) ? (
                      prefillRequest.role
                    ) : (
                      <span className="text-red-400">{prefillRequest.role} (unknown role — will be ignored)</span>
                    )}
                  </dd>
                </div>
              )}
              {prefillRequest.task && (
                <div>
                  <dt className="font-medium text-zinc-400">Task</dt>
                  <dd className="text-zinc-100 break-words">{prefillRequest.task}</dd>
                </div>
              )}
            </dl>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={handlePrefillReject}
                className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={handlePrefillAccept}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400 tracking-tight">Huascar Builder</h1>
          <p className="text-zinc-400">Agent Deployment Dashboard</p>
        </div>
        <Link
          href="/agents/new"
          aria-label="Crear un agente nuevo"
          className="w-fit rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
        >
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
          {activeTab === 'terminal' && <TerminalOutput logs={logs} jsonResponse={jsonResponse} loading={loading} />}
          {activeTab === 'history' && (
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
