const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse');
const localeCommonFunc = require('./localeCommonFunc');

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
 *        (3) 格式3：t(`${name}.test`)，该格式暂无法获取语言包key，直接输出到文件 notStringForLocale.txt 中进行手动对比处理，格式：[文件路径]: line[行号](获取对应语言包key失败)
 *        (4) 格式4：t(save)，与格式3处理相同
 *        (5) 格式5：与以上四种格式类似，使用translate替换 t，处理方式参考对应格式
 *        PS: 通过节点名称是否为 t 获取key时，需要注意部分代码中存在 t ，举例：C:\Users\sunji\Desktop\actionCode\umc-ui\src\page\DBLEConfig\DBLEConfigV6\LogicLibrary\index.tsx
 *
 *    2、步骤3.1中，部分语言包的文件中存在特殊格式的数据结构，需要特殊处理：
 *        (1) 文件中存在数组结构，举例：C:\Users\sunji\Desktop\actionCode\umc-ui\src\locale\ch-language\formRules.ts
 *        (2) 文件中key为中划线连接的字符串，举例：C:\Users\sunji\Desktop\actionCode\umc-ui\src\locale\ch-language\button.ts
 */

/**
 * 语言包中key的数据，比如：
 * {
 *  '2-execute': 'commonGenerator.execute',
 * }
 */
let keysData = {};
/**
 * 语言包文件名，用于过滤当前文件
 */
let nameKeys = [];

const logger = localeCommonFunc.addProcessLog();

// store files directory
const storeDir = path.resolve(__dirname, './');

const notStringForLocale = path.resolve(storeDir, './notStringForLocale.txt');

const filterMissLocale = (file, key) => {
  const localeFileName = key?.split('.')?.[0];
  if (
    !localeCommonFunc.detectChinese(localeFileName) &&
    !nameKeys.includes(localeFileName)
  ) {
    nameKeys.push(localeFileName);
    // 通过当前文件名获取对应的语言包key数据，进行对比。注意：以下对比仅对ch-language文件夹下的数据进行了对比，如需对比英文修改参数为英文文件夹名称即可
    localeCommonFunc.getKeyDataFromLocaleFile(
      keysData,
      localeFileName,
      'ch-language',
      true,
      false
    );
  }
  if (!Object.values(keysData).includes(key)) {
    logger.error(`${file}-----${key}`);
  }
};

const getNodeTypeAndData = (fileName, argument = [], pa) => {
  argument.forEach((item) => {
    if (item?.type === 'StringLiteral') {
      logger.info(`find miss locale from ${fileName}`);
      filterMissLocale(fileName, item?.value);
    } else if (
      item?.type === 'Identifier' ||
      item?.type === 'TemplateLiteral' ||
      item?.type === 'MemberExpression' ||
      item?.type === 'LogicalExpression' ||
      item?.type === 'OptionalMemberExpression' ||
      item?.type === 'BinaryExpression'
    ) {
      // 使用模板字符串等无法识别的语言包位置
      fs.appendFileSync(
        notStringForLocale,
        `${fileName}----line: ${pa?.node?.loc?.start?.line}\n`
      );
    }
  });
};

const checkMissKeyDataInLocaleFile = () => {
  // path.txt 暂存项目中的需要筛选的文件路径，筛选完成后删除
  const pathFile = path.resolve(storeDir, './path.txt');

  // all need filter files path data
  const allFiles = localeCommonFunc.getAllFilePathUsedI18nT('notCompare');

  localeCommonFunc.deleteFiles([pathFile, notStringForLocale]);
  fs.writeFileSync(pathFile, allFiles.join('\n'));

  const file = fs.readFileSync(pathFile, 'utf8');
  const fileArr = file.split(/\r?\n/);
  fileArr.forEach((fileName) => {
    const current = fs.statSync(fileName);
    if (current.isFile() === true) {
      keysData = {};
      nameKeys = [];
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
              (pa.node.name === 'translate' || pa.node.name === 't') &&
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

  localeCommonFunc.deleteFiles([pathFile]);
};

logger.trace('start to check miss key data in locale file');
checkMissKeyDataInLocaleFile();
