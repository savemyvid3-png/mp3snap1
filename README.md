# Neurotube - YouTube Converter

A modern YouTube to MP3/MP4 converter with a beautiful UI and fast downloads.

## Features

- 🎵 Convert YouTube videos to MP3 (320kbps high-quality audio)
- 🎥 Download YouTube videos as MP4 (up to 1080p HD)
- 📱 YouTube Shorts support
- 🎨 Modern, sleek UI with Tailwind CSS
- ⚡ Fast concurrent downloads using yt-dlp + FFmpeg
- 🚀 Single unified server (frontend + backend)
- 📱 Responsive design

## Prerequisites

- **Node.js** (v18 or higher)

## Installation

```bash
npm install
```

## Usage

### Quick Start (Windows)

Simply double-click `start.bat` or run:

```bash
npm start
```

Then open your browser to `http://localhost:3000`

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run production
```

This will build the frontend and serve everything from a single optimized server.

## How to Use

1. Open `http://localhost:3000` in your browser
2. Paste a YouTube URL (videos or Shorts)
3. Select format: MP3 (audio) or MP4 (video)
4. For MP4, select quality (1080p, 720p, 480p, 360p)
5. Click the arrow button to fetch video info
6. Click "Download" to get your file!

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/info` | GET | Get video info (title, thumbnail, duration, available qualities) |
| `/api/download` | GET | Download video as MP3 or MP4 |
| `/api/health` | GET | Health check |

### Query Parameters

- `url` - YouTube video URL
- `format` - Output format (`mp3` or `mp4`)

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Python Flask + yt-dlp + FFmpeg
- **Icons**: Lucide React

## Project Structure

```
Youtube converter/
├── src/                    # React frontend
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── backend/                # Python backend
│   ├── app.py              # Flask server
│   ├── requirements.txt
│   └── start_backend.bat
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Troubleshooting

### FFmpeg not found
Make sure FFmpeg is installed and added to your system PATH.

### Video download fails
Some videos may be age-restricted or region-locked. Try a different video.

### CORS errors
Make sure the backend is running on port 5000 and the frontend proxy is configured correctly.

## License

For educational purposes only. Respect YouTube's Terms of Service.

- Make sure you have a stable internet connection
- Some videos may take longer depending on their size
- Audio is converted to 320kbps MP3 format
- Video downloads are in the highest quality available
