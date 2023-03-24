const fs = require('fs');
const path = require('path');
const process = require('process');
const traverse = require('@babel/traverse');
const parser = require('@babel/parser');

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
    if (current.isDirectory() === true) {
      allFile.push(filePath);
      getFilePath(filePath, allFile);
    }
    if (current.isFile() === true) {
      allFile.push(filePath);
    }
  });
};

const currentDir = path.resolve(
  __dirname,
  '../../project/filter_project_locale'
);
const storeDir = path.resolve(__dirname, '../../project/scripts');

const allFiles = getDirAllFile(currentDir);

const pathFile = path.resolve(storeDir, './path.txt');
const localeFile = path.resolve(storeDir, './locale.txt');

const fileSet = [pathFile, localeFile];

for (const key of fileSet) {
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

const detectChinese = (text) => {
  return /[\u4e00-\u9fa5]/.test(text);
};

const file = fs.readFileSync(pathFile, 'utf8');
const fileArr = file.split(/\r?\n/);
fileArr.forEach((fileName) => {
  const current = fs.statSync(fileName);
  if (current.isFile() === true) {
    const lineFile = fs.readFileSync(fileName).toString();

    const code = parser.parse(lineFile, {
      sourceType: 'module',
      // plugins: ['json', 'html', 'js'],
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'syntax-import-meta'],
    });
    traverse.default(code, {
      Property(pa) {
        console.log(pa.node.key);
        console.log(pa.node.value);
        const test = detectChinese(pa.node.key.name || pa.node.value.value);
        if (test) {
          const info = `${pa.node.key.name || pa.node.value.value}\nline: ${
            pa.node.loc.start.line
          }`;
          fs.appendFileSync(localeFile, info);
        }
      },
    });

    // const arr = lineFile.split(/\r?\n/);
    // arr.forEach((line, index) => {
    //   var match =
    //     !line.includes('//') && !line.includes('<!--') && !line.includes('*')
    //       ? line.match(/[\u4e00-\u9faf]+/g)
    //       : '';
    //   if (!!match) {
    //     const localeContent = fs.existsSync(localeFile)
    //       ? fs.readFileSync(localeFile)
    //       : '';
    //     let data = '';
    //     if (localeContent.includes(fileName)) {
    //       data = `\nline ${index + 1}: ${match.join('、')}`;
    //     } else {
    //       data = `${fs.existsSync(localeFile) ? '\n\n' : ''}${fileName}\nline ${
    //         index + 1
    //       }: ${match.join('、')}`;
    //     }
    //     fs.appendFileSync(localeFile, data);
    //   }
    // });
  }
});
