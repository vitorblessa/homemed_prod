export const metadata = {
  title: 'Termos de Uso — HomeMed',
  description: 'Termos e condições de uso do HomeMed.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border p-6 sm:p-10 space-y-5 text-slate-800 dark:text-slate-200">
        <header>
          <h1 className="text-3xl font-bold">Termos de Uso</h1>
          <p className="text-sm text-muted-foreground mt-1">HomeMed — vigência: junho de 2025</p>
        </header>

        <section>
          <h2 className="font-semibold text-xl">1. Aceitação</h2>
          <p className="text-sm">Ao criar uma conta ou usar o HomeMed você concorda com estes Termos e com a nossa <a href="/privacy" className="text-blue-600 underline">Política de Privacidade</a>.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl">2. Natureza do serviço</h2>
          <p className="text-sm">O HomeMed é uma <b>ferramenta de organização de farmácia doméstica</b>. Ele armazena informações que você cadastra sobre medicamentos, alerta sobre validades/estoques e oferece consulta em linguagem natural.</p>
          <p className="text-sm mt-2"><b>Não é um serviço médico</b>: não realiza diagnósticos, não receita medicamentos e não substitui o atendimento por um profissional de saúde. Em caso de sintomas ou dúvidas clínicas, procure um médico ou farmacêutico.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl">3. Elegibilidade</h2>
          <p className="text-sm">Você deve ter idade legal para consentir com o tratamento dos seus dados. Ao usar em nome da família, você é responsável pelo cadastro adequado dos convidados.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl">4. Sua conta</h2>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Guarde sua senha com segurança; você é responsável pelas atividades feitas pela sua conta.</li>
            <li>Não compartilhe credenciais e mantenha o e-mail atualizado.</li>
            <li>Podemos suspender contas em caso de uso indevido, tentativa de fraude ou violação destes termos.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-xl">5. Conteúdo enviado</h2>
          <p className="text-sm">Você garante que as informações cadastradas são suas, corretas e não violam direitos de terceiros. Você nos concede licença limitada para armazenar e processar essas informações exclusivamente para operar o serviço.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl">6. Compartilhamento familiar</h2>
          <p className="text-sm">Ao criar uma família ou aceitar um convite, você concorda que os medicamentos ficarão visíveis aos membros da mesma família. Ao sair, o histórico permanece com os que ficam.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl">7. Assistente inteligente</h2>
          <p className="text-sm">O assistente de IA usa modelos de terceiros. As respostas podem conter imprecisões e não são aconselhamento profissional. Sempre consulte um farmacêutico ou médico para orientações clínicas.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl">8. Disponibilidade</h2>
          <p className="text-sm">Buscamos manter o serviço disponível, mas ele pode sofrer interrupções para manutenção, atualizações ou falhas de terceiros. Não oferecemos SLA formal nesta versão.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl">9. Limitação de responsabilidade</h2>
          <p className="text-sm">O uso do HomeMed é por conta e risco do usuário. Não nos responsabilizamos por danos decorrentes do uso ou impossibilidade de uso, incluídos prejuízos indiretos, no limite permitido em lei.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl">10. Encerramento</h2>
          <p className="text-sm">Você pode encerrar sua conta a qualquer momento em Configurações → Gerenciar conta ou pela <a href="/delete-account" className="text-blue-600 underline">página de exclusão</a>. Podemos encerrar contas em desacordo com estes Termos.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl">11. Alterações</h2>
          <p className="text-sm">Podemos atualizar estes Termos. Continuar usando o serviço após a atualização implica em aceitação.</p>
        </section>

        <section>
          <h2 className="font-semibold text-xl">12. Contato / Lei aplicável</h2>
          <p className="text-sm">Estes Termos são regidos pelas leis do Brasil. Dúvidas: <a href="mailto:suporte@homemed.app" className="text-blue-600 underline">suporte@homemed.app</a> (placeholder — substituir pelo canal oficial ao publicar).</p>
          <p className="text-xs text-muted-foreground mt-3">Titular / Empresa responsável: <i>[a preencher antes da publicação na Play Store]</i></p>
        </section>

        <footer className="pt-4 border-t text-xs text-muted-foreground">
          <a href="/" className="text-blue-600 underline">Voltar ao HomeMed</a> · <a href="/privacy" className="text-blue-600 underline">Privacidade</a> · <a href="/delete-account" className="text-blue-600 underline">Excluir conta</a>
        </footer>
      </div>
    </div>
  )
}
