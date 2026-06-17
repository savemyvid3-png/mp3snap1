import React, { useState } from 'react';
import { Download, Music, Video, Link, ArrowRight, CheckCircle, Loader2, AlertCircle, Play, Zap, Settings } from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp3'); // 'mp3' or 'mp4'
  const [quality, setQuality] = useState('1080p'); // Default quality for mp4
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [videoData, setVideoData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Validate YouTube URL (including Shorts)
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

  const handleConvert = async () => {
    setErrorMsg('');
    setVideoData(null);

    if (!url.trim()) {
      setErrorMsg('Please enter a YouTube URL');
      setStatus('error');
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      setErrorMsg('Please enter a valid YouTube URL (videos or Shorts)');
      setStatus('error');
      return;
    }

    setStatus('processing');
    
    try {
      const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to fetch video info');
      }
      
      setVideoData({
        id: data.id,
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        isShort: data.isShort,
        channel: data.channel,
        availableQualities: data.availableQualities || ['1080p', '720p', '480p', '360p'],
        bestQuality: data.bestQuality || '1080p'
      });
      
      // Set quality to best available if current selection is not available
      if (data.availableQualities && !data.availableQualities.includes(quality)) {
        setQuality(data.availableQualities[0] || '1080p');
      }
      
      setStatus('success');

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to fetch video info. Please check the URL.');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setUrl('');
    setVideoData(null);
    setErrorMsg('');
  };

  const getDownloadUrl = () => {
    const baseUrl = `/api/download?url=${encodeURIComponent(url)}&format=${format}`;
    return format === 'mp4' ? `${baseUrl}&quality=${quality}` : baseUrl;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-rose-500 selection:text-white">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-rose-600/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[100px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 flex flex-col min-h-screen">
        
        {/* Navbar */}
        <nav className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-rose-500 to-orange-500 p-2 rounded-lg">
              <Download className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Neuro<span className="text-rose-500">tube</span>
            </span>
          </div>
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#" className="hover:text-white transition-colors">FAQ</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-grow flex flex-col items-center justify-center max-w-3xl mx-auto w-full">
          
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">
              Convert Video to <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-orange-500">
                Audio & MP4
              </span>
            </h1>
            <p className="text-slate-400 text-lg max-w-lg mx-auto">
              Download YouTube videos & Shorts in HD 1080p MP4 or high-quality 320kbps MP3 instantly.
            </p>
          </div>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 border border-slate-700">
              <Zap className="w-3 h-3 text-yellow-500" /> Fast Downloads
            </div>
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 border border-slate-700">
              <Video className="w-3 h-3 text-blue-500" /> 1080p HD
            </div>
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 border border-slate-700">
              <Music className="w-3 h-3 text-rose-500" /> 320kbps Audio
            </div>
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 border border-slate-700">
              <Play className="w-3 h-3 text-green-500" /> Shorts Support
            </div>
          </div>

          {/* Converter Card */}
          <div className="w-full bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl">
            
            {/* Format Toggle */}
            <div className="flex p-1 bg-slate-900/50 rounded-xl mb-2">
              <button 
                onClick={() => setFormat('mp3')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${format === 'mp3' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                <Music className="w-4 h-4" /> MP3 Audio
              </button>
              <button 
                onClick={() => setFormat('mp4')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${format === 'mp4' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                <Video className="w-4 h-4" /> MP4 Video
              </button>
            </div>

            {/* Quality Selector for MP4 */}
            {format === 'mp4' && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2">
                <Settings className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">Quality:</span>
                <div className="flex gap-2">
                  {['1080p', '720p', '480p', '360p'].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        quality === q 
                          ? 'bg-rose-500 text-white' 
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Link className="w-5 h-5 text-slate-500 group-focus-within:text-rose-500 transition-colors" />
              </div>
              <input 
                type="text" 
                placeholder="Paste YouTube URL here (videos or Shorts)..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
                className="w-full bg-slate-900 border border-slate-700 text-white pl-12 pr-32 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all placeholder:text-slate-600"
              />
              <button 
                onClick={handleConvert}
                disabled={status === 'processing'}
                className="absolute right-2 top-2 bottom-2 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white px-6 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-500/20"
              >
                {status === 'processing' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {/* Error Message */}
            {errorMsg && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}
          </div>

          {/* Result Card */}
          {videoData && status === 'success' && (
            <div className="w-full mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-800 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                
                {/* Video Info Header */}
                <div className="p-6 flex gap-4 md:gap-6">
                  <div className="relative shrink-0 w-32 md:w-48 aspect-video rounded-lg overflow-hidden bg-slate-900 shadow-lg group">
                    <img 
                      src={videoData.thumbnail} 
                      alt="Thumbnail" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-8 h-8 text-white fill-current" />
                    </div>
                    {videoData.isShort && (
                      <div className="absolute top-1 left-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        SHORT
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="text-lg md:text-xl font-bold text-white truncate leading-tight mb-2">
                      {videoData.title}
                    </h3>
                    {videoData.channel && (
                      <p className="text-sm text-slate-400 mb-2 truncate">{videoData.channel}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <span className="bg-slate-700/50 px-2 py-0.5 rounded text-xs border border-white/5">
                        {videoData.duration}
                      </span>
                      <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded text-xs border border-rose-500/20 uppercase">
                        {format === 'mp4' ? quality : '320kbps'}
                      </span>
                      <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs border border-blue-500/20 uppercase">
                        {format.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Download Section */}
                <div className="bg-slate-900/50 p-6 border-t border-white/5">
                  <div className="flex flex-col md:flex-row gap-3 items-center justify-between animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                      <CheckCircle className="w-5 h-5" />
                      Ready to download!
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                      <button 
                        onClick={handleReset}
                        className="flex-1 md:flex-none px-6 py-2.5 rounded-lg border border-slate-600 hover:bg-slate-800 text-slate-300 font-medium transition-all"
                      >
                        Convert Another
                      </button>
                      <a 
                        href={getDownloadUrl()}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Download {format.toUpperCase()}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* Features Section */}
        <section id="features" className="mt-16 mb-8">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <Video className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">HD 1080p Video</h3>
              <p className="text-sm text-slate-400">Download videos in full HD quality. Select from 1080p, 720p, 480p, or 360p.</p>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              <div className="w-10 h-10 bg-rose-500/20 rounded-lg flex items-center justify-center mb-4">
                <Music className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">320kbps Audio</h3>
              <p className="text-sm text-slate-400">Convert to high-quality MP3 audio at 320kbps bitrate for the best sound.</p>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                <Play className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">YouTube Shorts</h3>
              <p className="text-sm text-slate-400">Full support for YouTube Shorts. Just paste the Shorts URL and download.</p>
            </div>
          </div>
        </section>

        <footer className="mt-auto py-6 text-center text-slate-500 text-sm">
          <p>© 2024 Neurotube. Designed for educational purposes.</p>
        </footer>

      </div>
    </div>
  );
}
