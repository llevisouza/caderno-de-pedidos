// Testes das regras de negocio. Rodar com: npm test  (ou: node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');

const AGORA = new Date(2026, 9, 20, 12, 0, 0); // 20/10/2026 12:00 no horario local

function dadosValidos(extra) {
  return Object.assign({
    cliente: 'Maria Souza',
    telefone: '(71) 99999-1234',
    itens: '2 acarajés completos',
    valor: '25,50',
    pagamento: 'pix',
    pago: false,
    tipo: 'retirada',
    endereco: '',
    observacao: ''
  }, extra);
}

function novoPedido(extra, estado, quando) {
  const r = Core.criarPedido(dadosValidos(extra), estado || Core.estadoInicial(), quando || AGORA, 'Ana');
  assert.ok(r.pedido, 'pedido deveria ser criado: ' + (r.erros || []).join(' '));
  return r;
}

test('paraCentavos entende os formatos digitados no Brasil', () => {
  assert.equal(Core.paraCentavos('25'), 2500);
  assert.equal(Core.paraCentavos('25,5'), 2550);
  assert.equal(Core.paraCentavos('R$ 1.234,56'), 123456);
  assert.equal(Core.paraCentavos('12.50'), 1250);
  assert.ok(Number.isNaN(Core.paraCentavos('')));
  assert.ok(Number.isNaN(Core.paraCentavos('abc')));
  assert.ok(Number.isNaN(Core.paraCentavos('-5')));
});

test('formatarReais usa o padrao brasileiro', () => {
  assert.equal(Core.formatarReais(2550), 'R$ 25,50');
  assert.equal(Core.formatarReais(123456), 'R$ 1.234,56');
  assert.equal(Core.formatarReais(0), 'R$ 0,00');
  assert.equal(Core.centavosParaCampo(2550), '25,50');
});

test('validarPedido explica o que falta em linguagem simples', () => {
  const erros = Core.validarPedido({ itens: '', valor: '', pagamento: '', tipo: '' });
  assert.equal(erros.length, 4);
  assert.match(erros[0], /o que foi pedido/);
  assert.deepEqual(Core.validarPedido(dadosValidos()), []);
  assert.equal(Core.validarPedido(dadosValidos({ telefone: '9999' })).length, 1);
});

test('criarPedido numera os pedidos por dia e recomeca no dia seguinte', () => {
  const estado = Core.estadoInicial();
  const r1 = novoPedido({}, estado);
  assert.equal(r1.pedido.numero, 1);
  assert.equal(r1.pedido.valor, 2550);
  assert.equal(r1.pedido.telefone, '71999991234');
  assert.equal(r1.pedido.status, 'recebido');
  assert.equal(r1.pedido.operador, 'Ana');
  estado.contador = r1.contador;

  const r2 = novoPedido({}, estado);
  assert.equal(r2.pedido.numero, 2);
  estado.contador = r2.contador;

  const amanha = new Date(2026, 9, 21, 9, 0, 0);
  const r3 = novoPedido({}, estado, amanha);
  assert.equal(r3.pedido.numero, 1);
});

test('criarPedido nao guarda endereco em pedido de retirada', () => {
  const { pedido } = novoPedido({ tipo: 'retirada', endereco: 'Rua X, 10' });
  assert.equal(pedido.endereco, '');
});

test('o andamento segue a ordem certa para entrega e para retirada', () => {
  let entrega = novoPedido({ tipo: 'entrega', endereco: 'Rua A, 1' }).pedido;
  const passosEntrega = [];
  while (Core.proximoStatus(entrega)) {
    entrega = Core.avancar(entrega, AGORA);
    passosEntrega.push(entrega.status);
  }
  assert.deepEqual(passosEntrega, ['preparo', 'pronto', 'saiu', 'entregue']);
  assert.equal(entrega.historico.length, 5);

  let retirada = novoPedido({ tipo: 'retirada' }).pedido;
  const passosRetirada = [];
  while (Core.proximoStatus(retirada)) {
    retirada = Core.avancar(retirada, AGORA);
    passosRetirada.push(retirada.status);
  }
  assert.deepEqual(passosRetirada, ['preparo', 'pronto', 'entregue']);
  assert.equal(Core.rotuloStatus(retirada), 'Retirado');
});

