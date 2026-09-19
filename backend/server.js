const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const NLP = require('./thai-nlp'); // เรียกใช้โมดูลที่เราเขียนไว้

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// In-Memory Database สำหรับเก็บข้อมูลห้องทั้งหมด
const rooms = new Map();

// สร้างห้องใหม่พร้อมการตั้งค่าเริ่มต้น
function createInitialRoomState(roomId) {
    return {
        roomId,
        status: 'lobby',
        settings: {
            totalRounds: 3,
            turnTimeLimit: 5000,   // 5 วินาที
            debateTimeLimit: 60000 // 1 นาที (ปรับลดลงมาเพื่อไม่ให้นานเกินไป)
        },
        currentRound: 1,
        players: [],         // { id, name, avatar, score, isHost }
        activePlayerIds: [], // ID ของคนที่ยังมีชีวิตอยู่ในรอบนี้
        currentTurnIndex: 0,
        usedSyllables: new Set(),
        lastTwoWords: [],    // [{ playerId, word }] สูงสุด 2 ค่า
        challenge: null,
        timerRef: null
    };
}

// ---------------------------------------------------------
// Game Flow Helpers
// ---------------------------------------------------------

function nextTurn(room) {
    clearTimeout(room.timerRef);

    // เช็คเงื่อนไขจบเงื่อนไขจบเกม (เหลือคนเดียว)
    if (room.activePlayerIds.length <= 1) {
        handleRoundEnd(room);
        return;
    }

    // เลื่อนไปผู้เล่นคนถัดไป
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.activePlayerIds.length;
    const nextPlayerId = room.activePlayerIds[room.currentTurnIndex];

    io.to(room.roomId).emit('turn_start', { 
        playerId: nextPlayerId, 
        timeLimit: room.settings.turnTimeLimit 
    });

    // เริ่มจับเวลาของเทิร์นนี้
    room.timerRef = setTimeout(() => {
        eliminatePlayer(room, nextPlayerId, "หมดเวลาพูด");
    }, room.settings.turnTimeLimit);
}

function eliminatePlayer(room, playerId, reason) {
    clearTimeout(room.timerRef);

    const eliminatedIndex = room.activePlayerIds.indexOf(playerId);
    if (eliminatedIndex === -1) return;

    room.activePlayerIds.splice(eliminatedIndex, 1);
    io.to(room.roomId).emit('elimination', { playerId, reason });

    // ให้คะแนนผู้ที่รอดถึง Top 3
    if (room.activePlayerIds.length === 3) {
        room.activePlayerIds.forEach(id => {
            const p = room.players.find(p => p.id === id);
            if (p) p.score += 1;
        });
        io.to(room.roomId).emit('score_update', room.players);
    }

    // เซ็ตคิวของคนถัดไปและรีเซ็ตคำเชื่อม
    room.currentTurnIndex = eliminatedIndex % Math.max(room.activePlayerIds.length, 1);
    // ถอยกลับ index ไป 1 step เพราะ nextTurn() จะบวกเพิ่ม
    room.currentTurnIndex = (room.currentTurnIndex - 1 + room.activePlayerIds.length) % room.activePlayerIds.length;
    room.lastTwoWords = []; 
    
    nextTurn(room);
}

function handleRoundEnd(room) {
    const winnerId = room.activePlayerIds[0];
    const winner = room.players.find(p => p.id === winnerId);
    if (winner) winner.score += 3; // คะแนนผู้ชนะรอบ

    room.status = 'roundEnd';
    io.to(room.roomId).emit('round_end', { winnerId, players: room.players });

    // เช็คว่าจบเกมหรือยัง
    if (room.currentRound >= room.settings.totalRounds) {
        room.status = 'gameEnd';
        io.to(room.roomId).emit('game_end', { players: room.players });
    } else {
        // รอ 5 วินาทีแล้วเริ่มรอบถัดไป
        setTimeout(() => {
            room.currentRound++;
            room.activePlayerIds = room.players.map(p => p.id);
            room.usedSyllables.clear();
            room.lastTwoWords = [];
            room.status = 'playing';
            
            io.to(room.roomId).emit('round_start', { round: room.currentRound });
            nextTurn(room);
        }, 5000);
    }
}

// ---------------------------------------------------------
// Socket.io Events
// ---------------------------------------------------------

