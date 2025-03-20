# Y2S = YouTube to Spotify - An automation tool to publish your podcast

![Cover image](https://raw.githubusercontent.com/schroedinger-Hat/youtube-to-anchorfm/main/assets/img/cover.png 'Cover image')

This action will upload an audio file from a given YouTube video automatically to your spotify account.

It is very useful in a scenario where you have a YouTube account and also a podcast at Spotify through Anchor.fm.

In our live show ([Schrödinger Hat](https://open.spotify.com/show/7yfkQCV6hrPIqflSqJDB2P)) we had this necessity. So we built it for the open source community.

Every contribution is appreciated, even just a simple feedback.

Table of Contents
=================

* [YouTube to spotify - An automation tool to publish your podcast](#youtube-to-spotify---an-automation-tool-to-publish-your-podcast)
   * [How it works](#how-it-works)
   * [How can I run this as a GitHub action?](#how-can-i-run-this-as-a-github-action)
   * [Environment variables](#environment-variables)
      * [Draft Mode](#draft-mode)
      * [Audio conversion options](#audio-conversion-options)
      * [Explicit Mode](#explicit-mode)
      * [Thumbnail Mode](#thumbnail-mode)
      * [Add YouTube URL to Podcast Description](#add-youtube-url-to-podcast-description)
      * [Set a publish date for the episode](#set-a-publish-date-for-the-episode)
  * [Multiple shows per repository](#multiple-shows-per-repository)
   * [How can I setup for development and use the script locally?](#how-can-i-setup-for-development-and-use-the-script-locally)
   * [How to upload a YouTube playlist to spotify using this script?](#how-to-upload-a-youtube-playlist-to-spotify-using-this-script)
* [Contributors](#contributors)
* [License](#license)


## How it works

The action will start every time you push a change on the `episode.json` file. Into this file you need to specify the YouTube id of your video.

The action uses a docker image built over Ubuntu. It takes some time to setup the environment before running the script.

**NOTE**: For the script to run successfully it is necessary for there to be at least one episode manually published on spotify, as the steps to publish on a brand new spotify account are different, and the automation will break.

## How can I run this as a GitHub action?

You can use the latest version of this action from the [GitHub Actions marketplace](https://github.com/marketplace/actions/upload-episode-from-youtube-to-spotify).

In the repository root directory add a `episode.json` file containing your YouTube video id, e.g.:

```json
{
  "id": "nHCXZC2InAA"
}
```

Then create a GitHub action in the `.github/workflows` directory with this yaml:

```yaml
name: 'Upload Episode from YouTube To Spotify'

on:
  push:
    paths:
      - episode.json
    branches: [main]

jobs:
  upload_episode:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Upload Episode from YouTube To Spotify
        uses: Schroedinger-Hat/youtube-to-spotify@v2.5.0
        env:
          SPOTIFY_EMAIL: ${{ secrets.SPOTIFY_EMAIL }}
          SPOTIFY_PASSWORD: ${{ secrets.SPOTIFY_PASSWORD }}
          EPISODE_PATH: /github/workspace
```

**NOTE**: you need to [set up the secrets](https://docs.github.com/en/free-pro-team@latest/actions/reference/encrypted-secrets#creating-encrypted-secrets-for-a-repository) for _SPOTIFY_EMAIL_ and _SPOTIFY_PASSWORD_. This environment variables are mandatory as they specify the sign in account. 

**NOTE**: Since [PR#127](https://github.com/Schroedinger-Hat/youtube-to-anchorfm/issues/127) the project remove any reference to Anchor.fm due to the Spotify acquisition of the company (you can read more [here](https://medium.com/anchor/anchor-is-joining-spotify-70356e3ac23f)).

## Environment variables

### Login Type

Setting the `SPOTIFY_LOGIN` to true makes the script login with the old spotify login type. Instead setting it to false makes the script login with the spotify account. By default the value is true.

```yaml
env:
  SPOTIFY_LOGIN: true
```

### Draft Mode

By setting the `SAVE_AS_DRAFT`, the new episode will be published as a draft. This can be useful if you need someone else's
approval before actual publication.

```yaml
env:
  SAVE_AS_DRAFT: true
```

### Audio conversion options

ffmpeg is used to convert the video to MP3. It's possible to pass arguments to ffmpeg with `POSTPROCESSOR_ARGS` environment
variable.

See `-postprocessor-args` syntax and options on https://github.com/yt-dlp/yt-dlp#post-processing-options.

The example below convert the video to mono audio.

```yaml
env:
  POSTPROCESSOR_ARGS: 'ExtractAudio+ffmpeg:-ac 1'
```

To convert to mono audio, remove initial silence and apply fade-in:

```yaml
# remove initial silence quieter than -50dB
env:
  POSTPROCESSOR_ARGS: "ExtractAudio+ffmpeg:-ac 1 -af silenceremove=1:0:-50dB,afade=t=in:d=5"
```

### Explicit Mode

By setting the `IS_EXPLICIT`, the new episode will be marked as explicit.

```yaml
env:
  IS_EXPLICIT: true
```

### Sponsored Content

By setting `IS_SPONSORED`, the new episode will be marked as having promotional content (sponsored).
Default is `false`.

```yaml
env:
  IS_SPONSORED: true
```

### Thumbnail Mode

By setting the `LOAD_THUMBNAIL`, the new episode will include the video thumbnail as the episode art.

```yaml
env:
  LOAD_THUMBNAIL: true
```

### Add YouTube URL to Podcast Description

By setting the `URL_IN_DESCRIPTION`, the Podcast description will include the YouTube URL on a new line at the end of the description.
It is recommended to set it, for if the YouTube video has no description it will fail to save the new episode. Setting it to true guarantees to always have a description.

```yaml
env:
  URL_IN_DESCRIPTION: true
```

### Set a publish date for the episode

By setting `SET_PUBLISH_DATE`, the new episode can be scheduled for publishing the episode on the date that the YouTube video is uploaded. Please note that the scheduling will work if `SAVE_AS_DRAFT` is not set, because spotify doesn't store publish date for draft episodes.
If `SET_PUBLISH_DATE` is not set, then spotify will choose the current date for publishing.

```yaml
env:
  SET_PUBLISH_DATE: true
```

## Multiple shows per repository

It is possible to use a single repository to maintain several shows.

There are two ways to do that.

### You have multiple accounts.

As an example, suppose you have two shows, you called "Great News" and another "Sad News". Every
show on its own account.

You repository will look like this:

```
.github/
├─ workflows/
│  ├─ great-news.yaml
│  ├─ sad-news.yaml
great-news.json
sad-news.json
```

In `great-news.json` and `sad-news.json`, you have:
```json
{
  "id": "episode_video_id"
}
```

In `great-news.yaml` and `sad-news.yaml`:
```yaml
name: 'Great News Upload Action'
on:
  push:
    paths:
    ## only updates to this file trigger this action
      - great-news.json   # or sad-news.json
jobs:
  upload_episode:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Upload Episode from YouTube To Spotify
        uses: Schrodinger-Hat/youtube-to-spotify@v2.5.0
        env:
          SPOTIFY_EMAIL: ${{ secrets.SPOTIFY_EMAIL_GREATNEWS }}  # OR secrets.SPOTIFY_EMAIL_SADNEWS
          SPOTIFY_PASSWORD: ${{ secrets.SPOTIFY_PASSWORD_GREATNEWS }}  # OR secrets.SPOTIFY_PASSWORD_SADNEWS
          EPISODE_PATH: /github/workspace/
          EPISODE_FILE: great-news.json
          # (…) Other configs as needed
```

### You have multiple podcasts on the same account

Same as before, you setup one config per podcast, but with the same `SPOTIFY_EMAIL` and `SPOTIFY_PASSWORD`.
But now you provide a title for the podcast, to that it can be found in the list:

In `great-news.yaml` and `sad-news.yaml`:
```yaml
name: 'Great News Upload Action'
on:
  push:
    paths:
    ## only updates to this file trigger this action
      - great-news.json   # or sad-news.json
jobs:
  upload_episode:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Upload Episode from YouTube To Spotify
        uses: Schrodinger-Hat/youtube-to-spotify@v2.5.0
        env:
          SPOTIFY_EMAIL: ${{ secrets.SPOTIFY_EMAIL }}   # Both shows on the same account
          SPOTIFY_PASSWORD: ${{ secrets.SPOTIFY_PASSWORD }}
          PODCAST_TITLE: Great News  # Or "Sad News", just as shown in your spotify podcasts list
          EPISODE_PATH: /github/workspace/
          EPISODE_FILE: great-news.json  # or sad-news.json
          # (…) Other configs as needed
```

## How can I setup for development and use the script locally?

To run the script locally, you need `python3` and `ffmpeg` to be available in `PATH` which are used by the npm dependency `youtube-dl-exec`.

Clone the repository and run `npm ci` to install the exact dependencies that are specified in `package-lock.json`.

After that, you can edit `episode.json` that is located at the root of this repository.
It is recommended to specify the id of a short YouTube video in `episode.json` for testing.

Then, make sure to setup your `.env` file in the root of this repository so you can put
the environment variables that you normally specify in the GitHub action YAML file.

To do that, you can copy `.env.sample` into a file with name `.env`.

Make sure to specify the mandatory environment variables for logging in to spotify,
`SPOTIFY_EMAIL` and `SPOTIFY_PASSWORD`.

If needed we can set the `SPOTIFY_EMAIL` and `SPOTIFY_PASSWORD` too, so they will be used to login with the new login type after changing `SPOTIFY_LOGIN` to false.

Finally, you can do `npm start` to execute the script.

## How to upload a YouTube playlist to spotify using this script?

⚠ WARNING: This Potentially violates GitHub's Terms of service ⚠

> In particular, any repositories that use GitHub Actions or similar 3rd party services solely to interact with 3rd party websites, to engage in incentivized activities, or for general computing purposes may fall foul of the [GitHub Additional Product Terms (Actions)](https://docs.github.com/github/site-policy/github-terms-for-additional-products-and-features#actions), or the [GitHub Acceptable Use Policies](https://docs.github.com/github/site-policy/github-acceptable-use-policies).
> Actions should not be used for any activity unrelated to the production, testing, deployment, or publication of the software project associated with the repository where GitHub Actions are used.

Currently, you can process a full playlist (one way only) with

```bash
curl https://scc-youtube.vercel.app/playlist-items/PLoXdlLuaGN8ShASxcE2A4YuSto3AblDmX \
    | jq '.[].contentDetails.videoId' -r \
    | tac \
    | xargs -I% bash -c "jo id='%' > episode.json && git commit -am % && git push"
```

`https://scc-youtube.vercel.app/playlist-items` is from https://github.com/ThatGuySam/youtube-json-server

`jo` is a json generator https://github.com/jpmens/jo

`tac` is a command present in most Linux distributions and on mac with brew install coreutils. Its from reversing the list from older to newer. Remove if you want to upload in the order presented on YouTube.

`jq` is a json processor https://stedolan.github.io/jq/

This must be run on the folder where your episode.json is.

# License

MIT
