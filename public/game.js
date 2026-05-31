const socket = io('https://site-t7mo.onrender.com');
let codigoSalaAtual = '';
let isAnfitriao = false;
let acaoAoFecharAlerta = null;

// Verifica a existência de dados armazenados para recuperação de sessão ativa ao carregar a página
window.onload = function() {
    const codigoSalvo = sessionStorage.getItem('detetive_codigoSala');
    const socketIdSalvo = sessionStorage.getItem('detetive_socketId');
    const nickSalvo = sessionStorage.getItem('detetive_nick');

    if (codigoSalvo && socketIdSalvo) {
        document.getElementById('btnReconectar').style.display = 'block';
        if (nickSalvo) {
            document.getElementById('playerNick').value = nickSalvo;
        }
    }
};

function esconderTudo() {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('aguardando').style.display = 'none';
    document.getElementById('escolhaHost').style.display = 'none';
    document.getElementById('jogo').style.display = 'none';
}

function obterNick() {
    return document.getElementById('playerNick').value.trim();
}

// CAIXA DE ALERTA DINÂMICA CUSTOMIZADA
function lancarAlertaCustom(mensagem, titulo = "Aviso do Caso", erro = false, onFechar = null) {
    document.getElementById('alertaTitulo').innerText = titulo;
    document.getElementById('alertaConteudo').innerText = mensagem;
    
    const layout = document.getElementById('modalAlertaLayout');
    if (erro) {
        layout.style.borderColor = "var(--danger)";
        document.getElementById('alertaTitulo').style.color = "var(--danger)";
    } else {
        layout.style.borderColor = "var(--gold)";
        document.getElementById('alertaTitulo').style.color = "var(--gold)";
    }
    
    acaoAoFecharAlerta = onFechar;
    document.getElementById('modalAlerta').style.display = 'flex';
}

function fecharAlertaCustom() {
    document.getElementById('modalAlerta').style.display = 'none';
    if (acaoAoFecharAlerta) {
        acaoAoFecharAlerta();
        acaoAoFecharAlerta = null;
    }
}

function fecharModal(id) {
    document.getElementById(id).style.display = 'none';
}

function criarSala() { 
    const nick = obterNick();
    if(!nick) return lancarAlertaCustom('Por favor, digite seu Nick antes de criar a sala!', 'Erro de Identificação', true);
    sessionStorage.setItem('detetive_nick', nick);
    socket.emit('criarSala', nick); 
}

function entrarSala() {
    const codigo = document.getElementById('codigoEntrada').value.trim();
    const nick = obterNick();
    if(!nick) return lancarAlertaCustom('Por favor, digite seu Nick antes de entrar!', 'Erro de Identificação', true);
    if(codigo.length === 4) {
        sessionStorage.setItem('detetive_nick', nick);
        socket.emit('entrarSala', { codigoSala: codigo, nick: nick });
    } else {
        lancarAlertaCustom('Insira um código válido de 4 dígitos.', 'Código Inválido', true);
    }
}

function reconectarJogo() {
    const codigoSala = sessionStorage.getItem('detetive_codigoSala');
    const antigoSocketId = sessionStorage.getItem('detetive_socketId');
    if (codigoSala && antigoSocketId) {
        socket.emit('tentarReconexao', { codigoSala, antigoSocketId });
    }
}

function iniciarJogo() { socket.emit('iniciarJogo', codigoSalaAtual); }

function enviarEnvelope() {
    const envelope = {
        suspeito: document.getElementById('hostSuspeito').value,
        arma: document.getElementById('hostArma').value,
        local: document.getElementById('hostLocal').value
    };
    socket.emit('envelopeDefinido', { codigoSala: codigoSalaAtual, envelope });
}

function mostrarDicaLocal() {
    const carta = document.getElementById('selectMinhaDica').value;
    document.getElementById('cartaRevelada').innerText = carta;
    document.getElementById('modalDica').style.display = 'flex';
}

function rolarDado() { socket.emit('rolarDado', codigoSalaAtual); }

// ABRE O CONFIRM CUSTOMIZADO
function abrirConfirmacaoAcusacao() {
    document.getElementById('modalConfirmar').style.display = 'flex';
}

function processarAcusacaoFinal(confirmado) {
    document.getElementById('modalConfirmar').style.display = 'none';
    if (confirmado) {
        const palpite = {
            suspeito: document.getElementById('selectSuspeito').value,
            arma: document.getElementById('selectArma').value,
            local: document.getElementById('selectLocal').value
        };
        socket.emit('fazerPalpite', { codigoSala: codigoSalaAtual, palpite });
    }
}

function atualizarInterfaceCartasEliminados(cartas) {
    const secao = document.getElementById('secaoCartasEliminados');
    const container = document.getElementById('cartasEliminados');
    
    if (cartas && cartas.length > 0) {
        secao.style.display = 'block';
        container.innerHTML = '';
        cartas.forEach(carta => {
            const div = document.createElement('div');
            div.className = 'carta carta-eliminada';
            div.innerText = carta;
            container.appendChild(div);
        });
    } else {
        secao.style.display = 'none';
    }
}

function limparCacheEReload() {
    sessionStorage.clear();
    window.location.reload();
}

