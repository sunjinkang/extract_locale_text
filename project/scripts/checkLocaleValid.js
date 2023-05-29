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

const keysData = {};

// 依据语言包文件名获取对应文件中所有的语言包key，并保存在keysData中
// 注意：
// 1.由于同一个文件中，有时会引用不同的语言包文件，可能会出现keysData中同时需要保存多个文件key的情况
// 2.当查找的文件切换时，需要清空keysData
const getFileLocaleDataByFileName = (fileName, languagePrefix = 'ch') => {
  const testFile = path.resolve(
    __dirname,
    `../src/locale/${languagePrefix}-language/${fileName}.ts`
  );

  const fileContent = fs.readFileSync(testFile).toString();

  const getFileName = () => {
    const tempName = path.basename(testFile, '.ts');
    return Object.keys(bashFileName).includes(tempName)
      ? bashFileName[tempName]
      : tempName;
  };
  const currentFileName = getFileName();

  const code = parser.parse(fileContent, {
    sourceType: 'module',
  });

  const getAllParentPath = (path, pathArray) => {
    const key = path.node.key?.name
      ? path.node.key?.name
      : path.node.key?.value;
    if (path.node.type !== 'ExportDefaultDeclaration') {
      if (key) {
        pathArray.unshift(key);
      }
      getAllParentPath(path.parentPath, pathArray);
    } else {
      return;
    }
  };

  traverse.default(code, {
    Property(pa) {
      if (pa.node.value.type === 'StringLiteral') {
        const currentKey = `${pa.node.loc?.start?.line}-${pa.node.key.name}`;
        keysData[currentKey] = [];
      }
    },
    Identifier(pa) {
      const currentKey = `${pa.node.loc?.start?.line}-${pa.node.name}`;
      if (Object.keys(keysData).includes(currentKey)) {
        getAllParentPath(pa, keysData[currentKey]);
        keysData[currentKey].unshift(currentFileName);
        keysData[currentKey] = keysData[currentKey].join('.');
      }
    },
  });
};

// getFileLocaleDataByFileName('common');
// console.log(keysData);

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

  if (fs.existsSync(pathFile)) {
    try {
      fs.rmSync(key);
    } catch (rmError) {
      console.error(`删除文件失败:${rmError}`);
      process.exit(1);
    }
  }
  fs.appendFileSync(pathFile, allFiles.join('\n'));

  const file = fs.readFileSync(pathFile, 'utf8');
  const fileArr = file.split(/\r?\n/);
  fileArr.forEach((fileName) => {
    const current = fs.statSync(fileName);
    if (current.isFile() === true) {
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
        Property(pa) {
          console.log(pa);
        },
        JSXAttribute(pa) {
          console.log(pa);
        },
        StringLiteral(pa) {
          console.log(pa);
        },
      });
    }
  });
};

getAllFilePath();
