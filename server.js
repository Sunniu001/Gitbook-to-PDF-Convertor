const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { convertGitbook } = require('./src/converter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const OUTPUT_ROOT = path.join(__dirname, 'web_outputs');

if (!fs.existsSync(OUTPUT_ROOT)) {
  fs.mkdirSync(OUTPUT_ROOT);
}

app.use(express.static('public'));
app.use('/downloads', express.static(OUTPUT_ROOT));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('start-conversion', async (data) => {
    const { url } = data;
    const jobId = Date.now().toString();
    const jobDir = path.join(OUTPUT_ROOT, jobId);

    try {
      await convertGitbook(url, jobDir, (progress) => {
        socket.emit('conversion-progress', { ...progress, jobId });
      });
    } catch (error) {
      socket.emit('conversion-error', { message: error.message, jobId });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
