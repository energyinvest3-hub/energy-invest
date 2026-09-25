import { LegalCopy } from "@/components/profile";
import Link from "next/link";
export default function Page() {
  return (
    <main className="public-legal">
      <Link href="/cadastro">← Voltar</Link>
      <section className="surface">
        <LegalCopy section="privacidade" />
      </section>
    </main>
  );
}
