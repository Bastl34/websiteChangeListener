const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const moment = require('moment');

//config
const config = require('./config');
const userConfig = require('./config.user');

const mailTransporter = nodemailer.createTransport(`smtps://${encodeURIComponent(userConfig.mail.user)}:${encodeURIComponent(userConfig.mail.pass)}@${userConfig.mail.host}`);

async function execForAll()
{
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
            console.error(e);
        }
    }
}

async function exec(watchItem, screenshotPath)
{
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(watchItem.javascript);
    await page.setViewport({ width: config.browserWidth, height: config.browserHeight });
    await page.goto(watchItem.url, { waitUntil: 'networkidle2' });

    await page.waitForXPath(watchItem.xPath);
    let content = await page.$x(watchItem.xPath);

    process.stdout.write(`${moment().format("YYYY-MM-DD HH:mm:ss")} checking "${watchItem.name}"... `);

    if (!content || content.length == 0)
    {
        console.warn('no content found for xpath');
        return;
    }
    const item = content[0];

    let htmlContent = await page.evaluate(el => el.innerHTML, item);

    //screenshot on change
    if (watchItem.lastContent && htmlContent != watchItem.lastContent)
        await item.screenshot({path: screenshotPath});

    await browser.close();

    //send mail
    if (watchItem.lastContent && htmlContent != watchItem.lastContent)
    {
        process.stdout.write(`change detected`);
        console.log();
        sendMail("Website change detected for " + watchItem.name, watchItem.mailTo, watchItem.name, watchItem.url, screenshotPath);
    }
    else
    {
        process.stdout.write(`(no change)`);
        console.log();
    }
    watchItem.lastContent = htmlContent;
}

function sendMail(subject, mailTo, linkName, link, image, callback)
{
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
        to: mailTo ? mailTo : userConfig.mail.to,
        attachments:
        [{
            filename: image,
            path: image,
            cid: 'IMAGE'
        }]
    };

	mailTransporter.sendMail(mail, function(error, info)
	{
		if(error)
			console.warn('could not send eMail',"eMail",error);
		else
			console.log('eMail sent: ' + info.response);

		if (callback)
			callback(error);
    });
}


(async () =>
{
    await execForAll();
})();

setInterval(execForAll, config.timerInterval);
