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
