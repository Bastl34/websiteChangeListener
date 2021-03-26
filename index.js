const playwright = require('playwright');

const nodemailer = require('nodemailer');
const axios = require('axios');

const colors = require('colors/safe');

const tr = require('tor-request');

//config
const config = require('./config');
const userConfig = require('./config.user');

const mailTransporter = nodemailer.createTransport(`smtps://${encodeURIComponent(userConfig.mail.user)}:${encodeURIComponent(userConfig.mail.pass)}@${userConfig.mail.host}`);

const TIMEOUT = 25000;
const DEFAULT_BROWSER = 'chromium';

//logging
let lastNewLine = true;

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
    let lastRun = 0;

    while(true)
    {
        await sleep(1000);

        if (lastRun + config.timerInterval > Date.now())
            continue;

        lastRun = Date.now();

        for(let key in userConfig.watcher)
        {
            try
            {
                const watchItem = userConfig.watcher[key];
                const screenshotPath = `screenshot_${key}.png`;
                await exec(watchItem, screenshotPath);
            }
            catch(e)
            {
                log(e, colors.red);
            }
        }
    
        //get a new tor identity
        if (userConfig.tor.use)
        {
            await newTorIdentity();
            await sleep(5000);
        }
    }
}

async function exec(watchItem, screenshotPath)
{
    const options =
    {
        headless: true,
        proxy: userConfig.tor.use ? {server: `socks5://${userConfig.tor.host}:${userConfig.tor.port}` } : undefined
    };

    const browserName = watchItem.browser || DEFAULT_BROWSER;
    const browser = await playwright[browserName].launch(options);
    const context = await browser.newContext({ viewport: { width: config.browserWidth, height: config.browserHeight } });
    const page = await context.newPage();

    const selector = watchItem.xPath || watchItem.selector;

    log(`checking "${watchItem.name}"... `, undefined, false);

    try
    {
        await page.goto(watchItem.url, { timeout: TIMEOUT });
    }
    catch(e)
    {
        log('load timeout', colors.yellow);
        await browser.close();
        return false;
    }

    const item = await page.$(selector);

    if (!item)
    {
        log('no content found for xpath/selector', colors.yellow);
        await browser.close();
        return false;
    }

    let htmlContent = await item.innerHTML();

    //screenshot on change
    if (watchItem.lastContent && htmlContent != watchItem.lastContent)
        await item.screenshot({path: screenshotPath});

    await browser.close();

    //change detected
    if (watchItem.lastContent && htmlContent != watchItem.lastContent)
    {
        watchItem.changeDetected = true;
        log('change detected', colors.rainbow);
    }
    else
    {
        log('no change');
    }

    //notify
    if (watchItem.changeDetected)
    {
        try
        {
            const mailAddr = watchItem.mailTo ? watchItem.mailTo : userConfig.mail.to;
            const slackWebhook = watchItem.slackWebhookUrl ? watchItem.slackWebhookUrl : userConfig.slack.webhook;

            const subject = ':rotating_light: *' + watchItem.name + '*: change detected :rotating_light:';

            if (mailAddr)
                await sendMail(subject, mailAddr, watchItem.name, watchItem.url, screenshotPath);

            if (slackWebhook)
                await sendToSlack(subject, slackWebhook, watchItem.url);

            watchItem.changeDetected = false;
        }
        catch(e)
        {
            log(e, colors.red);
        }
    }

    watchItem.lastContent = htmlContent;

    return true;
}

function sendMail(subject, mailTo, linkName, link, image)
{
    log(' - sending mail... ', undefined, false);
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
                log('failed', colors.red);
            else
                log('done', colors.green);

            if (error)
                reject(error);

            resolve();
        });
    });
}

async function sendToSlack(subject, hookUrl, link)
{
    log(' - sending slack message... ', undefined, false);

    try
    {
        await axios.post(hookUrl ? hookUrl : userConfig.slack.webhook,
        {
            text: subject + '\n' + link,
        });
        log('done', colors.green);
    }
    catch(e)
    {
        log('failed', colors.red);
    }
}

async function newTorIdentity()
{
    log(' - requesting new tor identity... ', undefined, false);

    return new Promise((resolve, reject) =>
    {
        tr.newTorSession((err) =>
        {
            if (err)
            {
                log('failed', colors.red);
                log(err);
            }
            else
                log('done', colors.green);

            if (err)
                reject(err);
            else
                resolve();
        });
    });
}

function log(message, color = undefined, newLine = true)
{
    let date = (new Date()).toLocaleString();

    if (lastNewLine === true)
        message = date + ' ' + message;

    if (color)
        message = color(message);

    if (newLine)
        console.log(message);
    else
        process.stdout.write(message);

    lastNewLine = newLine
}

function sleep(ms) 
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () =>
{
    await execForAll();
})();
