# Modelos: Imóveis no Sal e Mural do Sal

## Imóveis no Sal

Cada anúncio pertence a uma conta autenticada e possui um tipo: **aluguel fixo**, **aluguel por temporada** ou **venda**. O autor informa título, descrição, WhatsApp, localização, preço do imóvel, características e galeria. O anúncio começa como `pendente`; fica público apenas após a confirmação administrativa do pagamento PIX correspondente ao plano de anúncio semanal ou mensal. O administrador configura livremente nome, preço e disponibilidade desses planos.

| Entidade | Responsabilidade | Acesso |
|---|---|---|
| `property_listing_plans` | Planos semanal e mensal, preços e ativação | Administrador gerencia; público consulta |
| `property_listings` | Dados, tipo, preço, local, estado e proprietário do imóvel | Autor cria/edita; administrador gerencia; público vê ativos |
| `property_listing_images` | Galeria de imagens de cada imóvel | Autor e administrador gerenciam |
| `property_payment_requests` | PIX, comprovante, confirmação e duração do anúncio | Autor envia; administrador confirma ou recusa |

## Mural do Sal

Uma conta autenticada publica texto, até quatro fotos, localização opcional e a escolha explícita de permitir ou bloquear comentários. Toda postagem precisa de aprovação administrativa antes de aparecer. Curtidas são únicas por usuário. Comentários são permitidos somente quando o autor liberou a interação e também passam por aprovação administrativa.

| Entidade | Responsabilidade | Acesso |
|---|---|---|
| `mural_posts` | Texto, localização, preferência de comentários e moderação | Autor cria; administrador aprova; público vê aprovados |
| `mural_post_images` | Fotos vinculadas a uma postagem | Autor envia durante a criação |
| `mural_likes` | Uma curtida por usuário e postagem | Usuário autenticado alterna |
| `mural_comments` | Comentários moderados pelo administrador | Usuário cria se permitido; público vê aprovados |

Nenhuma postagem, comentário ou anúncio usa conteúdo inventado: a vitrine começa vazia até que usuários ou administradores publiquem conteúdo real.
