"use client";
import React, { useState } from "react";
import { postSettings } from "@/lib/api";

export default function SettingsPanel() {
  const [threads, setThreads] = useState<number>(4);
  const [hashMb, setHashMb] = useState<number>(256);
  const [ownBook, setOwnBook] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>("");

  async function apply() {
    setMsg("Applying...");
    try {
      const res = await postSettings({
        Threads: threads,
        USI_Hash: hashMb,
        USI_OwnBook: ownBook,
      });
      setMsg(`OK: ${JSON.stringify(res.applied)}`);
    } catch (e: unknown) {
      if (e instanceof Error) setMsg(`Error: ${e.message}`);
      else setMsg(`Error: ${String(e)}`);
    }
  }

  return (
    <div className="rounded-xl border p-3 space-y-3">
      <div className="font-semibold">Engine Settings</div>
      <div className="flex items-center gap-2">
        <label className="w-24">Threads</label>
        <input type="number" value={threads}
          onChange={e=>setThreads(parseInt(e.target.value || "0"))}
          className="border rounded px-2 py-1 w-28"/>
      </div>
      <div className="flex items-center gap-2">
        <label className="w-24">Hash (MB)</label>
        <input type="number" value={hashMb}
          onChange={e=>setHashMb(parseInt(e.target.value || "0"))}
          className="border rounded px-2 py-1 w-28"/>
      </div>
      <div className="flex items-center gap-2">
        <label className="w-24">Book</label>
        <input type="checkbox" checked={ownBook} onChange={e=>setOwnBook(e.target.checked)} />
      </div>
      <button onClick={apply} className="rounded-xl border px-3 py-1">
        Apply
      </button>
      {msg && <div className="text-xs opacity-70">{msg}</div>}
    </div>
  );
}
