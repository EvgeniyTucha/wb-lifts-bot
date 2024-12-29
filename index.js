const puppeteer = require('puppeteer-extra');
require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const {delay, logStep, debug} = require('./utils');
const {
    siteInfo,
    IS_PROD,
    NEXT_SCHEDULE_POLL_MIN
} = require('./config');
const {th} = require("date-fns/locale");
const config = require("./config");

const typeToEmoji = {
    gondola: "🚠",
    six: "🚡",
    eight: "🚡",
    quad: "🚡",
    triple: "🚡"
};

const botToken = config.telegram.NOTIFY_TG_TOKEN;
const chatId = config.telegram.NOTIFY_TG_CHAT_ID;
const bot = new TelegramBot(botToken, {polling: true});

const sendTelegramNotification = async (message) => {
    bot.sendMessage(chatId, message)
        .then(() => console.log('Notification sent!'))
        .catch((err) => console.error('Error sending notification:', err));
};

const process = async () => {
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
    const browser = await puppeteer.launch(!IS_PROD ? {headless: false} : {args: ['--no-sandbox', '--disable-setuid-sandbox']});

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        const response = await page.goto(siteInfo.WB_URL);
        console.log(response.status());
        console.log(response.headers());

        // Extract data
        const lifts = await page.evaluate(() => {
            const results = [];
            // Select the parent element for each lift
            const liftContainers = document.querySelectorAll('.liftStatus__lifts__row'); // Adjust selector to match lift structure

            liftContainers.forEach(lift => {
                const name = lift.querySelector('.liftStatus__lifts__row__title')?.innerText.trim(); // Adjust selector for lift name
                const srOnlyDivs = lift.querySelectorAll('.sr-only');

                if (srOnlyDivs.length === 2) {
                    const type = srOnlyDivs[0]?.innerText.trim();
                    const status = srOnlyDivs[1]?.innerText.trim();

                    results.push({name, type, status});
                }
            });

            return results;
        });

        const filePath = './lifts_state.json';

        const fileData = fs.readFileSync(filePath, "utf8");
        let lastLiftsState;
        if (fileData !== '') {
            lastLiftsState = JSON.parse(fileData);
        } else {
            lastLiftsState = [];
        }

        const diff = findDifference(lifts, lastLiftsState);

        let liftsJson = JSON.stringify(lifts, null, 2);

        fs.writeFileSync(filePath, liftsJson, "utf8");

        logStep(JSON.stringify(diff, null, 2));

        if (diff.length > 0) {
            let message = new Date().toLocaleString() + '\n';
            for (let i = 0; i < diff.length; i++) {
                message += getEmojiForType(diff[i].type) + diff[i].name + ' is now ' + diff[i].status + '\n'
            }
            await sendTelegramNotification(message);
        }

        await browser.close();

    } catch (err) {
        console.error(err);
        await sendTelegramNotification(`Huston we have a problem: ${err}`);
    }

    await browser.close();

    logStep(`Sleeping for ${NEXT_SCHEDULE_POLL_MIN} minutes`)

    await delay(NEXT_SCHEDULE_POLL_MIN)

    await process()
}

function isEqual(obj1, obj2) {
    return obj1.name === obj2.name && obj1.status === obj2.status;
}

function findDifference(arr1, arr2) {
    return arr1.filter(item1 => !arr2.some(item2 => isEqual(item1, item2)));
}

function getEmojiForType(type) {
    return typeToEmoji[type] || "❓"; // Default to ❓ if type is unknown
}

(async () => {
    try {
        await process();
    } catch (err) {
        console.error(err);
    }
})();