// Article cart...
// Can be merged to any other projects...
// July 21 2019

const axios = require('axios');
const htmlparser = require('node-html-parser');
const turndown = require('turndown');
const downloader = require('image-downloader');
const fs = require('fs');
const FormData = require('form-data');
const config = require('./config.json');

const xtoken = config.xtoken;

async function parseOrange(artid) {
    let articleContent = '';
    console.log(`SS-Spider: Loading... trying to catch article ${artid} from Orange.xyz`);
    // Catcher 获取文章， 因平台而异
    const rawPage = await axios.get(`https://orange.xyz/p/${artid}`, {
        method: 'get',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.117 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        }
    });
    // console.log(rawPage);
    console.log(`Article ${artid} catched...`);
    // Parser 处理， 转化为markdown， 因平台而异
    const parsedPage = htmlparser.parse(rawPage.data);
    const parsedTitle = parsedPage.querySelector('div.article-title');
    const parsedContent = parsedPage.querySelector('div.article-content');
    const parsedCover = parsedPage.querySelector('div.img-center-cropped.float-img').rawAttributes.style;
    const coverRe = new RegExp(/url\(\'.*\'\)/);
    const coverUrl = coverRe.exec(parsedCover)[0];
    // for (let index = 0; index < parsedContent.childNodes.length; index += 1) {
    //     articleContent += parsedContent.childNodes[index].toString();
    // }
    const turndownService = new turndown();
    articleContent = turndownService.turndown(parsedContent.toString());
    console.log(`Article ${artid} markdown generated...`);

    const coverLocation = await uploadArticleCover(coverUrl.substring(5, coverUrl.length-2));

    const articleObj = {
        title: parsedTitle.childNodes[0].rawText,
        content: articleContent,
        cover: coverLocation,
    };

    const uploadResult = await uploadArticleBody(articleObj);
    if (!uploadResult) {
        return null;
    }

    console.log(`Article ${artid} from Orange.xyz process ended...`);
}

async function parseChainnews(artid) {
    console.log(`SS-Spider: Loading... trying to catch article ${artid} from Chainnews.com`);
    const rawPage = await axios({
        url: `https://www.chainnews.com/articles/${artid}.htm`,
        method: 'get',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.117 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        }
    });
    console.log(`Article ${artid} catched...`);
    // Parser 处理， 转化为markdown， 因平台而异
    const parsedPage = htmlparser.parse(rawPage.data);
    const parsedContent = parsedPage.querySelector('div.post-content.markdown');
    const parsedTitle = parsedPage.querySelector('h1.post-title');
    const parsedCover = parsedPage.querySelector('head').childNodes[11].rawAttributes.content;
    // const coverRe = new RegExp(//);
    const turndownService = new turndown();
    articleContent = turndownService.turndown(parsedContent.toString());

    const coverLocation = await uploadArticleCover(parsedCover.substring(0, parsedCover.length-6));

    const articleObj = {
        title: parsedTitle.childNodes[0].rawText,
        content: articleContent,
        cover: coverLocation
    };

    const uploadResult = await uploadArticleBody(articleObj);
    if (!uploadResult) {
        return null;
    }

    console.log(`Article ${artid} from Chainnews.com process ended...`);
}

async function uploadArticleBody(articleObj) {
    let draftUpload = null;
    try {
        // 上载至SS草稿箱， 可独立拆开
        draftUpload = await axios({
            url: config.articleUploadUrl,
            method: 'post',
            headers: {
                'x-access-token': xtoken,
            },
            data: {
                title: articleObj.title,
                content: articleObj.content,
                cover: articleObj.cover,
                fissionFactor: 2000,
                isOriginal: 0,
            }
        });
    } catch (e) {
        console.log(e);
        return null;
    }
    console.log(`Article body uploaded...`);
    return draftUpload;
}

async function uploadArticleCover(url) {
    let imageFile;
    let imageUpload = null;
    try {
        imageFile = await downloader.image({
            url,
            dest: './uploads',
        })
    } catch (e) {
        console.log(e);
        return null;
    }
    const formdata = new FormData();
    formdata.append('file', fs.createReadStream(imageFile.filename));
    const requestHeaders = formdata.getHeaders();
    requestHeaders['x-access-token'] = xtoken;
    try {
        imageUpload = await axios({
            url: config.imageUploadUrl,
            method: 'post',
            data: formdata,
            headers: requestHeaders,
        });
        // console.log(imageUpload.data);
    } catch (e) {
        console.log(e);
        return null;
    }
    console.log(`Cover image uploaded at ${imageUpload.data.data.cover}`);
    return imageUpload.data.data.cover;
}

parseOrange();
parseChainnews();