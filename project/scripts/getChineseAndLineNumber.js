const fs = require('fs');
const path = require('path');
const localeCommonFunc = require('./localeCommonFunc');

/**
 * 作用：
 *  查找项目中的中文，并输出中文位置
 */

// save file locale key data to filter repeat locale data
const localeKeyData = new Map();

const logger = localeCommonFunc.addProcessLog();

// 将当前文件的中文语言包的key保存在内存中，判断是否已发现时从内存中获取，每次换文件时，清空内存
const detectRepetition = (key, content) => {
  if (localeKeyData.has(key)) {
    return false;
  }
  localeKeyData.set(key, content);
  return true;
};

const commonFetText = (pa, fileName) => {
  const testName = localeCommonFunc.detectChinese(pa.node.key?.name ?? '');
  const testValue = localeCommonFunc.detectChinese(pa.node.value?.value ?? '');
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
    logger.error(infoName || infoValue);
  }
};

const getChineseAndLineNumber = () => {
  const allFiles = localeCommonFunc.getAllFilePathUsedI18nT('notCompare');
  const storeDir = path.resolve(__dirname, './');
  // path.txt 暂存项目中的需要筛选的文件路径，筛选完成后删除
  const pathFile = path.resolve(storeDir, './path.txt');

  localeCommonFunc.deleteFiles([pathFile]);
  fs.appendFileSync(pathFile, allFiles.join('\n'));

  const file = fs.readFileSync(pathFile, 'utf8');
  const fileArr = file.split(/\r?\n/);
  fileArr.forEach((fileName) => {
    logger.info(`start get chinese and line number from: ${fileName}`);
    const current = fs.statSync(fileName);
    if (current.isFile() === true) {
      localeKeyData.clear();

      localeCommonFunc.transformCodeByAst(
        fileName,
        {
          Property(pa) {
            commonFetText(pa, fileName);
          },
          JSXAttribute(pa) {
            commonFetText(pa, fileName);
          },
          StringLiteral(pa) {
            const testValue = localeCommonFunc.detectChinese(
              pa.node.value ?? ''
            );
            const infoValue = testValue
              ? `${fileName}\nline: ${pa.node.loc.start.line}-${pa.node.value}\n\n`
              : '';
            const infoValueKey = testValue
              ? `${fileName}-${pa.node.loc.start.line}-${pa.node.value}`
              : '';
            const isNotSame = detectRepetition(infoValueKey, infoValue);
            if (infoValue && isNotSame) {
              logger.error(infoValue);
            }
          },
        },
        false
      );
    }
  });

  localeCommonFunc.deleteFiles([pathFile]);
};

getChineseAndLineNumber();
