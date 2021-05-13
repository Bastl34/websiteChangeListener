/**
 * Telegram Service
 */

// Includes
const axios = require('axios');
const log = require('./log');
const colors = require('colors/safe');

async function sendToTelegram(botToken, botChatID, message) {
    
    if (botToken && botChatID) {
        let url = 'https://api.telegram.org/bot' + botToken +
            '/sendMessage?chat_id=' + botChatID + '&parse_mode=Markdown&text=' + message;
        try
        {
            await axios.post(url);
            log('Telegram message send', colors.green);
        }
        catch(e)
        {
            log('Telegram message failed', colors.red);
        }
    }
}

module.exports = sendToTelegram;
