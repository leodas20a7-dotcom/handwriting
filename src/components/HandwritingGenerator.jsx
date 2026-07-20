import React, { useState, useRef, useEffect } from 'react';
import opentype from 'opentype.js';
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

export default function HandwritingGenerator() {
    const [text, setText] = useState('Hand Writing');
    const [pathData, setPathData] = useState('');
    const [svgDimensions, setSvgDimensions] = useState({ width: 500, height: 200, viewBox: '0 0 500 200' });
    const [isGenerating, setIsGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState(null);
    const [font, setFont] = useState(null);
    const [selectedFontUrl, setSelectedFontUrl] = useState(AVAILABLE_FONTS[0].url);
    const [fontError, setFontError] = useState(null);
    const [fontLoadingProgress, setFontLoadingProgress] = useState(null);
    const [bgColor, setBgColor] = useState('#00ff00'); // Green screen by default
    const [showPencil, setShowPencil] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

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

    const generateVideo = async () => {
        if (!pathRef.current) return;
        setIsGenerating(true);
        setVideoUrl(null);

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

        let start = null;
        const duration = Math.max(2500, text.length * 200);
        
        const svgString = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="${svgDimensions.viewBox}">
                <path d="${pathData}" fill="white" stroke="white" stroke-width="1" />
            </svg>
        `;
        
        const img = new Image();
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            
            const drawFrame = (timestamp) => {
                if (!start) start = timestamp;
                const rawProgress = (timestamp - start) / duration;
                const progress = Math.min(rawProgress, 1);
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, canvas.width * progress, canvas.height);
                ctx.clip();
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                ctx.restore();
                
                if (showPencil && rawProgress < 1.0) {
                    const pencilX = canvas.width * progress;
                    const wiggle = Math.sin(progress * Math.PI * text.length * 4) * 15;
                    const pencilY = (canvas.height / 2) + wiggle + 20;
                    
                    ctx.save();
                    ctx.font = '64px Arial';
                    ctx.fillText('✏️', pencilX, pencilY);
                    ctx.restore();
                }
                
                if (rawProgress < 1.1) {
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
        <div className="p-0 sm:p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="bg-white sm:rounded-2xl shadow-none sm:shadow-lg border-y sm:border border-gray-100 p-6 sm:p-8 overflow-hidden relative min-h-screen sm:min-h-0 flex flex-col justify-center">

                <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

                <div className="relative z-10 flex-grow flex flex-col justify-center py-4 sm:py-0">
                    <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-gray-800 tracking-tight">Handwriting Generator</h2>
                    <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8">Type text to generate a video of it being written.</p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">
                        <div className="flex flex-col">
                            <div className="flex flex-col gap-2 relative mb-6">
                                <label className="text-sm font-semibold text-gray-700">Your Text</label>
                                <input 
                                    type="text" 
                                    value={text} 
                                    onChange={e => setText(e.target.value)} 
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none bg-white text-gray-700 font-medium placeholder-gray-400"
                                    placeholder="Type something amazing..."
                                />
                            </div>

                            <div className="flex flex-col gap-2 mb-6">
                                <label className="text-sm font-semibold text-gray-700">Font Style</label>
                                <div className="relative">
                                    <select 
                                        value={selectedFontUrl} 
                                        onChange={e => setSelectedFontUrl(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none appearance-none bg-white text-gray-700 font-medium"
                                    >
                                        {AVAILABLE_FONTS.map(f => (
                                            <option key={f.name} value={f.url}>{f.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-gray-700">Background Color (e.g. Green Screen)</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={bgColor} 
                                        onChange={e => setBgColor(e.target.value)} 
                                        className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                                    />
                                    <span className="text-sm text-gray-500 font-mono">{bgColor}</span>
                                </div>
                            </div>

                            {/* Show Pencil Checkbox */}
                            <div className="flex items-center gap-3 mt-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <input 
                                    type="checkbox" 
                                    id="showPencil" 
                                    checked={showPencil} 
                                    onChange={e => setShowPencil(e.target.checked)} 
                                    className="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                                />
                                <label htmlFor="showPencil" className="text-sm font-semibold text-gray-700 select-none cursor-pointer flex items-center gap-2">
                                    <span>Show Pencil Writing Effect</span>
                                    <span className="text-xl">✏️</span>
                                </label>
                            </div>
                            
                            <hr className="border-gray-100 mt-8 mb-8" />
                            <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start w-full">
                                <button
                                    onClick={generateVideo}
                                    disabled={isGenerating || !font || !text}
                                    className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white px-8 py-3.5 sm:py-3 rounded-xl disabled:opacity-50 font-semibold transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Recording Canvas...
                                        </>
                                    ) : 'Generate Video'}
                                </button>

                                {videoUrl && (
                                    <a
                                        href={videoUrl.url}
                                        download={`handwriting.${videoUrl.ext}`}
                                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 sm:py-3 rounded-xl font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                        Download .{videoUrl.ext}
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="flex flex-col gap-6 w-full">
                            <div className="relative border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center p-4 sm:p-6 min-h-[200px] sm:min-h-[300px] overflow-hidden transition-colors w-full" style={{ backgroundColor: bgColor }}>
                                <div className="absolute top-4 left-4 text-xs font-bold text-gray-400 uppercase tracking-wider mix-blend-difference">Live Preview</div>

                                {!font && fontLoadingProgress === null && !fontError && (
                                    <button
                                        onClick={loadPreview}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-md hover:shadow-lg relative z-10"
                                    >
                                        Load Preview
                                    </button>
                                )}

                                {fontLoadingProgress !== null && (
                                    <div className="flex flex-col items-center justify-center w-full max-w-xs relative z-10">
                                        <div className="text-sm font-medium text-gray-600 mb-2 mix-blend-difference">Loading Font... {fontLoadingProgress}%</div>
                                        <div className="w-full bg-gray-200/20 rounded-full h-2.5">
                                            <div className="bg-white h-2.5 rounded-full transition-all duration-300" style={{ width: `${fontLoadingProgress}%` }}></div>
                                        </div>
                                    </div>
                                )}

                                {font && fontLoadingProgress === null && (
                                    <div className="w-full flex flex-col items-center">
                                        <svg key={text} ref={svgRef} width={svgDimensions.width} height={svgDimensions.height} viewBox={svgDimensions.viewBox} className="max-w-full h-auto drop-shadow-md relative z-10" style={{ overflow: 'visible' }}>
                                            <path 
                                                ref={pathRef}
                                                d={pathData} 
                                                fill="white" 
                                                stroke="white" 
                                                strokeWidth="1" 
                                            />
                                        </svg>
                                    </div>
                                )}

                                {fontError && (
                                    <div className="flex flex-col items-center justify-center text-red-500 text-center relative z-10">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span className="font-bold">Failed to load font</span>
                                        <span className="text-sm mt-1">{fontError}</span>
                                        <button
                                            onClick={loadPreview}
                                            className="mt-4 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-medium transition-all"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                )}
                            </div>

                            {videoUrl && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-gray-50 border border-gray-100 p-6 rounded-xl">
                                    <h3 className="text-sm font-bold mb-3 text-gray-800 uppercase tracking-wider">Video Result ({videoUrl.ext.toUpperCase()})</h3>
                                    <div className="bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-blue-50 border border-blue-200 p-4 rounded-lg shadow-inner flex items-center justify-center min-h-[150px]">
                                        <video src={videoUrl.url} autoPlay loop muted className="max-w-full rounded drop-shadow-md" />
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
