const path = require('node:path');
const puppeteer = require('puppeteer');
const env = require('../environment-variables');
const { compareDates } = require('../dateutils');
const { isEmpty } = require('../stringutils');
const { LOGS_LOCATION, getLogger } = require('../logger');

const SPOTIFY_AUTH_ACCEPTED = 'spotify-auth-accepted';
const logger = getLogger();

function addUrlToDescription(youtubeVideoInfo) {
  return env.URL_IN_DESCRIPTION
    ? `${youtubeVideoInfo.description}\n${youtubeVideoInfo.url}`
    : youtubeVideoInfo.description;
}

async function setPublishDate(page, date) {
  logger.info('-- Setting publish date');
  const dateCalendarSelector = '::-p-xpath(//label/span[text() = "Date"]/parent::label/parent::div/parent::div/button)';
  await page.waitForSelector(dateCalendarSelector, { visible: true });
  await clickSelector(page, dateCalendarSelector);

  await selectCorrectYearAndMonthInDatePicker();
  await selectCorrectDayInDatePicker();

  async function selectCorrectYearAndMonthInDatePicker() {
    const dateForComparison = `${date.monthAsFullWord} ${date.year}`;
    // there are two calendars, we click until the left calendar is matching the date
    const currentDateCaptionElementSelector =
      'div[class*="CalendarMonth"][data-visible="true"] div[class*="CalendarMonth_caption"] > strong';
    let currentDate = await getTextContentFromSelector(page, currentDateCaptionElementSelector);
    const navigationButtonSelector =
      compareDates(dateForComparison, currentDate) === -1
        ? 'div[class*="calendarDatePicker__navIcon--left"]'
        : 'div[class*="calendarDatePicker__navIcon--right"]';

    while (currentDate !== dateForComparison) {
      await clickSelector(page, navigationButtonSelector);
      currentDate = await getTextContentFromSelector(page, currentDateCaptionElementSelector);
      await sleepSeconds(0.5);
    }
  }

  async function selectCorrectDayInDatePicker() {
    const dayWithoutLeadingZero = parseInt(date.day, 10);
    // this selector will return two entries, clickSelector should click the first matched element
    const daySelector = `::-p-xpath(//div[contains(@class, "CalendarMonth") and @data-visible="true"]//td[text() = "${dayWithoutLeadingZero}"])`;
    await clickSelector(page, daySelector);
  }
}

async function selectPodcast(page, targetTitle) {
  // When we come to this point in the flow, the dashboard page
  // is in a state it never reaches when using interatively: it has 
  // no podcast selected and all the podcasts are in the list, available to be selected.
  //
  // Normally, when whe access the creators dashboard, there is a podcast already selected
  // and others available podcasts to be selected.
  //
  // This helped us here, because we can simply choose and click on any podcast on the list.
  // But note that if the user has not provided a podcast title, it means she wants
  // the first one, so we cannot enter this state and just follow from the state the
  // page is before entering here.
  if (env.PODCAST_TITLE === '') {
    logger.info('-- No PODCAST_TITLE provided. Using default podcast.');
    return
  }
  
  var navigationPromise = page.waitForNavigation();
  await page.goto('https://podcasters.spotify.com/pod/dashboard/episodes')
  await navigationPromise;

  logger.info(`-- Searching for podcast ${targetTitle}`);
  const elementHandle = await page.waitForFunction(`
      document.querySelector('#__chrome').shadowRoot.querySelector("a[aria-label='${targetTitle}']")
    `);

  logger.info(`-- Selected podcast ${targetTitle}`);
  navigationPromise = page.waitForNavigation();
  await elementHandle.asElement().click()
  await navigationPromise;

  logger.info('-- Going back to the new episode wizard');
  navigationPromise = page.waitForNavigation();
  page = await page.goto('https://creators.spotify.com/pod/dashboard/episode/wizard');
  await navigationPromise;
}

