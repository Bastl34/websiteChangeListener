const playwright = require('playwright');

const nodemailer = require('nodemailer');
const axios = require('axios');
const moment = require('moment');

const tr = require('tor-request');

//config
const config = require('./config');
const userConfig = require('./config.user');

const mailTransporter = nodemailer.createTransport(`smtps://${encodeURIComponent(userConfig.mail.user)}:${encodeURIComponent(userConfig.mail.pass)}@${userConfig.mail.host}`);

const TIMEOUT = 5000;

//tor
if (userConfig.tor.use)
{
    tr.TorControlPort.host = userConfig.tor.host;
    tr.TorControlPort.password = userConfig.tor.controlPW;
    tr.TorControlPort.port = userConfig.tor.controlPort;

    tr.setTorAddress(userConfig.tor.host, userConfig.tor.port);
}

async function execForAll()
{
    //get a new tor identity first
    if (userConfig.tor.use)
        await newTorIdentity();

    for(let key in userConfig.watcher)
    {
        try
        {
            const watchItem = userConfig.watcher[key];
            const screenshotPath = `screenshot_${key}.png`;
            const res = await exec(watchItem, screenshotPath);

            if (!res && userConfig.tor.use)
                await newTorIdentity();
        }
        catch(e)
        {
            console.error(e);
        }
    }
}

async function exec(watchItem, screenshotPath)
{
    const options =
    {
        headless: false,
        proxy: userConfig.tor.use ? {server: `socks5://${userConfig.tor.host}:${userConfig.tor.port}` } : undefined
    };

    const browserName = watchItem.browser || 'chromium';
    const browser = await playwright[browserName].launch(options);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(watchItem.url);

    const selector = watchItem.xPath || watchItem.selector;

    try
    {
        await page.waitForSelector(selector, {timeout: TIMEOUT});
    }
    catch(e)
    {
        console.warn('no content found for xpath/selector');
        await browser.close();
        return false;
    }

    const item = await page.$(selector);

    process.stdout.write(`${moment().format(userConfig.timeFormat)} checking "${watchItem.name}"... `);

    let htmlContent = await item.innerHTML();

    //screenshot on change
    //if (watchItem.lastContent && htmlContent != watchItem.lastContent)
        await item.screenshot({path: screenshotPath});

    await browser.close();

    //change detected
    if (watchItem.lastContent && htmlContent != watchItem.lastContent)
    {
        process.stdout.write(`change detected`);
        watchItem.changeDetected = moment().format(userConfig.timeFormat);
        console.log();
    }
    else
    {
        process.stdout.write(`(no change)`);
        console.log();
    }

    //notify
    if (watchItem.changeDetected)
    {
        try
        {
            const subject = 'Website change detected for ' + watchItem.name + ' (' + watchItem.changeDetected + ')';

            const mailAddr = watchItem.mailTo ? watchItem.mailTo : userConfig.mail.to;
            const slackWebhook = watchItem.slackWebhookUrl ? watchItem.slackWebhookUrl : userConfig.slack.webhook;

            if (mailAddr)
                await sendMail(subject, mailAddr, watchItem.name, watchItem.url, screenshotPath);

            if (slackWebhook)
                await sendToSlack(subject, slackWebhook, watchItem.url);

            watchItem.changeDetected = false;
        }
        catch(e)
        {
            console.error(e);
        }
    }

    watchItem.lastContent = htmlContent;

    return true;
}

function sendMail(subject, mailTo, linkName, link, image)
{
    console.log('sending mail...');
    let mailContent = `
        <html>
            <head />
            <body style="font-family:verdana, sans-serif;">
            --&gt; <a href="${link}">${linkName}</a>
            <br>
            <a href="${link}">
                <img src="cid:IMAGE"/>
            </a>
            </body>
        </html>
    `;

    let mail =
    {
        subject:subject,
        html: mailContent,
        from: userConfig.mail.from,
        to: mailTo,
        attachments:
        [{
            filename: image,
            path: image,
            cid: 'IMAGE'
        }]
    };

    return new Promise((resolve, reject) =>
    {
        mailTransporter.sendMail(mail, (error, info) =>
        {
            if (error)
                console.warn('could not send eMail');
            else
                console.log('eMail sent: ' + info.response);

            if (error)
                reject(error);

            resolve();
        });
    });
}

async function sendToSlack(subject, hookUrl, link)
{
    console.log('sending slack message...');
    return axios.post(hookUrl ? hookUrl : userConfig.slack.webhook,
    {
        text: subject + '\n' + link,
    });
}

async function newTorIdentity()
{
    process.stdout.write('requesting new tor identity...');

    return new Promise((resolve, reject) =>
    {
        tr.newTorSession((err) =>
        {
            if (err)
            {
                console.log(' error');
                console.log(err);
            }
            else
                console.log(' done');

            if (err)
                reject(err);
            else
                resolve();
        });
    });
}

(async () =>
{
    await execForAll();
})();

setInterval(execForAll, config.timerInterval);
