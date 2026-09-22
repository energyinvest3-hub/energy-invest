"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Não conseguimos carregar esta página.</h1>
      <p>
        Tente novamente em instantes. Se o problema persistir, verifique a
        configuração da conta.
      </p>
      <button className="button primary" onClick={reset}>
        Tentar novamente
      </button>
    </main>
  );
}
