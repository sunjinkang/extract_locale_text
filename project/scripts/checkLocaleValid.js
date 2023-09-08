// 该脚本已废弃，功能已迁移至 filterLocaleError.js

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse');

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

let keysData = {};
let nameKeys = [];

// 依据语言包文件名获取对应文件中所有的语言包key，并保存在keysData中
// 注意：
// 1.由于同一个文件中，有时会引用不同的语言包文件，可能会出现keysData中同时需要保存多个文件key的情况
// 2.当查找的文件切换时，需要清空keysData
const getFileLocaleDataByFileName = (fileName, languagePrefix = 'ch') => {
  const aliasName = Object.keys(bashFileName).includes(fileName)
    ? bashFileName[fileName]
    : fileName;
  const testFile = path.resolve(
    __dirname,
    `../src/locale/${languagePrefix}-language/${aliasName}.ts`
  );

  const fileContent = fs.readFileSync(testFile).toString();

  const code = parser.parse(fileContent, {
    sourceType: 'module',
  });

  const getAllParentPath = (path, pathArray) => {
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
  };

  const getKeysData = (pa, currentKey, name) => {
    if (Object.keys(keysData).includes(currentKey)) {
      getAllParentPath(pa, keysData[currentKey]);
      keysData[currentKey].unshift(name);
      keysData[currentKey] = keysData[currentKey].join('.');
    }
  };

  traverse.default(code, {
    Property(pa) {
      if (pa.node.value.type === 'StringLiteral' && pa.node.key.name) {
        const currentKey = `${pa.node.loc?.start?.line}-${pa.node.key.name}`;
        keysData[currentKey] = [];
      }
    },
    StringLiteral(pa) {
      const parentNodeKey = pa?.parentPath?.node?.key;
      if (
        parentNodeKey?.value &&
        pa.parentPath?.parentPath.parentPath.node.type ===
          'ExportDefaultDeclaration'
      ) {
        const currentKey = `${parentNodeKey?.loc?.start?.line}-${parentNodeKey?.value}`;
        keysData[currentKey] = [];
        getKeysData(pa, currentKey, fileName);
      }
    },
    Identifier(pa) {
      const childrenNode = pa?.parentPath?.node?.value?.properties;
      const hasStringKeys = childrenNode?.filter(
        (item) =>
          item.key.type === 'StringLiteral' &&
          item.value.type === 'StringLiteral'
      );
      if (hasStringKeys && hasStringKeys.length) {
        let childrenKeys = '';
        hasStringKeys.forEach((item) => {
          childrenKeys = `${item?.loc?.start?.line}-${item?.key?.value}`;
          keysData[childrenKeys] = [item?.key?.value];
          getKeysData(pa, childrenKeys, fileName);
        });
      }
      if (pa.node.name) {
        const currentKey = `${pa.node.loc?.start?.line}-${pa.node.name}`;
        getKeysData(pa, currentKey, fileName);
      }
    },
  });
};

const getAllFilePath = () => {
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
      `../src/${filterDirectory[i]}`
    );
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
      if (
        current.isDirectory() === true &&
        !filterDirectory.includes(filePath)
      ) {
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
          filePath.endsWith('.d.tsx') ||
          filePath.endsWith('.stories.js') ||
          filePath.endsWith('.md') ||
          filePath.endsWith('.test.js')
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
  const notStringForLocale = path.resolve(storeDir, './notStringForLocale.txt');

  for (const key of [pathFile, notStringForLocale]) {
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

  const file = fs.readFileSync(pathFile, 'utf8');
  const fileArr = file.split(/\r?\n/);
  fileArr.forEach((fileName) => {
    const current = fs.statSync(fileName);
    if (current.isFile() === true) {
      keysData = {};
      nameKeys = [];
      const lineFile = fs.readFileSync(fileName).toString();
      const code = parser.parse(lineFile, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'syntax-import-meta',
        ],
      });
      traverse.default(code, {
        // 项目中部分语言包使用模板字符串处理key，暂无好的处理方法，将对应的位置输出到文件中，方便手动处理
        Identifier(pa) {
          if (pa.node.name === 't' || pa.node.name === 'translate') {
            // 判断 t() 及 translate() 类型语言包中是否含有模板字符串

            const expressionType = [
              'MemberExpression',
              'CallExpression',
            ].includes(pa.parentPath.node.type);
            const hasNotStringFirst =
              expressionType &&
              pa.parentPath.node.arguments?.some(
                (item) =>
                  item.type !== 'StringLiteral' &&
                  item.type !== 'ObjectExpression'
              );
            // 判断 i18n.t() 语言包中是否含有模板字符串
            const argumentData = pa?.parentPath?.parentPath?.node?.arguments;
            const hasNotStringSecond =
              pa.node.name === 't' &&
              expressionType &&
              argumentData?.length > 1 &&
              argumentData?.some(
                (item) =>
                  item.type !== 'StringLiteral' &&
                  item.type !== 'ObjectExpression'
              );
            if (!!hasNotStringFirst || !!hasNotStringSecond)
              fs.appendFileSync(
                notStringForLocale,
                `${fileName}----line: ${pa.node.loc?.start?.line}\n`
              );
          }
        },
        StringLiteral(pa) {
          const parentNode = pa?.parentPath?.node;
          if (
            parentNode?.type === 'CallExpression' &&
            (parentNode?.callee?.object?.name === 'i18n' ||
              parentNode?.callee?.property?.name === 't' ||
              parentNode?.callee?.name === 'translate')
          ) {
            filterMissLocale(fileName, pa.node.value);
          }
        },
      });
    }
  });
};

const filterMissLocale = (file, key) => {
  const localeFileName = key?.split('.')?.[0];
  if (!nameKeys.includes(localeFileName)) {
    nameKeys.push(localeFileName);
    getFileLocaleDataByFileName(localeFileName);
  }
  if (!Object.values(keysData).includes(key)) {
    console.log(`${file}-----${key}`);
  }
};

getAllFilePath();
