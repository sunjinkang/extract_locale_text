const fs = require('fs');
const path = require('path');
const process = require('process');
const traverse = require('@babel/traverse');
const parser = require('@babel/parser');

const filterDirectory = [
  'api',
  'api-oceanBase',
  'locale',
  'store',
  'styles',
  'theme',
  'typing',
];

for (let i = 0; i < filterDirectory.length; i++) {
  filterDirectory[i] = path.resolve(__dirname, `../src/${filterDirectory[i]}`);
}

const getDirAllFile = (dir) => {
  const allFile = [];
  getFilePath(dir, allFile);
  return allFile;
};

const getFilePath = (dir, allFile) => {
  const dirFiles = fs.readdirSync(dir);
  dirFiles.forEach((item) => {
    const filePath = path.join(dir, item);
    const current = fs.statSync(filePath);
    if (current.isDirectory() === true && !filterDirectory.includes(filePath)) {
      getFilePath(filePath, allFile);
    }
    if (
      current.isFile() === true &&
      !(
        filePath.endsWith('.test.tsx') ||
        filePath.endsWith('.d.ts') ||
        filePath.endsWith('.type.ts') ||
        filePath.endsWith('.enum.ts') ||
        filePath.endsWith('.less') ||
        filePath.endsWith('.d.tsx')
      )
    ) {
      allFile.push(filePath);
    }
  });
};

export const getAllFilePathUsedI18nT = () => {
  const currentDir = path.resolve(__dirname, '../src');
  return getDirAllFile(currentDir);
};
