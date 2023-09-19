const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse');
const lodash = require('lodash');
import { getAllFilePathUsedI18nT } from './localeCommonFunc';

/**
 * 作用：查找语言包中无效的key
 */

let keysData = {};
let currentFileKeys = {};

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
    const fileName = name.split('\\').at(-1);
    keysData[currentKey].unshift(fileName.slice(0, -3));
    keysData[currentKey] = Array.isArray(keysData[currentKey])
      ? keysData[currentKey].join('.')
      : keysData[currentKey];
    const invertData = lodash.invert(keysData);
    currentFileKeys = { ...currentFileKeys, ...invertData };
  }
};

const getKeysByAst = (code, fileName) => {
  traverse.default(code, {
    Property(pa) {
      if (pa.node.value.type === 'StringLiteral' && pa.node.key.name) {
        // const currentKey = `${pa.node.loc?.start?.line}-${pa.node.key.name}`;
        const currentKey = `${fileName},${pa.node.loc?.start?.line}`;
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
        // const currentKey = `${parentNodeKey?.loc?.start?.line}-${parentNodeKey?.value}`;
        const currentKey = `${fileName},${parentNodeKey?.loc?.start?.line}`;
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
          // childrenKeys = `${item?.loc?.start?.line}-${item?.key?.value}`;
          childrenKeys = `${fileName},${item?.loc?.start?.line}`;
          keysData[childrenKeys] = [item?.key?.value];
          getKeysData(pa, childrenKeys, fileName);
        });
      }
      if (pa.node.name) {
        // const currentKey = `${pa.node.loc?.start?.line}-${pa.node.name}`;
        const currentKey = `${fileName},${pa.node.loc?.start?.line}`;
        getKeysData(pa, currentKey, fileName);
      }
    },
  });
};

const getFileLocaleDataByFileName = (fileName, fileSuffix) => {
  const fileContent = fs.readFileSync(fileName).toString();
  keysData = {};
  const code = parser.parse(fileContent, {
    sourceType: 'module',
  });
  getKeysByAst(code, !!fileSuffix ? `${fileName}${fileSuffix}` : fileName);
};

const transformKeys = (directory, filterPath, fileSuffix) => {
  const localeDir = path.resolve(directory);
  const localeFilterPath = path.resolve(filterPath);
  const localeFilePath = getAllFilePathUsedI18nT('useless', localeDir).filter(
    (item) => item !== localeFilterPath
  );
  localeFilePath.forEach((item) =>
    getFileLocaleDataByFileName(item, fileSuffix)
  );
};

transformKeys('./src/locale', './src/locale/index.ts');

const templateLocale = {};

const getNodeTypeAndData = (fileName, argument = [], pa) => {
  argument.forEach((item) => {
    if (item?.type === 'StringLiteral') {
      if (Object.keys(currentFileKeys).includes(item?.value)) {
        delete currentFileKeys[item?.value];
      }
    } else if (
      item?.type === 'Identifier' ||
      item?.type === 'TemplateLiteral' ||
      item?.type === 'MemberExpression' ||
      item?.type === 'LogicalExpression' ||
      item?.type === 'OptionalMemberExpression' ||
      item?.type === 'BinaryExpression'
    ) {
      console.log(`${fileName}----line: ${pa?.node?.loc?.start?.line}\n`);
      templateLocale[fileName] = `line: ${pa?.node?.loc?.start?.line}`;
    }
  });
};

const filterUselessLocale = () => {
  const allFileDirectory = getAllFilePathUsedI18nT('useless');
  allFileDirectory.forEach((fileName) => {
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
            (pa.node.name === 'translate' ||
              pa.node.name === 't' ||
              pa.node.name === 'translation') &&
            pa?.parentPath?.node?.type === 'CallExpression'
          ) {
            // to filter dble LogicLibrary t param
            if (
              pa?.parentPath.parent.type === 'ArrowFunctionExpression' &&
              pa.parentPath.node?.callee?.type === 'MemberExpression'
            ) {
              return;
            }
            const currentNodeArgument = pa?.parentPath?.node?.arguments;
            getNodeTypeAndData(fileName, currentNodeArgument, pa);
          }
        },
      });
    }
  });
};

filterUselessLocale();
console.log(currentFileKeys);
console.log(templateLocale);
console.log(Object.keys(currentFileKeys).length);
