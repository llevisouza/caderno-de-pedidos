/*
 * Caderno de Pedidos - regras de negocio.
 * Este arquivo nao mexe na tela: so recebe dados e devolve dados.
 * Funciona no navegador (window.Core) e no Node (require) para os testes.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSAO_DADOS = 1;

  var STATUS = {
    recebido: 'Recebido',
    preparo: 'Em preparo',
    pronto: 'Pronto',
    saiu: 'Saiu para entrega',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
  };

  var PAGAMENTOS = {
    pix: 'Pix',
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
    outro: 'Outro'
  };

  var FINALIZADOS = ['entregue', 'cancelado'];

  // ---------- utilidades ----------

  function doisDigitos(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** Data local no formato AAAA-MM-DD (sem fuso UTC, para "hoje" bater com o relogio do celular). */
  function dataLocal(valor) {
    var d = valor instanceof Date ? valor : new Date(valor);
    return d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate());
  }

  function horaLocal(valor) {
    var d = valor instanceof Date ? valor : new Date(valor);
    return doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
  }

  function dataBR(dia) {
    var p = String(dia).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(dia);
  }

  function somenteDigitos(texto) {
    return String(texto || '').replace(/\D/g, '');
  }

  function textoLimpo(texto, limite) {
    return String(texto == null ? '' : texto).trim().slice(0, limite || 500);
  }

  function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Converte o valor digitado pelo usuario em centavos.
   * Aceita "25", "25,50", "R$ 1.234,56" e "12.50". Devolve NaN se for invalido.
   */
  function paraCentavos(texto) {
    if (typeof texto === 'number') return texto >= 0 ? Math.round(texto * 100) : NaN;
    var limpo = String(texto == null ? '' : texto).replace(/[^\d,.-]/g, '');
    if (!limpo) return NaN;
    if (limpo.indexOf('-') >= 0) return NaN;
    if (limpo.indexOf(',') >= 0) limpo = limpo.replace(/\./g, '').replace(',', '.');
    var n = Number(limpo);
    return isFinite(n) ? Math.round(n * 100) : NaN;
  }

  function formatarReais(centavos) {
    var valor = (centavos || 0) / 100;
    var partes = valor.toFixed(2).split('.');
    var inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'R$ ' + inteiro + ',' + partes[1];
  }

  /** Valor em centavos para o campo de texto do formulario ("25,50"). */
  function centavosParaCampo(centavos) {
    if (!centavos) return '';
    return (centavos / 100).toFixed(2).replace('.', ',');
  }

  // ---------- estado ----------

  function estadoInicial() {
    return {
      versao: VERSAO_DADOS,
      pedidos: [],
      acessos: [],
      contador: { dia: '', n: 0 },
      config: { loja: '', pix: '', fonte: 'normal', contraste: false }
    };
  }

  /** Garante que um estado lido do aparelho ou de um backup tenha o formato esperado. */
  function normalizarEstado(bruto) {
    var base = estadoInicial();
    if (!bruto || typeof bruto !== 'object') return base;
    var cfg = bruto.config && typeof bruto.config === 'object' ? bruto.config : {};
    return {
      versao: VERSAO_DADOS,
      pedidos: Array.isArray(bruto.pedidos) ? bruto.pedidos.filter(pedidoValido) : [],
      acessos: Array.isArray(bruto.acessos)
        ? bruto.acessos.filter(function (a) { return a && a.nome && a.em; })
        : [],
      contador: bruto.contador && typeof bruto.contador.n === 'number'
        ? { dia: String(bruto.contador.dia || ''), n: bruto.contador.n }
        : base.contador,
      config: {
        loja: textoLimpo(cfg.loja, 60),
        pix: textoLimpo(cfg.pix, 80),
        fonte: ['normal', 'grande', 'enorme'].indexOf(cfg.fonte) >= 0 ? cfg.fonte : 'normal',
        contraste: cfg.contraste === true
      }
    };
  }

  function pedidoValido(p) {
    return p && typeof p === 'object' && p.id && STATUS[p.status] && typeof p.valor === 'number';
  }

  // ---------- pedidos ----------

  /** Lista de problemas do formulario, em linguagem simples. Vazia = pode salvar. */
  function validarPedido(dados) {
    var erros = [];
    if (!textoLimpo(dados.itens)) erros.push('Escreva o que foi pedido.');
    var centavos = paraCentavos(dados.valor);
    if (isNaN(centavos) || centavos <= 0) erros.push('Informe o valor total do pedido (exemplo: 25,50).');
    if (!PAGAMENTOS[dados.pagamento]) erros.push('Escolha a forma de pagamento.');
    if (dados.tipo !== 'entrega' && dados.tipo !== 'retirada') erros.push('Escolha se é entrega ou retirada.');
    var tel = somenteDigitos(dados.telefone);
    if (tel && (tel.length < 10 || tel.length > 13)) erros.push('O WhatsApp do cliente parece incompleto. Use DDD + número.');
    return erros;
  }

  function proximoNumero(estado, agora) {
    var dia = dataLocal(agora);
    var n = estado.contador && estado.contador.dia === dia ? estado.contador.n + 1 : 1;
    return { dia: dia, n: n };
  }

  /** Cria um pedido novo. Devolve { pedido, contador } ou { erros }. */
  function criarPedido(dados, estado, agora, operador) {
    var erros = validarPedido(dados);
    if (erros.length) return { erros: erros };
    var contador = proximoNumero(estado, agora);
    var em = agora.toISOString();
    var pedido = {
      id: novoId(),
      numero: contador.n,
      criadoEm: em,
      atualizadoEm: em,
      cliente: textoLimpo(dados.cliente, 60),
      telefone: somenteDigitos(dados.telefone),
      itens: textoLimpo(dados.itens, 500),
      valor: paraCentavos(dados.valor),
      pagamento: dados.pagamento,
      pago: dados.pago === true,
      tipo: dados.tipo,
      endereco: dados.tipo === 'entrega' ? textoLimpo(dados.endereco, 160) : '',
      observacao: textoLimpo(dados.observacao, 200),
      status: 'recebido',
      operador: textoLimpo(operador, 40),
      historico: [{ status: 'recebido', em: em }]
    };
    return { pedido: pedido, contador: contador };
  }

  /** Atualiza os dados de um pedido existente sem mexer no andamento. */
  function editarPedido(pedido, dados, agora) {
    var erros = validarPedido(dados);
    if (erros.length) return { erros: erros };
    var copia = clonar(pedido);
    copia.cliente = textoLimpo(dados.cliente, 60);
    copia.telefone = somenteDigitos(dados.telefone);
    copia.itens = textoLimpo(dados.itens, 500);
    copia.valor = paraCentavos(dados.valor);
    copia.pagamento = dados.pagamento;
    copia.pago = dados.pago === true;
    copia.tipo = dados.tipo;
    copia.endereco = dados.tipo === 'entrega' ? textoLimpo(dados.endereco, 160) : '';
    copia.observacao = textoLimpo(dados.observacao, 200);
    // Pedido de retirada nao passa por "saiu para entrega".
    if (copia.tipo === 'retirada' && copia.status === 'saiu') copia.status = 'pronto';
    copia.atualizadoEm = agora.toISOString();
    return { pedido: copia };
  }

  function proximoStatus(pedido) {
    switch (pedido.status) {
      case 'recebido': return 'preparo';
      case 'preparo': return 'pronto';
      case 'pronto': return pedido.tipo === 'entrega' ? 'saiu' : 'entregue';
      case 'saiu': return 'entregue';
      default: return null;
    }
  }

  function rotuloStatus(pedido, status) {
    var s = status || pedido.status;
    if (s === 'entregue' && pedido.tipo === 'retirada') return 'Retirado';
    return STATUS[s] || s;
  }

  /** Texto do botao principal do cartao do pedido. */
  function rotuloAcao(pedido) {
    switch (proximoStatus(pedido)) {
      case 'preparo': return 'Começar preparo';
      case 'pronto': return 'Ficou pronto';
      case 'saiu': return 'Saiu para entrega';
      case 'entregue': return pedido.tipo === 'retirada' ? 'Cliente retirou' : 'Foi entregue';
      default: return '';
    }
  }

  function mudarStatus(pedido, status, agora) {
    var copia = clonar(pedido);
    var em = agora.toISOString();
    copia.status = status;
    copia.atualizadoEm = em;
    copia.historico = (copia.historico || []).concat([{ status: status, em: em }]);
    return copia;
  }

  function avancar(pedido, agora) {
    var proximo = proximoStatus(pedido);
    return proximo ? mudarStatus(pedido, proximo, agora) : pedido;
  }

  function cancelar(pedido, agora) {
    return pedido.status === 'cancelado' ? pedido : mudarStatus(pedido, 'cancelado', agora);
  }

  function marcarPago(pedido, pago, agora) {
    var copia = clonar(pedido);
    copia.pago = pago;
    copia.atualizadoEm = agora.toISOString();
    return copia;
  }

  function estaAberto(pedido) {
    return FINALIZADOS.indexOf(pedido.status) < 0;
  }

  /**
   * Filtros da lista:
   *  - abertos: tudo que ainda nao foi entregue nem cancelado (inclusive de dias anteriores);
   *  - hoje: todos os pedidos criados no dia;
   *  - concluidos: entregues ou cancelados no dia.
   */
  function filtrar(pedidos, filtro, dia) {
    var lista = pedidos.filter(function (p) {
      if (filtro === 'abertos') return estaAberto(p);
      var doDia = dataLocal(p.criadoEm) === dia;
      if (filtro === 'concluidos') return doDia && !estaAberto(p);
      return doDia;
    });
    return lista.sort(function (a, b) {
      if (filtro === 'abertos') return a.criadoEm < b.criadoEm ? -1 : 1; // mais antigo primeiro
      return a.criadoEm < b.criadoEm ? 1 : -1; // mais recente primeiro
    });
  }

  /** Minutos desde que o pedido foi anotado. */
  function minutosDesde(pedido, agora) {
    return Math.max(0, Math.floor((agora.getTime() - new Date(pedido.criadoEm).getTime()) / 60000));
  }

  // ---------- resumo do dia ----------

  function resumoDoDia(pedidos, dia) {
    var r = {
      dia: dia,
      quantidade: 0,
      cancelados: 0,
      total: 0,
      recebido: 0,
      aReceber: 0,
      ticketMedio: 0,
      entregas: 0,
      retiradas: 0,
      emAberto: 0,
      porPagamento: {}
    };
    Object.keys(PAGAMENTOS).forEach(function (k) {
      r.porPagamento[k] = { quantidade: 0, valor: 0 };
    });
    pedidos.forEach(function (p) {
      if (dataLocal(p.criadoEm) !== dia) return;
      if (p.status === 'cancelado') {
        r.cancelados += 1;
        return;
      }
      r.quantidade += 1;
      r.total += p.valor;
      if (p.pago) r.recebido += p.valor;
      else r.aReceber += p.valor;
      if (p.tipo === 'entrega') r.entregas += 1;
      else r.retiradas += 1;
      if (estaAberto(p)) r.emAberto += 1;
      var pg = r.porPagamento[p.pagamento] || (r.porPagamento[p.pagamento] = { quantidade: 0, valor: 0 });
      pg.quantidade += 1;
      pg.valor += p.valor;
    });
    r.ticketMedio = r.quantidade ? Math.round(r.total / r.quantidade) : 0;
    return r;
  }

  function textoResumo(r, loja) {
    var linhas = [
      (loja ? loja + ' - ' : '') + 'Resumo do dia ' + dataBR(r.dia),
      'Pedidos: ' + r.quantidade + (r.cancelados ? ' (+' + r.cancelados + ' cancelado' + (r.cancelados > 1 ? 's' : '') + ')' : ''),
      'Total vendido: ' + formatarReais(r.total),
      'Já recebido: ' + formatarReais(r.recebido),
      'A receber: ' + formatarReais(r.aReceber)
    ];
    Object.keys(r.porPagamento).forEach(function (k) {
      var pg = r.porPagamento[k];
      if (pg.quantidade) linhas.push(PAGAMENTOS[k] + ': ' + pg.quantidade + ' pedido(s), ' + formatarReais(pg.valor));
    });
    return linhas.join('\n');
  }

  // ---------- mensagens para o cliente ----------

  /**
   * Mensagem pronta para o status atual (ou para cobranca).
   * Usa o nome como foi anotado: cortar no primeiro nome estraga "Dona Maria" e "Seu Raimundo".
   */
  function mensagem(pedido, tipo, config) {
    config = config || {};
    var ola = 'Olá' + (pedido.cliente ? ', ' + pedido.cliente : '') + '!';
    var num = 'nº ' + pedido.numero;
    var assinatura = config.loja ? '\n' + config.loja : '';
    var corpo;
    switch (tipo || pedido.status) {
      case 'recebido':
        corpo = ola + ' Anotamos seu pedido ' + num + ':\n' + pedido.itens +
          '\nTotal: ' + formatarReais(pedido.valor) + ' (' + PAGAMENTOS[pedido.pagamento] + ')' +
          (pedido.tipo === 'entrega' ? '\nEntrega' + (pedido.endereco ? ': ' + pedido.endereco : '') : '\nRetirada no local') +
          (pedido.pago ? '\nPagamento confirmado. Obrigado!' : '');
        break;
      case 'preparo':
        corpo = ola + ' Seu pedido ' + num + ' já está sendo preparado.';
        break;
      case 'pronto':
        corpo = pedido.tipo === 'retirada'
          ? ola + ' Seu pedido ' + num + ' está pronto para retirada.'
          : ola + ' Seu pedido ' + num + ' está pronto e logo sai para entrega.';
        break;
      case 'saiu':
        corpo = ola + ' Seu pedido ' + num + ' saiu para entrega e chega em breve.';
        break;
      case 'entregue':
        corpo = ola + ' Pedido ' + num + ' finalizado. Obrigado pela preferência!';
        break;
      case 'cancelado':
        corpo = ola + ' Seu pedido ' + num + ' foi cancelado. Qualquer dúvida, é só chamar.';
        break;
      case 'cobranca':
        corpo = ola + ' O pedido ' + num + ' (' + formatarReais(pedido.valor) + ') ainda está aguardando pagamento.' +
          (config.pix ? '\nChave Pix: ' + config.pix : '');
        break;
      default:
        corpo = ola;
    }
    return corpo + assinatura;
  }

  /** Link do WhatsApp com a mensagem ja escrita. Sem telefone, o WhatsApp pede para escolher o contato. */
  function linkWhatsApp(telefone, texto) {
    var tel = somenteDigitos(telefone);
    if (tel.length === 10 || tel.length === 11) tel = '55' + tel;
    var base = tel ? 'https://wa.me/' + tel : 'https://wa.me/';
    return base + '?text=' + encodeURIComponent(texto);
  }

  // ---------- registro de acessos ----------

  function registrarAcesso(acessos, nome, agora) {
    var limpo = textoLimpo(nome, 40);
    if (!limpo) return acessos;
    return acessos.concat([{ nome: limpo, em: agora.toISOString() }]);
  }

  /** Nomes ja usados neste aparelho, do mais recente para o mais antigo, sem repetir. */
  function operadoresConhecidos(acessos) {
    var vistos = {};
    var nomes = [];
    for (var i = acessos.length - 1; i >= 0; i--) {
      var chave = acessos[i].nome.toLowerCase();
      if (!vistos[chave]) {
        vistos[chave] = true;
        nomes.push(acessos[i].nome);
      }
    }
    return nomes;
  }

  function csvCampo(valor) {
    var s = String(valor == null ? '' : valor);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** CSV separado por ponto e virgula (abre direto no Excel/Planilhas em portugues). */
  function acessosCSV(acessos, loja) {
    var linhas = ['Nome;Data;Hora;Local'];
    acessos.forEach(function (a) {
      linhas.push([a.nome, dataBR(dataLocal(a.em)), horaLocal(a.em), loja || ''].map(csvCampo).join(';'));
    });
    return linhas.join('\r\n');
  }

  // ---------- manutencao ----------

  /** Remove pedidos finalizados com mais de `dias` dias (menos dados guardados = mais privacidade). */
  function limparAntigos(pedidos, dias, agora) {
    var limite = agora.getTime() - dias * 86400000;
    return pedidos.filter(function (p) {
      return estaAberto(p) || new Date(p.criadoEm).getTime() >= limite;
    });
  }

  function clonar(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  return {
    VERSAO_DADOS: VERSAO_DADOS,
    STATUS: STATUS,
    PAGAMENTOS: PAGAMENTOS,
    dataLocal: dataLocal,
    horaLocal: horaLocal,
    dataBR: dataBR,
    somenteDigitos: somenteDigitos,
    paraCentavos: paraCentavos,
    formatarReais: formatarReais,
    centavosParaCampo: centavosParaCampo,
    estadoInicial: estadoInicial,
    normalizarEstado: normalizarEstado,
    validarPedido: validarPedido,
    criarPedido: criarPedido,
    editarPedido: editarPedido,
    proximoStatus: proximoStatus,
    rotuloStatus: rotuloStatus,
    rotuloAcao: rotuloAcao,
    avancar: avancar,
    cancelar: cancelar,
    marcarPago: marcarPago,
    estaAberto: estaAberto,
    filtrar: filtrar,
    minutosDesde: minutosDesde,
    resumoDoDia: resumoDoDia,
    textoResumo: textoResumo,
    mensagem: mensagem,
    linkWhatsApp: linkWhatsApp,
    registrarAcesso: registrarAcesso,
    operadoresConhecidos: operadoresConhecidos,
    acessosCSV: acessosCSV,
    limparAntigos: limparAntigos,
    clonar: clonar
  };
});