test('avancar nao altera o pedido original (permite desfazer)', () => {
  const original = novoPedido().pedido;
  const depois = Core.avancar(original, AGORA);
  assert.equal(original.status, 'recebido');
  assert.equal(depois.status, 'preparo');
});

test('rotuloAcao mostra o proximo passo em palavras simples', () => {
  const p = novoPedido({ tipo: 'retirada' }).pedido;
  assert.equal(Core.rotuloAcao(p), 'Começar preparo');
  const pronto = Core.avancar(Core.avancar(p, AGORA), AGORA);
  assert.equal(Core.rotuloAcao(pronto), 'Cliente retirou');
});

test('editarPedido volta para "pronto" se a entrega virar retirada depois de sair', () => {
  let p = novoPedido({ tipo: 'entrega', endereco: 'Rua A, 1' }).pedido;
  p = Core.avancar(Core.avancar(Core.avancar(p, AGORA), AGORA), AGORA);
  assert.equal(p.status, 'saiu');
  const r = Core.editarPedido(p, dadosValidos({ tipo: 'retirada' }), AGORA);
  assert.equal(r.pedido.status, 'pronto');
  assert.equal(r.pedido.numero, p.numero);
});

test('filtrar separa pedidos em aberto, do dia e concluidos', () => {
  const ontem = new Date(2026, 9, 19, 20, 0, 0);
  const aberto = novoPedido().pedido;
  const atrasadoDeOntem = novoPedido({}, null, ontem).pedido;
  const entregue = Core.avancar(Core.avancar(Core.avancar(novoPedido().pedido, AGORA), AGORA), AGORA);
  const cancelado = Core.cancelar(novoPedido().pedido, AGORA);
  const todos = [aberto, atrasadoDeOntem, entregue, cancelado];
  const hoje = Core.dataLocal(AGORA);

  assert.deepEqual(Core.filtrar(todos, 'abertos', hoje).map((p) => p.id), [atrasadoDeOntem.id, aberto.id]);
  assert.equal(Core.filtrar(todos, 'hoje', hoje).length, 3);
  assert.equal(Core.filtrar(todos, 'concluidos', hoje).length, 2);
});

test('resumoDoDia soma vendas, separa pago e a receber e ignora cancelados', () => {
  const pedidos = [
    novoPedido({ valor: '20', pagamento: 'pix', pago: true }).pedido,
    novoPedido({ valor: '30', pagamento: 'dinheiro', pago: false, tipo: 'entrega', endereco: 'Rua B' }).pedido,
    Core.cancelar(novoPedido({ valor: '100' }).pedido, AGORA),
    novoPedido({ valor: '50' }, null, new Date(2026, 9, 19, 10, 0, 0)).pedido // outro dia
  ];
  const r = Core.resumoDoDia(pedidos, Core.dataLocal(AGORA));
  assert.equal(r.quantidade, 2);
  assert.equal(r.cancelados, 1);
  assert.equal(r.total, 5000);
  assert.equal(r.recebido, 2000);
  assert.equal(r.aReceber, 3000);
  assert.equal(r.ticketMedio, 2500);
  assert.equal(r.entregas, 1);
  assert.equal(r.retiradas, 1);
  assert.equal(r.porPagamento.pix.valor, 2000);
  assert.equal(r.porPagamento.dinheiro.quantidade, 1);
  assert.match(Core.textoResumo(r, 'Lanchonete da Ana'), /Total vendido: R\$ 50,00/);
});

