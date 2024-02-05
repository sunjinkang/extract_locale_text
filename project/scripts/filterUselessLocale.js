const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse');
const lodash = require('lodash');
const localeCommonFunc = require('./localeCommonFunc');

/**
 * 作用：
 * 1. 查找语言包中无效的key
 * 2. 输出项目中语言包使用模板字符串的代码位置
 */

/**
 * localeFileKeysMappingData 是语言包中的key数据，比如：
 * {
 * 'xxxxx\ch-language\\AlertConfig.ts,11': 'AlertConfig.components.Modal.data.inhibitionGroupTag',
 * }
 */
let localeFileKeysMappingData = {};

/**
 * localeKeysFileMappingData 是翻转后的key数据，比如：
 * {
 * 'AlertConfig.components.Modal.data.inhibitionGroupTag': 'xxxxx\ch-language\\AlertConfig.ts,11',
 * }
 */
let localeKeysFileMappingData = {};

const logger = localeCommonFunc.addProcessLog();

const getKeysData = (pa, currentKey, name) => {
  if (Object.keys(localeFileKeysMappingData).includes(currentKey)) {
    localeCommonFunc.getAllParentPath(
      pa,
      localeFileKeysMappingData[currentKey]
    );
    const fileName = name.split('\\').at(-1);
    localeFileKeysMappingData[currentKey].unshift(fileName.slice(0, -3));
    localeFileKeysMappingData[currentKey] = Array.isArray(
      localeFileKeysMappingData[currentKey]
    )
      ? localeFileKeysMappingData[currentKey].join('.')
      : localeFileKeysMappingData[currentKey];
    const invertData = lodash.invert(localeFileKeysMappingData);
    localeKeysFileMappingData = {
      ...localeKeysFileMappingData,
      ...invertData,
    };
  }
};

const getFileLocaleDataByFileName = (fileName) => {
  localeFileKeysMappingData = {};
  logger.info(`get file locale data from: ${fileName}`);
  localeCommonFunc.transformCodeByAst(
    fileName,
    {
      Property(pa) {
        if (pa.node.value.type === 'StringLiteral' && pa.node.key.name) {
          const currentKey = `${fileName},${pa.node.loc?.start?.line}`;
          localeFileKeysMappingData[currentKey] = [];
        }
      },
      StringLiteral(pa) {
        const parentNodeKey = pa?.parentPath?.node?.key;
        if (
          parentNodeKey?.value &&
          pa.parentPath?.parentPath.parentPath.node.type ===
            'ExportDefaultDeclaration'
        ) {
          const currentKey = `${fileName},${parentNodeKey?.loc?.start?.line}`;
          localeFileKeysMappingData[currentKey] = [];
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
            childrenKeys = `${fileName},${item?.loc?.start?.line}`;
            localeFileKeysMappingData[childrenKeys] = [item?.key?.value];
            getKeysData(pa, childrenKeys, fileName);
          });
        }
        if (pa.node.name) {
          const currentKey = `${fileName},${pa.node.loc?.start?.line}`;
          getKeysData(pa, currentKey, fileName);
        }
      },
    },
    false
  );
};

const transformKeys = (directory, filterPath) => {
  logger.info('start to transform key data from locale directory');
  const localeDir = path.resolve(directory);
  const localeFilterPath = path.resolve(filterPath);
  const localeFilePath = localeCommonFunc
    .getAllFilePathUsedI18nT('notCompare', localeDir)
    .filter((item) => item !== localeFilterPath);
  localeFilePath.forEach((item) => getFileLocaleDataByFileName(item));
};

transformKeys('./src/locale', './src/locale/index.ts');

// 语言包中使用模板字符串的位置
const templateLocale = {};

const getNodeTypeAndData = (fileName, argument = [], pa) => {
  argument.forEach((item) => {
    if (item?.type === 'StringLiteral') {
      if (Object.keys(localeKeysFileMappingData).includes(item?.value)) {
        delete localeKeysFileMappingData[item?.value];
      }
    } else if (
      item?.type === 'Identifier' ||
      item?.type === 'TemplateLiteral' ||
      item?.type === 'MemberExpression' ||
      item?.type === 'LogicalExpression' ||
      item?.type === 'OptionalMemberExpression' ||
      item?.type === 'BinaryExpression'
    ) {
      logger.info(`${fileName}----line: ${pa?.node?.loc?.start?.line}\n`);
      templateLocale[fileName] = `line: ${pa?.node?.loc?.start?.line}`;
    }
  });
};

const filterUselessLocale = () => {
  const allFileDirectory =
    localeCommonFunc.getAllFilePathUsedI18nT('notCompare');
  allFileDirectory.forEach((fileName) => {
    const current = fs.statSync(fileName);
    if (current.isFile() === true) {
      localeFileKeysMappingData = {};
      nameKeys = [];
      logger.info(`filter useless locale from: ${fileName}`);
      localeCommonFunc.transformCodeByAst(
        fileName,
        {
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
        },
        false
      );
    }
  });
};

logger.info('start to filter useless locale!');
filterUselessLocale();

// localeKeysFileMappingData 为无效的语言包key，需要注意：由于一些历史原因，可能某些地方的语言包key是使用模板字符串拼接的，导致一些实际被使用的key出现在下面的无效key中，如果要删除语言包的key，建议手动在项目中检查后再删除
logger.info(
  `This is useless locale data for locale: ${localeKeysFileMappingData}`
);
// templateLocale 为项目中使用 模板字符串的地方，输出格式为：文件地址----行数
logger.info(`This is template string for locale: ${templateLocale}`);
