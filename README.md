# HomeMed

App de farmácia doméstica — controle de medicamentos, validade, estoque e
identificação por foto/código de barras com IA. Construído em Next.js 15
(App Router) com MongoDB, e empacotado também como app Android via Capacitor.

## Stack

- **Next.js 15** (App Router, API routes em `app/api/[[...path]]/route.js`)
- **MongoDB** para persistência (`lib/mongo.js`)
- **Google Gemini** para reconhecimento de medicamentos e assistente de
  inventário (`lib/ai.js`)
- **Capacitor** para gerar o app Android (`/android`)

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Descrição |
|---|---|
| `MONGO_URL` | Connection string do MongoDB Atlas (Connect → Drivers → Node.js) |
| `DB_NAME` | Nome do banco (padrão: `homemed`) |
| `GEMINI_API_KEY` | Chave da API do Google AI Studio (https://aistudio.google.com/apikey) |
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth do Google, para o botão "Continuar com Google" |
| `GOOGLE_CLIENT_SECRET` | Chave secreta do mesmo cliente OAuth |
| `CORS_ORIGINS` | Origens permitidas nas rotas `/api/*` (opcional) |
| `FRAME_ANCESTORS` | Origens permitidas a enquadrar o app em iframe (opcional) |

> Nunca commite o `.env` — ele já está no `.gitignore`. Em produção, defina
> essas variáveis direto no painel da hospedagem (Vercel, Railway, etc.).

### Login com Google (OAuth próprio)

O botão "Continuar com Google" usa um fluxo OAuth 2.0 padrão implementado
nas próprias rotas de API (`/api/auth/google` e `/api/auth/google/callback`
em `app/api/[[...path]]/route.js`) — sem depender de nenhum serviço de
terceiros. Para habilitar:

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   crie (ou reutilize) um projeto e vá em **APIs e Serviços → Credenciais**.
2. **Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, adicione uma linha para
   cada domínio onde o app roda, por exemplo:
   - `https://www.homemed.tech/api/auth/google/callback`
   - `https://homemed-prod-uqag.vercel.app/api/auth/google/callback` (domínio da Vercel, útil para testes)
   - `http://localhost:3000/api/auth/google/callback` (desenvolvimento local)
4. Copie o **Client ID** e o **Client Secret** gerados para
   `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
5. Em **Tela de consentimento OAuth**, preencha nome do app, email de
   suporte e o link da política de privacidade (`/privacy`). Como o app só
   usa os escopos básicos (`openid email profile`), não é necessária
   verificação do Google para publicar — só marcar o app como "Em produção"
   (Publishing status) para não ficar limitado a usuários de teste.

## Rodando localmente

```bash
yarn install
yarn dev
```

O app sobe em `http://localhost:3000`.

## Deploy em produção (Vercel)

1. Importe este repositório em [vercel.com/new](https://vercel.com/new).
2. Em "Environment Variables", adicione `MONGO_URL`, `DB_NAME` e
   `GEMINI_API_KEY` (veja a tabela acima).
3. Clique em Deploy. O `next.config.js` já está configurado com
   `output: 'standalone'` e cabeçalhos de segurança (CSP, CORS, etc.).
4. Depois do primeiro deploy, ajuste `CORS_ORIGINS` e `FRAME_ANCESTORS`
   para a URL final de produção, em vez de `*`.

## App Android (Capacitor)

A pasta `/android` já contém o projeto nativo. Para gerar um novo build
após alterar `capacitor.config.js` ou o frontend:

```bash
yarn build
npx cap sync android
npx cap open android
```

## Estrutura

```
app/                 páginas e rotas de API (Next.js App Router)
components/          componentes de UI (shadcn/ui) e o leitor de código de barras
lib/                 conexão com MongoDB, integração de IA, exportação, utils
android/             projeto nativo gerado pelo Capacitor
public/              manifest PWA, service worker, ícones
```
