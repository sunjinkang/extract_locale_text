const fs = require('fs');

const getDirAllFile = (dir) => {
  const allFile = [];
  getFilePath(dir, allFile);
  return allFile;
};

const getFilePath = (dir, allFile) => {
  const dirFiles = fs.readdirSync(dir);
  dirFiles.forEach((item) => {
    console.log(item);
    const filePath = fs.join(dir, item);
    const current = fs.statSync(filePath);
    if (current.isDirectory) {
      getFilePath(current);
    }
    if (current.isFile) {
      allFile.push(current);
    }
  });
};
