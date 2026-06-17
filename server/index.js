import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Set yt-dlp binary path explicitly with quotes to handle spaces
const ytdlpPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');

// Helper to run yt-dlp and get JSON output
const getVideoInfo = async (url) => {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--dump-single-json',
      '--no-check-certificates',
      '--no-warnings'
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
          reject(new Error(`Failed to parse JSON: ${err.message}`));
        }
      } else {
        reject(new Error(`yt-dlp process exited with code ${code}: ${stderr}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
};

// Middleware - Fixed CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Get video info
app.get('/api/info', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Get video info using yt-dlp
    const info = await getVideoInfo(url);

    // Format duration
    const duration = new Date(info.duration * 1000)
      .toISOString()
      .substr(11, 8)
      .replace(/^00:/, '');

    // Get best quality available
    const videoQuality = info.height ? `${info.height}p` : 'HD';
    const audioQuality = info.abr ? `${Math.round(info.abr)}kbps` : '320kbps';

    res.json({
      id: info.id,
      title: info.title,
      thumbnail: info.thumbnail,
      duration: duration,
      quality: videoQuality,
      availableFormats: {
        video: videoQuality,
        audio: audioQuality
      }
    });
  } catch (error) {
    console.error('Error fetching video info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch video information',
      message: error.message 
    });
  }
});

// Download/convert video - Fixed implementation
app.get('/api/download', async (req, res) => {
  let tempFile = null;
  
  try {
    const { url, format } = req.query;

    if (!url || !format) {
      return res.status(400).json({ error: 'URL and format parameters are required' });
    }

    // Get video info for title
    const info = await getVideoInfo(url);
    const title = info.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');

    if (format === 'mp3') {
      // Create temp file for MP3
      tempFile = path.join(tmpdir(), `${Date.now()}_${title}.mp3`);
      
      res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
      res.setHeader('Content-Type', 'audio/mpeg');

      const args = [
        url,
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--ffmpeg-location', ffmpegStatic,
        '--output', tempFile,
        '--no-check-certificates',
        '--no-warnings'
      ];

      const ytdlProcess = spawn(ytdlpPath, args);
      
      ytdlProcess.stderr.on('data', (data) => {
        console.error('yt-dlp stderr:', data.toString());
      });

      ytdlProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempFile)) {
          const fileStream = fs.createReadStream(tempFile);
          fileStream.pipe(res);
          
          fileStream.on('end', () => {
            fs.unlink(tempFile, (err) => {
              if (err) console.error('Error deleting temp file:', err);
            });
          });

          fileStream.on('error', (err) => {
            console.error('File stream error:', err);
            fs.unlink(tempFile, () => {});
            if (!res.headersSent) {
              res.status(500).json({ error: 'Download failed' });
            }
          });
        } else {
          if (tempFile) fs.unlink(tempFile, () => {});
          if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed' });
          }
        }
      });

      ytdlProcess.on('error', (err) => {
        console.error('Download error:', err);
        if (tempFile) fs.unlink(tempFile, () => {});
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      });

    } else if (format === 'mp4') {
      // Download as MP4
      res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
      res.setHeader('Content-Type', 'video/mp4');

      // Create temp file path
      tempFile = path.join(tmpdir(), `${Date.now()}_${title}.mp4`);

      const args = [
        url,
        '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '--ffmpeg-location', ffmpegStatic,
        '--output', tempFile,
        '--no-check-certificates',
        '--no-warnings'
      ];

      const ytdlProcess = spawn(ytdlpPath, args);
      
      ytdlProcess.stderr.on('data', (data) => {
        console.error('yt-dlp stderr:', data.toString());
      });

      ytdlProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempFile)) {
          const fileStream = fs.createReadStream(tempFile);
          fileStream.pipe(res);
          
          fileStream.on('end', () => {
            fs.unlink(tempFile, (err) => {
              if (err) console.error('Error deleting temp file:', err);
            });
          });

          fileStream.on('error', (err) => {
            console.error('File stream error:', err);
            fs.unlink(tempFile, () => {});
            if (!res.headersSent) {
              res.status(500).json({ error: 'Download failed' });
            }
          });
        } else {
          console.error('Download failed or file not created');
          if (tempFile) fs.unlink(tempFile, () => {});
          if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed' });
          }
        }
      });

      ytdlProcess.on('error', (err) => {
        console.error('Download error:', err);
        if (tempFile) fs.unlink(tempFile, () => {});
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      });

    } else {
      res.status(400).json({ error: 'Invalid format. Use mp3 or mp4' });
    }

  } catch (error) {
    console.error('Error downloading video:', error);
    if (tempFile) {
      fs.unlink(tempFile, () => {});
    }
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to download video',
        message: error.message 
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 StreamRip backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});