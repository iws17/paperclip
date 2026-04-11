import { useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import type { Issue } from "@paperclipai/shared";
import { heartbeatsApi, type LiveRunForIssue } from "../api/heartbeats";
import type { TranscriptEntry } from "../adapters";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { cn, relativeTime } from "../lib/utils";
import { ExternalLink, Loader2 } from "lucide-react";
import { Identity } from "./Identity";
import { useLiveRunTranscripts } from "./transcript/useLiveRunTranscripts";
import {
  displayToolName,
  summarizeToolInput,
  summarizeToolResult,
} from "../lib/transcriptPresentation";

const MIN_DASHBOARD_RUNS = 4;

function isRunActive(run: LiveRunForIssue): boolean {
  return run.status === "queued" || run.status === "running";
}

interface ActiveAgentsPanelProps {
  companyId: string;
}

export function ActiveAgentsPanel({ companyId }: ActiveAgentsPanelProps) {
  const { data: liveRuns } = useQuery({
    queryKey: [...queryKeys.liveRuns(companyId), "dashboard"],
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId, MIN_DASHBOARD_RUNS),
  });

  const runs = liveRuns ?? [];
  const { data: issues } = useQuery({
    queryKey: [...queryKeys.issues.list(companyId), "with-routine-executions"],
    queryFn: () => issuesApi.list(companyId, { includeRoutineExecutions: true }),
    enabled: runs.length > 0,
  });

  const issueById = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues ?? []) {
      map.set(issue.id, issue);
    }
    return map;
  }, [issues]);

  const { transcriptByRun, hasOutputForRun } = useLiveRunTranscripts({
    runs,
    companyId,
    maxChunksPerRun: 120,
  });

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Agents
      </h3>
      {runs.length === 0 ? (
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">No recent agent runs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {runs.map((run) => (
            <AgentRunCard
              key={run.id}
              companyId={companyId}
              run={run}
              issue={run.issueId ? issueById.get(run.issueId) : undefined}
              transcript={transcriptByRun.get(run.id) ?? []}
              hasOutput={hasOutputForRun(run.id)}
              isActive={isRunActive(run)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentRunCard({
  companyId,
  run,
  issue,
  transcript,
  hasOutput,
  isActive,
}: {
  companyId: string;
  run: LiveRunForIssue;
  issue?: Issue;
  transcript: TranscriptEntry[];
  hasOutput: boolean;
  isActive: boolean;
}) {
  return (
    <div className={cn(
      "flex h-[320px] flex-col overflow-hidden rounded-xl border shadow-sm",
      isActive
        ? "border-cyan-500/25 bg-cyan-500/[0.04] shadow-[0_16px_40px_rgba(6,182,212,0.08)]"
        : "border-border bg-background/70",
    )}>
      <div className="border-b border-border/60 px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isActive ? (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
                </span>
              ) : (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-muted-foreground/35" />
              )}
              <Identity name={run.agentName} size="sm" className="[&>span:last-child]:!text-[11px]" />
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{isActive ? "Live now" : run.finishedAt ? `Finished ${relativeTime(run.finishedAt)}` : `Started ${relativeTime(run.createdAt)}`}</span>
            </div>
          </div>

          <Link
            to={`/agents/${run.agentId}/runs/${run.id}`}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>

        {run.issueId && (
          <div className="mt-3 rounded-lg border border-border/60 bg-background/60 px-2.5 py-2 text-xs">
            <Link
              to={`/issues/${issue?.identifier ?? run.issueId}`}
              className={cn(
                "line-clamp-2 hover:underline",
                isActive ? "text-cyan-700 dark:text-cyan-300" : "text-muted-foreground hover:text-foreground",
              )}
              title={issue?.title ? `${issue?.identifier ?? run.issueId.slice(0, 8)} - ${issue.title}` : issue?.identifier ?? run.issueId.slice(0, 8)}
            >
              {issue?.identifier ?? run.issueId.slice(0, 8)}
              {issue?.title ? ` - ${issue.title}` : ""}
            </Link>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <AgentRunSummary transcript={transcript} hasOutput={hasOutput} isActive={isActive} />
      </div>
    </div>
  );
}

interface SummaryItem {
  kind: "text" | "tool" | "status";
  text: string;
  pending?: boolean;
  isError?: boolean;
}

function extractSummaryItems(transcript: TranscriptEntry[]): SummaryItem[] {
  const items: SummaryItem[] = [];

  // Collect tool call inputs and results, keyed by toolUseId
  const toolInputs = new Map<string, { name: string; input: unknown }>();

  for (const entry of transcript) {
    if (entry.kind === "tool_call") {
      toolInputs.set(entry.toolUseId ?? `tc-${items.length}`, {
        name: entry.name,
        input: entry.input,
      });
      // Will be emitted as pending until a matching result arrives
    } else if (entry.kind === "tool_result") {
      const id = entry.toolUseId;
      if (!id) continue;
      const tool = toolInputs.get(id);
      const name = tool?.name ?? entry.toolName ?? "tool";
      const input = tool?.input ?? {};
      const displayName = displayToolName(name, input);
      const resultSummary = summarizeToolResult(entry.content ?? "", entry.isError);
      const label = `${displayName} — ${resultSummary}`;
      items.push({ kind: "tool", text: label, isError: entry.isError });
      toolInputs.delete(id);
    } else if (entry.kind === "assistant" && entry.text?.trim()) {
      // Use only non-delta (complete) assistant messages
      if (!entry.delta) {
        items.push({ kind: "text", text: entry.text.trim() });
      }
    }
  }

  // Any unresolved tool calls are still pending
  for (const [, tool] of toolInputs) {
    const displayName = displayToolName(tool.name, tool.input);
    const inputSummary = summarizeToolInput(tool.name, tool.input);
    items.push({ kind: "tool", text: `${displayName} — ${inputSummary}`, pending: true });
  }

  return items;
}

function AgentRunSummary({
  transcript,
  hasOutput,
  isActive,
}: {
  transcript: TranscriptEntry[];
  hasOutput: boolean;
  isActive: boolean;
}) {
  const items = useMemo(() => extractSummaryItems(transcript), [transcript]);

  if (!hasOutput && !isActive) {
    return (
      <p className="text-[12px] text-muted-foreground/60 italic">No run output captured.</p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground/60 italic">
        {isActive ? "Waiting for run output…" : "No output."}
      </p>
    );
  }

  // Show last 6 items (most recent at bottom)
  const visible = items.slice(-6);

  return (
    <div className="space-y-1.5">
      {visible.map((item, i) => {
        if (item.kind === "text") {
          return (
            <p
              key={i}
              className="text-[12px] leading-5 text-foreground/80 line-clamp-3"
            >
              {item.text}
            </p>
          );
        }
        // tool
        return (
          <div key={i} className="flex items-start gap-1.5">
            {item.pending ? (
              <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-muted-foreground/50" />
            ) : (
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  item.isError ? "bg-destructive/70" : "bg-muted-foreground/35",
                )}
              />
            )}
            <span
              className={cn(
                "truncate text-[11px] leading-5",
                item.isError
                  ? "text-destructive/80"
                  : "text-muted-foreground/70",
              )}
            >
              {item.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
