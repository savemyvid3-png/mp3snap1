import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';
const isWindows = process.platform === 'win32';

// cookies.txt path
const cookiesPath = '/app/cookies.txt';
const cookiesArgs = fs.existsSync(cookiesPath) ? ['--cookies', cookiesPath] : [];

// Set ffmpeg path (use system ffmpeg in Docker/Linux, ffmpeg-static on Windows)
const ffmpegPath = isWindows ? ffmpegStatic : '/usr/bin/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);

// Set yt-dlp binary path (cross-platform)
const ytdlpPath = isWindows
  ? path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe')
  : '/usr/local/bin/yt-dlp';

// Helper to validate YouTube URL (including Shorts)
const isValidYouTubeUrl = (url) => {
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
    /^(https?:\/\/)?youtu\.be\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/v\/[\w-]+/
  ];
  return patterns.some(pattern => pattern.test(url));
};

// Helper to run yt-dlp and get JSON output
const getVideoInfo = async (url) => {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--dump-single-json',
      '--no-check-certificates',
      '--no-warnings',
      '--no-playlist',
      '--flat-playlist',
      ...cookiesArgs
    ];

    const process = spawn(ytdlpPath, args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout));
        } catch (err) {
          reject(new Error('Failed to parse JSON: ' + err.message));
        }
      } else {
        reject(new Error('yt-dlp process exited with code ' + code + ': ' + stderr));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
};

// Get available video formats with quality info
const getAvailableFormats = (info) => {
  const formats = info.formats || [];
  const videoFormats = formats
    .filter(f => f.vcodec !== 'none' && f.height)
    .map(f => ({
      formatId: f.format_id,
      height: f.height,
      quality: f.height + 'p',
      ext: f.ext,
      filesize: f.filesize || f.filesize_approx
    }))
    .sort((a, b) => b.height - a.height);

  const uniqueFormats = [];
  const seenHeights = new Set();
  for (const f of videoFormats) {
    if (!seenHeights.has(f.height)) {
      seenHeights.add(f.height);
      uniqueFormats.push(f);
    }
  }

  return uniqueFormats.slice(0, 5);
};

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Neurotube server is running' });
});

// Get video info with available qualities
app.get('/api/info', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL.' });
    }

    const info = await getVideoInfo(url);

    // Format duration
    let duration = '0:00';
    if (info.duration) {
      duration = new Date(info.duration * 1000).toISOString().substring(11, 19).replace(/^00:/, '');
    }

    const availableFormats = getAvailableFormats(info);
    const isShort = url.includes('/shorts/') || (info.duration && info.duration <= 60);

    res.json({
      id: info.id,
      title: info.title,
      thumbnail: info.thumbnail,
      duration: duration,
      isShort: isShort,
      channel: info.channel || info.uploader,
      availableQualities: availableFormats.map(f => f.quality),
      bestQuality: (availableFormats[0] && availableFormats[0].quality) || 'HD',
      audioQuality: '320kbps'
    });
  } catch (error) {
    console.error('Error fetching video info:', error);
    res.status(500).json({
      error: 'Failed to fetch video information',
      message: error.message
    });
  }
});

