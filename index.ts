import puppeteer from 'puppeteer';
import schedule from 'node-schedule';
import dotnev from 'dotenv';
dotnev.config();

const loginPageUrl = 'https://osaka.v-yoyaku.jp/login';
const ID = process.env.ID!;
const PASSWORD = process.env.PASSWORD!;

const main = async () => {
    const browser = await puppeteer.launch({
        headless: false,
    });
    const page = await browser.newPage();
    await page.goto(loginPageUrl);
    await page.waitForSelector('div.login-card-body');
    await page.type('input#login_id', ID);
    await page.type('input#login_pwd', PASSWORD);
    await page.evaluate(() => {
        (document.querySelector('input[name="prio_tgt"]') as HTMLInputElement).click(); // 同意
        (document.querySelector('button#btn_login') as HTMLButtonElement).click(); // ログイン
    });
    await page.waitForSelector('div#mypage_accept');
    await page.click('div#mypage_accept'); // 「予約・変更する」
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
        (document.querySelector('button#btn_Search_Medical') as HTMLButtonElement).click(); // 「接種会場を選択」
    });
    await page.waitForSelector('select#ward_name');
    await page.select('select#ward_name', '大規模接種会場');
    await page.evaluate(() => {
        (document.querySelector('button#btn_search_medical') as HTMLButtonElement).click(); // 「検索」
    });
    await page.waitForTimeout(1000);
    const selectable = await page.evaluate(() => {
        const text = (document.querySelector('table#search-medical-table tbody') as HTMLTableSectionElement).textContent!.trim();
        if (text.includes('予約できる接種会場はありません。')) return false;
        (document.querySelector('input#search_medical_table_radio_0') as HTMLInputElement).click(); // 頭の選択肢を選択 (インテックス大阪のみのはず)
        (document.querySelector('button#btn_select_medical') as HTMLButtonElement).click();
        return true;
    });
    if (!selectable) {
        await browser.close();
        return;
    }
    await page.waitForTimeout(2000);
    const availableDays = await page.evaluate(() => {
        const dayCells = document.querySelectorAll<HTMLTableDataCellElement & {
            outerText: string; // なんでこれないんすかねぇ………
        }>('div.fc-dayGridMonth-view td.fc-day-top');
        const availableDayStrs = Array.from(dayCells).map(d => d.outerText).filter(d => d.includes('△') || d.includes('〇'));
        const availableDays = availableDayStrs.map(s => s.split('\n')[0]);
        return availableDays;
    });
    console.log(availableDays);
    if (availableDays.length > 0) {
        // Invoke notification
        await page.evaluate(() => {
            const audio = new Audio('https://otologic.jp/sounds/se/pre/News-Alert03-1.mp3');
            audio.loop = true;
            audio.play();
        });
    } else {
        await browser.close();
    }
};

schedule.scheduleJob('*/15 * * * *', () => {
    main();
});
