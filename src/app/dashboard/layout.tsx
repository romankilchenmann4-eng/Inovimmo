import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import ImpersonationBanner from "@/components/layout/ImpersonationBanner";
import type { Profile } from "@/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: adminProfile } = await supabase
    .from("profiles").select("*").eq("id", user.id).maybeSingle();

  // Pending users can't access the dashboard
  if (adminProfile?.status === "pending") {
    redirect("/auth/pending");
  }

  // Impersonation: admin can "view as" another user
  const jar = await cookies();
  const impersonateId = jar.get("inovimmo_impersonate")?.value;
  let profile: Profile | null = adminProfile as Profile | null;
  let isImpersonating = false;

  if (impersonateId && adminProfile?.role === "admin") {
    const { data: impersonated } = await supabase
      .from("profiles").select("*").eq("id", impersonateId).maybeSingle();
    if (impersonated) {
      profile = impersonated as Profile;
      isImpersonating = true;
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar profile={profile} />

      <div className="flex-1 flex flex-col min-w-0 ml-[240px]">
        <Topbar profile={profile} adminProfile={isImpersonating ? (adminProfile as Profile) : null} />
        {isImpersonating && <ImpersonationBanner profile={profile} />}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
