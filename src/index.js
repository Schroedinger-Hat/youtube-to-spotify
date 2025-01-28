const fs = require('fs');
const { exit } = require('process');

const { configureLogger, getLogger, shutdownLogger } = require('./logger');
const env = require('./environment-variables');
const { getVideoInfo, downloadThumbnail, downloadAudio } = require('./youtube-yt-dlp');
const { postEpisode } = require('./spotify-puppeteer');

const logger = getLogger();

function validateYoutubeVideoId(id) {
  if (id === undefined || id === null || typeof id !== 'string') {
    throw new Error('Id not present in JSON');
  }
}

function getYoutubeVideoId() {
  try {
    if (env.EPISODE_ID) {
      validateYoutubeVideoId(env.EPISODE_ID);
      return env.EPISODE_ID;
    }
    const json = JSON.parse(fs.readFileSync(env.EPISODE_PATH, 'utf-8'));
    validateYoutubeVideoId(json.id);
    return json.id;
  } catch (err) {
    throw new Error(`Unable to get youtube video id: ${err}, 
    please make sure that either the environment variable EPISODE_ID is set with valid id 
    or episode path is set correctly using t he environment variables EPISODE_PATH and EPISODE_FILE`);
  }
}

async function main() {
  const youtubeVideoId = getYoutubeVideoId();

  const youtubeVideoInfo = await getVideoInfo(youtubeVideoId);
  const { title, description, uploadDate } = youtubeVideoInfo;
  logger.info(`title: ${title}`);
  logger.info(`description: ${description}`);
  logger.info(`Upload date: ${JSON.stringify(uploadDate)}`);

  if (env.LOAD_THUMBNAIL) {
    await downloadThumbnail(youtubeVideoId);
  }
  await downloadAudio(youtubeVideoId);

  logger.info('Posting episode to spotify');
  await postEpisode(youtubeVideoInfo);
}

configureLogger();

main()
  .then(async () => {
    logger.info('Finished successfully.');
    await exitSuccess();
  })
  .catch(async (err) => {
    logger.info(`Posting youtube episode to spotify failed: ${err}`);
    await exitFailure();
  });

async function exitSuccess() {
  await cleanUp();
  exit(0);
}

async function exitFailure() {
  await cleanUp();
  exit(1);
}

function cleanUp() {
  return new Promise((resolve) => {
    shutdownLogger(() => resolve());
  });
}
