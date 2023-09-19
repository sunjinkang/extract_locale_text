// "miss-locale-file": "cross-env outPutType=file node ./project/scripts/getNotLocaleFileAndLineNumber.js",
// "miss-locale-terminal": "cross-env outPutType=terminal node ./project/scripts/getNotLocaleFileAndLineNumber.js"

const fs = require('fs');
const path = require('path');
const process = require('process');
const traverse = require('@babel/traverse');
const parser = require('@babel/parser');

import { getAllFilePathUsedI18nT, detectChinese } from './localeCommonFunc';

const allFiles = getAllFilePathUsedI18nT('lineNumber');
const storeDir = path.resolve(__dirname, './');

const pathFile = path.resolve(storeDir, './path.txt');
const localeFile = path.resolve(storeDir, './locale.txt');

const fileSet = [pathFile, localeFile];

// save file locale key data to filter repeat locale data
const localeKeyData = new Map();

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

// 将当前文件的中文语言包的key保存在内存中，判断是否已发现时从内存中获取，每次换文件时，清空内存
const detectRepetition = (key, content) => {
  if (localeKeyData.has(key)) {
    return false;
  }
  localeKeyData.set(key, content);
  return true;
};

const commonFetText = (pa, fileName) => {
  const testName = detectChinese(pa.node.key?.name ?? '');
  const testValue = detectChinese(pa.node.value?.value ?? '');
  const infoName = testName
    ? `${fileName}\nline: ${pa.node.loc.start.line}-${pa.node.key?.name}\n\n`
    : '';
  const infoNameKey = testName
    ? `${fileName}-${pa.node.loc.start.line}-${pa.node.key?.name}`
    : '';
  const infoValue = testValue
    ? `${fileName}\nline: ${pa.node.loc.start.line}-${pa.node.value.value}\n\n`
    : '';
  const infoValueKey = testValue
    ? `${fileName}-${pa.node.loc.start.line}-${pa.node.value.value}`
    : '';
  const isNotSame = detectRepetition(
    infoNameKey || infoValueKey,
    infoName || infoValue
  );
  if ((infoName || infoValue) && isNotSame) {
    outPutLocaleResult(localeFile, infoName || infoValue);
  }
};

const outPutLocaleResult = (fileName, content) => {
  if (process.env.outPutType !== 'file') {
    console.log(content);
  } else {
    fs.appendFileSync(fileName, content);
  }
};

const file = fs.readFileSync(pathFile, 'utf8');
const fileArr = file.split(/\r?\n/);
fileArr.forEach((fileName) => {
  const current = fs.statSync(fileName);
  if (current.isFile() === true) {
    localeKeyData.clear();
    const lineFile = fs.readFileSync(fileName).toString();
    const code = parser.parse(lineFile, {
      sourceType: 'module',
      plugins: [
        // 支持jsx语法
        'jsx',
        // 支持typescript
        'typescript',
        // 修饰符
        'decorators-legacy',
        // 支持使用import.meta
        'syntax-import-meta',
      ],
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
        const infoValueKey = testValue
          ? `${fileName}-${pa.node.loc.start.line}-${pa.node.value}`
          : '';
        const isNotSame = detectRepetition(infoValueKey, infoValue);
        if (infoValue && isNotSame) {
          outPutLocaleResult(localeFile, infoValue);
        }
      },
    });
  }
});
