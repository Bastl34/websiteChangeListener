/**
 * Logging Service
 */

// Variables
let lastNewLine = true;

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

module.exports = log;
