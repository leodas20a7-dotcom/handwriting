import opentype from 'opentype.js';
import fs from 'fs';

const font = opentype.loadSync('public/fonts/Pacifico-Regular.ttf'); // Assuming we can read it. Wait, the font is in src/assets.
