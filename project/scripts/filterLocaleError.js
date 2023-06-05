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
 *        PS: 通过节点名称是否为 t 获取key时，需要注意部分代码中存在 t ，举例：C:\Users\sunji\Desktop\actionCode\umc-ui\src\page\DBLEConfig\DBLEConfigV6\LogicLibrary\index.tsx
 *
 *    2、步骤3.1中，部分语言包的文件中存在特殊格式的数据结构，需要特殊处理：
 *        (1) 文件中存在数组结构，举例：C:\Users\sunji\Desktop\actionCode\umc-ui\src\locale\ch-language\formRules.ts
 *        (2) 文件中key为中划线连接的字符串，举例：C:\Users\sunji\Desktop\actionCode\umc-ui\src\locale\ch-language\button.ts
 */

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

const getFileLocaleDataByFileName = (fileName, languagePrefix = 'ch') => {
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
