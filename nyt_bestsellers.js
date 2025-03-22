import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';
import fs from 'fs';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: `${__dirname}/config.env` });

//replace with env var
const senderEmail = process.env.GMAIL_USER_JRL_DEV;
const senderPass = process.env.GMAIL_PASS_JRL_DEV;
const receiverEmail = process.env.GMAIL_USER_JRL_MAIN;
const obsidianPath = process.env.OBSIDIAN_PATH;//absolute path

var today = new Date().toLocaleString('default', { month: 'long' })

const nyt_bestsellersUrl = 'https://api.nytimes.com/svc/books/v3/lists/current/';
const lists = new Array(
    'graphic-books-and-manga',
    'paperback-nonfiction',
    'trade-fiction-paperback');
const append_JSON = '.json?api-key='

async function getBestSellers() {
    console.log(chalk.bgBlue.white('Getting Best Sellers...'));
    let books = [];
    for (let list of lists) {
        const apiKey_NYT = process.env.NYT_API_KEY;
        const url = nyt_bestsellersUrl + list + append_JSON + apiKey_NYT;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.results && data.results.books) {
                console.log('///**********************ADDED**********************');
                console.log('Added new list: ' + list);
                data.results.books.forEach(book => {
                    book.list_name = data.results.list_name;
                    book.published_date = data.results.published_date;
                });
                books = books.concat(data.results.books);
            } else {
                console.log('========ERROR========');
                console.error('API response error: ' , data);
                fs.appendFile('error.log', 'API response error: ' + JSON.stringify(data) + '\n', (err) => {});
                console.log('========ERROR========');
            }
        } catch (error) {
            console.log('error: ' + error);
            fs.appendFile('error.log', 'fetch error: ' + JSON.stringify(error) + '\n', (err) => {});
            return [];
        }
    }

    console.log(chalk.bgYellow.red('Best Sellers Collected!!!'));
    return books;
};

function formatBooks(books) {
    console.log(chalk.bgBlue.white('Formatting Books...'));
    console.log(chalk.bgGreenBright.yellowBright('Added the ff books:'));

    // group books by list_name
    const booksByList = {};
    books.forEach(book => {
        if (!booksByList[book.list_name]) {
            booksByList[book.list_name] = [];
        }
        booksByList[book.list_name].push(book);
    });

    // format books for each list
    var plainText = '';
    var richText = '';
    for (const listName in booksByList) {
        plainText += '## ' + listName + `\n\n`;
        richText += `<h2>${listName}</h2>\n<ul>\n`;
        booksByList[listName].forEach(book => {
            console.log(book.list_name);
            console.log(book.title + ' by ' + book.author);
            plainText += `- ${book.title} by ${book.author} published on ${book.published_date}\n`;
            richText += `<li>${book.title} by ${book.author} published on ${book.published_date}</li>\n`;
        });
        plainText += `\n---\n\n`;
        richText += '</ul>';
    }
    console.log(chalk.bgYellow.red('Formatted Books!!!'));

    return {
        plainText,
        richText
    };
}

async function sendEmail(richText) {
    console.log(chalk.bgBlue.white('Sending Email...'));
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: senderEmail,
            pass: senderPass
        }
    });

    var message = {
        from: senderEmail,
        to: receiverEmail,
        date: new Date(Date.now()),
        subject: 'NYT Bestsellers Appended - Month of ' + today,
        html: richText
    };

    try {
        let info = await transporter.sendMail(message);
        fs.appendFile('output.log', 'Email sent: ' + info.messageId + '\n', (err) => {});
    } catch (error) {
        console.error('Error sending email: ' + error);
        fs.appendFile('error.log', 'Email error: ' + JSON.stringify(error) + '\n', (err) => {});
    }
}

const header = '# NEW READING COLLECTION - MONTH OF `${today}`';
function appendToObsidian(plainText) {
    console.log(chalk.bgBlue.white('Adding to Vault...'));
    fs.appendFile(obsidianPath, `${header}\n\n${plainText}`, (err) => {
        if (err) {
            console.error('Error appending to obsidian: ' + err);
            fs.appendFile('error.log', 'obsidian error: ' + JSON.stringify(err) + '\n', (err) => {});
        } else {
            console.log('Appended to obsidian.');
            fs.appendFile('output.log', 'Appended to obsidian.\n', (err) => {});
        }
    });
    console.log(chalk.bgYellow.red('Added to Vault!!!'));
}

async function main() {
    const books = await getBestSellers();
    if (books && books.length > 0) {
        const { plainText, richText } = formatBooks(books);
        appendToObsidian(plainText);
        sendEmail(richText);
    } else {
        console.log('No books found.');
        fs.appendFile('output.log', 'No books found.\n', (err) => {});
    }
}

main();