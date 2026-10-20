// Irish Course Invitational private tournament API
// Deploy as Supabase Edge Function: tournament-api
// Required function secrets: FOURSOME_1_CODE, FOURSOME_2_CODE, FOURSOME_3_CODE, ADMIN_CODE
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are supplied by Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const encoder = new TextEncoder();
const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};
const newToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};
const cleanState = (input: any) => {
  const s = structuredClone(input);
  delete s.adminCode;
  delete s.accessCodes;
  return s;
};
const getState = async () => {
  const { data, error } = await supabase.from("tournament_state")
    .select("state,updated_at").eq("id", "irish-course-invitational").maybeSingle();
  if (error) throw error;
  if (!data?.state) throw new Error("Tournament data has not been initialized.");
  return data;
};
const saveState = async (state: any) => {
  const updated_at = new Date().toISOString();
  const { error } = await supabase.from("tournament_state")
    .upsert({ id: "irish-course-invitational", state, updated_at }, { onConflict: "id" });
  if (error) throw error;
  return updated_at;
};
const validScores = (scores: any) =>
  Array.isArray(scores) && scores.length === 4 &&
  scores.every((row: any) => Array.isArray(row) && row.length === 18 &&
    row.every((v: any) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 20)));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "verify") {
      const code = String(body.code || "").trim().toUpperCase();
      const requestedGroup = Number(body.groupId);
      let role: "admin" | "group" | null = null;
      let groupId: number | null = null;
      if (code && code === (Deno.env.get("ADMIN_CODE") || "").trim().toUpperCase()) {
        role = "admin";
      } else {
        for (const n of [1, 2, 3]) {
          const expected = (Deno.env.get(`FOURSOME_${n}_CODE`) || "").trim().toUpperCase();
          if (requestedGroup === n && code && code === expected) {
            role = "group"; groupId = n; break;
          }
        }
      }
      if (!role) return json({ error: "Invalid access code." }, 401);
      const token = newToken();
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("tournament_sessions").insert({
        token_hash: await hashToken(token), role, group_id: groupId, expires_at: expiresAt,
      });
      if (error) throw error;
      return json({ token, role, groupId, expiresAt });
    }

    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return json({ error: "Sign in to view the tournament." }, 401);
    const { data: session, error: sessionError } = await supabase.from("tournament_sessions")
      .select("role,group_id,expires_at").eq("token_hash", await hashToken(token)).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
      return json({ error: "Your session expired. Please enter your access code again." }, 401);
    }

    if (action === "load") {
      const data = await getState();
      return json({ state: cleanState(data.state), updated_at: data.updated_at, role: session.role, groupId: session.group_id });
    }

    if (action === "save_group") {
      if (session.role !== "group" || !session.group_id) return json({ error: "Foursome access required." }, 403);
      const incomingScores = body.playerScores;
      if (!validScores(incomingScores)) return json({ error: "Invalid scorecard payload." }, 400);
      const data = await getState();
      const current = data.state;
      const group = current.groups?.find((g: any) => Number(g.id) === Number(session.group_id));
      if (!group) return json({ error: "Foursome not found." }, 404);
      // Merge only the authenticated group's scores into the latest shared state.
      // Names, handicaps, other groups, access codes, and course settings are server-controlled.
      group.playerScores = incomingScores;
      if (Array.isArray(body.activity) && body.activity.length) {
        const safeActivity = body.activity.slice(-10).map((a: any) => ({
          message: String(a.message || "").slice(0, 180),
          time: String(a.time || new Date().toISOString()).slice(0, 40),
        }));
        current.activity = [...(Array.isArray(current.activity) ? current.activity : []), ...safeActivity].slice(-100);
      }
      const updated_at = await saveState(current);
      return json({ ok: true, updated_at });
    }

    if (action === "admin_save") {
      if (session.role !== "admin") return json({ error: "Administrator access required." }, 403);
      const data = await getState();
      const current = data.state;
      const incomingGroups = body.groups;
      if (!Array.isArray(incomingGroups) || incomingGroups.length !== 3) return json({ error: "Invalid player settings." }, 400);
      for (const currentGroup of current.groups) {
        const incoming = incomingGroups.find((g: any) => Number(g.id) === Number(currentGroup.id));
        if (!incoming || !Array.isArray(incoming.players) || incoming.players.length !== 4 ||
            !Array.isArray(incoming.handicaps) || incoming.handicaps.length !== 4) {
          return json({ error: "Invalid player settings." }, 400);
        }
        currentGroup.name = String(incoming.name || currentGroup.name).slice(0, 80);
        currentGroup.players = incoming.players.map((p: any) => String(p || "").slice(0, 80));
        currentGroup.handicaps = incoming.handicaps.map((h: any) => {
          const n = Number(h);
          return Number.isFinite(n) ? Math.max(-54, Math.min(54, Math.trunc(n))) : 0;
        });
      }
      const updated_at = await saveState(current);
      return json({ ok: true, state: cleanState(current), updated_at });
    }

    if (action === "reset_scores") {
      if (session.role !== "admin") return json({ error: "Administrator access required." }, 403);
      const data = await getState();
      const current = data.state;
      // Deliberately reset scores only. Keep roster, handicaps, access codes, and course settings.
      current.groups.forEach((g: any) => { g.playerScores = Array.from({ length: 4 }, () => Array(18).fill("")); });
      current.activity = [];
      current.activity.push({ message: "Administrator reset all tournament scores", time: new Date().toISOString() });
      const updated_at = await saveState(current);
      return json({ ok: true, state: cleanState(current), updated_at });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error("tournament-api error", e);
    return json({ error: "Tournament service error. Check the Supabase function logs." }, 500);
  }
});
