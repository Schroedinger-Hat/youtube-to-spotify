const fs = require('fs');
const dotenv = require('dotenv');

const defaultValues = {
  EPISODE_PATH: '.',
  EPISODE_FILE: 'episode.json',
  SPOTIFY_LOGIN: true,
  SPOTIFY_EMAIL: '',
  SPOTIFY_PASSWORD: '',
  UPLOAD_TIMEOUT: 60 * 5 * 1000,
  SAVE_AS_DRAFT: false,
  LOAD_THUMBNAIL: false,
  IS_EXPLICIT: false,
  IS_SPONSORED: false,
  URL_IN_DESCRIPTION: false,
  POSTPROCESSOR_ARGS: '',
  SET_PUBLISH_DATE: false,
  AUDIO_FILE_FORMAT: 'mp3',
  AUDIO_FILE_TEMPLATE: 'episode.%(ext)s',
  THUMBNAIL_FILE_FORMAT: 'jpg',
  THUMBNAIL_FILE_TEMPLATE: 'thumbnail.%(ext)s',
  PUPPETEER_HEADLESS: true,
  PODCAST_TITLE: ''
};

const dotEnvVariables = parseDotEnvVariables();

function parseDotEnvVariables() {
  try {
    const envBuf = fs.readFileSync('.env');
    return dotenv.parse(envBuf);
  } catch (err) {
    return {};
  }
}

function getEnvironmentVariable(environmentVariableName) {
  return (
    process.env[environmentVariableName] ||
    dotEnvVariables[environmentVariableName] ||
    defaultValues[environmentVariableName]
  );
}

function getDotEnvironmentVariable(environmentVariableName) {
  return dotEnvVariables[environmentVariableName] || defaultValues[environmentVariableName];
}

function getTemplatedFileName(fileTemplate, fileFormat) {
  return fileTemplate.replace('%(ext)s', fileFormat);
}

function getBoolean(value) {
  if (typeof value === 'string') {
    return value.toLowerCase() !== 'false';
  }
  return !!value;
}

function getCompleteEpisodePath() {
  const episodePath = getEnvironmentVariable('EPISODE_PATH');
  const episodeFile = getEnvironmentVariable('EPISODE_FILE');
  return `${episodePath}/${episodeFile}`;
}

module.exports = {
  EPISODE_ID: getEnvironmentVariable('EPISODE_ID'),
  EPISODE_PATH: getCompleteEpisodePath(),
  SPOTIFY_LOGIN: getBoolean(getEnvironmentVariable('SPOTIFY_LOGIN')),
  SPOTIFY_EMAIL: getEnvironmentVariable('SPOTIFY_EMAIL'),
  SPOTIFY_PASSWORD: getEnvironmentVariable('SPOTIFY_PASSWORD'),
  SPOTIFY_EMAIL: getEnvironmentVariable('SPOTIFY_EMAIL'),
  SPOTIFY_PASSWORD: getEnvironmentVariable('SPOTIFY_PASSWORD'),
  PODCAST_TITLE: getEnvironmentVariable('PODCAST_TITLE'),
  UPLOAD_TIMEOUT: getEnvironmentVariable('UPLOAD_TIMEOUT'),
  SAVE_AS_DRAFT: getBoolean(getEnvironmentVariable('SAVE_AS_DRAFT')),
  LOAD_THUMBNAIL: getBoolean(getEnvironmentVariable('LOAD_THUMBNAIL')),
  IS_EXPLICIT: getBoolean(getEnvironmentVariable('IS_EXPLICIT')),
  IS_SPONSORED: getBoolean(getEnvironmentVariable('IS_SPONSORED')),
  URL_IN_DESCRIPTION: getBoolean(getEnvironmentVariable('URL_IN_DESCRIPTION')),
  POSTPROCESSOR_ARGS: getEnvironmentVariable('POSTPROCESSOR_ARGS'),
  SET_PUBLISH_DATE: getBoolean(getEnvironmentVariable('SET_PUBLISH_DATE')),
  AUDIO_FILE_FORMAT: getDotEnvironmentVariable('AUDIO_FILE_FORMAT'),
  AUDIO_FILE_TEMPLATE: getDotEnvironmentVariable('AUDIO_FILE_TEMPLATE'),
  THUMBNAIL_FILE_FORMAT: getDotEnvironmentVariable('THUMBNAIL_FILE_FORMAT'),
  THUMBNAIL_FILE_TEMPLATE: getDotEnvironmentVariable('THUMBNAIL_FILE_TEMPLATE'),
  AUDIO_FILE: getTemplatedFileName(
    getDotEnvironmentVariable('AUDIO_FILE_TEMPLATE'),
    getDotEnvironmentVariable('AUDIO_FILE_FORMAT')
  ),
  THUMBNAIL_FILE: getTemplatedFileName(
    getDotEnvironmentVariable('THUMBNAIL_FILE_TEMPLATE'),
    getDotEnvironmentVariable('THUMBNAIL_FILE_FORMAT')
  ),
  PUPPETEER_HEADLESS: getBoolean(getDotEnvironmentVariable('PUPPETEER_HEADLESS')),
};
