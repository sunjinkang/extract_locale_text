const fs = require('fs');
const path = require('path');
const process = require('process');
const traverse = require('@babel/traverse');
const parser = require('@babel/parser');

const filterFileForMissKeyDataInLocaleFile = !(
  filePath.endsWith('.d.ts') ||
  filePath.endsWith('.type.ts') ||
  filePath.endsWith('.enum.ts') ||
  filePath.endsWith('.less') ||
  filePath.endsWith('.d.tsx') ||
  filePath.endsWith('.md') ||
  filePath.endsWith('.test.js')
);

const filterFileForGetNotLocalFileAndLineNumber = !(
  filePath.endsWith('.test.tsx') ||
  filePath.endsWith('.d.ts') ||
  filePath.endsWith('.type.ts') ||
  filePath.endsWith('.enum.ts') ||
  filePath.endsWith('.less') ||
  filePath.endsWith('.d.tsx')
);

const filterFileForFilterUselessLocale = !(
  filePath.endsWith('.test.tsx') ||
  filePath.endsWith('.d.ts') ||
  filePath.endsWith('.type.ts') ||
  filePath.endsWith('.enum.ts') ||
  filePath.endsWith('.less') ||
  filePath.endsWith('.d.tsx') ||
  filePath.endsWith('.css') ||
  filePath.endsWith('.svg') ||
  filePath.endsWith('.md')
);

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

const getDirAllFile = (type, dir) => {
  const allFile = [];
  getFilePath(type, dir, allFile);
  return allFile;
};

const getFilePath = (type, dir, allFile) => {
  const dirFiles = fs.readdirSync(dir);
  dirFiles.forEach((item) => {
    const filePath = path.join(dir, item);
    const current = fs.statSync(filePath);
    if (current.isDirectory() === true && !filterDirectory.includes(filePath)) {
      getFilePath(filePath, allFile);
    }
    if (current.isFile() === true && allDirFileFilterType[type]) {
      allFile.push(filePath);
    }
  });
};

export const allDirFileFilterType = {
  useless: filterFileForMissKeyDataInLocaleFile,
  lineNumber: filterFileForGetNotLocalFileAndLineNumber,
  missKey: filterFileForFilterUselessLocale,
};

// 获取所有使用语言包的文件路径
export const getAllFilePathUsedI18nT = (type, dir) => {
  const currentDir = path.resolve(__dirname, '../src');
  return getDirAllFile(type, dir ?? currentDir);
};

// 判断是否包含中文
export const detectChinese = (text) => {
  return /[\u4e00-\u9fa5]/.test(text) && !text.includes('.html');
};
