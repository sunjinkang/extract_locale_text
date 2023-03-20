const fs = require('fs');
const path = require('path');
const process = require('process');

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
fs.appendFileSync(pathFile, allFiles.join('\n'), 'utf8');

const file = fs.readFileSync(pathFile, 'utf8');
const fileArr = file.split(/\r?\n/);
fileArr.forEach((fileName) => {
  const current = fs.statSync(fileName);
  if (current.isFile() === true) {
    const lineFile = fs.readFileSync(fileName, 'utf8');
    const arr = lineFile.split(/\r?\n/);
    arr.forEach((line, index) => {
      var match =
        !line.includes('//') && !line.includes('<!--') && !line.includes('*')
          ? line.match(/[\u4e00-\u9faf]+/g)
          : '';
      if (!!match) {
        const localeContent = fs.existsSync(localeFile)
          ? fs.readFileSync(localeFile, 'utf8')
          : '';
        let data = '';
        if (localeContent.includes(fileName)) {
          data = `\nline ${index + 1}: ${match.join('、')}`;
        } else {
          data = `${fs.existsSync(localeFile) ? '\n\n' : ''}${fileName}\nline ${
            index + 1
          }: ${match.join('、')}`;
        }
        fs.appendFileSync(localeFile, data, 'utf8');
      }
    });
  }
});
