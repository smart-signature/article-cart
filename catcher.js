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
// const formatter = require('html-format');
const pretty = require('pretty');

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

async function parseWechat(id) {
    console.log(`SS-Spider: Loading... trying to catch article ${id} from WeChat`);
    // const biz = '';
    // const mid = '';
    // const idx = '';
    // const sn = '1';
    // const url = `http://mp.weixin.qq.com/mp/rumor?action=info&__biz=${biz}&mid=${mid}&idx=${idx}&sn=${sn}#wechat_redirect`;
    // console.log(url);
    const rawPage = await axios({
        url: `https://mp.weixin.qq.com/s/${id}`,
        method: 'get',
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_0_1 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Mobile/14A403 MicroMessenger/6.5.18 NetType/WIFI Language/zh_CN',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        }
    });
    const parsedPage = htmlparser.parse(rawPage.data);
    // 似乎没办法在一个后面再接一个查？？（查一次， 赋值之后再给另一个查）
    // imgElement是个引用（reference）
    let imgRawUrl, imgUpUrl, imgFileName;
    const imgElement = parsedPage.querySelector('div.rich_media_content').querySelectorAll('img');
    for (let index = 0; index < imgElement.length; index += 1) {
        imgRawUrl = imgElement[index].rawAttributes["data-src"];
        imgFileName = './uploads/today_' + Date.now() + '.' + imgElement[0].rawAttributes["data-type"];
        imgUpUrl = await uploadArticleCover(imgRawUrl, imgFileName);
        // 改rawAttributes似乎是无效的， 实际被填充的是rawAttrs
        // imgElement[index].rawAttributes["data-src"] = config.imageServiceUrl + imgUpUrl;
        // 需要手动赋值..
        // ...
        if (imgUpUrl) {
            // imgElement[index].rawAttrs = imgElement[index].rawAttrs.replace(imgRawUrl, config.imageServiceUrl + imgUpUrl);
            imgElement[index].rawAttrs = imgElement[index].rawAttrs.replace(
                /http[s]?:\/\/mmbiz\.q[a-z]{2,4}\.cn\/mmbiz_[a-z]{1,4}\/[a-zA-Z0-9]{50,100}\/[0-9]{1,4}\??[a-z0-9_=&]{0,100}/g, config.imageServiceUrl + imgUpUrl);
            // 实验性质，调整图片长宽缩放
            imgElement[index].rawAttrs = imgElement[index].rawAttrs.replace(
                /style=\"[a-zA-Z0-9-.!:;%,() ]{0,200}\"/g, 'style="vertical-align: middle;width: 90%;height: 90%;"');
        } else {
            // imgElement[index].rawAttrs = imgElement[index].rawAttrs.replace(imgRawUrl, 'https://ssimg.frontenduse.top/image/2019/08/08/15c08f8da1bc241d6cc5586e93f2c797.png');
            imgElement[index].rawAttrs = imgElement[index].rawAttrs.replace(
                /http[s]?:\/\/mmbiz\.q[a-z]{2,4}\.cn\/mmbiz_[a-z]{1,4}\/[a-zA-Z0-9]{50,100}\/[0-9]{1,4}\??[a-z0-9_=&]{0,100}/g, config.defaultPic);
        }
        // 会不会搞出两个src？
        imgElement[index].rawAttrs = imgElement[index].rawAttrs.replace('data-src', 'src');
        console.log(imgElement[index].rawAttrs);
    }
    // const parsedContent = parsedPage.querySelector('div.rich_media_content').querySelector('section').toString();
    // const parsedContent = parsedPage.querySelector('div.rich_media_content').childNodes.toString();
    let parsedContent = '';
    // 直接to string会有奇怪的逗号
    const parsedContentNodes = parsedPage.querySelector('div.rich_media_content').childNodes;
    for (let index = 0; index < parsedContentNodes.length; index += 1) {
        parsedContent += parsedContentNodes[index].toString();
    }
    // 将HTML改好看一点
    parsedContent = pretty(parsedContent);
    // parsedContent = parsedContent.replace(/\s{5,}/, '');

    const parsedTitleRaw = parsedPage.querySelector('h2.rich_media_title').childNodes[0].rawText;
    let parsedTitle = parsedTitleRaw.replace(/\s+/, '');

    // 提出来之后， script的text不见了？
    // const coverBlock = parsedPage.querySelectorAll('script').childNodes[27].firstChild.data;
    const parsedCoverRaw = rawPage.data.match(/msg_cdn_url = "http:\/\/mmbiz\.qpic\.cn\/mmbiz_jpg\/[0-9a-zA-Z]{10,100}\/0\?wx_fmt=jpeg"/)[0];
    const parsedCover = parsedCoverRaw.substring(15, parsedCoverRaw.length-1);
    // 先不转MARKDOWN吧
    // const turndownService = new turndown();
    // let articleContent = turndownService.turndown(parsedContent.toString());
    // articleContent = articleContent.replace(/\n{2,}/g, '\n');
    console.log(parsedTitle);
    console.log(parsedCover);
    console.log(parsedContent);

    const coverLocation = await uploadArticleCover(parsedCover);

    const articleObj = {
        title: parsedTitle,
        content: parsedContent,
        cover: coverLocation
    };

    const uploadResult = await uploadArticleBody(articleObj);
    if (!uploadResult) {
        return null;
    }

    console.log(`Article ${id} from WeChat process ended...`);
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

// 头图需要作为文章数据结构的一部分
async function uploadArticleCover(url, cacheFile = './uploads/today.jpg') {
    let imageFile;
    let imageUpload = null;
    try {
        imageFile = await downloader.image({
            url,
            dest: cacheFile,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_0_1 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Mobile/14A403 MicroMessenger/6.5.18 NetType/WIFI Language/zh_CN',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            },
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

// parseOrange();
// parseChainnews();
parseWechat('');
// uploadArticleCover('');