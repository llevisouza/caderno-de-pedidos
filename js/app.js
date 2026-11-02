/*
 * Caderno de Pedidos - tela.
 * Le e grava os dados no proprio aparelho (localStorage); as regras ficam em core.js.
 */
(function () {
  'use strict';

  var C = window.Core;
  var CHAVE = 'caderno-de-pedidos:v1';
  var VERSAO_APP = '1.0.0';

  var estado = carregar();
  var operador = lerSessao();
  var filtroAtual = 'abertos';
  var diaResumo = null; // null = hoje
  var avisoTimer = null;
  var eventoInstalar = null;

  var main = document.getElementById('conteudo');
  var dialogo = document.getElementById('dialogo');
  var dialogoForm = document.getElementById('dialogo-form');

  // ---------- armazenamento ----------

  function carregar() {
    try {
      var texto = localStorage.getItem(CHAVE);
      return C.normalizarEstado(texto ? JSON.parse(texto) : null);
    } catch (e) {
      return C.estadoInicial();
    }
  }

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
      return true;
    } catch (e) {
      mostrarAviso('Não foi possível salvar neste aparelho. Verifique se há espaço livre.');
      return false;
    }
  }

  function lerSessao() {
    try { return sessionStorage.getItem(CHAVE + ':operador') || ''; } catch (e) { return ''; }
  }

  function gravarSessao(nome) {
    try { sessionStorage.setItem(CHAVE + ':operador', nome); } catch (e) { /* sem sessao, segue so na memoria */ }
  }

  // ---------- utilidades de tela ----------

  function esc(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hoje() {
    return C.dataLocal(new Date());
  }

  function acharPedido(id) {
    for (var i = 0; i < estado.pedidos.length; i++) {
      if (estado.pedidos[i].id === id) return estado.pedidos[i];
    }
    return null;
  }

  function trocarPedido(novo) {
    estado.pedidos = estado.pedidos.map(function (p) { return p.id === novo.id ? novo : p; });
  }

  function tempoTexto(pedido) {
    if (!C.estaAberto(pedido)) return 'às ' + C.horaLocal(pedido.atualizadoEm);
    var min = C.minutosDesde(pedido, new Date());
    if (min < 1) return 'agora';
    if (min < 60) return 'há ' + min + ' min';
    var h = Math.floor(min / 60);
    if (h < 24) return 'há ' + h + 'h' + (min % 60 ? ' ' + (min % 60) + 'min' : '');
    return 'desde ' + C.dataBR(C.dataLocal(pedido.criadoEm));
  }

  function baixarArquivo(nome, conteudo, tipo) {
    var blob = new Blob([conteudo], { type: tipo });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  var ICONE_WHATS = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3z"/></svg>';
  var ICONE_MAIS = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>';

  // ---------- aviso com "desfazer" ----------

  function mostrarAviso(texto, aoDesfazer) {
    var caixa = document.getElementById('aviso');
    var botao = document.getElementById('aviso-desfazer');
    document.getElementById('aviso-texto').textContent = texto;
    botao.hidden = !aoDesfazer;
    botao.onclick = aoDesfazer
      ? function () { esconderAviso(); aoDesfazer(); }
      : null;
    caixa.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(esconderAviso, aoDesfazer ? 8000 : 4000);
  }

  function esconderAviso() {
    document.getElementById('aviso').hidden = true;
  }

  /** Executa uma mudanca nos pedidos guardando a versao anterior para o botao "Desfazer". */
  function mudarPedidos(mudanca, texto) {
    var antes = C.clonar({ pedidos: estado.pedidos, contador: estado.contador });
    mudanca();
    if (!salvar()) {
      estado.pedidos = antes.pedidos;
      estado.contador = antes.contador;
      return;
    }
    render();
    mostrarAviso(texto, function () {
      estado.pedidos = antes.pedidos;
      estado.contador = antes.contador;
      salvar();
      render();
      mostrarAviso('Pronto, voltou como estava.');
    });
  }

  // ---------- aparencia ----------

  function aplicarAparencia() {
    var raiz = document.documentElement;
    raiz.setAttribute('data-fonte', estado.config.fonte);
    if (estado.config.contraste) raiz.setAttribute('data-contraste', 'alto');
    else raiz.removeAttribute('data-contraste');
    document.getElementById('nome-loja').textContent = estado.config.loja || 'Caderno de Pedidos';
    document.getElementById('nome-operador').textContent = operador || '—';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', estado.config.contraste ? '#000000' : '#14532d');
  }

  // ---------- rotas ----------

  function rotaAtual() {
    var partes = location.hash.replace(/^#\/?/, '').split('/');
    return { nome: partes[0] || 'pedidos', id: partes[1] || '' };
  }

  function render() {
    var rota = rotaAtual();
    var html;
    switch (rota.nome) {
      case 'novo': html = telaFormulario(null); break;
      case 'editar': html = telaFormulario(acharPedido(rota.id)); break;
      case 'resumo': html = telaResumo(); break;
      case 'mais': html = telaMais(); break;
      default: html = telaPedidos();
    }
    main.innerHTML = html;
    var aba = rota.nome === 'editar' ? 'novo' : rota.nome;
    document.querySelectorAll('.abas a').forEach(function (a) {
      if (a.getAttribute('data-aba') === aba) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    aplicarAparencia();
    document.title = tituloDaTela(rota.nome) + ' · Caderno de Pedidos';
  }

  function tituloDaTela(nome) {
    return { novo: 'Novo pedido', editar: 'Editar pedido', resumo: 'Resumo do dia', mais: 'Mais opções' }[nome] || 'Pedidos';
  }

  // ---------- tela: pedidos ----------

  function telaPedidos() {
    var dia = hoje();
    var lista = C.filtrar(estado.pedidos, filtroAtual, dia);
    var contagem = {
      abertos: C.filtrar(estado.pedidos, 'abertos', dia).length,
      hoje: C.filtrar(estado.pedidos, 'hoje', dia).length,
      concluidos: C.filtrar(estado.pedidos, 'concluidos', dia).length
    };
    var rotulos = { abertos: 'Em aberto', hoje: 'Hoje', concluidos: 'Concluídos' };

    var filtros = '<div class="filtros" role="group" aria-label="Mostrar pedidos">' +
      Object.keys(rotulos).map(function (f) {
        return '<button type="button" data-acao="filtro" data-filtro="' + f + '" aria-pressed="' + (f === filtroAtual) + '">' +
          rotulos[f] + ' (' + contagem[f] + ')</button>';
      }).join('') + '</div>';

    var corpo;
    if (!lista.length) {
      var msg = {
        abertos: 'Nenhum pedido em aberto agora.',
        hoje: 'Nenhum pedido anotado hoje.',
        concluidos: 'Nenhum pedido concluído hoje.'
      }[filtroAtual];
      corpo = '<div class="vazio"><p>' + msg + '</p>' +
        '<a class="botao" href="#/novo">+ Anotar novo pedido</a></div>';
    } else {
      corpo = '<ul class="lista">' + lista.map(cartaoPedido).join('') + '</ul>';
    }
    return '<h2>Pedidos</h2>' + filtros + corpo;
  }

  function cartaoPedido(p) {
    var proximo = C.rotuloAcao(p);
    var nome = p.cliente || 'Cliente sem nome';
    var pagamento = C.PAGAMENTOS[p.pagamento] || p.pagamento;
    var etiquetaPago = p.status === 'cancelado' ? '' : p.pago
      ? '<span class="etiqueta etiqueta-pago">✓ Pago · ' + esc(pagamento) + '</span>'
      : '<span class="etiqueta etiqueta-pendente">A receber · ' + esc(pagamento) + '</span>';
    var linkWhats = C.linkWhatsApp(p.telefone, C.mensagem(p, p.status, estado.config));
    var principal = proximo
      ? '<button type="button" class="botao" data-acao="avancar" data-id="' + p.id + '">' + esc(proximo) + ' →</button>'
      : '<button type="button" class="botao botao-secundario" data-acao="opcoes" data-id="' + p.id + '">Ver detalhes</button>';

    return '<li class="cartao" data-status="' + p.status + '">' +
      '<div class="cartao-topo">' +
        '<p class="cartao-titulo"><span class="numero">nº ' + p.numero + '</span> ' + esc(nome) + '</p>' +
        '<span class="cartao-valor">' + C.formatarReais(p.valor) + '</span>' +
      '</div>' +
      '<p class="cartao-itens">' + esc(p.itens) + '</p>' +
      (p.observacao ? '<p class="cartao-obs">Obs.: ' + esc(p.observacao) + '</p>' : '') +
      '<div class="cartao-info">' +
        '<span class="etiqueta etiqueta-status">' + esc(C.rotuloStatus(p)) + '</span>' +
        etiquetaPago +
        '<span class="etiqueta etiqueta-neutra">' + (p.tipo === 'entrega' ? 'Entrega' : 'Retirada') + '</span>' +
        '<span class="etiqueta etiqueta-neutra">' + esc(tempoTexto(p)) + '</span>' +
      '</div>' +
      '<div class="cartao-acoes">' +
        principal +
        '<a class="botao botao-whats icone" href="' + esc(linkWhats) + '" target="_blank" rel="noopener" ' +
          'aria-label="Avisar ' + esc(nome) + ' no WhatsApp (' + esc(C.rotuloStatus(p)) + ')">' + ICONE_WHATS + '</a>' +
        '<button type="button" class="botao botao-secundario icone" data-acao="opcoes" data-id="' + p.id + '" ' +
          'aria-label="Mais opções do pedido nº ' + p.numero + '">' + ICONE_MAIS + '</button>' +
      '</div>' +
    '</li>';
  }

  // ---------- tela: formulario ----------

  function ultimoPedido() {
    var ordenados = estado.pedidos.slice().sort(function (a, b) { return a.criadoEm < b.criadoEm ? 1 : -1; });
    return ordenados[0] || null;
  }

  function telaFormulario(pedido) {
    var editando = !!pedido;
    if (location.hash.indexOf('#/editar') === 0 && !pedido) {
      return '<div class="vazio"><p>Este pedido não foi encontrado.</p><a class="botao" href="#/pedidos">Voltar aos pedidos</a></div>';
    }
    var ultimo = ultimoPedido();
    var d = pedido || {
      cliente: '', telefone: '', itens: '', valor: 0, endereco: '', observacao: '',
      pagamento: ultimo ? ultimo.pagamento : 'pix',
      pago: false,
      tipo: ultimo ? ultimo.tipo : 'retirada'
    };

    function radio(nome, valor, rotulo, marcado) {
      return '<label class="opcao"><input type="radio" name="' + nome + '" value="' + valor + '"' +
        (marcado ? ' checked' : '') + '><span>' + rotulo + '</span></label>';
    }

    return '<h2>' + (editando ? 'Editar pedido nº ' + pedido.numero : 'Novo pedido') + '</h2>' +
      '<div class="erros" id="erros" role="alert" tabindex="-1" hidden></div>' +
      '<form id="form-pedido" novalidate data-id="' + (editando ? pedido.id : '') + '">' +
        '<div class="campo"><label for="f-itens">O que foi pedido? <span class="dica">Escreva do seu jeito. Ex.: 2 acarajés, 1 suco de cajá</span></label>' +
          '<textarea id="f-itens" name="itens" required aria-required="true">' + esc(d.itens) + '</textarea></div>' +
        '<div class="campo"><label for="f-valor">Valor total (R$)</label>' +
          '<input type="text" id="f-valor" name="valor" inputmode="decimal" autocomplete="off" placeholder="0,00" required aria-required="true" value="' + esc(C.centavosParaCampo(d.valor)) + '"></div>' +
        '<fieldset><legend class="rotulo">Forma de pagamento</legend><div class="opcoes quatro">' +
          Object.keys(C.PAGAMENTOS).map(function (k) { return radio('pagamento', k, C.PAGAMENTOS[k], d.pagamento === k); }).join('') +
        '</div></fieldset>' +
        '<fieldset><legend class="rotulo">O pagamento já foi feito?</legend><div class="opcoes">' +
          radio('pago', 'sim', 'Sim, já pagou', d.pago) + radio('pago', 'nao', 'Ainda não', !d.pago) +
        '</div></fieldset>' +
        '<fieldset><legend class="rotulo">Entrega ou retirada?</legend><div class="opcoes">' +
          radio('tipo', 'entrega', 'Entrega', d.tipo === 'entrega') + radio('tipo', 'retirada', 'Retirada', d.tipo === 'retirada') +
        '</div></fieldset>' +
        '<div class="campo" id="campo-endereco"' + (d.tipo === 'entrega' ? '' : ' hidden') + '><label for="f-endereco">Endereço de entrega <span class="dica">Opcional</span></label>' +
          '<input type="text" id="f-endereco" name="endereco" autocomplete="off" value="' + esc(d.endereco) + '"></div>' +
        '<div class="campo"><label for="f-cliente">Nome do cliente <span class="dica">Opcional. Pode ser apelido.</span></label>' +
          '<input type="text" id="f-cliente" name="cliente" autocomplete="off" value="' + esc(d.cliente) + '"></div>' +
        '<div class="campo"><label for="f-telefone">WhatsApp do cliente <span class="dica">Opcional. Com DDD, para mandar avisos prontos.</span></label>' +
          '<input type="tel" id="f-telefone" name="telefone" inputmode="tel" autocomplete="off" placeholder="(71) 99999-0000" value="' + esc(d.telefone) + '"></div>' +
        '<div class="campo"><label for="f-obs">Observação <span class="dica">Opcional. Ex.: sem cebola, troco para R$ 50</span></label>' +
          '<input type="text" id="f-obs" name="observacao" autocomplete="off" value="' + esc(d.observacao) + '"></div>' +
        '<div class="grupo-botoes">' +
          '<button type="submit" class="botao botao-largo">' + (editando ? 'Salvar alterações' : 'Salvar pedido') + '</button>' +
          '<a class="botao botao-secundario botao-largo" href="#/pedidos">Voltar sem salvar</a>' +
        '</div>' +
      '</form>';
  }

  function lerFormulario(form) {
    var fd = new FormData(form);
    return {
      cliente: fd.get('cliente'),
      telefone: fd.get('telefone'),
      itens: fd.get('itens'),
      valor: fd.get('valor'),
      pagamento: fd.get('pagamento'),
      pago: fd.get('pago') === 'sim',
      tipo: fd.get('tipo'),
      endereco: fd.get('endereco'),
      observacao: fd.get('observacao')
    };
  }

  function mostrarErros(erros) {
    var caixa = document.getElementById('erros');
    caixa.innerHTML = '<strong>Falta pouco:</strong><ul>' + erros.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
    caixa.hidden = false;
    caixa.focus();
    document.getElementById('f-itens').setAttribute('aria-invalid', String(erros.some(function (e) { return /pedido\.$/.test(e); })));
    document.getElementById('f-valor').setAttribute('aria-invalid', String(erros.some(function (e) { return /valor/.test(e); })));
    document.getElementById('f-telefone').setAttribute('aria-invalid', String(erros.some(function (e) { return /WhatsApp/.test(e); })));
  }

  function salvarFormulario(form) {
    var dados = lerFormulario(form);
    var id = form.getAttribute('data-id');
    var agora = new Date();
    var r;
    if (id) {
      var original = acharPedido(id);
      if (!original) return;
      r = C.editarPedido(original, dados, agora);
      if (r.erros) return mostrarErros(r.erros);
      filtroAtual = C.estaAberto(r.pedido) ? 'abertos' : 'hoje';
      location.hash = '#/pedidos';
      mudarPedidos(function () { trocarPedido(r.pedido); }, 'Pedido nº ' + r.pedido.numero + ' atualizado.');
      return;
    }
    r = C.criarPedido(dados, estado, agora, operador);
    if (r.erros) return mostrarErros(r.erros);
    filtroAtual = 'abertos';
    location.hash = '#/pedidos';
    mudarPedidos(function () {
      estado.pedidos.push(r.pedido);
      estado.contador = r.contador;
    }, 'Pedido nº ' + r.pedido.numero + ' anotado.');
    if (r.pedido.telefone) perguntarConfirmacao(r.pedido);
  }

  function perguntarConfirmacao(p) {
    var link = C.linkWhatsApp(p.telefone, C.mensagem(p, 'recebido', estado.config));
    abrirDialogo(
      '<h2 id="dialogo-titulo">Pedido nº ' + p.numero + ' anotado</h2>' +
      '<p>Quer mandar a confirmação para ' + esc(p.cliente || 'o cliente') + ' no WhatsApp?</p>' +
      '<div class="grupo-botoes">' +
        '<a class="botao botao-whats botao-largo" href="' + esc(link) + '" target="_blank" rel="noopener" data-acao="fechar">' + ICONE_WHATS + ' Enviar confirmação</a>' +
        '<button type="button" class="botao botao-secundario botao-largo" data-acao="fechar">Agora não</button>' +
      '</div>'
    );
  }

  // ---------- dialogo de opcoes do pedido ----------

  function abrirDialogo(html) {
    dialogoForm.removeAttribute('data-form');
    dialogoForm.innerHTML = html;
    if (typeof dialogo.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal();
    } else {
      dialogo.setAttribute('open', '');
    }
  }

  function fecharDialogo() {
    if (typeof dialogo.close === 'function' && dialogo.open) dialogo.close();
    else dialogo.removeAttribute('open');
  }

  function abrirOpcoes(id) {
    var p = acharPedido(id);
    if (!p) return;
    var historico = (p.historico || []).map(function (h) {
      return '<li>' + esc(C.rotuloStatus(p, h.status)) + ' — ' + C.dataBR(C.dataLocal(h.em)) + ' às ' + C.horaLocal(h.em) + '</li>';
    }).join('');
    var cobranca = !p.pago && p.status !== 'cancelado'
      ? '<a class="botao botao-whats botao-largo" target="_blank" rel="noopener" href="' +
        esc(C.linkWhatsApp(p.telefone, C.mensagem(p, 'cobranca', estado.config))) + '">' + ICONE_WHATS + ' Lembrar do pagamento</a>'
      : '';
    var pagar = p.status === 'cancelado' ? '' :
      '<button type="button" class="botao botao-secundario botao-largo" data-acao="pagar" data-id="' + p.id + '">' +
      (p.pago ? 'Marcar como NÃO pago' : '✓ Marcar como pago') + '</button>';
    var cancelarBtn = C.estaAberto(p)
      ? '<button type="button" class="botao botao-perigo botao-largo" data-acao="cancelar" data-id="' + p.id + '">Cancelar pedido</button>'
      : '';

    abrirDialogo(
      '<h2 id="dialogo-titulo">Pedido nº ' + p.numero + (p.cliente ? ' — ' + esc(p.cliente) : '') + '</h2>' +
      '<p class="cartao-itens">' + esc(p.itens) + '</p>' +
      '<p><strong>' + C.formatarReais(p.valor) + '</strong> · ' + esc(C.PAGAMENTOS[p.pagamento]) + ' · ' + (p.pago ? 'pago' : 'a receber') + '</p>' +
      '<p>' + (p.tipo === 'entrega' ? 'Entrega' + (p.endereco ? ': ' + esc(p.endereco) : '') : 'Retirada no local') + '</p>' +
      (p.observacao ? '<p>Obs.: ' + esc(p.observacao) + '</p>' : '') +
      (p.telefone ? '<p>WhatsApp: ' + esc(p.telefone) + '</p>' : '') +
      '<p class="suave pequeno">Anotado' + (p.operador ? ' por ' + esc(p.operador) : '') + '. Andamento:</p>' +
      '<ul class="pequeno">' + historico + '</ul>' +
      '<div class="grupo-botoes">' +
        pagar + cobranca +
        '<a class="botao botao-secundario botao-largo" href="#/editar/' + p.id + '" data-acao="fechar">Editar pedido</a>' +
        cancelarBtn +
        '<button type="button" class="botao botao-secundario botao-largo" data-acao="fechar">Fechar</button>' +
      '</div>'
    );
  }

  // ---------- tela: resumo ----------

  function telaResumo() {
    var dia = diaResumo || hoje();
    var ontem = C.dataLocal(new Date(Date.now() - 86400000));
    var r = C.resumoDoDia(estado.pedidos, dia);
    var aReceber = estado.pedidos.filter(function (p) {
      return C.dataLocal(p.criadoEm) === dia && !p.pago && p.status !== 'cancelado';
    });

    var linhasPagamento = Object.keys(C.PAGAMENTOS).map(function (k) {
      var pg = r.porPagamento[k];
      return '<tr><td>' + C.PAGAMENTOS[k] + '</td><td class="direita">' + pg.quantidade + '</td><td class="direita">' + C.formatarReais(pg.valor) + '</td></tr>';
    }).join('');

    var listaReceber = aReceber.length
      ? '<h3>Falta receber</h3><ul class="lista">' + aReceber.map(function (p) {
        return '<li class="secao"><strong>nº ' + p.numero + '</strong> ' + esc(p.cliente || 'Cliente sem nome') +
          ' — ' + C.formatarReais(p.valor) + ' (' + esc(C.PAGAMENTOS[p.pagamento]) + ')' +
          '<div class="grupo-botoes duas" style="margin-top:10px">' +
            '<button type="button" class="botao botao-secundario" data-acao="pagar" data-id="' + p.id + '">✓ Pagou</button>' +
            '<a class="botao botao-whats" target="_blank" rel="noopener" href="' + esc(C.linkWhatsApp(p.telefone, C.mensagem(p, 'cobranca', estado.config))) + '">Lembrar</a>' +
          '</div></li>';
      }).join('') + '</ul>'
      : '';

    return '<h2>Resumo do dia</h2>' +
      '<div class="seletor-dia" role="group" aria-label="Escolher o dia">' +
        '<button type="button" class="botao ' + (dia === hoje() ? '' : 'botao-secundario') + '" data-acao="dia" data-dia="' + hoje() + '">Hoje</button>' +
        '<button type="button" class="botao ' + (dia === ontem ? '' : 'botao-secundario') + '" data-acao="dia" data-dia="' + ontem + '">Ontem</button>' +
        '<div class="largo"><label class="rotulo" for="f-dia">Outro dia</label><input type="date" id="f-dia" value="' + dia + '" max="' + hoje() + '"></div>' +
      '</div>' +
      '<p class="suave">Dia ' + C.dataBR(dia) + '</p>' +
      '<div class="numeros">' +
        caixaNumero('Total vendido', C.formatarReais(r.total), 'destaque largo') +
        caixaNumero('Pedidos', String(r.quantidade)) +
        caixaNumero('Valor médio', C.formatarReais(r.ticketMedio)) +
        caixaNumero('Já recebido', C.formatarReais(r.recebido)) +
        caixaNumero('A receber', C.formatarReais(r.aReceber)) +
        caixaNumero('Entregas', String(r.entregas)) +
        caixaNumero('Retiradas', String(r.retiradas)) +
        (r.cancelados ? caixaNumero('Cancelados', String(r.cancelados), 'largo') : '') +
      '</div>' +
      '<table class="tabela"><caption>Por forma de pagamento</caption>' +
        '<thead><tr><th scope="col">Forma</th><th scope="col" class="direita">Pedidos</th><th scope="col" class="direita">Valor</th></tr></thead>' +
        '<tbody>' + linhasPagamento + '</tbody></table>' +
      listaReceber +
      '<div class="grupo-botoes" style="margin-top:16px">' +
        '<a class="botao botao-whats botao-largo" target="_blank" rel="noopener" href="' + esc(C.linkWhatsApp('', C.textoResumo(r, estado.config.loja))) + '">' + ICONE_WHATS + ' Enviar resumo no WhatsApp</a>' +
      '</div>';
  }

  function caixaNumero(rotulo, valor, classe) {
    return '<div class="numero-caixa ' + (classe || '') + '"><p class="rotulo">' + rotulo + '</p><p class="valor">' + valor + '</p></div>';
  }

  // ---------- tela: mais ----------

  function telaMais() {
    var cfg = estado.config;
    var acessos = estado.acessos.slice().reverse().slice(0, 100);
    var listaAcessos = acessos.length
      ? '<ul class="acessos">' + acessos.map(function (a) {
        return '<li><span>' + esc(a.nome) + '</span><span class="suave">' + C.dataBR(C.dataLocal(a.em)) + ' às ' + C.horaLocal(a.em) + '</span></li>';
      }).join('') + '</ul>'
      : '<p class="suave">Nenhum acesso registrado ainda.</p>';

    function radio(nome, valor, rotulo, marcado) {
      return '<label class="opcao"><input type="radio" name="' + nome + '" value="' + valor + '"' + (marcado ? ' checked' : '') + '><span>' + rotulo + '</span></label>';
    }

    return '<h2>Mais opções</h2>' +

      (eventoInstalar
        ? '<div class="secao"><h3>Colocar na tela inicial</h3><p>Instale o Caderno no celular para abrir com um toque, mesmo sem internet.</p>' +
          '<button type="button" class="botao botao-largo" data-acao="instalar">Instalar no celular</button></div>'
        : '') +

      '<form class="secao" id="form-config" novalidate>' +
        '<h3>Seu negócio</h3>' +
        '<div class="campo"><label for="c-loja">Nome do negócio <span class="dica">Aparece no topo e no fim das mensagens.</span></label>' +
          '<input type="text" id="c-loja" name="loja" autocomplete="off" maxlength="60" value="' + esc(cfg.loja) + '"></div>' +
        '<div class="campo"><label for="c-pix">Chave Pix <span class="dica">Opcional. Vai junto no lembrete de pagamento.</span></label>' +
          '<input type="text" id="c-pix" name="pix" autocomplete="off" maxlength="80" value="' + esc(cfg.pix) + '"></div>' +
        '<button type="submit" class="botao botao-largo">Salvar</button>' +
      '</form>' +

      '<div class="secao">' +
        '<h3>Leitura e cores</h3>' +
        '<fieldset><legend class="rotulo">Tamanho da letra</legend><div class="opcoes quatro">' +
          radio('fonte', 'normal', 'Normal', cfg.fonte === 'normal') +
          radio('fonte', 'grande', 'Grande', cfg.fonte === 'grande') +
          radio('fonte', 'enorme', 'Enorme', cfg.fonte === 'enorme') +
        '</div></fieldset>' +
        '<fieldset><legend class="rotulo">Alto contraste (fundo preto)</legend><div class="opcoes">' +
          radio('contraste', 'sim', 'Ligado', cfg.contraste) + radio('contraste', 'nao', 'Desligado', !cfg.contraste) +
        '</div></fieldset>' +
      '</div>' +

      '<div class="secao">' +
        '<h3>Registro de acessos</h3>' +
        '<p class="suave">Quem usou o caderno neste aparelho, com data e hora. Total: ' + estado.acessos.length + ' acesso(s)' +
          (estado.acessos.length > acessos.length ? '; aqui aparecem os ' + acessos.length + ' mais recentes' : '') + '.</p>' +
        listaAcessos +
        '<div class="grupo-botoes">' +
          '<button type="button" class="botao botao-secundario botao-largo" data-acao="baixar-acessos"' + (estado.acessos.length ? '' : ' disabled') + '>Baixar planilha de acessos</button>' +
          '<a class="botao botao-whats botao-largo" target="_blank" rel="noopener" href="' + esc(C.linkWhatsApp('', textoAcessos())) + '">' + ICONE_WHATS + ' Enviar acessos no WhatsApp</a>' +
        '</div>' +
      '</div>' +

      '<div class="secao">' +
        '<h3>Cópia de segurança</h3>' +
        '<p class="suave">Os pedidos ficam só neste aparelho. Salve uma cópia de vez em quando, principalmente antes de trocar de celular.</p>' +
        '<div class="grupo-botoes">' +
          '<button type="button" class="botao botao-secundario botao-largo" data-acao="backup">Salvar cópia em arquivo</button>' +
          '<label class="botao botao-secundario botao-largo" for="f-restaurar">Restaurar uma cópia</label>' +
          '<input type="file" id="f-restaurar" accept="application/json,.json" hidden>' +
        '</div>' +
      '</div>' +

      '<div class="secao">' +
        '<h3>Privacidade</h3>' +
        '<p>Nada é enviado para a internet: os dados ficam guardados apenas neste aparelho. Anote só o necessário do cliente (nome ou apelido e, se quiser, o WhatsApp), conforme a Lei Geral de Proteção de Dados (LGPD).</p>' +
        '<div class="grupo-botoes">' +
          '<button type="button" class="botao botao-secundario botao-largo" data-acao="limpar-antigos">Apagar pedidos finalizados com mais de 30 dias</button>' +
          '<button type="button" class="botao botao-perigo botao-largo" data-acao="apagar-tudo">Apagar todos os dados</button>' +
        '</div>' +
      '</div>' +

      '<div class="secao">' +
        '<h3>Como usar</h3>' +
        '<ol class="passos">' +
          '<li>Chegou um pedido? Toque em <strong>Novo pedido</strong>, escreva o que foi pedido e o valor, e salve.</li>' +
          '<li>Na tela <strong>Pedidos</strong>, toque no botão verde para avançar: em preparo → pronto → saiu/retirou.</li>' +
          '<li>Toque no botão do <strong>WhatsApp</strong> para mandar ao cliente uma mensagem pronta sobre o andamento.</li>' +
          '<li>No fim do dia, veja o <strong>Resumo</strong>: quanto vendeu, quanto já recebeu e quem falta pagar.</li>' +
          '<li>Errou? Use o botão <strong>Desfazer</strong> que aparece logo depois de cada ação.</li>' +
        '</ol>' +
      '</div>' +

      '<div class="secao">' +
        '<h3>Sobre</h3>' +
        '<p>Caderno de Pedidos v' + VERSAO_APP + ' — projeto de extensão do Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas (Uninter). Uso gratuito e sem fins comerciais.</p>' +
      '</div>';
  }

  function textoAcessos() {
    var linhas = ['Registro de acessos - ' + (estado.config.loja || 'Caderno de Pedidos')];
    estado.acessos.forEach(function (a) {
      linhas.push(a.nome + ' - ' + C.dataBR(C.dataLocal(a.em)) + ' ' + C.horaLocal(a.em));
    });
    return linhas.join('\n');
  }

  // ---------- quem esta usando ----------

  function pedirOperador() {
    var nomes = C.operadoresConhecidos(estado.acessos).slice(0, 6);
    abrirDialogo(
      '<h2 id="dialogo-titulo">Quem está usando o caderno agora?</h2>' +
      (nomes.length
        ? '<p class="suave">Toque no seu nome:</p><div class="nomes">' + nomes.map(function (n) {
          return '<button type="button" class="botao botao-secundario" data-acao="entrar" data-nome="' + esc(n) + '">' + esc(n) + '</button>';
        }).join('') + '</div>'
        : '') +
      '<div class="campo"><label for="f-operador">' + (nomes.length ? 'Ou escreva outro nome' : 'Seu nome') + '</label>' +
        '<input type="text" id="f-operador" name="operador" autocomplete="given-name" maxlength="40"></div>' +
      '<p class="suave pequeno">O nome fica salvo só neste aparelho, para o registro de acessos (quem usou, data e hora).</p>' +
      '<div class="grupo-botoes">' +
        '<button type="submit" class="botao botao-largo" data-tipo="entrar-form">Entrar</button>' +
        '<button type="button" class="botao botao-secundario botao-largo" data-acao="entrar" data-nome="Não informado">Pular</button>' +
      '</div>'
    );
    dialogoForm.setAttribute('data-form', 'operador');
  }

  function entrar(nome) {
    operador = String(nome || '').trim().slice(0, 40) || 'Não informado';
    gravarSessao(operador);
    estado.acessos = C.registrarAcesso(estado.acessos, operador, new Date());
    salvar();
    dialogoForm.removeAttribute('data-form');
    fecharDialogo();
    render();
    mostrarAviso('Olá, ' + operador + '!');
  }

  // ---------- eventos ----------

  document.addEventListener('click', function (e) {
    var alvo = e.target.closest('[data-acao]');
    if (!alvo) return;
    var acao = alvo.getAttribute('data-acao');
    var id = alvo.getAttribute('data-id');
    var p;

    switch (acao) {
      case 'filtro':
        filtroAtual = alvo.getAttribute('data-filtro');
        render();
        break;

      case 'avancar':
        p = acharPedido(id);
        if (!p) return;
        var avancado = C.avancar(p, new Date());
        mudarPedidos(function () { trocarPedido(avancado); },
          'Pedido nº ' + p.numero + ': ' + C.rotuloStatus(avancado) + '.');
        break;

      case 'opcoes':
        abrirOpcoes(id);
        break;

      case 'pagar':
        p = acharPedido(id);
        if (!p) return;
        var pago = C.marcarPago(p, !p.pago, new Date());
        fecharDialogo();
        mudarPedidos(function () { trocarPedido(pago); },
          'Pedido nº ' + p.numero + (pago.pago ? ' marcado como pago.' : ' marcado como não pago.'));
        break;

      case 'cancelar':
        p = acharPedido(id);
        if (!p) return;
        fecharDialogo();
        mudarPedidos(function () { trocarPedido(C.cancelar(p, new Date())); },
          'Pedido nº ' + p.numero + ' cancelado.');
        break;

      case 'fechar':
        // links (WhatsApp, editar) seguem normalmente; so fechamos o dialogo
        fecharDialogo();
        break;

      case 'dia':
        diaResumo = alvo.getAttribute('data-dia');
        render();
        break;

      case 'entrar':
        entrar(alvo.getAttribute('data-nome'));
        break;

      case 'trocar-operador':
        pedirOperador();
        break;

      case 'baixar-acessos':
        baixarArquivo('acessos-caderno-de-pedidos-' + hoje() + '.csv',
          '﻿' + C.acessosCSV(estado.acessos, estado.config.loja), 'text/csv;charset=utf-8');
        break;

      case 'backup':
        baixarArquivo('copia-caderno-de-pedidos-' + hoje() + '.json',
          JSON.stringify(estado, null, 2), 'application/json');
        mostrarAviso('Cópia salva na pasta de downloads.');
        break;

      case 'limpar-antigos':
        var restantes = C.limparAntigos(estado.pedidos, 30, new Date());
        var apagados = estado.pedidos.length - restantes.length;
        if (!apagados) {
          mostrarAviso('Não há pedidos finalizados com mais de 30 dias.');
          break;
        }
        mudarPedidos(function () { estado.pedidos = restantes; }, apagados + ' pedido(s) antigo(s) apagado(s).');
        break;

      case 'apagar-tudo':
        confirmarApagarTudo();
        break;

      case 'apagar-tudo-confirmado':
        estado = C.estadoInicial();
        salvar();
        fecharDialogo();
        operador = '';
        gravarSessao('');
        render();
        pedirOperador();
        break;

      case 'instalar':
        if (eventoInstalar) {
          eventoInstalar.prompt();
          eventoInstalar = null;
          render();
        }
        break;
    }
  });

  function confirmarApagarTudo() {
    abrirDialogo(
      '<h2 id="dialogo-titulo">Apagar tudo?</h2>' +
      '<p>Isso apaga <strong>todos os pedidos, o registro de acessos e as configurações</strong> deste aparelho. Não dá para desfazer.</p>' +
      '<p>Se quiser guardar, salve uma cópia antes.</p>' +
      '<div class="grupo-botoes">' +
        '<button type="button" class="botao botao-secundario botao-largo" data-acao="fechar">Não, manter meus dados</button>' +
        '<button type="button" class="botao botao-perigo botao-largo" data-acao="apagar-tudo-confirmado">Sim, apagar tudo</button>' +
      '</div>'
    );
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.id === 'form-pedido') {
      e.preventDefault();
      salvarFormulario(form);
    } else if (form.id === 'form-config') {
      e.preventDefault();
      var fd = new FormData(form);
      estado.config.loja = String(fd.get('loja') || '').trim().slice(0, 60);
      estado.config.pix = String(fd.get('pix') || '').trim().slice(0, 80);
      if (salvar()) {
        aplicarAparencia();
        mostrarAviso('Dados do negócio salvos.');
      }
    } else if (form === dialogoForm && form.getAttribute('data-form') === 'operador') {
      e.preventDefault();
      entrar(document.getElementById('f-operador').value);
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'tipo' && t.form && t.form.id === 'form-pedido') {
      document.getElementById('campo-endereco').hidden = t.value !== 'entrega';
    } else if (t.name === 'fonte') {
      estado.config.fonte = t.value;
      salvar();
      aplicarAparencia();
    } else if (t.name === 'contraste') {
      estado.config.contraste = t.value === 'sim';
      salvar();
      aplicarAparencia();
    } else if (t.id === 'f-dia' && t.value) {
      diaResumo = t.value;
      render();
    } else if (t.id === 'f-restaurar' && t.files && t.files[0]) {
      restaurar(t.files[0]);
    }
  });

  function restaurar(arquivo) {
    var leitor = new FileReader();
    leitor.onload = function () {
      try {
        var dados = JSON.parse(leitor.result);
        if (!dados || !Array.isArray(dados.pedidos)) throw new Error('formato');
        var antes = C.clonar(estado);
        estado = C.normalizarEstado(dados);
        salvar();
        render();
        mostrarAviso('Cópia restaurada: ' + estado.pedidos.length + ' pedido(s).', function () {
          estado = antes;
          salvar();
          render();
        });
      } catch (err) {
        mostrarAviso('Este arquivo não é uma cópia do Caderno de Pedidos.');
      }
    };
    leitor.readAsText(arquivo);
  }

  dialogo.addEventListener('cancel', function (e) {
    // Esc no pedido de nome = "Pular", para nunca ficar sem registro de acesso
    if (dialogoForm.getAttribute('data-form') === 'operador') {
      e.preventDefault();
      entrar('Não informado');
    }
  });

  window.addEventListener('hashchange', function () {
    render();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  });

  // Atualiza o "ha X min" dos cartoes a cada minuto, sem atrapalhar quem esta digitando.
  setInterval(function () {
    var ativo = document.activeElement;
    var digitando = ativo && /INPUT|TEXTAREA/.test(ativo.tagName);
    if (rotaAtual().nome === 'pedidos' && !dialogo.open && !digitando) render();
  }, 60000);

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    eventoInstalar = e;
    if (rotaAtual().nome === 'mais') render();
  });

  // Outra aba mudou os dados: recarrega para nao sobrescrever.
  window.addEventListener('storage', function (e) {
    if (e.key === CHAVE) {
      estado = carregar();
      render();
    }
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* segue funcionando online */ });
  }

  // ---------- inicio ----------

  render();
  if (!operador) pedirOperador();
})();
