# Requisitos do Caderno de Pedidos

Requisitos derivados do levantamento da Atividade Extensionista I (gestão manual e fragmentada de pedidos em pequenos negócios de alimentação de Salvador/BA) e organizados por prioridade para o empreendedor.

## Atores

- **Atendente/empreendedor(a):** quem recebe o pedido (geralmente pelo WhatsApp), anota, prepara ou entrega e confere o caixa. No negócio pequeno costuma ser a mesma pessoa.
- **Cliente final:** não usa o app; recebe as mensagens prontas pelo WhatsApp.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF01 | Registrar um pedido informando o que foi pedido, o valor total, a forma de pagamento (Pix, dinheiro, cartão, outro), se já foi pago e se é entrega ou retirada. | Alta |
| RF02 | Permitir informar, de forma opcional, nome ou apelido do cliente, WhatsApp, endereço de entrega e observação. | Alta |
| RF03 | Numerar os pedidos automaticamente por dia (nº 1, 2, 3…), recomeçando a cada dia. | Alta |
| RF04 | Avançar o andamento do pedido com um único toque: recebido → em preparo → pronto → saiu para entrega → entregue (na retirada, pronto → retirado). | Alta |
| RF05 | Listar os pedidos em aberto (inclusive de dias anteriores), os do dia e os concluídos do dia. | Alta |
| RF06 | Marcar e desmarcar o pedido como pago. | Alta |
| RF07 | Gerar mensagem pronta para o WhatsApp do cliente conforme a etapa do pedido (confirmação, em preparo, pronto, saiu, finalizado, cancelado) e lembrete de pagamento com a chave Pix. | Alta |
| RF08 | Exibir o resumo de um dia: total vendido, já recebido, a receber, quantidade de pedidos, valor médio, entregas, retiradas, cancelados e totais por forma de pagamento. | Média |
| RF09 | Compartilhar o resumo do dia pelo WhatsApp. | Baixa |
| RF10 | Editar e cancelar pedidos. | Média |
| RF11 | Desfazer a última ação (avançar, pagar, cancelar, criar, editar, limpar). | Alta |
| RF12 | Identificar quem está usando o app ao abrir e manter o registro de acessos (nome, data e hora), com exportação em planilha CSV e envio pelo WhatsApp. | Média |
| RF13 | Configurar nome do negócio e chave Pix, usados no topo e nas mensagens. | Média |
| RF14 | Salvar e restaurar cópia de segurança em arquivo. | Média |
| RF15 | Apagar pedidos finalizados com mais de 30 dias e apagar todos os dados. | Média |

## Requisitos não funcionais

| ID | Categoria | Requisito |
| --- | --- | --- |
| RNF01 | Usabilidade | Linguagem simples, sem termos técnicos; no máximo dois campos obrigatórios por pedido. |
| RNF02 | Acessibilidade | Alvos de toque de no mínimo 48 px, letra base de 18 px com opções grande e enorme, modo de alto contraste, rótulo em todos os campos, foco visível e avisos anunciados a leitores de tela (WCAG 2.2). |
| RNF03 | Acessibilidade | A cor nunca é a única forma de informação: todo status tem texto. |
| RNF04 | Portabilidade | Funcionar no navegador de celulares Android e iPhone e em computadores, sem instalação obrigatória. |
| RNF05 | Disponibilidade | Funcionar sem internet depois do primeiro acesso (service worker) e poder ser instalado na tela inicial (PWA). |
| RNF06 | Custo | Custo zero para o negócio: sem servidor pago, sem cadastro e sem mensalidade. |
| RNF07 | Privacidade/LGPD | Dados guardados apenas no aparelho; coleta mínima e opcional de dados do cliente; aviso sobre o registro de acessos; meios de apagar os dados. |
| RNF08 | Desempenho | Abrir em menos de 2 segundos em celular de entrada; sem bibliotecas externas. |
| RNF09 | Confiabilidade | Dados corrompidos ou de backup inválido não podem travar o app (normalização ao carregar). |
| RNF10 | Manutenibilidade | Regras de negócio separadas da interface (`js/core.js`) e cobertas por testes automatizados. |

## Relação com os 7 princípios do Desenho Universal

| Princípio | Como aparece no app |
| --- | --- |
| 1. Uso equitativo | Gratuito, roda em qualquer celular com navegador, sem cadastro. |
| 2. Flexibilidade no uso | Funciona com ou sem nome/WhatsApp do cliente; três tamanhos de letra; tema claro ou alto contraste. |
| 3. Uso simples e intuitivo | Um botão principal por pedido, sempre com o próximo passo escrito ("Ficou pronto →"). |
| 4. Informação de fácil percepção | Status com texto e cor, ícones sempre acompanhados de palavra, valores em reais formatados. |
| 5. Tolerância ao erro | Botão "Desfazer" após cada ação, validação explicando o que falta, confirmação antes de apagar tudo. |
| 6. Baixo esforço físico | Poucos toques por pedido, botões grandes, valores padrão iguais aos do último pedido. |
| 7. Tamanho e espaço para uso | Alvos de toque grandes, menu fixo embaixo ao alcance do polegar, layout para tela pequena. |
