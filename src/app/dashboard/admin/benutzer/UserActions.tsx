"use client";

import { useState } from "react";
import { toast } from "sonner";

interface UserActionsProps {
  userId: string;
  userName: string;
  isBlocked: boolean;
}

export default function UserActions({ userId, userName, isBlocked: initialBlocked }: UserActionsProps) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleBlock() {
    const action = blocked ? "entsperren" : "sperren";
    if (!confirm(`${userName} wirklich ${action}?`)) return;
    setLoading("block");
    try {
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block: !blocked }),
      });
      const data = await res.json();
      if (res.ok) {
        setBlocked(!blocked);
        toast.success(`Benutzer ${blocked ? "entsperrt" : "gesperrt"}`);
      } else {
        toast.error(data.error || "Fehler");
      }
    } catch {
      toast.error("Verbindungsfehler");
    }
    setLoading(null);
  }

  async function handleDelete() {
    if (!confirm(`${userName} unwiderruflich löschen? Alle Daten gehen verloren.`)) return;
    if (!confirm("Sind Sie absolut sicher?")) return;
    setLoading("delete");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Benutzer gelöscht");
        window.location.reload();
      } else {
        toast.error(data.error || "Fehler");
      }
    } catch {
      toast.error("Verbindungsfehler");
    }
    setLoading(null);
  }

  async function handleResetPassword() {
    if (!confirm(`Passwort für ${userName} zurücksetzen? Der Benutzer erhält eine E-Mail zum Zurücksetzen.`)) return;
    setLoading("reset");
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Passwort-Reset-E-Mail gesendet an ${data.email}`);
      } else {
        toast.error(data.error || "Fehler");
      }
    } catch {
      toast.error("Verbindungsfehler");
    }
    setLoading(null);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <ImpersonateButtonSmall userId={userId} userName={userName} loading={loading} />
      <button
        onClick={handleBlock}
        disabled={loading === "block"}
        className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
          blocked
            ? "bg-green-50 text-green-700 hover:bg-green-100"
            : "bg-orange-50 text-orange-700 hover:bg-orange-100"
        } disabled:opacity-50`}
      >
        {loading === "block" ? "..." : blocked ? "Entsperren" : "Sperren"}
      </button>
      <button
        onClick={handleResetPassword}
        disabled={loading === "reset"}
        className="px-2 py-1 text-xs rounded-md font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
      >
        {loading === "reset" ? "..." : "Passwort"}
      </button>
      <button
        onClick={handleDelete}
        disabled={loading === "delete"}
        className="px-2 py-1 text-xs rounded-md font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        {loading === "delete" ? "..." : "Löschen"}
      </button>
    </div>
  );
}

function ImpersonateButtonSmall({ userId, userName, loading }: { userId: string; userName: string; loading: string | null }) {
  const [impLoading, setImpLoading] = useState(false);

  async function handleImpersonate() {
    setImpLoading(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Impersonation fehlgeschlagen");
      }
    } catch {
      toast.error("Verbindungsfehler");
    }
    setImpLoading(false);
  }

  return (
    <button
      onClick={handleImpersonate}
      disabled={impLoading || loading !== null}
      className="px-2 py-1 text-xs rounded-md font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
    >
      {impLoading ? "..." : "Imitieren"}
    </button>
  );
}