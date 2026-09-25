import { getAppData } from "@/lib/data";
import { AppProvider, AppShell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getAppData();
  return (
    <AppProvider initial={data}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
