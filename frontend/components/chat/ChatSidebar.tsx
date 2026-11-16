"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Bug,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { authRequest, getAuthPayload } from "@/lib/auth-api";
import ConfirmModal from "@/components/ConfirmModal";

interface ChatSession {
  session_id: string;
  repo_link: string;
  title?: string | null;
  updated_at?: string;
  last_activity?: string;
  last_message: string | null;
}

interface SidebarUser {
  name: string;
  email: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function repositoryName(repoLink: string) {
  const parts = repoLink.replace(/\/+$/, "").split("/");
  return parts.slice(-2).join("/") || repoLink;
}

export default function ChatSidebar({
  user,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: {
  user: SidebarUser | null;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySession, setBusySession] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | "all" | null>(null);
  const [editingSession, setEditingSession] = useState("");
  const [editingTitle, setEditingTitle] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const payload = asRecord(await getAuthPayload("api/chats/sessions"));
      const values = payload?.sessions;

      if (!Array.isArray(values)) {
        throw new Error("The server returned an unexpected chat list.");
      }

      setSessions(
        values.filter((value): value is ChatSession => {
          const session = asRecord(value);
          return (
            typeof session?.session_id === "string" &&
            typeof session.repo_link === "string" &&
            (typeof session.last_message === "string" ||
              session.last_message === null)
          );
        }),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load chat history.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSessions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSessions, pathname]);

  useEffect(() => {
    const refresh = () => void loadSessions();
    window.addEventListener("bugkill:sessions-updated", refresh);
    return () => window.removeEventListener("bugkill:sessions-updated", refresh);
  }, [loadSessions]);

  async function handleLogout() {
    setLogoutError("");

    try {
      const response = await authRequest("api/users/logout", {
        method: "POST",
        retry: false,
      });

      if (!response.ok) {
        throw new Error("Unable to log out. Please try again.");
      }

      router.replace("/");
      router.refresh();
    } catch (logoutFailure) {
      setLogoutError(
        logoutFailure instanceof Error
          ? logoutFailure.message
          : "Unable to log out. Please try again.",
      );
    }
  }

  async function confirmDeleteSession() {
    if (!confirmDelete) return;
    setBusySession(confirmDelete);
    setError("");
    try {
      const response = await authRequest(
        confirmDelete === "all"
          ? "api/chats/sessions"
          : `api/chats/sessions/${encodeURIComponent(confirmDelete)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Unable to delete the selected chat.");
      if (confirmDelete === "all" || pathname === `/chat/${confirmDelete}`) router.replace("/chat");
      window.dispatchEvent(new Event("bugkill:sessions-updated"));
      setConfirmDelete(null);
      await loadSessions();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete the chat.");
    } finally {
      setBusySession("");
    }
  }

  async function saveTitle(sessionId: string) {
    const title = editingTitle.trim();
    if (!title) return;
    setBusySession(sessionId);
    try {
      const response = await authRequest(`api/chats/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error("Unable to rename this chat.");
      setEditingSession("");
      await loadSessions();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Unable to rename this chat.");
    } finally {
      setBusySession("");
    }
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-white/10 bg-[#0e111b] p-3 text-white transition-transform duration-200 md:relative md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${collapsed ? "md:w-[4.5rem]" : "md:w-72"}`}
    >
      <div
        className={`mb-5 flex items-center ${
          collapsed ? "md:justify-center" : "justify-between"
        }`}
      >
        <Link
          href="/chat"
          onClick={onCloseMobile}
          aria-label="BugKill AI home"
          className="flex min-w-0 items-center gap-2 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Bug className="h-6 w-6 shrink-0 text-indigo-400" />
          <span className={collapsed ? "md:hidden" : ""}>
            <span className="font-bold">BugKill</span>{" "}
            <span className="font-bold text-indigo-400">AI</span>
          </span>
        </Link>
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
          className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white md:block"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <Link
        href="/chat"
        onClick={onCloseMobile}
        title="New chat"
        className={`mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-medium transition hover:border-indigo-400/40 hover:bg-indigo-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          collapsed ? "md:justify-center md:px-0" : ""
        }`}
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className={collapsed ? "md:hidden" : ""}>New chat</span>
      </Link>

      <div className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-slate-500 ${collapsed ? "md:hidden" : ""}`}>
        <span>Recent repositories</span>
        {sessions.length > 0 && (
          <button type="button" onClick={() => setConfirmDelete("all")} className="normal-case text-[11px] font-normal text-red-300 hover:text-red-200">Delete all</button>
        )}
      </div>

      <nav aria-label="Chat history" className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-5 text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!loading && sessions.length === 0 && !error && (
          <p className={`px-2 py-3 text-xs leading-5 text-slate-500 ${collapsed ? "md:hidden" : ""}`}>
            Your analyzed repositories will appear here.
          </p>
        )}
        {sessions.map((session) => {
          const href = `/chat/${encodeURIComponent(session.session_id)}`;
          const active = pathname === href;

          return (
            <div
              key={session.session_id}
              className={`group flex items-center gap-1 rounded-lg ${
                active ? "bg-white/10" : "hover:bg-white/[0.06]"
              }`}
            >
              <Link
                href={href}
                onClick={onCloseMobile}
                title={repositoryName(session.repo_link)}
                className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  active ? "text-white" : "text-slate-300"
                } ${collapsed ? "md:justify-center md:px-0" : ""}`}
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-slate-500" />
                <span className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : ""}`}>
                  {editingSession === session.session_id ? (
                    <input
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onBlur={() => void saveTitle(session.session_id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveTitle(session.session_id);
                        if (event.key === "Escape") setEditingSession("");
                      }}
                      autoFocus
                      className="w-full rounded border border-indigo-400/40 bg-[#090b14] px-2 py-1 text-xs text-white outline-none"
                    />
                  ) : (
                    <>
                      <span className="block truncate">{session.title?.trim() || repositoryName(session.repo_link)}</span>
                      {(session.updated_at || session.last_activity) && (
                        <span className="mt-0.5 block text-[10px] text-slate-500">
                          {new Date(session.updated_at || session.last_activity || "").toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </Link>
              {!collapsed && (
                <div className="flex opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button type="button" aria-label="Rename chat" title="Rename chat" onClick={() => { setEditingSession(session.session_id); setEditingTitle(session.title?.trim() || repositoryName(session.repo_link)); }} className="rounded p-1.5 text-slate-500 hover:bg-white/10 hover:text-indigo-300">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Delete chat" title="Delete chat" disabled={busySession === session.session_id} onClick={() => setConfirmDelete(session.session_id)} className="mr-1 rounded p-1.5 text-slate-500 hover:bg-white/10 hover:text-red-300 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {(error || logoutError) && (
        <div
          role="alert"
          className={`mb-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-200 ${collapsed ? "md:hidden" : ""}`}
        >
          {error || logoutError}
          {error && (
            <button
              type="button"
              onClick={() => void loadSessions()}
              className="ml-1 underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div
        className={`mt-3 border-t border-white/10 pt-3 ${
          collapsed ? "md:flex md:justify-center" : ""
        }`}
      >
        <div
          className={`flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 ${
            collapsed ? "md:hidden" : ""
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-200">
            {user?.name?.slice(0, 1).toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name || "Account"}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          title="Log out"
          className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
            collapsed ? "md:mt-0 md:w-auto md:justify-center md:px-2" : ""
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={collapsed ? "md:hidden" : ""}>Log out</span>
        </button>
      </div>
      <ConfirmModal
        open={Boolean(confirmDelete)}
        title={confirmDelete === "all" ? "Delete all chats?" : "Delete this chat?"}
        description={confirmDelete === "all" ? "All of your repositories and chat history will be removed." : "This repository session and its chat history will be removed."}
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void confirmDeleteSession()}
      />
    </aside>
  );
}
