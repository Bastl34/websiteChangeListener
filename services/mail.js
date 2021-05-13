/**
 * Mail Service
 */

// Includes
const userConfig = require('../config.user');
const nodemailer = require('nodemailer');
const log = require('./log');

// Config
const mailTransporter = nodemailer.createTransport(`smtps://${encodeURIComponent(userConfig.mail.user)}:${encodeURIComponent(userConfig.mail.pass)}@${userConfig.mail.host}`);

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

module.exports = sendMail;
