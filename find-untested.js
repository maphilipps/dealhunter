const fs = require('fs');
const path = require('path');

function findUntestedFiles() {
  const libDir = './lib';
  const untested = [];

  function walkDir(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (file !== '__tests__' && file !== 'node_modules') {
          walkDir(filePath);
        }
      } else if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.config.ts')) {
        // Check if test file exists
        const testFilePath = path.join(path.dirname(filePath), '__tests__', path.basename(file).replace('.ts', '.test.ts'));

        if (!fs.existsSync(testFilePath)) {
          untested.push(filePath);
        }
      }
    }
  }

  walkDir(libDir);
  return untested;
}

const untested = findUntestedFiles();
console.log('Files without tests:');
untested.forEach(f => console.log(f));
console.log(`\nTotal: ${untested.length} files without tests`);