async function postEpisode(youtubeVideoInfo) {
  let browser;
  let page;

  try {
    logger.info('Launching puppeteer');
    browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: env.PUPPETEER_HEADLESS });

    page = await openNewPage('https://creators.spotify.com/pod/dashboard/episode/wizard');

    logger.info('Setting language to English');
    await setLanguageToEnglish();

    logger.info('Set cookie banner acceptance');
    await setAcceptedCookieBannerDate();

    logger.info('Trying to log in and open episode wizard');
    await loginAndWaitForNewEpisodeWizard();

    logger.info(`Making sure the correct podcast is selected for uploading`);
    await selectPodcast(page, env.PODCAST_TITLE);

    logger.info('Uploading audio file');
    await uploadEpisode();

    logger.info('Filling required podcast details');
    await fillDetails();

    logger.info('Going to Review and Publish step');
    await clickSelector(page, '::-p-xpath(//span[text()="Next"]/parent::button)');

    logger.info('Filling details in Review and Publish step');
    await fillReviewAndPublishDetails();

    logger.info('Save draft or publish');
    await saveDraftOrScheduleOrPublish();

    /*
    This is a workaround solution of the problem where the podcast
    is sometimes saved as draft with title "Untitled" and no other metadata.
    We navigate to the spotify/spotify dashboard immediately after podcast is
    published/scheduled.
     */
    await goToDashboard();

    logger.info('Yay');
  } catch (err) {
    logger.info(`Unable to post episode to spotify: ${err}`);
    if (page !== undefined) {
      logger.info('Screenshot base64:');
      const screenshotBinary = await page.screenshot({
        type: 'png',
        path: path.join(LOGS_LOCATION, 'screenshot.png'),
      });
      logger.info(`data:image/png;base64,${Buffer.from(screenshotBinary).toString('base64')}`);
    }
    throw new Error(`Unable to post episode to spotify: ${err}`);
  } finally {
    if (browser !== undefined) {
      await browser.close();
    }
  }

  async function openNewPage(url) {
    const newPage = await browser.newPage();
    await newPage.goto(url);
    await newPage.setViewport({ width: 2560, height: 1440 });
    return newPage;
  }

  async function setLanguageToEnglish() {
    await clickSelector(page, 'button[aria-label="Change language"]');
    await clickSelector(page, '[data-testid="language-option-en"]');
  }

  async function setAcceptedCookieBannerDate() {
    try {
      await page.setCookie({
        name: 'OptanonAlertBoxClosed',
        value: new Date().toISOString(),
      });
    } catch (e) {
      logger.info('-- Unable to set cookie');
    }
  }

  async function loginAndWaitForNewEpisodeWizard() {
    await spotifyLogin();

    return Promise.any([acceptSpotifyAuth(), waitForNewEpisodeWizard()]).then((res) => {
      if (res === SPOTIFY_AUTH_ACCEPTED) {
        logger.info('-- Spotify auth accepted. Waiting for episode wizard to open again.');
        return waitForNewEpisodeWizard();
      }
      logger.info('-- No need to accept spotify auth');
      return Promise.resolve();
    });
  }

  async function spotifyLogin() {
    logger.info('-- Accessing new Spotify login page for podcasts');
    var navigationPromise = page.waitForNavigation();
    await clickSelector(page, '::-p-xpath(//span[contains(text(), "Continue with Spotify")]/parent::button)');
    await navigationPromise;

    logger.info('-- Logging in');
    await page.waitForSelector('#login-username');
    await page.type('#login-username', env.SPOTIFY_EMAIL);
    await page.type('#login-password', env.SPOTIFY_PASSWORD);

    navigationPromise = page.waitForNavigation();
    await clickSelector(page, 'button[id="login-button"]');
    await navigationPromise;
  }

  function acceptSpotifyAuth() {
    logger.info('-- Trying to accept spotify auth');
    return clickSelector(page, 'button[data-testid="auth-accept"]').then(() => SPOTIFY_AUTH_ACCEPTED);
  }

  async function waitForNewEpisodeWizard() {
    await sleepSeconds(1);
    logger.info('-- Waiting for episode wizard to open');
    return page.waitForSelector('::-p-xpath(//span[contains(text(),"Select a file")])').then(() => {
      logger.info('-- Episode wizard is opened');
    });
  }

  async function uploadEpisode() {
    logger.info('-- Uploading audio file(waiting 5 seconds before initiating process)');
    await sleepSeconds(5);
    await page.waitForSelector('input[type=file]');
    const inputFile = await page.$('input[type=file]');
    await inputFile.uploadFile(env.AUDIO_FILE);

    logger.info('-- Waiting for upload to finish');
    await page.waitForSelector('::-p-xpath(//span[contains(text(),"Preview ready!")])', {
      timeout: env.UPLOAD_TIMEOUT,
    });
    logger.info('-- Audio file is uploaded');
  }

  async function fillDetails() {
    logger.info('-- Adding title');
    const titleInputSelector = '#title-input';
    await page.waitForSelector(titleInputSelector, { visible: true });
    // Wait some time so any field refresh doesn't mess up with our input
    await sleepSeconds(2);
    await page.type(titleInputSelector, youtubeVideoInfo.title);

    logger.info('-- Adding description');
    const textboxInputSelector = 'div[role="textbox"]';
    await page.waitForSelector(textboxInputSelector, { visible: true });
    const finalDescription = addUrlToDescription(youtubeVideoInfo);
    // focus and selectAll on the description textbox is important in order for the paste to work
    // using page.type also helps to focus the textbox
    await page.focus(textboxInputSelector);
    await page.type(textboxInputSelector, ' ');
    await selectAll(page, textboxInputSelector);
    if (isEmpty(finalDescription)) {
      await execClipboardPasteEvent(page, textboxInputSelector, `Video: ${youtubeVideoInfo.url}`);
    } else {
      await execClipboardPasteEvent(page, textboxInputSelector, finalDescription);
    }

    if (env.LOAD_THUMBNAIL) {
      logger.info('-- Uploading episode art');
      const imageUploadInputSelector = 'input[type="file"][accept*="image"]';
      await page.waitForSelector(imageUploadInputSelector);
      const inputEpisodeArt = await page.$(imageUploadInputSelector);
      await inputEpisodeArt.uploadFile(env.THUMBNAIL_FILE);

      logger.info('-- Saving uploaded episode art');
      await clickSelector(page, '::-p-xpath(//span[text()="Save"]/parent::button)');

      logger.info('-- Waiting for uploaded episode art to be saved');
      await page.waitForSelector('::-p-xpath(//div[@aria-label="image uploader"])', {
        hidden: true,
        timeout: env.UPLOAD_TIMEOUT,
      });
    }

    logger.info('-- Selecting content type(explicit or no explicit)');
    if (env.IS_EXPLICIT) {
      const explicitContentCheckboxLabelSelector = '::-p-xpath(//input[@name="podcastEpisodeIsExplicit"]/parent::*)';
      await clickSelector(page, explicitContentCheckboxLabelSelector);
    }

    logger.info('-- Selection promotional content(formerly content sponsorship - sponsored or not sponsored)');
    if (env.IS_SPONSORED) {
      const promotionalContentCheckboxLabelSelector =
        '::-p-xpath(//input[@name="podcastEpisodeContainsSponsoredContent"]/parent::*)';
      await clickSelector(page, promotionalContentCheckboxLabelSelector);
    }
  }

  async function fillReviewAndPublishDetails() {
    if (env.SET_PUBLISH_DATE) {
      await clickSelector(page, 'input[type="radio"][id="publish-date-schedule"]');
      const dateDisplay = `${youtubeVideoInfo.uploadDate.day} ${youtubeVideoInfo.uploadDate.monthAsFullWord}, ${youtubeVideoInfo.uploadDate.year}`;
      logger.info('-- Schedule publishing for date: ', dateDisplay);
      await setPublishDate(page, youtubeVideoInfo.uploadDate);
    } else {
      logger.info('-- No schedule, should publish immediately');
      await clickSelector(page, 'input[type="radio"][id="publish-date-now"]');
    }
  }

  async function saveDraftOrScheduleOrPublish() {
    if (env.SAVE_AS_DRAFT) {
      logger.info('-- Saving draft');
      await clickSelector(page, 'header > button > span');
      await clickSelector(page, '::-p-xpath(//span[text()="Save draft"]/parent::button)');
    } else if (env.SET_PUBLISH_DATE) {
      logger.info('-- Scheduling');
      await clickSelector(page, '::-p-xpath(//span[text()="Schedule"]/parent::button)');
    } else {
      logger.info('-- Publishing');
      await clickSelector(page, '::-p-xpath(//span[text()="Publish"]/parent::button)');
    }
    await sleepSeconds(3);
  }

  async function goToDashboard() {
    logger.info("-- Going to dashboard");
    var navigationPromise = page.waitForNavigation();
    page.goto('https://podcasters.spotify.com/pod/dashboard/episodes')
    await navigationPromise;
  }
}

async function sleepSeconds(seconds) {
  await new Promise((r) => {
    setTimeout(r, seconds * 1000);
  });
}

async function clickSelector(page, selector, options = {}) {
  await page.waitForSelector(selector, options);
  const elementHandle = await page.$(selector);
  await clickDom(page, elementHandle);
}

async function clickDom(page, domElementHandle) {
  await page.evaluate((element) => element.click(), domElementHandle);
}

async function getTextContentFromSelector(page, selector, options = {}) {
  await page.waitForSelector(selector, options);
  const elementHandle = await page.$(selector);
  return getTextContentFromDom(page, elementHandle);
}

async function getTextContentFromDom(page, domElementHandle) {
  return page.evaluate((element) => element.textContent, domElementHandle);
}

function execClipboardPasteEvent(page, selector, textToPaste) {
  return page.evaluate(
    (sel, text) => {
      const target = document.querySelector(sel);
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      const clipboardEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(clipboardEvent);
    },
    selector,
    textToPaste
  );
}

function selectAll(page, selector) {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }, selector);
}

module.exports = {
  postEpisode,
};