io.on('connection', (socket) => {
    
    // ผู้เล่นเข้าร่วมห้อง
    socket.on('join_room', ({ roomId, name, avatar }) => {
        let room = rooms.get(roomId);
        if (!room) {
            room = createInitialRoomState(roomId);
            rooms.set(roomId, room);
        }

        const isHost = room.players.length === 0;
        const player = { id: socket.id, name, avatar, score: 0, isHost };
        room.players.push(player);
        
        socket.join(roomId);
        io.to(roomId).emit('room_update', { players: room.players, settings: room.settings });
    });

    // Host เริ่มเกม
    socket.on('start_game', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || room.status !== 'lobby' || room.players.length < 3) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) return;

        room.status = 'playing';
        room.activePlayerIds = room.players.map(p => p.id);
        
        // สุ่มคนเริ่มเกม
        room.currentTurnIndex = Math.floor(Math.random() * room.activePlayerIds.length);
        room.currentTurnIndex = (room.currentTurnIndex - 1 + room.activePlayerIds.length) % room.activePlayerIds.length; // เผื่อไว้ให้ nextTurn() บวก
        
        io.to(roomId).emit('game_started');
        nextTurn(room);
    });

    // ผู้เล่นส่งคำศัพท์
    socket.on('submit_word', async ({ roomId, word }) => {
        const room = rooms.get(roomId);
        if (!room || room.activePlayerIds[room.currentTurnIndex] !== socket.id) return;

        // หยุดเวลาทันทีที่ระบบได้รับคำ เพื่อเผื่อเวลาให้ Python ประมวลผล
        clearTimeout(room.timerRef);

        try {
            // 1. ตรวจสอบคำนามและพยางค์ผ่าน Python NLP
            const nlpResult = await NLP.processWord(word);

            if (!nlpResult.isNoun) {
                return eliminatePlayer(room, socket.id, `คำว่า '${word}' ไม่ใช่คำนามที่ถูกต้อง`);
            }

            // 2. ตรวจสอบพยางค์ซ้ำ
            for (let syl of nlpResult.syllables) {
                if (room.usedSyllables.has(syl)) {
                    return eliminatePlayer(room, socket.id, `พยางค์ '${syl}' ถูกใช้ไปแล้ว`);
                }
            }

            // 3. ผ่านการตรวจสอบทั้งหมด -> บันทึกเข้าระบบ
            nlpResult.syllables.forEach(syl => room.usedSyllables.add(syl));
            
            room.lastTwoWords.push({ playerId: socket.id, word });
            if (room.lastTwoWords.length > 2) room.lastTwoWords.shift();

            io.to(roomId).emit('word_accepted', { playerId: socket.id, word });

            // ให้เวลา 1.5 วินาทีในการกด Challenge ก่อนเปลี่ยนเทิร์น
            room.timerRef = setTimeout(() => nextTurn(room), 1500); 

        } catch (error) {
            console.error("NLP Error:", error);
            // กรณีระบบ NLP พัง ข้ามให้ผ่านชั่วคราวหรือเตะออก (ตรงนี้เลือกให้ส่งกลับไปให้ผู้เล่นลองใหม่หรือเตะออกได้)
            eliminatePlayer(room, socket.id, "ระบบตรวจคำศัพท์ขัดข้อง");
        }
    });

    // ขอ Challenge คำก่อนหน้า
    socket.on('challenge_turn', ({ roomId }) => {
        const room = rooms.get(roomId);
        // เช็คว่ามีคำให้ท้วงอย่างน้อย 2 คำ และเกมอยู่ในสถานะปกติ
        if (!room || room.status !== 'playing' || room.lastTwoWords.length < 2) return;
        
        clearTimeout(room.timerRef);
        room.status = 'debate';
        room.challenge = {
            challengerId: socket.id,
            challengedId: room.lastTwoWords[1].playerId,
            votes: {}
        };

        io.to(roomId).emit('debate_start', {
            challengerId: socket.id,
            challengedId: room.challenge.challengedId,
            words: room.lastTwoWords,
            debateTimeLimit: room.settings.debateTimeLimit
        });

        // จบช่วง Debate อัตโนมัติ -> เข้าสู่การโหวต
        room.timerRef = setTimeout(() => {
            room.status = 'voting';
            io.to(roomId).emit('voting_start');
            
            // ให้เวลาโหวต 15 วินาที
            room.timerRef = setTimeout(() => resolveChallenge(room), 15000);
        }, room.settings.debateTimeLimit);
    });

    // ส่งผลโหวต
    socket.on('submit_vote', ({ roomId, voteFor }) => {
        const room = rooms.get(roomId);
        if (!room || room.status !== 'voting') return;

        // ห้ามคนที่มีส่วนได้ส่วนเสียโหวต
        if (socket.id === room.challenge.challengerId || socket.id === room.challenge.challengedId) return;

        room.challenge.votes[socket.id] = voteFor;
    });

    // ผู้เล่นหลุดออกจากเกม
    socket.on('disconnect', () => {
        rooms.forEach(room => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                // ถ้าเป็นผู้เล่นที่รอดชีวิตอยู่ ให้ออกจากรอบด้วย
                const activeIndex = room.activePlayerIds.indexOf(socket.id);
                if (activeIndex !== -1) {
                    eliminatePlayer(room, socket.id, "ผู้เล่นตัดการเชื่อมต่อ");
                }
                
                io.to(room.roomId).emit('room_update', { players: room.players, settings: room.settings });
            }
        });
    });

    // Helper ประมวลผลโหวตหลังหมดเวลา
    function resolveChallenge(room) {
        const { challengerId, challengedId, votes } = room.challenge;
        let challengerVotes = 0, challengedVotes = 0;
        
        Object.values(votes).forEach(vote => {
            if (vote === challengerId) challengerVotes++;
            if (vote === challengedId) challengedVotes++;
        });

        const challengerWon = challengerVotes > challengedVotes;
        
        io.to(room.roomId).emit('challenge_result', { 
            challengerWon, 
            challengerVotes, 
            challengedVotes 
        });
        
        room.status = 'playing';
        room.challenge = null;

        if (challengerWon) {
            eliminatePlayer(room, challengedId, "แพ้โหวตการท้วงคำ (คำไม่เชื่อมกัน)");
        } else {
            eliminatePlayer(room, challengerId, "แพ้โหวตการท้วงคำ (ท้วงผิด)");
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Wordchain Engine Live on port ${PORT}`);
});