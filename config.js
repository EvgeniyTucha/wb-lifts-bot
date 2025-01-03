const {th} = require("date-fns/locale");
module.exports = {

    siteInfo: {
        get WB_URL() {
            return `https://www.whistlerblackcomb.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx`
        }
    },
    IS_PROD: process.env.NODE_ENV === 'prod',
    NEXT_SCHEDULE_POLL_MIN: process.env.NEXT_SCHEDULE_POLL_MIN || 2, // default to 2 minutes
    SLEEP_HOUR: process.env.SLEEP_HOUR || 20, // in 24-hour format, i.e. 20
    WAKEUP_HOUR: process.env.WAKEUP_HOUR || 6, // in 24-hour format, i.e. 6
    telegram: {
        NOTIFY_TG_CHAT_ID: process.env.NOTIFY_TG_CHAT_ID, // chat id to send notification
        NOTIFY_TG_TOKEN: process.env.NOTIFY_TG_TOKEN, // tg token
    }
}
