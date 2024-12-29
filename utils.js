const debug = async (page, logName, saveScreenShot) => {
    if (saveScreenShot) {
        await page.screenshot({path: `${logName}.png`});
    }

    await page.evaluate(() => {
        debugger;
    });
};

const delay = timeout => {
    const timeoutInMs = timeout * 60 * 1000
    return new Promise(resolve => setTimeout(resolve, timeoutInMs))
};

const logStep = (stepTitle) => {
    console.log(`${new Date().toLocaleString()} ==> Step: ${stepTitle}`);
}

module.exports = {
    debug,
    delay,
    logStep
}
