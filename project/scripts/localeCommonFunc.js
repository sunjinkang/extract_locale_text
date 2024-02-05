const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse');
const process = require('process');
const log4js = require('log4js');

function filterFileForNotGetLocale(filePath) {
  return !(
    filePath.endsWith('.d.ts') ||
    filePath.endsWith('.type.ts') ||
    filePath.endsWith('.enum.ts') ||
    filePath.endsWith('.less') ||
    filePath.endsWith('.d.tsx') ||
    filePath.endsWith('.md') ||
    filePath.endsWith('.test.tsx') ||
    filePath.endsWith('.css') ||
    filePath.endsWith('.svg') ||
    filePath.endsWith('.test.js') ||
    filePath.endsWith('stories.js')
  );
}

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
  filterDirectory[i] = path.resolve(
    __dirname,
    `../../src/${filterDirectory[i]}`
  );
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
    const filterByType =
      type !== 'compare' ? !filterDirectory.includes(filePath) : true;
    if (current.isDirectory() === true && filterByType) {
      getFilePath(type, filePath, allFile);
    }
    if (current.isFile() === true && allDirFileFilterType[type](filePath)) {
      allFile.push(filePath);
    }
  });
};

const allDirFileFilterType = {
  notCompare: filterFileForNotGetLocale,
  compare: (type) => !!type,
};

// 获取所有使用语言包的文件路径
function getAllFilePathUsedI18nT(type, dir) {
  const currentDir = path.resolve(__dirname, '../../src');
  return getDirAllFile(type, dir ?? currentDir);
}

// 判断是否包含中文
function detectChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text) && !text.includes('.html');
}

// 删除已有文件
function deleteFiles(files) {
  for (const key of files) {
    if (fs.existsSync(key)) {
      try {
        fs.rmSync(key);
      } catch (rmError) {
        console.error(`删除文件失败:${rmError}`);
        process.exit(1);
      }
    }
  }
}

// traverse to get node path until the export default
function getAllParentPath(path, pathArray) {
  let key = path.node.key?.name ? path.node.key?.name : path.node.key?.value;
  // 部分语言包中存在数组结构数据
  if (!!key && path?.parentPath?.parentPath?.type === 'ArrayExpression') {
    key = `${path?.parentPath?.key}.${key}`;
  }
  if (path.node.type !== 'ExportDefaultDeclaration') {
    if (key) {
      pathArray.unshift(key);
    }
    getAllParentPath(path.parentPath, pathArray);
  } else {
    return;
  }
}

// locale file alias
const bashFileName = {
  User: 'User_bash',
  UrmanTask: 'UrmanTask_bash',
  UrmanResource: 'UrmanResource_bash',
  UrmanDataRecovery: 'UrmanDataRecovery_bash',
  UproxyRouter: 'UproxyRouter_bash',
  Tag: 'Tag_bash',
  Sla: 'Sla_bash',
  SipPool: 'SipPool_bash',
  Server: 'Server_bash',
  Mysql: 'Mysql_bash',
  License: 'License_bash',
  Layout: 'Layout_bash',
  Diagnosis: 'Diagnosis_bash',
  publicLang: 'public',
  index: 'index_bash',
  Progress: 'Progress_bash',
  Button: 'Button_bash',
};

// 获取中英文语言包文件夹或文件夹下文件
function getCurrentLocaleFile(localeFileDirectory, name, useAlias) {
  try {
    if (!name)
      return path.resolve(__dirname, `../../src/locale/${localeFileDirectory}`);
    const fileName =
      Object.keys(bashFileName).includes(name) && useAlias
        ? bashFileName[name]
        : name;
    const fileNameWithSuffix = fileName?.endsWith('.ts')
      ? fileName
      : `${fileName}.ts`;
    return path.resolve(
      __dirname,
      `../../src/locale/${localeFileDirectory}/${fileNameWithSuffix}`
    );
  } catch (error) {
    console.error(
      `failed to get locale file from directory: ${localeFileDirectory}`
    );
  }
}

// generate keysData for current locale file
const getKeysData = (keysData, pa, currentKey, name) => {
  // when object has both StringLiteral type key and value will execute getKeysData multiple, so judge condition: keysData[currentKey].length === 0
  try {
    if (
      Object.keys(keysData).includes(currentKey) &&
      keysData[currentKey].length === 0
    ) {
      getAllParentPath(pa, keysData[currentKey]);
      keysData[currentKey].unshift(name);
      keysData[currentKey] = keysData[currentKey].join('.');
    }
  } catch (error) {
    console.error(`failed to get key data. Error: ${error}`);
  }
};

function getKeyDataFromLocaleFile(
  keysData,
  fileName,
  languageDirectory = 'ch-language',
  useAlias,
  keyWithValue
) {
  try {
    const testFile = getCurrentLocaleFile(
      languageDirectory,
      fileName,
      useAlias
    );
    transformCodeByAst(testFile, {
      // get locale keys data from locale files
      Property(pa) {
        if (
          (pa.node.value.type === 'StringLiteral' ||
            pa.node.value.type === 'TemplateLiteral') &&
          (pa.node.key.name || pa.node.key.value)
        ) {
          const currentNodeKeyData = pa?.node?.key;
          let currentKey = `${pa.node.loc?.start?.line}-${
            currentNodeKeyData?.name ?? currentNodeKeyData?.value
          }`;
          if (keyWithValue) {
            currentKey = `${currentKey}${keyAndValueSeparateCode}${pa?.node?.value?.value}`;
          }
          keysData[currentKey] = [];
          getKeysData(keysData, pa, currentKey, fileName);
        }
      },
    });
  } catch (error) {
    console.error(
      `failed to get locale data by file: ${fileName}. Error: ${error}`
    );
  }
}

function transformCodeByAst(filePath, astFunction, isNeedCode) {
  const fileContent = fs.readFileSync(filePath).toString();
  const code = parser.parse(fileContent, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'decorators-legacy', 'syntax-import-meta'],
  });
  traverse.default(code, astFunction);
  if (isNeedCode) {
    return code;
  }
}

function addProcessLog() {
  log4js.configure({
    appenders: {
      console: { type: 'console' },
      file: { type: 'file', filename: './scripts/locale/detail.log' },
    },
    categories: {
      default: { appenders: ['console', 'file'], level: 'info' },
    },
  });

  const logger = log4js.getLogger();
  return logger;
  // logger.trace("Entering cheese testing");
  // logger.debug("Got cheese.");
  // logger.info("Cheese is Comté.");
  // logger.warn("Cheese is quite smelly.");
  // logger.error("Cheese is too ripe!");
  // logger.fatal("Cheese was breeding ground for listeria.");
}

const keyAndValueSeparateCode = '_localeSeparate_';

module.exports = {
  keyAndValueSeparateCode,
  getAllFilePathUsedI18nT,
  detectChinese,
  deleteFiles,
  getAllParentPath,
  getKeyDataFromLocaleFile,
  getCurrentLocaleFile,
  addProcessLog,
  transformCodeByAst,
};
