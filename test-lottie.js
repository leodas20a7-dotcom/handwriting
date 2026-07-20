import opentype from 'opentype.js';
import fs from 'fs';

// Mock path for testing
const fontData = fs.readFileSync('./node_modules/@fontsource/pacifico/files/pacifico-latin-400-normal.woff');
const font = opentype.parse(fontData.buffer);
const path = font.getPath('Hello World', 0, 0, 72);

// Function to convert opentype path commands to a Lottie path ks object
function createLottieShapeFromPath(path) {
    const lottieShapes = [];
    
    let currentShape = null;
    let prevX = 0, prevY = 0;

    for (const cmd of path.commands) {
        if (cmd.type === 'M') {
            if (currentShape && currentShape.v.length > 0) lottieShapes.push(currentShape);
            currentShape = { c: false, i: [], o: [], v: [] };
            currentShape.v.push([cmd.x, cmd.y]);
            currentShape.i.push([0, 0]);
            currentShape.o.push([0, 0]);
            prevX = cmd.x;
            prevY = cmd.y;
        } else if (cmd.type === 'L') {
            if (!currentShape) continue;
            currentShape.v.push([cmd.x, cmd.y]);
            currentShape.i.push([0, 0]);
            currentShape.o.push([0, 0]);
            prevX = cmd.x;
            prevY = cmd.y;
        } else if (cmd.type === 'Q') {
            if (!currentShape) continue;
            // Convert Quad to Cubic
            const x1 = prevX + 2.0/3.0 * (cmd.x1 - prevX);
            const y1 = prevY + 2.0/3.0 * (cmd.y1 - prevY);
            const x2 = cmd.x + 2.0/3.0 * (cmd.x1 - cmd.x);
            const y2 = cmd.y + 2.0/3.0 * (cmd.y1 - cmd.y);
            
            const lastIdx = currentShape.v.length - 1;
            currentShape.o[lastIdx] = [x1 - prevX, y1 - prevY];
            
            currentShape.v.push([cmd.x, cmd.y]);
            currentShape.i.push([x2 - cmd.x, y2 - cmd.y]);
            currentShape.o.push([0, 0]);
            
            prevX = cmd.x;
            prevY = cmd.y;
        } else if (cmd.type === 'C') {
            if (!currentShape) continue;
            const lastIdx = currentShape.v.length - 1;
            currentShape.o[lastIdx] = [cmd.x1 - prevX, cmd.y1 - prevY];
            
            currentShape.v.push([cmd.x, cmd.y]);
            currentShape.i.push([cmd.x2 - cmd.x, cmd.y2 - cmd.y]);
            currentShape.o.push([0, 0]);
            
            prevX = cmd.x;
            prevY = cmd.y;
        } else if (cmd.type === 'Z') {
            if (currentShape) currentShape.c = true;
        }
    }
    
    if (currentShape && currentShape.v.length > 0) lottieShapes.push(currentShape);
    return lottieShapes;
}

const shapes = createLottieShapeFromPath(path);
console.log(`Generated ${shapes.length} separate path segments`);