// Respostas vindas do Servidor (Socket Events)
socket.on('salaCriada', ({ codigoSala, socketId }) => {
    codigoSalaAtual = codigoSala;
    isAnfitriao = true;
    
    sessionStorage.setItem('detetive_codigoSala', codigoSala);
    sessionStorage.setItem('detetive_socketId', socketId);

    esconderTudo();
    document.getElementById('lobby').style.display = 'block';
    document.getElementById('displayCodigo').innerText = codigoSala;
    document.getElementById('btnIniciar').style.display = 'block';
});

socket.on('entradaConfirmada', ({ codigoSala, socketId }) => {
    codigoSalaAtual = codigoSala;
    isAnfitriao = false;

    sessionStorage.setItem('detetive_codigoSala', codigoSala);
    sessionStorage.setItem('detetive_socketId', socketId);

    esconderTudo();
    document.getElementById('lobby').style.display = 'block';
    document.getElementById('displayCodigo').innerText = codigoSala;
});

socket.on('reconexaoSucesso', (dados) => {
    codigoSalaAtual = dados.codigoSala;
    isAnfitriao = dados.isAnfitriao;
    
    sessionStorage.setItem('detetive_socketId', socket.id);

    esconderTudo();
    if (!dados.iniciado) {
        document.getElementById('lobby').style.display = 'block';
        document.getElementById('displayCodigo').innerText = dados.codigoSala;
        if (isAnfitriao) document.getElementById('btnIniciar').style.display = 'block';
    } else {
        document.getElementById('jogo').style.display = 'block';
        if (isAnfitriao) document.getElementById('painelAnfitriao').style.display = 'block';
        
        if (dados.cartas && dados.cartas.length > 0) {
            const container = document.getElementById('minhasCartas');
            container.innerHTML = '';
            dados.cartas.forEach(carta => {
                const div = document.createElement('div');
                div.className = 'carta';
                div.innerText = carta;
                container.appendChild(div);
            });
            preencherSelect('selectMinhaDica', dados.cartas);
            preencherSelect('selectSuspeito', dados.opcoes.suspeitos);
            preencherSelect('selectArma', dados.opcoes.armas);
            preencherSelect('selectLocal', dados.opcoes.locais);
        }
        atualizarInterfaceCartasEliminados(dados.cartasEliminados);
    }
    lancarAlertaCustom('Lógica de integridade restabelecida! Voltaste à investigação.', 'Sessão Recuperada');
});

socket.on('atualizarJogadores', (listaNomes) => {
    const listaUl = document.getElementById('listaJogadores');
    listaUl.innerHTML = '';
    listaNomes.forEach(nome => {
        const li = document.createElement('li');
        li.innerText = nome;
        listaUl.appendChild(li);
    });
});

socket.on('aguardandoHost', () => {
    esconderTudo();
    document.getElementById('aguardando').style.display = 'block';
});

socket.on('escolherEnvelope', ({ suspeitos, armas, locais }) => {
    esconderTudo();
    document.getElementById('escolhaHost').style.display = 'block';
    preencherSelect('hostSuspeito', suspeitos);
    preencherSelect('hostArma', armas);
    preencherSelect('hostLocal', locais);
});

socket.on('jogoIniciado', () => {
    esconderTudo();
    document.getElementById('jogo').style.display = 'block';
    if (isAnfitriao) {
        document.getElementById('painelAnfitriao').style.display = 'block';
    }
});

socket.on('resultadoDado', (valor) => {
    document.getElementById('areaDado').style.display = 'block';
    document.getElementById('valorDado').innerText = `🎲 ${valor}`;
});

socket.on('cartasRecebidas', ({ cartas, opcoes }) => {
    const container = document.getElementById('minhasCartas');
    container.innerHTML = '';
    cartas.forEach(carta => {
        const div = document.createElement('div');
        div.className = 'carta';
        div.innerText = carta;
        container.appendChild(div);
    });

    preencherSelect('selectMinhaDica', cartas);
    preencherSelect('selectSuspeito', opcoes.suspeitos);
    preencherSelect('selectArma', opcoes.armas);
    preencherSelect('selectLocal', opcoes.locais);
});

socket.on('fimDeJogo', (dados) => {
    esconderTudo();
    document.getElementById('vendedorNick').innerText = dados.vencedor;
    document.getElementById('detalhesCrime').innerHTML = `
        <p><strong>Suspeito:</strong> ${dados.envelope.suspeito}</p>
        <p><strong>Arma:</strong> ${dados.envelope.arma}</p>
        <p><strong>Local:</strong> ${dados.envelope.local}</p>
    `;
    document.getElementById('painelVitoria').style.display = 'block';
});

socket.on('eliminado', () => {
    lancarAlertaCustom('❌ VOCÊ ERROU A ACUSAÇÃO E FOI EXPULSO DA INVESTIGAÇÃO! ❌\nSuas cartas foram expostas aos outros detetives.', 'Expulso da Sala', true, () => {
        limparCacheEReload();
    });
});

socket.on('alguemEliminado', (dados) => {
    lancarAlertaCustom(`⚠️ O investigador [${dados.nick}] errou a acusação final e foi ELIMINADO!`, 'Investigador Eliminado', true);
    atualizarInterfaceCartasEliminados(dados.cartasEliminados);
});

socket.on('erro', (msg) => lancarAlertaCustom(msg, 'Erro do Sistema', true));

function preencherSelect(idSelect, lista) {
    const select = document.getElementById(idSelect);
    select.innerHTML = '';
    lista.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.innerText = item;
        select.appendChild(opt);
    });
}
