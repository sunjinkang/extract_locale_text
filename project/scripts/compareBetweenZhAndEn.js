const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse');

/**
 * 作用：对比中英文文件，查找是否存在中英文key不一致，存在数据缺失
 *    1、先对比中文目录和英文目录下的文件是否一致
 *        1.1 缺失中文文件时打印输出文件名称
 *        1.2 缺失英文文件时复制对应的中文文件到英文目录下
 *    2、以中文目录为基准遍历文件
 *        2.1 遍历文件中的key，并查找在英文目录下相同文件的相同父级key下是否存在相同的key，如不存在，将缺失的数据在英文文件中的key和行号打印输出
 *    3、以英文目录为基准遍历文件
 *        3.1 遍历文件中的key，并查找在中文目录下相同文件的相同父级key下是否存在相同的key，如不存在，将缺失的数据复制到英文目录下相同文件的相同父级key下对应位置
 */

const localePrefix = { ch: 'en', en: 'ch' };

const getCurrentLocaleFile = (filePrefix, name) => {
  if (!name)
    return path.resolve(__dirname, `../src/locale/${filePrefix}-language`);
  return path.resolve(
    __dirname,
    `../src/locale/${filePrefix}-language/${name}`
  );
};

const getFilePath = (dir, allFile) => {
  const dirFiles = fs.readdirSync(dir);
  dirFiles.forEach((item) => {
    const filePath = path.join(dir, item);
    const current = fs.statSync(filePath);
    if (current.isDirectory() === true) {
      getFilePath(filePath, allFile);
    }
    if (current.isFile() === true) {
      allFile.push(filePath);
    }
  });
};

const getDirectoryFile = (directory) => {
  const allFile = [];
  getFilePath(directory, allFile);
  return allFile;
};

const compareMissFileAndCopy = (originFiles, compareFiles, type) => {
  const missFiles = compareFiles.filter((item) => {
    const fileName = item.split('\\');
    const compareName = getCurrentLocaleFile(
      type,
      fileName[fileName.length - 1]
    );
    return !originFiles.includes(compareName);
  });
  if (missFiles?.length) {
    missFiles.forEach((item) => {
      const fileName = item.split('\\');
      if (type === 'en') {
        fs.copyFile(
          item,
          getCurrentLocaleFile(type, fileName[fileName.length - 1]),
          (err) => {
            if (err) console.log(`复制文件失败: ${err}`);
          }
        );
      } else {
        console.log(`缺失对应中文文件: ${item}`);
      }
    });
  }
};

const compareLocale = () => {
  Object.keys(localePrefix).forEach((item) => {
    const currentFiles = getDirectoryFile(getCurrentLocaleFile(item));
    const otherFiles = getDirectoryFile(
      getCurrentLocaleFile(localePrefix[item])
    );
    compareMissFileAndCopy(currentFiles, otherFiles, item);
  });
};

compareLocale();
