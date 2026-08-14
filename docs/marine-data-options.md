# Fontes de dados marítimos — Tô no Sal

## Open-Meteo Marine

O endpoint público Marine Weather fornece previsões de ondas, direção, período e nível do mar incluindo marés. A previsão é atualizada continuamente; as fontes de modelos possuem cadências entre seis e vinte e quatro horas, conforme o modelo. A documentação alerta que a resolução de maré é limitada em áreas costeiras e não deve ser usada para navegação.

Referência: <https://open-meteo.com/en/docs/marine-weather-api>

## Stormglass

O provedor oferece um endpoint específico de marés com níveis e extremos de maré alta/baixa, além de fontes marítimas globais. A integração exige conta e chave de API.

Referência: <https://stormglass.io/global-tide-api/>

## WorldTides

O endpoint fornece alturas, extremos, datum e estações próximas. A integração exige chave de API e opera por créditos; a resposta inclui atribuição obrigatória.

Referência: <https://www.worldtides.info/apidocs>

## Estratégias de atualização

1. Consulta sob demanda com cache curto: o backend busca os dados quando alguém abre a página, preserva o último resultado válido por alguns minutos e mostra a data da atualização. Não requer serviço adicional.
2. Atualização agendada para banco: uma tarefa periódica atualiza um snapshot no banco; a tela usa o último snapshot mesmo se a fonte externa falhar. Requer configurar o agendador da hospedagem, mas torna a exibição mais resiliente.

## Agendamento no EasyPanel

A documentação do EasyPanel descreve duas formas de executar tarefas recorrentes: usar um cron no contêiner via Dockerfile ou acionar uma URL por serviço externo quando a aplicação usa um builder padrão. O serviço Box do EasyPanel também permite scripts agendados por expressão cron. Para este aplicativo, a alternativa mais simples é uma chamada HTTP agendada para um endpoint protegido que renova o cache marítimo.

Referências: <https://easypanel.io/docs/guides/cron-job> e <https://easypanel.io/docs/services/box>
