export const metadata = {
  title: 'Política de Privacidade — HomeMed',
  description: 'Como o HomeMed usa e protege seus dados.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border p-6 sm:p-10 space-y-5 text-slate-800 dark:text-slate-200">
        <header>
          <h1 className="text-3xl font-bold">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground mt-1">HomeMed — vigência: junho de 2025</p>
        </header>

        <section>
          <p>O HomeMed é uma ferramenta de organização pessoal e familiar de medicamentos. Ele <b>não realiza diagnósticos, prescrições ou tratamentos médicos</b> e não substitui a orientação de um profissional de saúde.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl mt-4">1. Dados que coletamos</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><b>Cadastrais</b>: nome, e-mail, foto de perfil (quando informados via Google).</li>
            <li><b>Autenticação</b>: hash da senha (bcrypt) quando o cadastro é por e-mail/senha; tokens de sessão gerenciados via cookie httpOnly.</li>
            <li><b>Medicamentos</b>: nome, princípio ativo, laboratório, categoria, lote, datas de fabricação/validade, quantidade, local, código de barras e observações que você cadastra.</li>
            <li><b>Família</b>: quando você cria/entra em uma família, seus medicamentos ficam visíveis aos demais membros dessa família.</li>
            <li><b>Uso da IA</b>: os textos e códigos que você envia ao Assistente ou ao cadastro por IA são processados em nossos servidores e encaminhados ao provedor de IA para gerar a resposta.</li>
            <li><b>Registros técnicos</b>: logs de acesso básicos para diagnóstico e segurança.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-xl mt-4">2. Como usamos seus dados</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Manter sua conta e sessão funcionais.</li>
            <li>Exibir seu inventário de medicamentos e alertar sobre validade/estoque.</li>
            <li>Enriquecer informações sobre medicamentos por meio de IA.</li>
            <li>Compartilhar dados apenas com membros da família que você criar/entrar.</li>
            <li>Melhorar a estabilidade e a segurança do serviço.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-xl mt-4">3. Compartilhamento com terceiros</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><b>Google (login)</b> — quando você escolhe autenticar pelo Google. Recebemos nome, e-mail e foto.</li>
            <li><b>Provedor de IA (Gemini)</b> — recebe as perguntas/inputs enviados ao Assistente. Não compartilhamos automaticamente todo o seu inventário; apenas o contexto necessário para responder.</li>
            <li>Não vendemos, alugamos ou trocamos seus dados com anunciantes.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-xl mt-4">4. Armazenamento</h2>
          <p className="text-sm">Os dados ficam em banco MongoDB acessado apenas pelo backend, sob HTTPS. Backups podem ser mantidos por tempo limitado para recuperação em caso de falha.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl mt-4">5. Cookies</h2>
          <p className="text-sm">Usamos apenas cookies estritamente necessários para autenticação (cookie de sessão httpOnly). Não usamos cookies de rastreamento publicitário.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl mt-4">6. Seus direitos</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Acessar, corrigir ou complementar seus dados a qualquer momento pelo app.</li>
            <li><b>Desativar</b> sua conta (dados preservados; login futuro reativa).</li>
            <li><b>Excluir</b> sua conta permanentemente pelo app (Configurações → Gerenciar conta) ou via <a href="/delete-account" className="text-blue-600 underline">página externa de exclusão</a>.</li>
            <li>Solicitar informações adicionais pelo contato abaixo.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-xl mt-4">7. Retenção e exclusão</h2>
          <p className="text-sm">Ao excluir sua conta, apagamos: seus medicamentos, histórico, preferências, assinaturas push e sessões. Dados compartilhados em família continuam com os demais membros; se você era o único membro, a família é removida.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl mt-4">8. Contato</h2>
          <p className="text-sm">Em caso de dúvidas sobre esta política: <a href="mailto:privacidade@homemed.app" className="text-blue-600 underline">privacidade@homemed.app</a> (placeholder — substituir pelo canal oficial ao publicar).</p>
        </section>

        <footer className="pt-4 border-t text-xs text-muted-foreground">
          <a href="/" className="text-blue-600 underline">Voltar ao HomeMed</a> · <a href="/terms" className="text-blue-600 underline">Termos de Uso</a> · <a href="/delete-account" className="text-blue-600 underline">Excluir conta</a>
        </footer>
      </div>
    </div>
  )
}
