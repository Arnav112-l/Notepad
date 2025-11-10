const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Store active collaborative sessions
const collaborativeSessions = new Map();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Ensure documents directory exists
const DOCS_DIR = path.join(__dirname, 'documents');
fs.mkdir(DOCS_DIR, { recursive: true }).catch(console.error);

// Save document
app.post('/api/save', async (req, res) => {
    try {
        const { content, filename } = req.body;
        
        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        const sanitizedFilename = filename.replace(/[^a-z0-9_-]/gi, '_');
        const filepath = path.join(DOCS_DIR, `${sanitizedFilename}.txt`);
        
        await fs.writeFile(filepath, content, 'utf8');
        
        res.json({ 
            success: true, 
            message: 'Document saved successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: 'Failed to save document' });
    }
});

// Load document
app.get('/api/load/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const sanitizedFilename = filename.replace(/[^a-z0-9_-]/gi, '_');
        const filepath = path.join(DOCS_DIR, `${sanitizedFilename}.txt`);
        
        const content = await fs.readFile(filepath, 'utf8');
        
        res.json({ 
            success: true, 
            content,
            filename: sanitizedFilename
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Document not found' });
        } else {
            console.error('Load error:', error);
            res.status(500).json({ error: 'Failed to load document' });
        }
    }
});

// List all documents
app.get('/api/documents', async (req, res) => {
    try {
        const files = await fs.readdir(DOCS_DIR);
        const txtFiles = files
            .filter(file => file.endsWith('.txt'))
            .map(file => ({
                name: file.replace('.txt', ''),
                fullName: file
            }));
        
        res.json({ success: true, documents: txtFiles });
    } catch (error) {
        console.error('List error:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

// Delete document
app.delete('/api/delete/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const sanitizedFilename = filename.replace(/[^a-z0-9_-]/gi, '_');
        const filepath = path.join(DOCS_DIR, `${sanitizedFilename}.txt`);
        
        await fs.unlink(filepath);
        
        res.json({ 
            success: true, 
            message: 'Document deleted successfully'
        });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// Create collaborative session
app.post('/api/collaborate/create', (req, res) => {
    const sessionId = uuidv4();
    const { title, content } = req.body;
    
    collaborativeSessions.set(sessionId, {
        id: sessionId,
        title: title || 'Untitled Shared Document',
        content: content || '',
        users: [],
        createdAt: new Date()
    });
    
    res.json({ 
        success: true, 
        sessionId,
        shareUrl: `${req.protocol}://${req.get('host')}/collaborate/${sessionId}`
    });
});

// Get collaborative session
app.get('/api/collaborate/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = collaborativeSessions.get(sessionId);
    
    if (session) {
        res.json({ 
            success: true, 
            session: {
                id: session.id,
                title: session.title,
                content: session.content,
                activeUsers: session.users.length
            }
        });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// WebSocket connection for real-time collaboration
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join collaborative session
    socket.on('join-session', (sessionId) => {
        socket.join(sessionId);
        
        const session = collaborativeSessions.get(sessionId);
        if (session) {
            session.users.push(socket.id);
            
            // Send current content to new user
            socket.emit('load-content', {
                title: session.title,
                content: session.content
            });
            
            // Notify others about new user
            socket.to(sessionId).emit('user-joined', {
                userId: socket.id,
                activeUsers: session.users.length
            });
            
            console.log(`User ${socket.id} joined session ${sessionId}`);
        }
    });
    
    // Handle content changes
    socket.on('content-change', ({ sessionId, content, cursorPosition }) => {
        const session = collaborativeSessions.get(sessionId);
        if (session) {
            session.content = content;
            
            // Broadcast to all other users in the session
            socket.to(sessionId).emit('content-update', {
                content,
                cursorPosition,
                userId: socket.id
            });
        }
    });
    
    // Handle title changes
    socket.on('title-change', ({ sessionId, title }) => {
        const session = collaborativeSessions.get(sessionId);
        if (session) {
            session.title = title;
            
            // Broadcast to all other users
            socket.to(sessionId).emit('title-update', {
                title,
                userId: socket.id
            });
        }
    });
    
    // Handle cursor position
    socket.on('cursor-move', ({ sessionId, position }) => {
        socket.to(sessionId).emit('cursor-update', {
            userId: socket.id,
            position
        });
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove user from all sessions
        collaborativeSessions.forEach((session, sessionId) => {
            const index = session.users.indexOf(socket.id);
            if (index > -1) {
                session.users.splice(index, 1);
                
                // Notify others
                socket.to(sessionId).emit('user-left', {
                    userId: socket.id,
                    activeUsers: session.users.length
                });
                
                // Clean up empty sessions after 1 hour
                if (session.users.length === 0) {
                    setTimeout(() => {
                        if (collaborativeSessions.get(sessionId)?.users.length === 0) {
                            collaborativeSessions.delete(sessionId);
                            console.log(`Session ${sessionId} cleaned up`);
                        }
                    }, 3600000);
                }
            }
        });
    });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
    console.log(`✨ Notepad server running on http://localhost:${PORT}`);
    console.log(`📁 Documents saved in: ${DOCS_DIR}`);
    console.log(`🔗 Real-time collaboration enabled!`);
});
