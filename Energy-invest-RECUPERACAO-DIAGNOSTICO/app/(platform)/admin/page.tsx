import { supabaseServer } from "@/lib/supabase/server";
import { AdminPage } from "@/components/admin";
import { EmptyState } from "@/components/ui";

type AdminData = Record<string, Record<string, unknown>[]>;

const emptyData: AdminData = {
  profiles: [],
  wallets: [],
  solar_projects: [],
  user_projects: [],
  deposits: [],
  withdrawals: [],
  transactions: [],
  project_credits: [],
  goal_definitions: [],
  user_rewards: [],
  referral_rewards: [],
  referral_program_settings: [],
  project_distributions: [],
  admin_audit_logs: [],
};

export default async function Admin() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return (
      <EmptyState
        title="Entre na conta administrativa"
        description="Faça login para acessar o painel de administração."
        href="/login"
        label="Ir para login"
      />
    );
  }

  const { data, error } = await db.rpc("admin_dashboard_snapshot");

  if (error) {
    return (
      <EmptyState
        title="Acesso administrativo indisponível"
        description="Sua sessão pode estar desatualizada ou sem permissão. Saia da conta, entre novamente e tente outra vez."
        href="/perfil"
        label="Voltar ao perfil"
      />
    );
  }

  const records = {
    ...emptyData,
    ...((data && typeof data === "object" ? data : {}) as AdminData),
  };

  return <AdminPage records={records} />;
}
