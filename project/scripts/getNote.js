const fs = require('fs');
const originRequest = require('request');
const iconv = require('iconv-lite');
const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Accept-Encoding': '',
};
const baseUrl = 'https://www.bimilou.org';
function request(url, callback) {
  const options = {
    url: `${baseUrl}${url}`,
    encoding: null,
    headers: headers,
    responseType: 'arraybuffer',
  };
  originRequest(options, callback);
}
let nextPage = '/book/27429/19721443.html';
// let nextPage = '/book/106431/16003159.html';
const getNote = (page) => {
  request(page, function (err, res, body) {
    // console.log(body);
    const html = iconv.decode(body, 'utf-8');
    // console.log(html);
    getContent(html);
    fs.writeFileSync('test1.html', html, { encoding: 'utf-8' });
    const newPage = getNextPage(html);
    if (newPage !== nextPage) {
      // console.log(newPage);
      nextPage = newPage;
      getNote(newPage);
    }
  });
};
if (fs.existsSync('note.txt')) {
  try {
    fs.rmSync('note.txt');
  } catch (rmError) {
    console.error(`删除文件失败:${rmError}`);
    process.exit(1);
  }
}
getNote(nextPage);

const getNextPage = (content) => {
  const start = content.indexOf('章节列表</a>→');
  const end = content.indexOf('下一章</a>');
  const nextButton = content.substring(start + '章节列表</a>→'.length, end);
  console.log(nextButton);
  const urlString = nextButton.split('href="')[1];
  return urlString.split('"')[0];
};

const getContent = (content) => {
  const textStart = content.indexOf('<div id="content" deep="3">');
  const textEnd = content.indexOf('<div align="center">');
  const text = content.substring(
    textStart + '<div id="content" deep="3">'.length,
    textEnd
  );
  const titleStart = content.indexOf('<h1>');
  const titleEnd = content.indexOf('</h1>');
  const title = content.substring(titleStart + '<h1>'.length, titleEnd);
  fs.appendFileSync('note.txt', `${title}\n\n`, {
    encoding: 'utf8',
  });
  fs.appendFileSync('note.txt', text.replaceAll('<br><br>', '\n\n'), {
    encoding: 'utf8',
  });
};
