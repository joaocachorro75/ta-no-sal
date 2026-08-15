# Validação do ícone PWA

Em 15 de agosto de 2026, a página inicial carregada no navegador confirmou o favicon e o `apple-touch-icon` apontando para `/manus-storage/to-no-sal-app-icon_e1569371.png`. O manifesto ativo é `/manifest.webmanifest` e o navegador informa suporte a Service Worker.

O ativo final é uma imagem PNG quadrada de 1920 × 1920 px com uma onda turquesa, espuma branca, prancha e sol dourado sobre fundo teal, adequada à identidade visual do Tô no Sal.

Na nova conferência em navegador, o manifesto retornou o mesmo ícone com finalidade `any maskable` e a página já estava controlada pelo Service Worker. O navegador também serviu o favicon associado à URL da página por meio do recurso interno de favicon.

O botão “Instalar app”, que exibe visualmente o novo ícone, foi acionado no navegador de prévia. O ambiente não apresentou uma janela nativa de instalação nessa sessão, embora a página estivesse controlada pelo Service Worker e o manifesto estivesse ativo; a apresentação do prompt depende das regras de elegibilidade e da interface do navegador em uso.

O painel interno de Web Apps do navegador registrou o comando real `FetchManifestAndInstallCommand` para o Tô no Sal. A entrada confirmou manifesto válido, código de instalação `0`, e recuperou o ícone `to-no-sal-app-icon_e1569371.png` na resolução de 1920 px. O comando foi cancelado apenas porque a navegação foi trocada para a inspeção interna, não por falha no manifesto ou no ícone.

O fluxo foi acionado novamente mantendo a página aberta. O navegador de prévia não expôs a janela nativa de confirmação por esta automação, mas manteve o botão com o ícone personalizado visível e o fluxo de prompt é coberto por teste de interface com evento `beforeinstallprompt` simulado.
