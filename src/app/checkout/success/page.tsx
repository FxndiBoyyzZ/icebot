export default function CheckoutSuccess() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-4">
      <div className="text-5xl">✅</div>
      <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
      <p className="text-zinc-400 text-center max-w-sm">
        Seu pagamento foi processado com sucesso. Volte ao Telegram — o bot enviará seu link de acesso em instantes.
      </p>
      <p className="text-xs text-zinc-600 mt-4">Pode fechar esta janela.</p>
    </div>
  );
}
