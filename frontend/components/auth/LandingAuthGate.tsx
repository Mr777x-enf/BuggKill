"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { authRequest } from "@/lib/auth-api";

type GateState =
  | "checking"
  | "unauthenticated"
  | "unavailable";

export default function LandingAuthGate({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<GateState>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    authRequest("api/users/me")
      .then((response) => {
        if (!active) return;

        if (response.ok) {
          router.replace("/chat");
          return;
        }

        if (response.status === 401) {
          setState("unauthenticated");
          return;
        }

        setState("unavailable");
      })
      .catch(() => {
        if (active) setState("unavailable");
      });

    return () => {
      active = false;
    };
  }, [attempt, router]);

  if (state === "unavailable") {
    return (
      <>
        {children}
        <aside
          role="status"
          className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#10131e] p-4 text-white shadow-2xl"
        >
          <AlertCircle className="h-6 w-6 shrink-0 text-amber-300" />
          <p className="flex-1 text-sm leading-6 text-slate-300">
            Couldn&apos;t verify your session. Authentication may be temporarily
            unavailable.
          </p>
          <button
            type="button"
            onClick={() => {
              setState("checking");
              setAttempt((value) => value + 1);
            }}
            className="shrink-0 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-400"
          >
            Try again
          </button>
        </aside>
      </>
    );
  }

  return children;
}
