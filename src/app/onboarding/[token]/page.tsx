"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

type TokenData = {
  mieter_email: string;
  mieter_vorname?: string;
  mieter_nachname?: string;
  mietbeginn?: string;
  nettomiete?: number;
  wohnung: {
    id: string;
    bezeichnung: string;
    etage: number;
    zimmer: number;
    liegenschaft: { name: string; strasse: string; hausnummer: string; plz: string; ort: string } | null;
  } | null;
};

type Step = "check" | "form" | "success" | "error";

export default function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState<Step>("check");
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    vorname: "",
    nachname: "",
    password: "",
    password2: "",
    phone: "",
    geburtsdatum: "",
    nationalitaet: "CH",
  });

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    async function validate() {
      const res = await fetch(`/api/onboarding?token=${token}`);
      const json = await res.json();
      if (!json.valid) {
        setErrorMsg(json.error ?? "Ungültige Einladung");
        setStep("error");
        return;
      }
      setTokenData(json.data as TokenData);
      setForm(f => ({
        ...f,
        vorname: json.data.mieter_vorname ?? "",
        nachname: json.data.mieter_nachname ?? "",
      }));
      setStep("form");
    }
    validate();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.password2) { toast.error("Passwörter stimmen nicht überein"); return; }
    if (form.password.length < 8) { toast.error("Passwort muss mind. 8 Zeichen haben"); return; }
    setLoading(true);

    try {
      const email = tokenData!.mieter_email;

      // 1. Create Supabase account
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: `${form.vorname} ${form.nachname}`.trim(),
            role: "mieter",
          },
        },
      });
      if (signUpError) {
        // If user already exists, try to sign in
        if (!signUpError.message.includes("already registered")) throw signUpError;
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password: form.password });
        if (loginErr) throw new Error("E-Mail bereits registriert — bitte loggen Sie sich ein");
      }

      // 2. Wait briefly for the session/profile to propagate
      await new Promise(r => setTimeout(r, 500));

      // 3. Update profile with full details
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({
          full_name: `${form.vorname} ${form.nachname}`.trim(),
          phone: form.phone,
          role: "mieter",
        }).eq("id", user.id);

        // 4. Mark token as used
        await fetch(`/api/onboarding?token=${token}`, { method: "DELETE" }).catch(() => {});

        // 5. Link to wohnung if possible
        if (tokenData?.wohnung?.id) {
          await supabase.from("wohnungen")
            .update({ mieter_id: user.id, mietbeginn: tokenData.mietbeginn ?? null, status: "vermietet" })
            .eq("id", tokenData.wohnung.id);
        }
      }

      setStep("success");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler bei der Registrierung");
    } finally {
      setLoading(false);
    }
  }

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] focus:ring-2 focus:ring-blue-100";
  const lbl = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

  // ── Loading ──────────────────────────────────────────────
  if (step === "check") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[hsl(214,76%,49%)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Einladung wird geprüft…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────
  if (step === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <p className="text-4xl mb-4">❌</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Einladung ungültig</h1>
          <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
          <Link href="/auth/login" className="text-[hsl(214,76%,49%)] text-sm font-medium hover:underline">
            Zur Anmeldung →
          </Link>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Willkommen bei Inovimmo!</h1>
          {tokenData?.wohnung && (
            <p className="text-gray-600 text-sm mb-4">
              Sie sind jetzt als Mieter für{" "}
              <strong>{tokenData.wohnung.bezeichnung}</strong>
              {tokenData.wohnung.liegenschaft ? ` in ${tokenData.wohnung.liegenschaft.name}` : ""}
              {" "}registriert.
            </p>
          )}
          <p className="text-gray-500 text-sm mb-6">
            Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen zugesandt haben.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-lg hover:bg-[hsl(214,76%,44%)] transition-colors text-sm"
          >
            Zum Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────
  const lg = tokenData?.wohnung?.liegenschaft;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-[hsl(214,76%,49%)] rounded-xl flex items-center justify-center text-xl">🏛</div>
            <span className="text-xl font-bold text-gray-900">Inovimmo</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Willkommen als Mieter!</h1>
          <p className="text-gray-500 text-sm">Erstellen Sie Ihr Konto, um Zugang zu Ihrem Mieter-Portal zu erhalten.</p>
        </div>

        {/* Wohnung Info */}
        {tokenData?.wohnung && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-2">Ihre Wohnung</p>
            <p className="font-semibold text-gray-900">{tokenData.wohnung.bezeichnung}</p>
            {lg && <p className="text-sm text-gray-600">{lg.strasse} {lg.hausnummer}, {lg.plz} {lg.ort}</p>}
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              {tokenData.wohnung.zimmer && <span>{tokenData.wohnung.zimmer} Zimmer</span>}
              {tokenData.mietbeginn && <span>ab {new Date(tokenData.mietbeginn).toLocaleDateString("de-CH")}</span>}
              {tokenData.nettomiete && <span>CHF {Number(tokenData.nettomiete).toLocaleString("de-CH")}/Mt.</span>}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Vorname</label>
                <input type="text" required className={inp} value={form.vorname} onChange={e => up("vorname", e.target.value)} placeholder="Anna" />
              </div>
              <div>
                <label className={lbl}>Nachname</label>
                <input type="text" required className={inp} value={form.nachname} onChange={e => up("nachname", e.target.value)} placeholder="Muster" />
              </div>
            </div>

            <div>
              <label className={lbl}>E-Mail</label>
              <input type="email" className={inp + " bg-gray-50 text-gray-500"} value={tokenData?.mieter_email ?? ""} readOnly />
            </div>

            <div>
              <label className={lbl}>Telefon</label>
              <input type="tel" className={inp} value={form.phone} onChange={e => up("phone", e.target.value)} placeholder="+41 79 123 45 67" />
            </div>

            <div>
              <label className={lbl}>Geburtsdatum</label>
              <input type="date" className={inp} value={form.geburtsdatum} onChange={e => up("geburtsdatum", e.target.value)} />
            </div>

            <hr className="border-gray-100" />

            <div>
              <label className={lbl}>Passwort <span className="text-red-400">*</span></label>
              <input type="password" required minLength={8} className={inp} value={form.password} onChange={e => up("password", e.target.value)} placeholder="Mind. 8 Zeichen" />
            </div>

            <div>
              <label className={lbl}>Passwort bestätigen <span className="text-red-400">*</span></label>
              <input type="password" required className={inp} value={form.password2} onChange={e => up("password2", e.target.value)} placeholder="Passwort wiederholen" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,44%)] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm mt-2"
            >
              {loading ? "Konto wird erstellt…" : "Konto erstellen & einloggen"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Mit der Registrierung akzeptieren Sie die Nutzungsbedingungen.
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Bereits ein Konto?{" "}
          <Link href="/auth/login" className="text-[hsl(214,76%,49%)] hover:underline">Einloggen</Link>
        </p>
      </div>
    </div>
  );
}
