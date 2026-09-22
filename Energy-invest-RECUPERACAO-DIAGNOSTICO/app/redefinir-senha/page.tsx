import { AuthPage } from "@/components/auth";
import { isDemo } from "@/lib/demo";
export const dynamic = "force-dynamic";
export default function Page() {
  return <AuthPage mode="reset" demo={isDemo()} />;
}
