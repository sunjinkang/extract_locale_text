const fs = require('fs');
const localeCommonFunc = require('./localeCommonFunc');
const lodash = require('lodash');
const t = require('@babel/types');
const generate = require('@babel/generator').default;

/**
 * 作用：
 * 1. 对比中英文文件，查找是否存在中英文文件不一致，若存在文件缺失，进行复制
 * 2. 对比中英文文件内容，打印缺少对应中英文的语言包位置，并复制对应中英文到缺少的文件中，打印格式：
 *    文件夹----文件位置：行号-语言包key
 *
 * 注意：建议优先处理其他的语言包问题，否则可能导致未知错误。
 */

const logger = localeCommonFunc.addProcessLog();

const getDirectoryFile = (directory) => {
  return localeCommonFunc.getAllFilePathUsedI18nT('compare', directory);
};

const compareMissFileAndCopyMissFile = (originFiles, compareFiles, type) => {
  const missFiles = compareFiles.filter((item) => {
    const fileName = item.split('\\');
    const compareName = localeCommonFunc.getCurrentLocaleFile(
      type,
      fileName[fileName.length - 1],
      false
    );
    return !originFiles.includes(compareName);
  });
  if (missFiles?.length) {
    missFiles.forEach((item) => {
      const fileName = item.split('\\');
      logger.error(
        `缺失对应${type === 'en' ? '英' : '中'}文文件: ${
          fileName[fileName.length - 1]
        }`
      );
      fs.copyFile(
        item,
        localeCommonFunc.getCurrentLocaleFile(
          type,
          fileName[fileName.length - 1],
          false
        ),
        (err) => {
          if (err) logger.error(`复制文件失败: ${err}`);
        }
      );
    });
  }
};

const createMissKeyData = (paData, missValue, missKeyArray) => {
  const currentNodeKey = paData?.node?.key;
  const parentNodeKey = paData?.parentPath?.parent?.key;
  const currentKey = missKeyArray?.[missKeyArray.length - 2];
  const parentKey = missKeyArray?.[missKeyArray.length - 3];
  const hasCurrentKey =
    missKeyArray.length >= 2
      ? currentNodeKey?.type === 'Identifier' &&
        currentNodeKey?.name === currentKey
      : true;
  const hasParentKey =
    missKeyArray.length >= 3
      ? parentNodeKey?.type === 'Identifier' &&
        parentNodeKey?.name === parentKey
      : true;
  const isRightParentKey = hasCurrentKey && hasParentKey;
  const isAtFirstLevel = missKeyArray.length === 1;
  if (isAtFirstLevel || isRightParentKey) {
    logger.info(`current miss key value: ${missValue}`);
    const newProperty = t.objectProperty(
      t.identifier(missKeyArray[missKeyArray.length - 1]),
      t.stringLiteral(missValue)
    );
    const currentProperties = isAtFirstLevel
      ? paData?.node?.declaration?.properties
      : paData?.node?.value?.properties;
    if (Array.isArray(currentProperties)) {
      currentProperties.push(newProperty);
    }
  }
};

const copyMissKeyDataByAst = (fileName, missValue, missKey) => {
  const missKeyArray = missKey.split('.').slice(2);
  // 有一种情况需要注意：如果当前语言包key的父级节点都不存在，控制台会打印缺少对应语言包数据，但暂时无法复制
  const code = localeCommonFunc.transformCodeByAst(
    fileName,
    {
      Property(pa) {
        if (missKeyArray.length > 1) {
          createMissKeyData(pa, missValue, missKeyArray);
        }
      },
      ExportDefaultDeclaration(pa) {
        if (missKeyArray.length === 1) {
          createMissKeyData(pa, missValue, missKeyArray);
        }
      },
    },
    true
  );
  const result = generate(code, { jsescOption: { minimal: true } }, '').code;
  fs.writeFileSync(fileName, result);
};

const getCorrespondDirectory = (filPath, isCheckCh) => {
  return isCheckCh
    ? filPath?.replace('en-language', 'ch-language')
    : filPath?.replace('ch-language', 'en-language');
};

const compareFileContent = (originFiles) => {
  try {
    originFiles.forEach((item) => {
      const filePathArray = item.split('\\');
      const fileName = filePathArray[filePathArray.length - 1];
      let chKeysData = {};
      let enKeysData = {};
      localeCommonFunc.getKeyDataFromLocaleFile(
        chKeysData,
        fileName,
        'ch-language',
        false,
        true
      );
      chKeysData = lodash.invert(chKeysData);
      localeCommonFunc.getKeyDataFromLocaleFile(
        enKeysData,
        fileName,
        'en-language',
        false,
        true
      );
      enKeysData = lodash.invert(enKeysData);
      Object.keys(chKeysData).forEach((keyItem) => {
        if (!Object.keys(enKeysData).includes(keyItem)) {
          const missContentFileName = getCorrespondDirectory(
            item,
            !item?.includes('ch-language')
          );
          logger.error(
            `miss ch key data in en-language directory corresponding position: ----${getCorrespondDirectory(
              item,
              item?.includes('ch-language')
            )}: ${chKeysData[keyItem]}`
          );
          const localeValue = chKeysData[keyItem].split(
            localeCommonFunc.keyAndValueSeparateCode
          )?.[1];
          copyMissKeyDataByAst(missContentFileName, localeValue, keyItem);
        } else {
          delete enKeysData[keyItem];
        }
      });
      Object.keys(enKeysData).forEach((keyItem) => {
        const missContentFileName = getCorrespondDirectory(
          item,
          item?.includes('ch-language')
        );
        logger.error(
          `miss en key data in ch-language directory corresponding position: ----${missContentFileName}: ${enKeysData[keyItem]}`
        );
        const localeValue = enKeysData[keyItem].split(
          localeCommonFunc.keyAndValueSeparateCode
        )?.[1];
        copyMissKeyDataByAst(missContentFileName, localeValue, keyItem);
      });
    });
  } catch (error) {
    logger.error(`failed to compare locale file content. Error: ${error}!`);
  }
};

const excuteCompareAndCopy = () => {
  // 语言包文件夹
  const localeDirectory = {
    'ch-language': 'en-language',
    'en-language': 'ch-language',
  };
  Object.keys(localeDirectory).forEach((item) => {
    const currentFiles = getDirectoryFile(
      localeCommonFunc.getCurrentLocaleFile(item)
    );
    const otherFiles = getDirectoryFile(
      localeCommonFunc.getCurrentLocaleFile(localeDirectory[item])
    );
    logger.info(`start to check directory: ${item}`);
    compareMissFileAndCopyMissFile(currentFiles, otherFiles, item);
  });
};

const compareFileBetweenZhAndEn = () => {
  logger.info('start to compare file between zh-language and en-language');
  // 对比中英文文件是否存在缺失，若缺失英文文件，复制对应的中文文件到英文文件夹，反之同样
  excuteCompareAndCopy();
  // 对比中英文文件内容，打印缺少对应中英文的语言包位置
  const currentFiles = getDirectoryFile(
    localeCommonFunc.getCurrentLocaleFile('ch-language')
  );
  compareFileContent(currentFiles);
};

compareFileBetweenZhAndEn();
