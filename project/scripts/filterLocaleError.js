const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse');

/**
 * 作用：查找代码中语言包key在语言包文件中是否缺少对应的数据
 * 方法：
 *    1、获取项目中所有需要对比的文件
 *    2、遍历文件
 *        2.1 通过AST获取对应的语言包key
 *        2.2 通过key获取对应的语言包文件名称
 *    3、将对应的语言包文件中的key处理为对应的语言包key，保存在keysData中
 *        3.1 保存在keysData中，即保存在内存中，每次遍历新的文件时，需要清空keysData，释放内存空间
 *    4、将文件中的语言包key，与keysData中的数据进行对比，如果语言包key在keysData中不存在对应数据，打印语言包key，格式：[文件路径]: line[行号]--[语言包key](语言包文件缺失对应文字)
 *
 * 注意事项：
 *    1、步骤2.1中，获取语言包key时，由于历史原因存在多种数据格式，分别对应的举例及处理方式如下：
 *        (1) 格式1：t('commonGenerator.save')，该格式可直接获取对应语言包key
 *        (2) 格式2：t('commonGenerator.save', { name: 'nameOne' })，该格式与格式1类似，但是获取时可能无法直接获取，需要注意
 *        (3) 格式3：t(`${name}.test`)，该格式暂无法获取语言包key，直接打印输出进行手动对比处理，格式：[文件路径]: line[行号](获取对应语言包key失败)
 *        (4) 格式4：t(save)，与格式3处理相同
 *        (5) 格式5：与以上四种格式类似，使用translate替换 t，处理方式参考对应格式
 *        PS: 通过节点名称是否为 t 获取key时，需要注意部分代码中存在 t ，举例：C:\Users\sunji\Desktop\actionCode\umc-ui\src\page\DBLEConfig\DBLEConfigV6\LogicLibrary\index.tsx
 *
 *    2、步骤3.1中，部分语言包的文件中存在特殊格式的数据结构，需要特殊处理：
 *        (1) 文件中存在数组结构，举例：C:\Users\sunji\Desktop\actionCode\umc-ui\src\locale\ch-language\formRules.ts
 *        (2) 文件中key为中划线连接的字符串，举例：C:\Users\sunji\Desktop\actionCode\umc-ui\src\locale\ch-language\button.ts
 */

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

let keysData = {};
let nameKeys = [];

// all need filter files directory
const currentDir = path.resolve(__dirname, '../src');
// store files directory
const storeDir = path.resolve(__dirname, './');
// locale files path file
const pathFile = path.resolve(storeDir, './path.txt');
const notStringForLocale = path.resolve(storeDir, './notStringForLocale.txt');

const getCurrentLocaleFile = (name, filePrefix) => {
  const aliasName = Object.keys(bashFileName).includes(name)
    ? bashFileName[name]
    : name;
  return path.resolve(
    __dirname,
    `../src/locale/${filePrefix}-language/${aliasName}.ts`
  );
};

// traverse to get node path until the export default
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

// generate keysData for current locale file
const getKeysData = (pa, currentKey, name) => {
  // when object has both StringLiteral type key and value will execute getKeysData multiple, so judge condition: keysData[currentKey].length === 0
  if (
    Object.keys(keysData).includes(currentKey) &&
    keysData[currentKey].length === 0
  ) {
    getAllParentPath(pa, keysData[currentKey]);
    keysData[currentKey].unshift(name);
    keysData[currentKey] = keysData[currentKey].join('.');
  }
};

const getFileLocaleDataByFileName = (fileName, languagePrefix = 'ch') => {
  const testFile = getCurrentLocaleFile(fileName, languagePrefix);
  const fileContent = fs.readFileSync(testFile).toString();
  const code = parser.parse(fileContent, {
    sourceType: 'module',
  });
  traverse.default(code, {
    // get locale keys data from locale files
    Property(pa) {
      if (
        pa.node.value.type === 'StringLiteral' &&
        (pa.node.key.name || pa.node.key.value)
      ) {
        const currentNodeKeyData = pa?.node?.key;
        const currentKey = `${pa.node.loc?.start?.line}-${
          currentNodeKeyData?.name ?? currentNodeKeyData?.value
        }`;
        keysData[currentKey] = [];
        getKeysData(pa, currentKey, fileName);
      }
    },
  });
};

const getFilePath = (dir, allFile, filterDirectory) => {
  const dirFiles = fs.readdirSync(dir);
  dirFiles.forEach((item) => {
    const filePath = path.join(dir, item);
    const current = fs.statSync(filePath);
    if (current.isDirectory() === true && !filterDirectory.includes(filePath)) {
      getFilePath(filePath, allFile, filterDirectory);
    }
    if (
      current.isFile() === true &&
      !(
        filePath.endsWith('.d.ts') ||
        filePath.endsWith('.type.ts') ||
        filePath.endsWith('.enum.ts') ||
        filePath.endsWith('.less') ||
        filePath.endsWith('.d.tsx') ||
        filePath.endsWith('.md') ||
        filePath.endsWith('.test.js')
      )
    ) {
      allFile.push(filePath);
    }
  });
};

const getDirAllFile = (dir, filterDirectory) => {
  const allFile = [];
  getFilePath(dir, allFile, filterDirectory);
  return allFile;
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

  // all need filter files path data
  const allFiles = getDirAllFile(currentDir, filterDirectory);

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
  fs.writeFileSync(pathFile, allFiles.join('\n'));
};

const filterMissLocale = (file, key) => {
  const localeFileName = key?.split('.')?.[0];
  if (
    !/[\u4e00-\u9fa5]/.test(localeFileName) &&
    !nameKeys.includes(localeFileName)
  ) {
    nameKeys.push(localeFileName);
    getFileLocaleDataByFileName(localeFileName);
  }
  if (!Object.values(keysData).includes(key)) {
    console.log(`${file}-----${key}`);
  }
};

const getNodeTypeAndData = (fileName, argument = [], pa) => {
  argument.forEach((item) => {
    if (item?.type === 'StringLiteral') {
      filterMissLocale(fileName, item?.value);
    } else if (
      item?.type === 'Identifier' ||
      item?.type === 'TemplateLiteral' ||
      item?.type === 'MemberExpression'
    ) {
      fs.appendFileSync(
        notStringForLocale,
        `${fileName}----line: ${pa?.node?.loc?.start?.line}\n`
      );
    }
  });
};

const filterLocale = () => {
  // getAllFilePath();
  const file = fs.readFileSync(pathFile, 'utf8');
  // const fileArr = file.split(/\r?\n/);
  const fileArr = [
    `C:\\Users\\sunji\\Desktop\\actionCode\\umc-ui\\src\\page\\Uproxy\\Instance\\components\\Modal\\components\\AddInstance.tsx`,
  ];
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
        Identifier(pa) {
          if (
            pa?.node?.name === 't' &&
            pa?.parentPath?.node?.type === 'MemberExpression'
          ) {
            const currentNodeArgument = pa?.parentPath?.parent?.arguments;
            getNodeTypeAndData(fileName, currentNodeArgument, pa);
          }
          if (
            pa.node.name === 'translate' &&
            pa?.parentPath?.node?.type === 'CallExpression'
          ) {
            console.log(pa?.parentPath?.node);
            const currentNodeArgument = pa?.parentPath?.node?.arguments;
            getNodeTypeAndData(fileName, currentNodeArgument, pa);
          }
        },
      });
    }
  });
};

filterLocale();
