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

const currentDir = path.resolve(__dirname, '../src');
const storeDir = path.resolve(__dirname, './');

const allFiles = getDirAllFile(currentDir);

const pathFile = path.resolve(storeDir, './path.txt');
const localeFile = path.resolve(storeDir, './locale.txt');

const fileSet = [pathFile, localeFile];

for (const key of fileSet) {
  if (fs.existsSync(key)) {
    try {
      fs.rmSync(key);
    } catch (rmError) {
      console.error(`删除文件失败:${rmError}`);
      process.exit(1);
    }
  }
}
fs.appendFileSync(pathFile, allFiles.join('\n'));

const detectChinese = (text) => {
  return /[\u4e00-\u9fa5]/.test(text) && !text.includes('.html');
};

const detectRepetition = (content) => {
  const fileContent = fs.existsSync(localeFile)
    ? fs.readFileSync(localeFile).toString()
    : '';
  return !fileContent.includes(content);
};

const commonFetText = (pa, fileName) => {
  const testName = detectChinese(pa.node.key?.name ?? '');
  const testValue = detectChinese(pa.node.value?.value ?? '');
  const infoName = testName
    ? `${fileName}\nline: ${pa.node.loc.start.line}-${pa.node.key?.name}\n\n`
    : '';
  const infoValue = testValue
    ? `${fileName}\nline: ${pa.node.loc.start.line}-${pa.node.value.value}\n\n`
    : '';
  const isNotSame = detectRepetition(infoName || infoValue);
  if ((infoName || infoValue) && isNotSame) {
    fs.appendFileSync(localeFile, infoName || infoValue);
  }
};

const file = fs.readFileSync(pathFile, 'utf8');
const fileArr = file.split(/\r?\n/);
fileArr.forEach((fileName) => {
  const current = fs.statSync(fileName);
  if (current.isFile() === true) {
    if (!fileName.endsWith('.tsx') && !fileName.endsWith('.jsx')) {
      return;
    }
    const lineFile = fs.readFileSync(fileName).toString();

    const code = parser.parse(lineFile, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'syntax-import-meta'],
    });
    traverse.default(code, {
      Property(pa) {
        commonFetText(pa, fileName);
      },
      JSXAttribute(pa) {
        commonFetText(pa, fileName);
      },
      StringLiteral(pa) {
        const testValue = detectChinese(pa.node.value ?? '');
        const infoValue = testValue
          ? `${fileName}\nline: ${pa.node.loc.start.line}-${pa.node.value}\n\n`
          : '';
        const isNotSame = detectRepetition(infoValue);
        if (infoValue && isNotSame) {
          fs.appendFileSync(localeFile, infoValue);
        }
      },
    });

    // const arr = lineFile.split(/\r?\n/);
    // arr.forEach((line, index) => {
    //   var match =
    //     !line.includes('//') && !line.includes('<!--') && !line.includes('*')
    //       ? line.match(/[\u4e00-\u9faf]+/g)
    //       : '';
    //   if (!!match) {
    //     const localeContent = fs.existsSync(localeFile)
    //       ? fs.readFileSync(localeFile)
    //       : '';
    //     let data = '';
    //     if (localeContent.includes(fileName)) {
    //       data = `\nline ${index + 1}: ${match.join('、')}`;
    //     } else {
    //       data = `${fs.existsSync(localeFile) ? '\n\n' : ''}${fileName}\nline ${
    //         index + 1
    //       }: ${match.join('、')}`;
    //     }
    //     fs.appendFileSync(localeFile, data);
    //   }
    // });
  }
});