// Download/convert video with quality selection
app.get('/api/download', async (req, res) => {
  let tempFile = null;

  try {
    const { url, format, quality } = req.query;

    if (!url || !format) {
      return res.status(400).json({ error: 'URL and format parameters are required' });
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const info = await getVideoInfo(url);
    const title = info.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').substring(0, 100);
    const timestamp = Date.now();

    if (format === 'mp3') {
      tempFile = path.join(tmpdir(), timestamp + '_' + title + '.mp3');

      res.setHeader('Content-Disposition', 'attachment; filename="' + title + '.mp3"');
      res.setHeader('Content-Type', 'audio/mpeg');

      const args = [
        url,
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--ffmpeg-location', ffmpegPath,
        '--output', tempFile,
        '--no-check-certificates',
        '--no-warnings',
        '--no-playlist',
        '--concurrent-fragments', '4',
        '--retries', '3',
        ...cookiesArgs
      ];

      const ytdlProcess = spawn(ytdlpPath, args);

      ytdlProcess.stderr.on('data', (data) => {
        console.log('yt-dlp progress:', data.toString());
      });

      ytdlProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempFile)) {
          const stat = fs.statSync(tempFile);
          res.setHeader('Content-Length', stat.size);

          const fileStream = fs.createReadStream(tempFile);
          fileStream.pipe(res);

          fileStream.on('end', () => { fs.unlink(tempFile, () => {}); });
          fileStream.on('error', (err) => {
            console.error('File stream error:', err);
            fs.unlink(tempFile, () => {});
            if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
          });
        } else {
          if (tempFile) fs.unlink(tempFile, () => {});
          if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
        }
      });

      ytdlProcess.on('error', (err) => {
        console.error('Download error:', err);
        if (tempFile) fs.unlink(tempFile, () => {});
        if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
      });

    } else if (format === 'mp4') {
      tempFile = path.join(tmpdir(), timestamp + '_' + title + '.mp4');

      res.setHeader('Content-Disposition', 'attachment; filename="' + title + '.mp4"');
      res.setHeader('Content-Type', 'video/mp4');

      let formatString;
      const requestedQuality = quality ? parseInt(quality.replace('p', '')) : 1080;

      if (requestedQuality >= 1080) {
        formatString = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best';
      } else if (requestedQuality >= 720) {
        formatString = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best';
      } else if (requestedQuality >= 480) {
        formatString = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best';
      } else {
        formatString = 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best[height<=360]/best';
      }

      const args = [
        url,
        '--format', formatString,
        '--merge-output-format', 'mp4',
        '--ffmpeg-location', ffmpegPath,
        '--output', tempFile,
        '--no-check-certificates',
        '--no-warnings',
        '--no-playlist',
        '--concurrent-fragments', '4',
        '--retries', '3',
        '--embed-thumbnail',
        '--add-metadata',
        ...cookiesArgs
      ];

      console.log('Downloading video with quality:', requestedQuality + 'p');

      const ytdlProcess = spawn(ytdlpPath, args);

      ytdlProcess.stderr.on('data', (data) => {
        console.log('yt-dlp progress:', data.toString());
      });

      ytdlProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempFile)) {
          const stat = fs.statSync(tempFile);
          res.setHeader('Content-Length', stat.size);

          const fileStream = fs.createReadStream(tempFile);
          fileStream.pipe(res);

          fileStream.on('end', () => { fs.unlink(tempFile, () => {}); });
          fileStream.on('error', (err) => {
            console.error('File stream error:', err);
            fs.unlink(tempFile, () => {});
            if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
          });
        } else {
          console.error('Download failed or file not created');
          if (tempFile) fs.unlink(tempFile, () => {});
          if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
        }
      });

      ytdlProcess.on('error', (err) => {
        console.error('Download error:', err);
        if (tempFile) fs.unlink(tempFile, () => {});
        if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
      });

    } else {
      res.status(400).json({ error: 'Invalid format. Use mp3 or mp4' });
    }

  } catch (error) {
    console.error('Error downloading video:', error);
    if (tempFile) fs.unlink(tempFile, () => {});
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to download video',
        message: error.message
      });
    }
  }
});

// Start server
async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('Warning: dist folder not found. Run "npm run build" first.');
    }
  }

  app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🎵  NEUROTUBE - YouTube Converter                       ║');
    console.log('║                                                           ║');
    console.log('║   🌐  Server running at: http://localhost:' + PORT + '             ║');
    console.log('║   📦  Mode: ' + (isDev ? 'Development' : 'Production') + '                                 ║');
    console.log('║   🍪  Cookies: ' + (cookiesArgs.length ? 'Loaded ✓' : 'Not found') + '                              ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
  });
}

startServer().catch(console.error);
