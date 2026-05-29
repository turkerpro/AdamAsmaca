import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();

function copyFolderSync(from, to) {
    if (!fs.existsSync(from)) return;
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }
    fs.readdirSync(from).forEach(element => {
        const fromPath = path.join(from, element);
        const toPath = path.join(to, element);
        if (fs.lstatSync(fromPath).isDirectory()) {
            // Skip __pycache__ and scratch directories
            if (element !== '__pycache__' && element !== 'scratch') {
                copyFolderSync(fromPath, toPath);
            }
        } else {
            // Only copy JSON and asset files
            if (element.endsWith('.json') || element.endsWith('.png') || element.endsWith('.svg') || element.endsWith('.txt')) {
                fs.copyFileSync(fromPath, toPath);
            }
        }
    });
}

function main() {
    const distDir = path.join(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    // Copy single files
    const filesToCopy = [
        'main.js',
        'style.css',
        'curriculum_index.json',
        'manifest.json',
        'ogretmen.js',
        'ogretmen.html'
    ];

    filesToCopy.forEach(file => {
        const src = path.join(__dirname, file);
        const dest = path.join(distDir, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`Copied ${file} to dist/`);
        }
    });

    // Copy data folder
    console.log('Copying data folder to dist/data...');
    copyFolderSync(path.join(__dirname, 'data'), path.join(distDir, 'data'));
    
    // Copy public folder if exists
    const publicDir = path.join(__dirname, 'public');
    if (fs.existsSync(publicDir) && fs.readdirSync(publicDir).length > 0) {
        console.log('Copying public folder to dist...');
        copyFolderSync(publicDir, distDir);
    }
    
    console.log('Build asset copy complete!');
}

main();
