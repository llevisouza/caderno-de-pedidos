# Diagramas

Os diagramas usam [Mermaid](https://mermaid.js.org/) e aparecem desenhados direto no GitHub.

## 1. Casos de uso (UML)

```mermaid
flowchart LR
  atendente(["👤 Atendente / empreendedor"])
  cliente(["👤 Cliente final"])

  subgraph sistema["Caderno de Pedidos"]
    uc1([Identificar quem está usando])
    uc2([Anotar pedido])
    uc3([Avançar andamento])
    uc4([Marcar como pago])
    uc5([Enviar mensagem pronta])
    uc6([Ver resumo do dia])
    uc7([Editar ou cancelar pedido])
    uc8([Desfazer ação])
    uc9([Consultar registro de acessos])
    uc10([Configurar negócio e acessibilidade])
    uc11([Salvar / restaurar cópia])
  end

  atendente --- uc1 & uc2 & uc3 & uc4 & uc6 & uc7 & uc8 & uc9 & uc10 & uc11
  uc2 -. "«extend»" .-> uc5
  uc3 -. "«extend»" .-> uc5
  uc4 -. "«extend»" .-> uc5
  uc5 --- cliente
```

## 2. Processo de atendimento com o app (BPMN simplificado)

```mermaid
flowchart TB
  subgraph C["Cliente"]
    c1((Início)) --> c2[Faz o pedido pelo WhatsApp ou balcão]
    c9[Recebe aviso pelo WhatsApp]
    c10[Recebe ou retira o pedido] --> c11((Fim))
  end

  subgraph N["Negócio (usando o Caderno de Pedidos)"]
    n1[Anota pedido: itens, valor, pagamento, entrega/retirada]
    n2{Pagou na hora?}
    n3[Marca como pago]
    n4[Fica como 'a receber']
    n5[Envia confirmação pronta]
    n6[Toca em 'Começar preparo']
    n7[Toca em 'Ficou pronto']
    n8{Entrega?}
    n9[Toca em 'Saiu para entrega']
    n10[Toca em 'Foi entregue' / 'Cliente retirou']
    n11[Fecha o dia no Resumo]
  end

  c2 --> n1 --> n2
  n2 -- sim --> n3 --> n5
  n2 -- não --> n4 --> n5
  n5 --> c9
  n5 --> n6 --> n7 --> n8
  n8 -- sim --> n9 --> c9
  n9 --> n10
  n8 -- não --> n10
  n10 --> c10
  n10 --> n11
```

## 3. Estados do pedido (UML)

```mermaid
stateDiagram-v2
  [*] --> Recebido: anotar pedido
  Recebido --> EmPreparo: Começar preparo
  EmPreparo --> Pronto: Ficou pronto
  Pronto --> SaiuParaEntrega: Saiu para entrega (entrega)
  Pronto --> Entregue: Cliente retirou (retirada)
  SaiuParaEntrega --> Entregue: Foi entregue
  Recebido --> Cancelado
  EmPreparo --> Cancelado
  Pronto --> Cancelado
  SaiuParaEntrega --> Cancelado
  Entregue --> [*]
  Cancelado --> [*]

  note right of Recebido
    "Pago" é independente do andamento:
    pode ser marcado ou desmarcado a qualquer momento.
  end note
```

## 4. Modelo de dados (UML de classes)

```mermaid
classDiagram
  class Estado {
    +int versao
    +Pedido[] pedidos
    +Acesso[] acessos
    +Contador contador
    +Config config
  }
  class Pedido {
    +string id
    +int numero
    +string criadoEm
    +string atualizadoEm
    +string cliente
    +string telefone
    +string itens
    +int valor
    +Pagamento pagamento
    +bool pago
    +Tipo tipo
    +string endereco
    +string observacao
    +Status status
    +string operador
    +Historico[] historico
  }
  class Historico {
    +Status status
    +string em
  }
  class Acesso {
    +string nome
    +string em
  }
  class Contador {
    +string dia
    +int n
  }
  class Config {
    +string loja
    +string pix
    +string fonte
    +bool contraste
  }
  class Status {
    <<enumeration>>
    recebido
    preparo
    pronto
    saiu
    entregue
    cancelado
  }
  class Pagamento {
    <<enumeration>>
    pix
    dinheiro
    cartao
    outro
  }
  class Tipo {
    <<enumeration>>
    entrega
    retirada
  }
  Estado "1" *-- "*" Pedido
  Estado "1" *-- "*" Acesso
  Estado "1" *-- "1" Contador
  Estado "1" *-- "1" Config
  Pedido "1" *-- "*" Historico
  Pedido --> Status
  Pedido --> Pagamento
  Pedido --> Tipo
```

## 5. Arquitetura

```mermaid
flowchart LR
  subgraph Celular["Celular do negócio (navegador)"]
    UI["app.js<br/>telas e eventos"] --> CORE["core.js<br/>regras de negócio"]
    UI <--> LS[("localStorage<br/>pedidos, acessos, config")]
    SW["sw.js<br/>cache offline"]
  end
  GH["GitHub Pages<br/>(arquivos estáticos)"] -- "1º acesso" --> SW
  UI -- "link wa.me com texto pronto" --> WA["WhatsApp"]
```
