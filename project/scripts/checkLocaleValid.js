const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse');
const parser = require('@babel/parser');

const localePath =
  'diagnosis.diagnosisReport.reportContent.highlyAvailableConfiguration.uguardStatus.statusDisabled';

const localePathParams = localePath.split('.');
const fileName = `${localePathParams[0]}.ts`;
const localeFilePath = path.resolve(__dirname, `../locale/${fileName}`);
const parentKey = localePathParams[localePathParams.length - 2];
const currentKey = localePathParams[localePathParams.length - 1];

const checkLocaleValid = () => {
  const fileContent = fs.existsSync(localeFilePath)
    ? fs.readFileSync(localeFilePath).toString()
    : '';
  const code = parser.parse(fileContent, {
    sourceType: 'module',
    plugins: ['typescript', 'decorators-legacy', 'syntax-import-meta'],
  });
  traverse.default(code, {
    ObjectProperty(pa) {
      if (pa.node.key.name === parentKey) {
        const children = pa.node.value.properties;
        if (Array.isArray(children) && children.length) {
          const hasCurrentKey = !!children.find(
            (item) => item.key.name === currentKey
          );
          if (!hasCurrentKey) console.log(localePath);
        }
      }
    },
  });
};

checkLocaleValid();

// 待解决难点：
// 1、怎么从代码里面找语言的路径代码？

// 2、有一些是模板字符串的路径怎么处理？
// 代码执行的时候，直接打印输出，手动处理

// 3、只使用最后两个key进行校验是否不严谨？
// 强烈不建议只使用最后两个key，可以先遍历语言包文件，获取所有的key，然后再将代码中的key与所有的key进行比较，查看代码中的key在语言包中是否存在对应文字
