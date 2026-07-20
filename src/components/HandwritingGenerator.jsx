import React, { useState, useRef, useEffect } from 'react';
import { HERSHEY_FONTS, getHersheyPathData } from '../utils/hershey.js';

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
    const [selectedFont, setSelectedFont] = useState(HERSHEY_FONTS[0].value);
    const [bgColor, setBgColor] = useState(PRESET_COLORS[0].value); 
    const [showPencil, setShowPencil] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [pathPoints, setPathPoints] = useState([]);
    const [totalLength, setTotalLength] = useState(0);

    const loadingPhrases = [
        "Sharpening virtual pencils...",
        "Mixing vibrant digital ink...",
        "Calculating elegant cursive curves...",
        "Drawing every single frame...",
        "Applying final artistic touches..."
    ];
    const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

    useEffect(() => {
        let interval;
        if (isGenerating) {
            setLoadingPhraseIndex(0);
            interval = setInterval(() => {
                setLoadingPhraseIndex(prev => (prev + 1) % loadingPhrases.length);
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

    const getContrastColor = (hex) => {
        if (!hex) return '#ffffff';
        let cleanHex = hex.replace('#', '');
        if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
        if (cleanHex.length !== 6) return '#ffffff';
        const r = parseInt(cleanHex.substring(0, 2), 16);
        const g = parseInt(cleanHex.substring(2, 4), 16);
        const b = parseInt(cleanHex.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    };

    const textColor = getContrastColor(bgColor);

    const svgRef = useRef(null);
    const pathRef = useRef(null);
    const canvasRef = useRef(null);

    // Generate Path Data dynamically on text or font change
    useEffect(() => {
        if (!text) {
            setPathData('');
            setPathPoints([]);
            return;
        }
        
        const { pathData: newPathData, width, height } = getHersheyPathData(text, selectedFont);
        setPathData(newPathData);
        
        // Wait for React to render the <path> so we can calculate its length
        setTimeout(() => {
            if (pathRef.current) {
                try {
                    const len = pathRef.current.getTotalLength();
                    setTotalLength(len);
                    
                    // Pre-calculate points for Canvas animation
                    const pts = [];
                    const step = 5;
                    for (let i = 0; i <= len; i += step) {
                        pts.push(pathRef.current.getPointAtLength(i));
                    }
                    pts.push(pathRef.current.getPointAtLength(len));
                    setPathPoints(pts);
                } catch(e) {
                    console.error("Error calculating path length", e);
                }
            }
        }, 50);

        // Center the path in viewBox
        const padding = 20;
        const minX = -padding;
        const minY = -10 - padding;
        const maxX = width + padding;
        const maxY = height + padding;
        
        const viewBoxStr = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;

        setSvgDimensions({
            width: maxX - minX,
            height: maxY - minY,
            viewBox: viewBoxStr
        });
    }, [text, selectedFont]);

    const handleDownloadLottie = () => {
        if (!text || !pathData) return;

        const padding = 20;
        const { width: textWidth, height: textHeight } = getHersheyPathData(text, selectedFont);
        
        const width = textWidth + padding * 2;
        const height = textHeight + padding * 2;
        const offsetX = padding;
        const offsetY = padding + 10; // Hershey paths go negative Y, shift down

        const lottieShapes = [];
        let currentShape = null;

        // Simple SVG path parser for M and L commands
        const regex = /([ML])\s*([\d.-]+)\s*,\s*([\d.-]+)/g;
        let match;
        while ((match = regex.exec(pathData)) !== null) {
            const cmd = match[1];
            const x = parseFloat(match[2]) + offsetX;
            const y = parseFloat(match[3]) + offsetY;

            if (cmd === 'M') {
                if (currentShape && currentShape.v.length > 0) lottieShapes.push(currentShape);
                currentShape = { c: false, i: [], o: [], v: [] };
                currentShape.v.push([x, y]);
                currentShape.i.push([0, 0]);
                currentShape.o.push([0, 0]);
            } else if (cmd === 'L') {
                if (currentShape) {
                    currentShape.v.push([x, y]);
                    currentShape.i.push([0, 0]);
                    currentShape.o.push([0, 0]);
                }
            }
        }
        if (currentShape && currentShape.v.length > 0) lottieShapes.push(currentShape);

        let cleanHex = bgColor.replace('#', '');
        if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

        let textHex = textColor.replace('#', '');
        if (textHex.length === 3) textHex = textHex.split('').map(c => c + c).join('');
        const tr = parseInt(textHex.substring(0, 2), 16) / 255;
        const tg = parseInt(textHex.substring(2, 4), 16) / 255;
        const tb = parseInt(textHex.substring(4, 6), 16) / 255;

        const baseDuration = Math.max(2500, text.length * 200);
        const durationFrames = Math.floor((baseDuration / speed) / 1000 * 60);

        const lottieJson = {
            "v": "5.7.4",
            "fr": 60,
            "ip": 0,
            "op": durationFrames + 60,
            "w": width,
            "h": height,
            "nm": "Handwriting Export",
            "ddd": 0,
            "assets": [],
            "layers": [
                {
                    "ty": 4,
                    "nm": "Text Stroke",
                    "ind": 1,
                    "st": 0,
                    "ip": 0,
                    "op": durationFrames + 60,
                    "ks": {
                        "o": { "a": 0, "k": 100 },
                        "r": { "a": 0, "k": 0 },
                        "p": { "a": 0, "k": [0, 0, 0] },
                        "a": { "a": 0, "k": [0, 0, 0] },
                        "s": { "a": 0, "k": [100, 100, 100] }
                    },
                    "shapes": [
                        {
                            "ty": "gr",
                            "nm": "Text Paths",
                            "it": [
                                ...lottieShapes.map((shape, index) => ({
                                    "ty": "sh",
                                    "nm": `Path ${index + 1}`,
                                    "ks": { "a": 0, "k": shape }
                                })),
                                {
                                    "ty": "st",
                                    "c": { "a": 0, "k": [tr, tg, tb, 1] },
                                    "w": { "a": 0, "k": 3 },
                                    "lc": 2,
                                    "lj": 2,
                                    "nm": "Stroke"
                                },
                                {
                                    "ty": "tm",
                                    "nm": "Trim Paths",
                                    "m": 2,
                                    "s": { "a": 0, "k": 0 },
                                    "e": {
                                        "a": 1,
                                        "k": [
                                            {
                                                "t": 0,
                                                "s": [0],
                                                "o": { "x": [0.25], "y": [0] },
                                                "i": { "x": [0.25], "y": [1] }
                                            },
                                            {
                                                "t": durationFrames,
                                                "s": [100]
                                            }
                                        ]
                                    },
                                    "o": { "a": 0, "k": 0 }
                                }
                            ]
                        }
                    ]
                },
                {
                    "ty": 1,
                    "sw": width,
                    "sh": height,
                    "sc": bgColor,
                    "nm": "Background",
                    "ind": 2,
                    "st": 0,
                    "ip": 0,
                    "op": durationFrames + 60,
                    "ks": {
                        "o": { "a": 0, "k": 100 },
                        "r": { "a": 0, "k": 0 },
                        "p": { "a": 0, "k": [width/2, height/2, 0] },
                        "a": { "a": 0, "k": [width/2, height/2, 0] },
                        "s": { "a": 0, "k": [100, 100, 100] }
                    }
                }
            ]
        };

        const blob = new Blob([JSON.stringify(lottieJson)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `handwriting-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    };

    const generateVideo = () => {
        if (!pathRef.current || isGenerating || !text || pathPoints.length === 0) return;
        setIsGenerating(true);
        setVideoUrl(null);
        
        setTimeout(() => {
            executeVideoGeneration();
        }, 50);
    };

    const executeVideoGeneration = async () => {
        if (!pathRef.current || pathPoints.length === 0) return;

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

        let start = null;
        const baseDuration = Math.max(2500, text.length * 200);
        const duration = baseDuration / speed;
        const viewBoxParts = svgDimensions.viewBox.split(' ').map(Number);
        const minX = viewBoxParts[0];
        const minY = viewBoxParts[1];
        const step = 5;
        
        const drawFrame = (timestamp) => {
            if (!start) start = timestamp;
            const elapsed = timestamp - start;
            const rawProgress = elapsed / duration;
            const progress = Math.min(rawProgress, 1.0);
            
            // 1. Draw Background
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 2. Stroke the path sequentially
            const currentLength = totalLength * progress;
            const strokePath = new Path2D();
            const maxI = Math.floor(currentLength / step);
            
            // Prevent out-of-bounds
            const safeMaxI = Math.min(maxI, pathPoints.length - 1);
            
            for (let i = 0; i <= safeMaxI; i++) {
                const pt = pathPoints[i];
                if (!pt) continue;
                // Since our custom parser creates disconnected shapes using M and L,
                // we should strictly follow the SVG commands instead of blindly linking points.
                // However, `getPointAtLength` linearly interpolates across M commands (creating jumps).
                // Actually, Hershey paths have many jumps. 
                // Wait! If getPointAtLength traverses M jumps, it draws straight lines between letters!
            }
            
            // Better approach for Hershey paths with jumps:
            // Parse the SVG `d` directly into sub-paths, and only draw up to `currentLength`.
            // But we already have `pathRef.current` and `pathPoints`. Does `getPointAtLength` include M jumps?
            // Yes, it does. This means we shouldn't use `pathPoints` naively for drawing if we want to avoid jump lines.
            // Let's use `pathRef.current` combined with SVG `<path>` stroke-dasharray animation in Canvas? No, Canvas doesn't support that directly easily.
            // Wait, we CAN use `ctx.setLineDash([currentLength, totalLength])` on the FULL path!
            
            const fullPath = new Path2D(pathData);
            
            ctx.save();
            ctx.translate(-minX, -minY);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 4; // Pen thickness
            ctx.strokeStyle = textColor;
            
            // Use setLineDash to draw progressively without manually calculating jumps!
            ctx.setLineDash([currentLength, totalLength]);
            ctx.stroke(fullPath);
            ctx.restore();
            
            // 3. Draw Pencil on top
            if (showPencil && progress < 1.0) {
                try {
                    const currentPt = pathRef.current.getPointAtLength(currentLength);
                    ctx.save();
                    ctx.translate(-minX, -minY);
                    ctx.font = '32px Arial';
                    ctx.fillText('✏️', currentPt.x - 5, currentPt.y + 5);
                    ctx.restore();
                } catch(e) {}
            }
            
            // Add a hold time at the end to ensure final frames are captured
            const holdDuration = 2000;
            
            if (elapsed >= duration) {
                // Force a tiny invisible pixel change to ensure captureStream emits frames
                ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.01})`;
                ctx.fillRect(0, 0, 1, 1);
            }
            
            if (elapsed < duration + holdDuration) {
                requestAnimationFrame(drawFrame);
            } else {
                recorder.stop();
            }
        };
        
        requestAnimationFrame(drawFrame);
    };

    return (
        <div className="p-0 sm:p-4 md:p-8 max-w-7xl mx-auto w-full relative z-10">
            {/* Full Screen Loading Overlay for Video Generation */}
            <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-xl transition-all duration-500 ${isGenerating ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div className="relative w-32 h-32 mb-8 drop-shadow-2xl">
                    <div className="absolute inset-0 rounded-full border-t-4 border-indigo-500 animate-spin"></div>
                    <div className="absolute inset-2 rounded-full border-r-4 border-purple-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                    <div className="absolute inset-4 rounded-full border-b-4 border-pink-500 animate-[spin_2s_linear_infinite]"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-4xl animate-bounce">✏️</div>
                </div>
                <h3 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 mb-3 tracking-wide animate-pulse">Crafting Your Video...</h3>
                <p className="text-gray-600 dark:text-gray-300 font-light text-lg sm:text-xl h-8 overflow-hidden">
                    <span className="block animate-[fade-in-up_0.5s_ease-out]">{loadingPhrases[loadingPhraseIndex]}</span>
                </p>
            </div>

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
                        <div>
                            <h2 className="text-3xl sm:text-5xl font-extrabold mb-2 text-gray-900 dark:text-white tracking-tight drop-shadow-sm transition-colors duration-500">Handwriting Generator</h2>
                            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 font-light transition-colors duration-500">True single-stroke human handwriting simulation.</p>
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
                                <label className="text-xs tracking-wider uppercase font-semibold text-gray-500 dark:text-gray-400 transition-colors group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400">Stroke Font Style</label>
                                <div className="relative">
                                    <select 
                                        value={selectedFont} 
                                        onChange={e => setSelectedFont(e.target.value)}
                                        className="w-full px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-black/20 focus:bg-white dark:focus:bg-black/40 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none appearance-none text-gray-900 dark:text-white font-medium text-lg shadow-inner cursor-pointer"
                                    >
                                        {HERSHEY_FONTS.map(f => (
                                            <option key={f.value} value={f.value} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">{f.name}</option>
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
                                    disabled={isGenerating || !text}
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

                                <button
                                    onClick={handleDownloadLottie}
                                    className="w-full sm:w-auto bg-white/60 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 backdrop-blur-md text-gray-900 dark:text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 border border-gray-200 dark:border-white/20"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path></svg>
                                    Export Lottie JSON
                                </button>
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

                                {text && (
                                    <div className="w-full flex flex-col items-center relative z-10 transition-transform duration-500 group-hover:scale-105">
                                        <svg key={text} ref={svgRef} width={svgDimensions.width} height={svgDimensions.height} viewBox={svgDimensions.viewBox} className="max-w-full h-auto drop-shadow-2xl" style={{ overflow: 'visible' }}>
                                            {/* Preview animation uses stroke-dasharray and CSS animation for smooth writing effect */}
                                            <style>
                                                {`
                                                    @keyframes drawLine {
                                                        from { stroke-dashoffset: ${totalLength}; }
                                                        to { stroke-dashoffset: 0; }
                                                    }
                                                `}
                                            </style>
                                            <path 
                                                ref={pathRef}
                                                d={pathData} 
                                                fill="none"
                                                stroke={textColor} 
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                style={{
                                                    strokeDasharray: totalLength,
                                                    strokeDashoffset: totalLength,
                                                    animation: `drawLine ${Math.max(2.5, text.length * 0.2) / speed}s ease-in-out forwards`
                                                }}
                                            />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {videoUrl && (
                                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-6 rounded-3xl shadow-2xl relative overflow-hidden transition-colors duration-500">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-pink-500/10 pointer-events-none"></div>
                                    <h3 className="text-xs font-bold mb-4 text-gray-500 dark:text-white/50 uppercase tracking-widest relative z-10">Final Render ({videoUrl.ext.toUpperCase()})</h3>
                                    <div className="bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/5 p-2 rounded-2xl shadow-inner relative z-10">
                                        <video 
                                            src={videoUrl.url} 
                                            controls 
                                            className="w-full rounded-xl"
                                            autoPlay
                                            loop
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden canvas for video generation */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
