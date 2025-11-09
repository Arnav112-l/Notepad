# Modern Notepad with Auto-Save

A modern, feature-rich notepad application with auto-save functionality both locally and to a server.

## Features

- ✨ Auto-save to browser localStorage
- 💾 Auto-save to server when hosted
- 🎨 Modern UI with dark/light theme
- 📊 Real-time character and word count
- ⌨️ Keyboard shortcuts
- 📱 Fully responsive design

## Local Usage (Browser Only)

Simply open `index.html` in your browser. Auto-save will work using localStorage.

## Server Usage (Full Auto-Save)

### Installation

1. Install Node.js dependencies:
```bash
npm install
```

### Running the Server

Start the server:
```bash
npm start
```

Or use nodemon for development:
```bash
npm run dev
```

The server will run on `http://localhost:3000`

### How It Works

- **Local Storage**: Always saves to browser localStorage as backup
- **Server Storage**: When hosted, automatically saves to `documents/` folder on the server
- **Auto-detect**: Automatically detects if server is available
- **Seamless**: Falls back to local storage if server is unavailable

### API Endpoints

- `POST /api/save` - Save document
- `GET /api/load/:filename` - Load document
- `GET /api/documents` - List all documents
- `DELETE /api/delete/:filename` - Delete document

## Keyboard Shortcuts

- `Ctrl+S` - Save file
- `Ctrl+N` - New document
- `Ctrl+Shift+C` - Copy all

## Technologies

- HTML5, CSS3, JavaScript (Frontend)
- Node.js, Express (Backend)
- File System API for document storage

## License

MIT
