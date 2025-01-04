const puppeteer = require('puppeteer-extra');
require('dotenv').config();
const fs = require('fs');
const {format} = require('date-fns')
const TelegramBot = require('node-telegram-bot-api');
const dateFormat = 'dd-MM-yyyy HH:mm';

const {delay, logStep, debug} = require('./utils');
const {
    siteInfo,
    IS_PROD,
    NEXT_SCHEDULE_POLL_MIN,
    SLEEP_HOUR,
    WAKEUP_HOUR
} = require('./config');
const config = require("./config");

const typeToEmoji = {
    gondola: "🚠",
    six: "🚡",
    eight: "🚡",
    quad: "🚡",
    triple: "🚡"
};

const numberToStatus = {
    0: "Closed",
    1: "Open",
    2: "On-Hold",
    3: "Scheduled"
};

const botToken = config.telegram.NOTIFY_TG_TOKEN;
const chatId = config.telegram.NOTIFY_TG_CHAT_ID;
const bot = new TelegramBot(botToken, {polling: true});

const sendTelegramNotification = async (message) => {
    bot.sendMessage(chatId, message, {parse_mode: 'html'})
        .then(() => console.log('Notification sent!'))
        .catch((err) => console.error('Error sending notification:', err));
};

const process = async () => {
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
    const browser = await puppeteer.launch(!IS_PROD ? {headless: false} : {args: ['--no-sandbox', '--disable-setuid-sandbox']});

    const now = new Date();
    const currentHour = now.getHours()
    if (currentHour >= SLEEP_HOUR || currentHour < WAKEUP_HOUR) {
        logStep("After hours, doing nothing")
    } else {
        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

            await page.goto(siteInfo.WB_URL);

            // Extract the content of the relevant script tag
            const lifts = await page.evaluate(() => {
                // Find all script tags
                const scriptTags = document.querySelectorAll('script[type="module"]');
                for (let script of scriptTags) {
                    if (script.textContent.includes('FR.TerrainStatusFeed')) {
                        // Extract and evaluate the JavaScript object
                        const scriptContent = script.textContent;
                        const jsonMatch = scriptContent.match(/FR\.TerrainStatusFeed\s*=\s*(\{[\s\S]*?});/);
                        if (jsonMatch && jsonMatch[1]) {
                            const fullData = JSON.parse(jsonMatch[1]);
                            // Return only the "Lifts" part
                            return fullData.Lifts || null;
                        }
                    }
                }
                return null; // Return null if not found
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

            logStep(`diff from last update: ${JSON.stringify(diff, null, 2)}`);

            if (diff.length > 0) {
                let message = format(new Date(), dateFormat) + '\n\n';
                for (let i = 0; i < diff.length; i++) {
                    let curr = diff[i];
                    message += getEmojiForType(curr.Type) + '<b>' + curr.Name + '</b> is now <b>' + getStatusForType(curr.Status) + '</b>\n Hours of operation : ' + curr.OpenTime + ' - ' + curr.CloseTime + '\n\n'
                }
                await sendTelegramNotification(message);
            }
        } catch (err) {
            console.error(err);
            await sendTelegramNotification(`Huston we have a problem: ${err}`);
        }

    }
    await browser.close();

    logStep(`Sleeping for ${NEXT_SCHEDULE_POLL_MIN} minutes`)

    await delay(NEXT_SCHEDULE_POLL_MIN)

    await process()
}

function isEqual(obj1, obj2) {
    return obj1.Name === obj2.Name && obj1.Status === obj2.Status;
}

function findDifference(arr1, arr2) {
    return arr1.filter(item1 => !arr2.some(item2 => isEqual(item1, item2)));
}

function getEmojiForType(type) {
    return typeToEmoji[type] || "❓"; // Default to ❓ if type is unknown
}

function getStatusForType(type) {
    return numberToStatus[type] || "Unknown";
}

(async () => {
    try {
        await process();
    } catch (err) {
        console.error(err);
        await sendTelegramNotification(`Huston we have a problem: ${err}. \n Script stopped`);
    }
})();