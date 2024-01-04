require('dotenv').config();
const fs = require('fs');
const { parse } = require("csv-parse");
const moment = require('moment');
const axios = require('axios');
const cheerio = require('cheerio');
const helperFn = require('../utils/helperFn');
const {RESPONSE} = require('../constants/constants');
const {
  crawPageViet69, crawPageSexDiary
} = require('../utils/crawlPage');
const VideoModel = require('../models/video');

const today = moment().toDate();

const websitesToCrawl = [
  {
    websiteURL: crawPageViet69.websiteURL,
    crawlMethod: async () => {
      const url = crawPageViet69.websiteURL;
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const today = new Date().toLocaleDateString('en-GB');

      const links = [];

      $(`${crawPageViet69.tagToCrawl}`).each((index, element) => {
        const href = $(element).attr('href');
        const title = $(element).attr('title');
        links.push({
          source: crawPageViet69.websiteURL,
          href,
          title,
          date: today,
        });
      });

      return links;
    },
  },
  {
    websiteURL: crawPageSexDiary.websiteURL,
    crawlMethod: async () => {
      const url = crawPageSexDiary.websiteURL;
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const links = [];

      $(`${crawPageSexDiary.tagToCrawl}`).each((index, element) => {
        const href = $(element).attr('href');
        const title = $(element).attr('title');
        links.push({
          source: crawPageSexDiary.websiteURL,
          href,
          title,
          date: today,
        });
      });

      return links;
    },
  },
];

async function crawlVideos(websites) {
  const results = [];

  for (const { crawlMethod } of websites) {
    try {
      const clipLinks = await crawlMethod();
      results.push(...clipLinks);
    } catch (error) {
      console.error('Error during crawling:', error);
    }
  }

  return results;
}



async function writeNewVideo(clipLinks) {

  for (const clipLink of clipLinks) {
    const video = new VideoModel({
      source: clipLink.source,
      href: clipLink.href,
      title: clipLink.title,
      date: clipLink.date,
    });

    await video.save();
  }

  console.log('Data has been written to the CSV file');
}


async function readExistingData() {
  try {
    const videos = await VideoModel.find({}).exec();
    // console.log('All videos:', videos);
    return videos;
  } catch (err) {
    console.error('Error reading videos:', err);
    throw err; // Re-throw the error to be caught by the calling code
  }
}


function findDifferences(newData, existingData) {
  const differences = [];

   // Iterate through new records
   for (const newRecord of newData) {
    
    // Check if there is a record with the same href in existing records
    const existingRecord = existingData.find(
      (record) => {
        return record.href === newRecord.href
      }
    );

    // If not found, add it to the differences
    if (!existingRecord) {
      differences.push(newRecord);
    }
  }
  return differences;
}


async function deleteOldVideos() {
  try {
    const fiveDaysAgo = moment().subtract(5, 'days').toDate();
    const result = await VideoModel.deleteMany({ date: { $lt: fiveDaysAgo } }).exec();

    return result;
  } catch (error) {
    console.error('Error deleting old videos:', error);
    throw error;
  }
}


const updateNewVideo = async (req) => {
  try {
    const newData = await crawlVideos(websitesToCrawl);
    const existingData = await readExistingData()
    const difference = findDifferences(newData, existingData)
    // If there are differences, send an email and write the new data to the CSV file
    if (difference.length > 0) {
      helperFn.sendEmail(difference);
      writeNewVideo(difference);
      deleteOldVideos();
      return RESPONSE.SEND_EMAIL_SUCCESSFULLY;
    }else {
      helperFn.sendEmail('No new video');
      deleteOldVideos();
      return RESPONSE.SEND_EMAIL_SUCCESSFULLY;
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

const getVideos = async (req) => {
  const videos = await VideoModel.find({}).exec();
  helperFn.sendEmail(videos);
  if(videos.length === 0) return RESPONSE.NO_VIDEO;
  return videos;
};

module.exports = {
  updateNewVideo, getVideos
}