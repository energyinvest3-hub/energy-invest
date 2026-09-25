import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>Este caminho ainda não recebe sol.</h1>
      <p>A página ou o projeto não foi encontrado.</p>
      <Link className="button primary" href="/">
        Voltar ao início
      </Link>
    </main>
  );
}
