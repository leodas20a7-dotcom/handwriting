import React, { useState, useRef, useEffect } from 'react';
import opentype from 'opentype.js';
import Lottie from 'lottie-react';
import pacificoUrl from '../assets/Pacifico-Regular.ttf';
import dancingScriptUrl from '@fontsource/dancing-script/files/dancing-script-latin-400-normal.woff?url';
import caveatUrl from '@fontsource/caveat/files/caveat-latin-400-normal.woff?url';
import satisfyUrl from '@fontsource/satisfy/files/satisfy-latin-400-normal.woff?url';
import sacramentoUrl from '@fontsource/sacramento/files/sacramento-latin-400-normal.woff?url';

const AVAILABLE_FONTS = [
    { name: 'Pacifico', url: pacificoUrl },
    { name: 'Dancing Script', url: dancingScriptUrl },
    { name: 'Caveat', url: caveatUrl },
    { name: 'Satisfy', url: satisfyUrl },
    { name: 'Sacramento', url: sacramentoUrl },
];

const PRESET_COLORS = [
    { name: 'Obsidian', value: '#1a1a24' },
    { name: 'Deep Space', value: '#0f1115' },
    { name: 'Chroma Green', value: '#00ff00' },
    { name: 'Cyberpunk Pink', value: '#ff007f' },
    { name: 'Pure White', value: '#ffffff' },
];

