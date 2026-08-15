# Validação de ativos locais

Em 15 de agosto de 2026, a página inicial de desenvolvimento foi verificada após o bootstrap do volume. Marca, ícone de instalação, banner, logotipos, fotos dos três estabelecimentos demonstrativos e imagem do Destaque foram entregues por caminhos relativos iniciados em `/uploads/system/demo-assets/`.

O bootstrap registrou a cópia dos ativos ausentes para o diretório de uploads e a vitrine renderizou as imagens locais. A publicação no domínio EasyPanel ainda precisa ser repetida para confirmar o mesmo comportamento no volume montado em `/data/uploads`.

Na primeira validação no EasyPanel, o banner local foi confirmado como disponível em `/uploads/system/demo-assets/to-no-sal-hero.png`. A recarga da vitrine exibiu os estabelecimentos demonstrativos, mas seus registros antigos ainda apontavam para URLs externas de fotos e logotipos. Uma sincronização segura dos registros que já são identificados como demo é necessária para migrá-los para as URLs locais, sem afetar parceiros reais.
