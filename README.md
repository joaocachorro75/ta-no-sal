# Tô no Sal

O **Tô no Sal** é uma plataforma web para descobrir estabelecimentos em Salinópolis por categoria e proximidade. A primeira versão inclui uma vitrine pública responsiva, geolocalização opcional do visitante, busca, filtros, detalhes com galeria, contato pelo WhatsApp, rota no Google Maps e um painel administrativo para operar parceiros, planos, mensalidades e destaques.

## Arquitetura

| Camada | Tecnologia | Responsabilidade |
| --- | --- | --- |
| Interface | React, TypeScript e Tailwind CSS | Vitrine pública e painel administrativo. |
| API | Express e tRPC | Catálogo, acesso administrativo, gestão e upload de imagens. |
| Dados | MySQL e Drizzle ORM | Perfis, favoritos, categorias, estabelecimentos, fotos, planos, assinaturas, solicitações PIX e destaques. |
| Arquivos | S3 no ambiente gerenciado ou volume no EasyPanel | Galerias de até seis fotos por estabelecimento. |

## Desenvolvimento local

Instale as dependências e inicie a aplicação com os comandos abaixo. Para funcionalidades que consultam o catálogo, defina `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` no ambiente local de execução; esses valores não devem ser versionados.

```bash
corepack enable
pnpm install
pnpm db:migrate
pnpm dev
```

Os comandos de qualidade são `pnpm test`, `pnpm check` e `pnpm build`. As migrations já versionadas estão em `drizzle/migrations/` e devem ser aplicadas por `pnpm db:migrate`; evite gerar migrations diretamente no ambiente de produção.

## Configuração no EasyPanel

Crie primeiro um serviço **MySQL** no mesmo projeto do EasyPanel. A documentação oficial recomenda copiar a URL de conexão interna em **Credentials** para a aplicação, mantendo o banco privado na rede do projeto.[1]

Depois, crie um serviço **App** e configure-o conforme a tabela seguinte. Para aplicações novas sem `Dockerfile`, o EasyPanel recomenda o builder Railpack; os comandos abaixo tornam a instalação e a inicialização explícitas.[2]

| Campo do EasyPanel | Valor |
| --- | --- |
| Source | GitHub → `SEU_USUARIO/to-no-sal` → branch `main` |
| Build Path | `/` |
| Builder | Railpack |
| Install Command | `corepack enable && pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` |
| Start Command | `pnpm db:migrate && pnpm start` |
| Target Port | `3000` |
| Replicas | `1` durante a primeira versão |

No campo **Environment**, cadastre as variáveis abaixo. Valores reais devem ser definidos diretamente no EasyPanel e nunca enviados ao GitHub.

| Variável | Origem / finalidade |
| --- | --- |
| `NODE_ENV` | Use `production`. |
| `DATABASE_URL` | Cole a URL interna do serviço MySQL. |
| `JWT_SECRET` | Um segredo aleatório longo para assinar o acesso administrativo. |
| `ADMIN_EMAIL` | E-mail usado para entrar em `/admin`. |
| `ADMIN_PASSWORD` | Senha forte usada para entrar em `/admin`. |
| `UPLOADS_DIR` | Use `/data/uploads`. |
| `PORT` | Use `3000`. |

Em **Storage**, adicione um volume e monte-o em `/data/uploads`. O EasyPanel alerta que o sistema de arquivos do contêiner pode ser perdido quando o serviço é recriado; por isso, o volume é necessário para preservar as fotos carregadas pelo painel.[3]

Por fim, crie um domínio, configure a porta interna `3000` e faça o primeiro deploy. O EasyPanel oferece **Enable Auto Deploy** quando a origem é GitHub, para que novos pushes na branch configurada disparem a atualização da aplicação.[4]

### Atualização automática gratuita de ondas e maré

Após o primeiro deploy, configure uma chamada HTTP recorrente a cada **30 minutos** para `POST https://SEU_DOMINIO/api/scheduled/refresh-marine`. A rota é pública porque a informação exibida é pública; ela respeita o cache de dez minutos, portanto chamadas repetidas não provocam nova consulta à fonte antes desse intervalo. O endpoint retorna a hora da leitura, mantém a última resposta válida por até vinte e quatro horas se a fonte ficar indisponível e salva esse snapshot no volume do aplicativo para sobreviver a reinícios. O EasyPanel documenta tarefas recorrentes por cron e, para aplicações sem Dockerfile, também aponta a alternativa de um serviço externo de agendamento.[5]

Depois da publicação, a ativação fica limitada a uma configuração única no painel de hospedagem: crie uma tarefa com frequência `*/30 * * * *` e requisição `POST` para a rota acima. A partir daí, o processo ocorre sozinho em segundo plano; o administrador não precisa abrir o aplicativo nem apertar qualquer botão.

### Perfis, PIX e assinaturas

O aplicativo oferece três papéis: **usuário**, que pode guardar favoritos em `/conta`; **dono de estabelecimento**, que usa `/parceiro` para cadastrar e editar apenas seus próprios locais, solicitar assinatura ou destaque e enviar comprovante; e **administrador**, que opera tudo em `/admin`.

O pagamento ocorre por **PIX com confirmação manual do administrador**. Depois do primeiro acesso administrativo, abra a aba **PIX** em `/admin` e informe o nome do recebedor, a chave PIX e as instruções de pagamento. O parceiro solicita o plano em `/parceiro`, vê os dados PIX, envia o comprovante e aguarda a conferência. Somente o botão **Confirmar pagamento** do administrador ativa ou renova a assinatura, ou libera o período de destaque.

Após o primeiro deploy, crie também uma tarefa diária que faça `POST https://SEU_DOMINIO/api/scheduled/suspend-expired-subscriptions`. Uma frequência adequada é `0 5 * * *`. A rota é idempotente: ela identifica a assinatura básica vencida mais recente de cada estabelecimento, marca-a como atrasada e retira estabelecimentos não demonstrativos da vitrine até uma nova confirmação PIX.

> Antes de ativar a vitrine para o público, entre em `/admin`, cadastre as categorias e crie os estabelecimentos. O primeiro login no EasyPanel usa `ADMIN_EMAIL` e `ADMIN_PASSWORD`; no ambiente gerenciado, a conta proprietária também mantém acesso administrativo via OAuth.

O banco da primeira instalação começa **sem estabelecimentos fictícios**. Dessa forma, a vitrine pública só passa a exibir informações fornecidas e aprovadas pelos próprios parceiros locais.

## Fluxo de publicação

O fluxo operacional é deliberadamente simples: alterações são revisadas localmente, passam por `pnpm test`, `pnpm check` e `pnpm build`, são enviadas para a branch `main` no GitHub e o EasyPanel executa o deploy automático. As migrations acompanham o código e são aplicadas no início de cada nova instância pelo comando de inicialização configurado acima.

## Referências

[1]: https://easypanel.io/docs/services/mysql "EasyPanel — MySQL Service"
[2]: https://easypanel.io/docs/builders "EasyPanel — Builders"
[3]: https://easypanel.io/docs/services/app "EasyPanel — App Service: Storage"
[4]: https://easypanel.io/docs/services/app "EasyPanel — App Service: GitHub e Auto Deploy"
[5]: https://easypanel.io/docs/guides/cron-job "EasyPanel — Cron Jobs"