export default function HandwritingGenerator({ isDark, setIsDark }) {
    const [text, setText] = useState('Hand Writing');
    const [pathData, setPathData] = useState('');
    const [svgDimensions, setSvgDimensions] = useState({ width: 500, height: 200, viewBox: '0 0 500 200' });
    const [isGenerating, setIsGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState(null);
    const [font, setFont] = useState(null);
    const [selectedFontUrl, setSelectedFontUrl] = useState(AVAILABLE_FONTS[0].url);
    const [fontError, setFontError] = useState(null);
    const [fontLoadingProgress, setFontLoadingProgress] = useState(null);
    const [bgColor, setBgColor] = useState(PRESET_COLORS[0].value); 
    const [showPencil, setShowPencil] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [retryCount, setRetryCount] = useState(0);
    const [lottieAnimation, setLottieAnimation] = useState(null);

    useEffect(() => {
        fetch('https://lottie.host/1046ae5b-2e59-47ce-bb6a-d5f7aaa2dddd/4m7zJ5OgRA.json')
            .then(res => res.json())
            .then(data => setLottieAnimation(data))
            .catch(err => console.error("Error loading Lottie", err));
    }, []);

    const getContrastColor = (hex) => {
        if (!hex) return '#ffffff';
        let cleanHex = hex.replace('#', '');
        if (cleanHex.length === 3) {
            cleanHex = cleanHex.split('').map(c => c + c).join('');
        }
        if (cleanHex.length !== 6) return '#ffffff';
        const r = parseInt(cleanHex.substring(0, 2), 16);
        const g = parseInt(cleanHex.substring(2, 4), 16);
        const b = parseInt(cleanHex.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    };

    const textColor = getContrastColor(bgColor);

    const loadPreview = () => setRetryCount(c => c + 1);

    const svgRef = useRef(null);
    const pathRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        const loadFont = async () => {
            try {
                setFontLoadingProgress(0);
                setFontError(null);
                
                const response = await fetch(selectedFontUrl);
                if (!response.ok) throw new Error('Failed to fetch font file');

                const contentLength = response.headers.get('content-length');
                const total = parseInt(contentLength, 10);

                const reader = response.body.getReader();
                let receivedLength = 0;
                const chunks = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    chunks.push(value);
                    receivedLength += value.length;

                    if (total) {
                        const percentage = Math.round((receivedLength / total) * 100);
                        setFontLoadingProgress(percentage);
                    } else {
                        setFontLoadingProgress(prev => prev === null ? 10 : Math.min(prev + 10, 99));
                    }
                }

                const chunksAll = new Uint8Array(receivedLength);
                let position = 0;
                for (let chunk of chunks) {
                    chunksAll.set(chunk, position);
                    position += chunk.length;
                }

                const buffer = chunksAll.buffer;
                const loadedFont = opentype.parse(buffer);
                setFont(loadedFont);
                setFontLoadingProgress(100);
                setTimeout(() => setFontLoadingProgress(null), 1000);

            } catch (err) {
                console.error('Could not load font:', err);
                setFontError(err.toString());
                setFontLoadingProgress(null);
            }
        };
        
        loadFont();
    }, [selectedFontUrl, retryCount]);

    useEffect(() => {
        if (!font || !text) return;
        const fontSize = 120;
        const p = font.getPath(text, 0, 0, fontSize);
        
        let rawPathData = p.toPathData(2);
        let sanitizedPathData = rawPathData.replace(/[a-zA-Z][^a-zA-Z]*NaN[^a-zA-Z]*/g, '');
        setPathData(sanitizedPathData);

        const bbox = p.getBoundingBox();
        const padding = 100;
        const viewBoxStr = `${bbox.x1 - padding} ${bbox.y1 - padding} ${bbox.x2 - bbox.x1 + padding * 2} ${bbox.y2 - bbox.y1 + padding * 2}`;

        setSvgDimensions({
            width: bbox.x2 - bbox.x1 + padding * 2,
            height: bbox.y2 - bbox.y1 + padding * 2,
            viewBox: viewBoxStr
        });
    }, [text, font]);

    const generateVideo = () => {
        if (!pathRef.current || isGenerating) return;
        setIsGenerating(true);
        setVideoUrl(null);
        
        // Defer heavy execution by 50ms to allow React to paint the "Recording Canvas..." spinner immediately
        setTimeout(() => {
            executeVideoGeneration();
        }, 50);
    };

    const executeVideoGeneration = async () => {
        if (!pathRef.current) return;

        const totalLength = pathRef.current.getTotalLength();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        canvas.width = Math.ceil(svgDimensions.width / 2) * 2;
        canvas.height = Math.ceil(svgDimensions.height / 2) * 2;

        const stream = canvas.captureStream(30);

        let options = { mimeType: 'video/webm; codecs=vp9' };
        let ext = 'webm';

        if (MediaRecorder.isTypeSupported('video/mp4')) {
            options = { mimeType: 'video/mp4' };
            ext = 'mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm; codecs=h264')) {
            options = { mimeType: 'video/webm; codecs=h264' };
        } else if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm' };
        }

        const recorder = new MediaRecorder(stream, options);
        const chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: options.mimeType });
            setVideoUrl({ url: URL.createObjectURL(blob), ext });
            setIsGenerating(false);
        };

        recorder.start();

        // Pre-calculate path points for performance to avoid calling getPointAtLength thousands of times per frame
        const pathPoints = [];
        const step = 5;
        for (let i = 0; i <= totalLength; i += step) {
            pathPoints.push(pathRef.current.getPointAtLength(i));
        }
        pathPoints.push(pathRef.current.getPointAtLength(totalLength));

        const svgString = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="${svgDimensions.viewBox}">
                <path d="${pathData}" fill="${textColor}" stroke="${textColor}" stroke-width="1" />
            </svg>
        `;
        
        const img = new Image();
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            
            let start = null;
            const baseDuration = Math.max(2500, text.length * 200);
            const duration = baseDuration / speed;
            const viewBoxParts = svgDimensions.viewBox.split(' ').map(Number);
            const minX = viewBoxParts[0];
            const minY = viewBoxParts[1];
            
            const drawFrame = (timestamp) => {
                if (!start) start = timestamp;
                const elapsed = timestamp - start;
                const rawProgress = elapsed / duration;
                const progress = Math.min(rawProgress, 1.0);
                
                // 1. Clear canvas (must be transparent for source-in mask to work)
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // 2. Draw the growing "worm" mask tracing the path
                const currentLength = totalLength * progress;
                const maskPath = new Path2D();
                const maxI = Math.floor(currentLength / step);
                for (let i = 0; i <= maxI; i++) {
                    const pt = pathPoints[i];
                    if (i === 0) maskPath.moveTo(pt.x, pt.y);
                    else maskPath.lineTo(pt.x, pt.y);
                }
                const currentPt = pathRef.current.getPointAtLength(currentLength);
                maskPath.lineTo(currentPt.x, currentPt.y);
                
                ctx.save();
                ctx.translate(-minX, -minY);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                // Reduced lineWidth to 40 to create a crisper, tighter mask around the true line shape
                ctx.lineWidth = 40; 
                ctx.strokeStyle = '#000'; // Color doesn't matter for mask shape
                ctx.stroke(maskPath);
                ctx.restore();
                
                // 3. Composite the solid text into the mask
                ctx.globalCompositeOperation = 'source-in';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // 4. Draw Background behind everything
                ctx.globalCompositeOperation = 'destination-over';
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // 5. Draw Pencil on top
                ctx.globalCompositeOperation = 'source-over';
                if (showPencil && progress < 1.0) {
                    ctx.save();
                    ctx.translate(-minX, -minY);
                    ctx.font = '64px Arial';
                    ctx.fillText('✏️', currentPt.x - 10, currentPt.y + 10);
                    ctx.restore();
                }
                
                // Add a hold time at the end to ensure final frames are captured by the MediaRecorder
                const holdDuration = 1000;
                
                if (elapsed < duration + holdDuration) {
                    requestAnimationFrame(drawFrame);
                } else {
                    recorder.stop();
                }
            };
            
            requestAnimationFrame(drawFrame);
        };
        img.src = url;
    };

    return (
        <div className="p-0 sm:p-4 md:p-8 max-w-7xl mx-auto w-full relative z-10">
            {/* Theme Toggle Button */}
            <button 
                onClick={() => setIsDark(!isDark)}
                className="absolute top-4 right-4 sm:top-8 sm:right-8 z-50 p-3 rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-md border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white hover:scale-110 hover:shadow-lg transition-all shadow-md"
                title="Toggle Theme"
            >
                {isDark ? '☀️' : '🌙'}
            </button>

            {/* Glassmorphic Container */}
            <div className="bg-white/60 dark:bg-white/[0.03] backdrop-blur-3xl sm:rounded-3xl shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border-y sm:border border-white/60 dark:border-white/[0.08] p-6 sm:p-10 overflow-hidden relative min-h-screen sm:min-h-0 flex flex-col justify-center transition-colors duration-500">

                <div className="relative z-10 flex-grow flex flex-col justify-center py-4 sm:py-0">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8 sm:mb-12">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 drop-shadow-lg">
                            {lottieAnimation && (
                                <Lottie 
                                    animationData={lottieAnimation} 
                                    loop={true} 
                                    autoplay={true} 
                                />
                            )}
                        </div>
                        <div>
                            <h2 className="text-3xl sm:text-5xl font-extrabold mb-2 text-gray-900 dark:text-white tracking-tight drop-shadow-sm transition-colors duration-500">Handwriting Generator</h2>
                            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 font-light transition-colors duration-500">Type text to generate a beautifully animated handwriting video.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
                        {/* Left Column - Controls */}
                        <div className="flex flex-col">
                            {/* Input Field */}
                            <div className="flex flex-col gap-3 relative mb-8 group">
                                <label className="text-xs tracking-wider uppercase font-semibold text-gray-500 dark:text-gray-400 transition-colors group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400">Your Text</label>
                                <input 
                                    type="text" 
                                    value={text} 
                                    onChange={e => setText(e.target.value)} 
                                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-black/20 focus:bg-white dark:focus:bg-black/40 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none text-gray-900 dark:text-white font-medium placeholder-gray-400 dark:placeholder-gray-600 text-lg shadow-inner"
                                    placeholder="Type something amazing..."
                                />
                            </div>

                            {/* Font Selection */}
                            <div className="flex flex-col gap-3 mb-8 group">
                                <label className="text-xs tracking-wider uppercase font-semibold text-gray-500 dark:text-gray-400 transition-colors group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400">Font Style</label>
                                <div className="relative">
                                    <select 
                                        value={selectedFontUrl} 
                                        onChange={e => setSelectedFontUrl(e.target.value)}
                                        className="w-full px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-black/20 focus:bg-white dark:focus:bg-black/40 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none appearance-none text-gray-900 dark:text-white font-medium text-lg shadow-inner cursor-pointer"
                                    >
                                        {AVAILABLE_FONTS.map(f => (
                                            <option key={f.name} value={f.url} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">{f.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-5 pointer-events-none text-gray-400">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Animation Speed Selection */}
                            <div className="flex flex-col gap-3 mb-8 group">
                                <label className="text-xs tracking-wider uppercase font-semibold text-gray-500 dark:text-gray-400 transition-colors group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400">Animation Speed</label>
                                <div className="relative">
                                    <select 
                                        value={speed} 
                                        onChange={e => setSpeed(Number(e.target.value))}
                                        className="w-full px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-black/20 focus:bg-white dark:focus:bg-black/40 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none appearance-none text-gray-900 dark:text-white font-medium text-lg shadow-inner cursor-pointer"
                                    >
                                        <option value="0.1" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">0.1x (Ultra Slow)</option>
                                        <option value="0.25" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">0.25x (Super Slow)</option>
                                        <option value="0.5" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">0.5x (Very Slow)</option>
                                        <option value="1" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">1x (Normal)</option>
                                        <option value="1.5" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">1.5x (Fast)</option>
                                        <option value="2" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">2x (Very Fast)</option>
                                        <option value="3" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">3x (Ultra Fast)</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-5 pointer-events-none text-gray-400">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Background Color Picker */}
                            <div className="flex flex-col gap-3 mb-8">
                                <label className="text-xs tracking-wider uppercase font-semibold text-gray-500 dark:text-gray-400">Background Color</label>
                                <div className="flex items-center gap-3 flex-wrap">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color.name}
                                            onClick={() => setBgColor(color.value)}
                                            title={color.name}
                                            className={`w-12 h-12 rounded-full cursor-pointer transition-all duration-300 border-2 ${bgColor === color.value ? 'scale-110 border-gray-800 dark:border-white shadow-[0_0_15px_rgba(0,0,0,0.2)] dark:shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-transparent hover:scale-105 hover:shadow-lg'}`}
                                            style={{ backgroundColor: color.value }}
                                        />
                                    ))}
                                    <div className="relative group">
                                        <input 
                                            type="color" 
                                            value={bgColor} 
                                            onChange={e => setBgColor(e.target.value)} 
                                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                                            title="Custom Color"
                                        />
                                        <div className="w-12 h-12 rounded-full cursor-pointer border border-gray-200 dark:border-white/20 bg-white/50 dark:bg-black/30 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-black/50 transition-colors shadow-sm">
                                            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Animated Toggle Switch */}
                            <div className="flex items-center justify-between mt-2 bg-white/50 dark:bg-black/20 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-inner transition-colors duration-500">
                                <label htmlFor="showPencil" className="text-base font-medium text-gray-800 dark:text-gray-200 select-none cursor-pointer flex items-center gap-3 transition-colors duration-500">
                                    <span className="p-2 bg-gray-100 dark:bg-white/10 rounded-xl text-xl">✏️</span>
                                    Show Pencil Animation
                                </label>
                                <button
                                    id="showPencil"
                                    onClick={() => setShowPencil(!showPencil)}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${showPencil ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${showPencil ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            
                            <hr className="border-gray-200 dark:border-white/10 mt-10 mb-10 transition-colors duration-500" />
                            
                            <div className="flex flex-col sm:flex-row flex-wrap gap-5 items-start w-full">
                                <button
                                    onClick={generateVideo}
                                    disabled={isGenerating || !font || !text}
                                    className="w-full sm:w-auto relative group overflow-hidden bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white px-10 py-4 rounded-2xl disabled:opacity-50 font-bold text-lg transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] dark:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] dark:hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] active:scale-95 flex items-center justify-center gap-3 border border-white/20"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                                    {isGenerating ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Recording Canvas...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            Generate Video
                                        </>
                                    )}
                                </button>

                                {videoUrl && (
                                    <a
                                        href={videoUrl.url}
                                        download={`handwriting.${videoUrl.ext}`}
                                        className="w-full sm:w-auto bg-white/60 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 backdrop-blur-md text-gray-900 dark:text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 border border-gray-200 dark:border-white/20"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download .{videoUrl.ext}
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Live Preview */}
                        <div className="flex flex-col gap-6 w-full">
                            <div 
                                className="relative rounded-3xl flex flex-col items-center justify-center p-4 sm:p-8 min-h-[250px] sm:min-h-[350px] overflow-hidden transition-all duration-500 w-full border border-gray-200 dark:border-white/10 group" 
                                style={{ 
                                    backgroundColor: bgColor,
                                    boxShadow: `0 0 60px -15px ${bgColor}` // Dynamic glow matching background
                                }}
                            >
                                {/* Inner glass reflection */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 dark:via-white/5 to-white/40 dark:to-white/20 pointer-events-none rounded-3xl"></div>
                                
                                <div className="absolute top-5 left-5 text-[10px] font-bold text-gray-800/50 dark:text-white/50 uppercase tracking-[0.2em] mix-blend-normal dark:mix-blend-screen backdrop-blur-md bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10">Live Preview</div>

                                {!font && fontLoadingProgress === null && !fontError && (
                                    <button
                                        onClick={loadPreview}
                                        className="bg-white/60 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-gray-900 dark:text-white backdrop-blur-md px-8 py-4 rounded-xl font-medium transition-all shadow-xl relative z-10 border border-gray-200 dark:border-white/20"
                                    >
                                        Load Preview
                                    </button>
                                )}

                                {fontLoadingProgress !== null && (
                                    <div className="flex flex-col items-center justify-center w-full max-w-xs relative z-10 bg-white/60 dark:bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl">
                                        <div className="text-sm font-semibold text-gray-800 dark:text-white/80 mb-3">Loading Font... {fontLoadingProgress}%</div>
                                        <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2 shadow-inner">
                                            <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)] dark:shadow-[0_0_10px_rgba(99,102,241,0.8)]" style={{ width: `${fontLoadingProgress}%` }}></div>
                                        </div>
                                    </div>
                                )}

                                {font && fontLoadingProgress === null && (
                                    <div className="w-full flex flex-col items-center relative z-10 transition-transform duration-500 group-hover:scale-105">
                                        <svg key={text} ref={svgRef} width={svgDimensions.width} height={svgDimensions.height} viewBox={svgDimensions.viewBox} className="max-w-full h-auto drop-shadow-2xl" style={{ overflow: 'visible' }}>
                                            <path 
                                                ref={pathRef}
                                                d={pathData} 
                                                fill={textColor} 
                                                stroke={textColor} 
                                                strokeWidth="1" 
                                            />
                                        </svg>
                                    </div>
                                )}

                                {fontError && (
                                    <div className="flex flex-col items-center justify-center bg-red-50 dark:bg-red-500/20 backdrop-blur-md border border-red-200 dark:border-red-500/30 p-8 rounded-2xl text-center relative z-10 shadow-xl">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span className="font-bold text-gray-900 dark:text-white text-lg">Failed to load font</span>
                                        <span className="text-sm mt-2 text-red-600 dark:text-red-200">{fontError}</span>
                                        <button
                                            onClick={loadPreview}
                                            className="mt-6 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                )}
                            </div>

                            {videoUrl && (
                                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-6 rounded-3xl shadow-2xl relative overflow-hidden transition-colors duration-500">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-pink-500/10 pointer-events-none"></div>
                                    <h3 className="text-xs font-bold mb-4 text-gray-500 dark:text-white/50 uppercase tracking-widest relative z-10">Final Render ({videoUrl.ext.toUpperCase()})</h3>
                                    <div className="bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/5 p-2 rounded-2xl shadow-inner flex items-center justify-center relative z-10 transition-colors duration-500">
                                        <video src={videoUrl.url} autoPlay loop muted className="w-full rounded-xl drop-shadow-2xl" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
            </div>
        </div>
    );
}
