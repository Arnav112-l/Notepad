const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✨ Notepad server running on http://localhost:${PORT}`);
    console.log(`📁 Documents saved in: ${DOCS_DIR}`);
});
