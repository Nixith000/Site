const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Tenta ler os ficheiros estáticos tanto da pasta 'public' como da raiz
app.use(express.static('public'));
app.use(express.static(__dirname));

const suspeitos = ["Sargento - Bigode", "Florista - Dona Branca", "Chef - Tony Gourmet", "Mordomo - James", "Médica - Dona Violeta", "Dançarina - Srta. Rosa", "Coveiro - Sergio Noturno", "Advogado - Sr. Marinho"];
const armas = ["Espingarda", "Pá", "Pé-De-Cabra", "Tesoura", "Arma Química", "Veneno", "Soco Inglês", "Faca"];
const locais = ["Prefeitura", "Restaurante", "Boate", "Floricultura", "Mansão", "Hotel", "Hospital", "Praça", "Cemitério", "Banco", "Estação de trem"];

const salas = {};

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function obterNomesJogadores(sala) {
    return sala.jogadores.map(j => j.nick);
}

io.on('connection', (socket) => {

    // Deteta se o utilizador já possuía uma sessão anterior ativa para reentrar no jogo
    socket.on('tentarReconexao', ({ codigoSala, antigoSocketId }) => {
        const sala = salas[codigoSala];
        if (sala) {
            const jogador = sala.jogadores.find(j => j.id === antigoSocketId);
            if (jogador) {
                // Atualiza o identificador do socket antigo para o novo ID gerado na ligação atual
                jogador.id = socket.id;
                if (sala.anfitriao === antigoSocketId) {
                    sala.anfitriao = socket.id;
                }
                
                socket.join(codigoSala);
                socket.emit('reconexaoSucesso', {
                    codigoSala,
                    isAnfitriao: sala.anfitriao === socket.id,
                    iniciado: sala.iniciado,
                    cartas: jogador.cartas,
                    opcoes: { suspeitos, armas, locais },
                    cartasEliminados: sala.cartasEliminados || []
                });

                io.to(codigoSala).emit('atualizarJogadores', obterNomesJogadores(sala));
                return;
            }
        }
        socket.emit('erro', 'Sessão anterior expirada ou sala inexistente.');
    });

    socket.on('criarSala', (nick) => {
        const codigoSala = Math.floor(1000 + Math.random() * 9000).toString();
        salas[codigoSala] = {
            anfitriao: socket.id,
            jogadores: [{ id: socket.id, nick: nick || "Anfitrião", cartas: [] }],
            envelope: {},
            iniciado: false,
            cartasEliminados: []
        };
        socket.join(codigoSala);
        socket.emit('salaCriada', { codigoSala, socketId: socket.id });
        io.to(codigoSala).emit('atualizarJogadores', obterNomesJogadores(salas[codigoSala]));
    });

    socket.on('entrarSala', ({ codigoSala, nick }) => {
        const sala = salas[codigoSala];
        if (sala && !sala.iniciado && sala.jogadores.length < 8) {
            const novoNick = nick || `Detetive ${sala.jogadores.length + 1}`;
            sala.jogadores.push({ id: socket.id, nick: novoNick, cartas: [] });
            socket.join(codigoSala);
            
            socket.emit('entradaConfirmada', { codigoSala, socketId: socket.id });
            io.to(codigoSala).emit('atualizarJogadores', obterNomesJogadores(sala));
        } else {
            socket.emit('erro', 'Sala cheia, inexistente ou jogo já em andamento.');
        }
    });

    socket.on('iniciarJogo', (codigoSala) => {
        const sala = salas[codigoSala];
        if (sala && sala.anfitriao === socket.id) {
            if (sala.jogadores.length < 4) {
                socket.emit('erro', 'São necessários pelo menos 4 investigadores!');
                return;
            }
            sala.iniciado = true;
            socket.emit('escolherEnvelope', { suspeitos, armas, locais });
            socket.to(codigoSala).emit('aguardandoHost');
        }
    });

    socket.on('envelopeDefinido', ({ codigoSala, envelope }) => {
        const sala = salas[codigoSala];
        if (sala && sala.anfitriao === socket.id) {
            sala.envelope = envelope;

            let sEmbaralhados = suspeitos.filter(c => c !== envelope.suspeito);
            let aEmbaralhadas = armas.filter(c => c !== envelope.arma);
            let lEmbaralhados = locais.filter(c => c !== envelope.local);

            let deckRestante = shuffle([...sEmbaralhados, ...aEmbaralhadas, ...lEmbaralhados]);

            let jogadorIndex = 0;
            while(deckRestante.length > 0) {
                sala.jogadores[jogadorIndex].cartas.push(deckRestante.pop());
                jogadorIndex = (jogadorIndex + 1) % sala.jogadores.length;
            }

            sala.jogadores.forEach(jogador => {
                io.to(jogador.id).emit('cartasRecebidas', {
                    cartas: jogador.cartas,
                    opcoes: { suspeitos, armas, locais }
                });
            });

            io.to(codigoSala).emit('jogoIniciado');
        }
    });

    socket.on('rolarDado', (codigoSala) => {
        const sala = salas[codigoSala];
        if (sala && sala.anfitriao === socket.id) {
            const dado = Math.floor(Math.random() * 6) + 1;
            io.to(codigoSala).emit('resultadoDado', dado);
        }
    });

    socket.on('fazerPalpite', ({ codigoSala, palpite }) => {
        const sala = salas[codigoSala];
        if (sala) {
            const jogadorAtual = sala.jogadores.find(j => j.id === socket.id);
            const nickEliminado = jogadorAtual ? jogadorAtual.nick : "Um investigador";

            const acertou = (
                palpite.suspeito === sala.envelope.suspeito &&
                palpite.arma === sala.envelope.arma &&
                palpite.local === sala.envelope.local
            );

            if (acertou) {
                io.to(codigoSala).emit('fimDeJogo', { resultado: 'ganhou', vencedor: nickEliminado, envelope: sala.envelope });
            } else {
                if (jogadorAtual) {
                    // Guarda as cartas de quem errou no array permanente da sala
                    sala.cartasEliminados.push(...jogadorAtual.cartas);
                }
                
                socket.emit('eliminado');
                socket.leave(codigoSala);
                sala.jogadores = sala.jogadores.filter(j => j.id !== socket.id);
                
                // Envia as cartas dos jogadores eliminados para quem continua ativo
                io.to(codigoSala).emit('alguemEliminado', { 
                    nick: nickEliminado, 
                    cartasEliminados: sala.cartasEliminados 
                });
                io.to(codigoSala).emit('atualizarJogadores', obterNomesJogadores(sala));
            }
        }
    });
});

// ROTA DE SEGURANÇA: Se o utilizador aceder à raiz e o Express vacilar, entrega o index.html à força
app.get('*', (req, res) => {
    // Tenta mandar da pasta public, se não conseguir, tenta da raiz
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'index.html'));
        }
    });
});

// CONFIGURAÇÃO DA PORTA DINÂMICA (O Render injeta a porta dele, localmente usa a 25555)
const PORT = process.env.PORT || 25555;
server.listen(PORT, () => console.log(`Servidor a rodar com sucesso na porta ${PORT}`));