test('mensagem monta textos prontos para cada etapa', () => {
  const p = novoPedido({ tipo: 'entrega', endereco: 'Rua das Flores, 20' }).pedido;
  const cfg = { loja: 'Lanchonete da Ana', pix: 'ana@exemplo.com' };
  const recebido = Core.mensagem(p, 'recebido', cfg);
  assert.match(recebido, /^Olá, Maria Souza!/);
  const seu = novoPedido({ cliente: 'Seu Raimundo' }).pedido;
  assert.match(Core.mensagem(seu, 'preparo', cfg), /^Olá, Seu Raimundo!/);
  assert.match(recebido, /nº 1/);
  assert.match(recebido, /R\$ 25,50 \(Pix\)/);
  assert.match(recebido, /Rua das Flores, 20/);
  assert.match(recebido, /Lanchonete da Ana$/);
  assert.match(Core.mensagem(p, 'saiu', cfg), /saiu para entrega/);
  assert.match(Core.mensagem(p, 'cobranca', cfg), /Chave Pix: ana@exemplo.com/);
});

test('linkWhatsApp coloca o 55 do Brasil e codifica o texto', () => {
  assert.equal(Core.linkWhatsApp('(71) 99999-1234', 'Oi tudo bem?'), 'https://wa.me/5571999991234?text=Oi%20tudo%20bem%3F');
  assert.equal(Core.linkWhatsApp('5571999991234', 'x'), 'https://wa.me/5571999991234?text=x');
  assert.equal(Core.linkWhatsApp('', 'x'), 'https://wa.me/?text=x');
});

test('registro de acessos guarda nome, data e hora e gera CSV', () => {
  let acessos = [];
  acessos = Core.registrarAcesso(acessos, 'Ana', new Date(2026, 9, 20, 8, 5));
  acessos = Core.registrarAcesso(acessos, '  ', new Date(2026, 9, 20, 8, 6)); // ignorado
  acessos = Core.registrarAcesso(acessos, 'Carlos', new Date(2026, 9, 20, 18, 30));
  acessos = Core.registrarAcesso(acessos, 'ana', new Date(2026, 9, 21, 9, 0));
  assert.equal(acessos.length, 3);
  assert.deepEqual(Core.operadoresConhecidos(acessos), ['ana', 'Carlos']);
  const csv = Core.acessosCSV(acessos, 'Lanchonete; da Ana').split('\r\n');
  assert.equal(csv[0], 'Nome;Data;Hora;Local');
  assert.equal(csv[1], 'Ana;20/10/2026;08:05;"Lanchonete; da Ana"');
  assert.equal(csv.length, 4);
});

test('limparAntigos apaga so pedidos finalizados e antigos', () => {
  const velho = new Date(2026, 7, 1, 12, 0);
  const finalizadoVelho = Core.cancelar(novoPedido({}, null, velho).pedido, velho);
  const abertoVelho = novoPedido({}, null, velho).pedido;
  const recente = Core.cancelar(novoPedido().pedido, AGORA);
  const r = Core.limparAntigos([finalizadoVelho, abertoVelho, recente], 30, AGORA);
  assert.deepEqual(r.map((p) => p.id), [abertoVelho.id, recente.id]);
});

test('normalizarEstado recupera dados corrompidos ou de backup sem quebrar', () => {
  assert.deepEqual(Core.normalizarEstado(null), Core.estadoInicial());
  const p = novoPedido().pedido;
  const e = Core.normalizarEstado({
    pedidos: [p, { lixo: true }],
    acessos: [{ nome: 'Ana', em: AGORA.toISOString() }, {}],
    config: { loja: 'X', fonte: 'gigante', contraste: 'sim' }
  });
  assert.equal(e.pedidos.length, 1);
  assert.equal(e.acessos.length, 1);
  assert.equal(e.config.fonte, 'normal');
  assert.equal(e.config.contraste, false);
});
