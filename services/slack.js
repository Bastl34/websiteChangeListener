/**
 * Slack Service
 */

// Includes
const axios = require('axios');
const log = require('./log');
const colors = require('colors/safe');

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

module.exports = sendToSlack;
