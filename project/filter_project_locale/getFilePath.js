const fs = require('fs');
const path = require('path');

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

const currentDir = path.resolve(__dirname, '../../project');
const allFiles = getDirAllFile(currentDir);
let isFileExist;
try {
  isFileExist = fs.accessSync('path.txt', fs.constants.F_OK);
} catch (error) {
  console.log(error);
  isFileExist = true;
}
console.log(isFileExist);
if (!isFileExist) {
  try {
    fs.rmSync('path.txt');
  } catch (rmError) {
    console.log(`删除文件失败:${rmError}`);
  }
}
fs.appendFile('path.txt', allFiles.join('\n'), 'utf8', (err) => {
  if (err) throw err;
  console.log('The "data to append" was appended to file!');
});
