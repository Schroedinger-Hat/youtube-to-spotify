const youtubedl = require('youtube-dl-exec');
const progress = require('progress-estimator')()
const env = require('../environment-variables');
const { AUDIO_FILE_FORMAT, THUMBNAIL_FILE_FORMAT } = require('../environment-variables');
const { parseDate } = require('../dateutils');
const { getLogger } = require('../logger');

const logger = getLogger();

const CONNECTION_TIMEOUT_IN_MS = 30000;

const youtubeDlOptions = {
  noCheckCertificates: true,
  noWarnings: true,
  preferFreeFormats: true,
};

function getVideoUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function getDownloadThumbnailOptions() {
  return {
    ...youtubeDlOptions,
    skipDownload: true,
    writeThumbnail: true,
    convertThumbnail: THUMBNAIL_FILE_FORMAT,
    o: env.THUMBNAIL_FILE_TEMPLATE,
  };
}

function getDownloadAudioOptions() {
  const options = {
    ...youtubeDlOptions,
    f: 'bestaudio',
    x: true,
    forceOverwrites: true,
    audioFormat: AUDIO_FILE_FORMAT,
    o: env.AUDIO_FILE_TEMPLATE,
  };
  if (env.POSTPROCESSOR_ARGS.length > 0) {
    options.postprocessorArgs = env.POSTPROCESSOR_ARGS;
  }
  return options;
}

async function getVideoInfo(videoId) {
  logger.info(`Getting JSON video info for video id ${videoId}`);
  try {
    const result = await youtubedl(
      getVideoUrl(videoId),
      {
        ...youtubeDlOptions,
        dumpSingleJson: true,
      },
      { timeout: CONNECTION_TIMEOUT_IN_MS }
    );
    return {
      title: result.title,
      description: result.description,
      url: result.original_url,
      uploadDate: parseDate(result.upload_date),
    };
  } catch (err) {
    throw new Error(`Unable to get video info: ${err}`);
  }
}

async function downloadThumbnail(videoId) {
  try {
    const promise = youtubedl(getVideoUrl(videoId), getDownloadThumbnailOptions());
    const result = await progress(promise, `Downloading thumbnail for video id ${videoId}`);
    logger.info(result)
    logger.info(`Downloaded thumbnail for video id ${videoId}`);
  } catch (err) {
    throw new Error(`Unable to download video thumbnail: ${err}`);
  }
}

async function downloadAudio(videoId) {
  try {
    const promise = youtubedl(getVideoUrl(videoId), getDownloadAudioOptions());
    const result = await progress(promise, `Downloading audio for video id ${videoId}`);
    logger.info(result)
    logger.info(`Downloaded audio for video id ${videoId}`);
  } catch (err) {
    throw new Error(`Unable to download audio: ${err}`);
  }
}

module.exports = {
  getVideoInfo,
  downloadThumbnail,
  downloadAudio,
};
