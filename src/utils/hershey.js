import hersheyData from '../hersheytext.min.json';

// Available Hershey fonts suitable for handwriting
export const HERSHEY_FONTS = [
    { name: 'Script Complex', value: 'scriptc' },
    { name: 'Script Simplex', value: 'scripts' },
    { name: 'Cursive', value: 'cursive' },
    { name: 'Roman Simplex', value: 'rowmans' },
];

export function getHersheyPathData(text, fontName) {
    const font = hersheyData[fontName];
    if (!font) return { pathData: '', width: 0, height: 30 }; // Default height approx 30

    let pathData = '';
    let currentX = 0;
    const spaceWidth = 10; // Default space width

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === ' ') {
            currentX += spaceWidth;
            continue;
        }

        const charCode = char.charCodeAt(0) - 33;
        const data = font.chars[charCode];

        if (data && data.d) {
            // The SVG path data `d` from Hershey is already a string like "M6,7 L5,6 ...".
            // We need to translate all X coordinates by `currentX`
            // and shift Y coordinates down slightly to center vertically (e.g., +5)
            
            // Regex to find all numbers (including negatives) in the SVG path
            const shiftedD = data.d.replace(/([A-Z])([^A-Z]*)/gi, (match, cmd, args) => {
                const parts = args.trim().split(/[\s,]+/);
                if (parts.length < 2) return match; // fallback for unexpected data
                
                let newArgs = '';
                for (let j = 0; j < parts.length; j += 2) {
                    const x = parseFloat(parts[j]);
                    const y = parseFloat(parts[j+1]);
                    if (!isNaN(x) && !isNaN(y)) {
                        newArgs += `${x + currentX},${y} `;
                    }
                }
                return `${cmd}${newArgs}`;
            });

            pathData += shiftedD + ' ';
            currentX += parseInt(data.o, 10) || 10; // Advance cursor
        } else {
            // Character not found, just advance
            currentX += spaceWidth;
        }
    }

    return {
        pathData: pathData.trim(),
        width: currentX,
        height: 40 // Hershey fonts roughly fit within a 40-unit height
    };
}
