/**
 * Core file
 */

// Includes
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const colors = require('colors/safe');
const config = require('./config');
const userConfig = require('./config.user');

// Service includes
const sendToSlack = require('./services/slack');
const sendToTelegram = require('./services/telegram');
const sendMail = require('./services/mail');
const newTorIdentity = require('./services/tor');
const log = require('./services/log');

puppeteer.use(StealthPlugin());

// Config
const TOR_NEW_CIRCUIT_WAIT = 5000;

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
            await sleep(TOR_NEW_CIRCUIT_WAIT);
        }
    }
}

async function exec(watchItem, screenshotPath)
{

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(watchItem.javascript);
    await page.setViewport({ width: config.browserWidth, height: config.browserHeight });
    await page.goto(watchItem.url, { waitUntil: 'networkidle2' });

    // send / set cookies 
    if(userConfig.cookies) {
         await page.setCookie(...userConfig.cookies); 
    }

    const selector = watchItem.xPath || watchItem.selector;

    log(`checking "${watchItem.name}"... `, undefined, false);

    try
    {
        await page.goto(watchItem.url, { timeout: config.websiteTimeout });
    }
    catch(e)
    {
        log('load timeout', colors.yellow);
        await browser.close();
        return false;
    }

    // Headless mode needs a small delay, otherwise content is not fully loaded
    await page.waitForTimeout(500);
    const item = await page.$(selector);

    if (!item)
    {
        log('no content found for xpath/selector', colors.yellow);
        await browser.close();
        return false;
    }

    let htmlContent = await page.evaluate(el => el.innerHTML, item);

    // Screenshot on change
    if (watchItem.lastContent && htmlContent != watchItem.lastContent)
        await item.screenshot({path: screenshotPath});

    await browser.close();

    // Change detected
    if (watchItem.lastContent && htmlContent != watchItem.lastContent)
    {
        log('change detected', colors.rainbow);

        if(watchItem.minValue) {

            if(parseInt(htmlContent.replace(/,/,"")) > parseInt(watchItem.minValue)) {

                log('New price change detected:' + htmlContent, colors.yellow);
            }
        } 

        watchItem.changeDetected = true;
    }
    else
    {
        log('no change');
    }

    // Notify
    if (watchItem.changeDetected)
    {
        try
        {
            const mailAddr = watchItem.mailTo ? watchItem.mailTo : userConfig.mail.to;
            const slackWebhook = watchItem.slackWebhookUrl ? watchItem.slackWebhookUrl : userConfig.slack.webhook;
            const botToken = userConfig.telegram.botToken;
            const botChatId = userConfig.telegram.botChatId;

            const subject = ':rotating_light: *' + watchItem.name + '*: change detected :rotating_light:';
            const message = 'New price change detected: ' + htmlContent;

            if (mailAddr)
                await sendMail(subject, mailAddr, watchItem.name, watchItem.url, screenshotPath);

            if (slackWebhook)
                await sendToSlack(subject, slackWebhook, watchItem.url);

            if(watchItem.minValue) {
  
                if(parseInt(htmlContent.replace(/,/,"")) > parseInt(watchItem.minValue)) {
    
                    if (botToken && botChatId) {
                        await sendToTelegram(botToken, botChatId, message);
                    }
                }
            } 

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

function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () =>
{
    await execForAll();
})();
