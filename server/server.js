const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  },
});

let sharedGraphs = {}; // Gráficos compartidos por roomId

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  socket.on('join', (roomId) => {
    socket.join(roomId);
    console.log(`Cliente ${socket.id} se unió a la sala ${roomId}`);

    // Inicializar el gráfico si no existe
    if (!sharedGraphs[roomId]) {
      sharedGraphs[roomId] = { tables: {}, relations: {} };
    }

    // Enviar el gráfico completo al nuevo cliente
    socket.emit('updateGraph', sharedGraphs[roomId]);
  });

  // Recibir cambios específicos del gráfico
  socket.on('graphChanged', (data) => {
    const { roomId, changeType, payload } = data;

    // Asegurarse de que el gráfico existe antes de intentar modificarlo
    if (!sharedGraphs[roomId]) {
      sharedGraphs[roomId] = { tables: {}, relations: {} };
    }

    switch (changeType) {
      case 'newTable':
        sharedGraphs[roomId].tables[payload.id] = payload;
        console.log("nueva tabla", payload);
        break;
      case 'updatedTable':
        sharedGraphs[roomId].tables[payload.id] = payload;
        console.log("tabla actualizada", payload);
        break;
      case 'newRelacion': // Nota: parece que usas 'newRelacion' en lugar de 'newRelation'
      case 'newRelation':
        sharedGraphs[roomId].relations[payload.id] = payload;
        console.log("nueva relación", payload);
        break;
      case 'updatedRelation':
        if (sharedGraphs[roomId].relations[payload.id]) {
          sharedGraphs[roomId].relations[payload.id] = { 
            ...sharedGraphs[roomId].relations[payload.id], 
            ...payload 
          };
        } else {
          sharedGraphs[roomId].relations[payload.id] = payload;
        }
        console.log("relación actualizada", payload);
        break;
      default:
        console.log(`Tipo de cambio no reconocido: ${changeType}`);
    }

    // Enviar el cambio a los otros clientes en la sala
    socket.to(roomId).emit('updateGraph', { changeType, payload });
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Servidor corriendo en el puerto 3000');
});