/**
 * Tor Service
 */

// Includes
const tr = require('tor-request');
const userConfig = require('../config.user');
const colors = require('colors/safe');
const log = require('./log');

// Config
if (userConfig.tor.use)
{
    tr.TorControlPort.host = userConfig.tor.host;
    tr.TorControlPort.password = userConfig.tor.controlPW;
    tr.TorControlPort.port = userConfig.tor.controlPort;

    tr.setTorAddress(userConfig.tor.host, userConfig.tor.port);
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

module.exports = newTorIdentity;
