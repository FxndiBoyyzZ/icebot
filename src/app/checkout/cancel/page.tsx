export default function CheckoutCancel() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-4">
      <div className="text-5xl">❌</div>
      <h1 className="text-2xl font-bold">Pagamento cancelado</h1>
      <p className="text-zinc-400 text-center max-w-sm">
        Nenhuma cobrança foi realizada. Volte ao Telegram e tente novamente quando quiser.
      </p>
      <p className="text-xs text-zinc-600 mt-4">Pode fechar esta janela.</p>
    </div>
  );
}
