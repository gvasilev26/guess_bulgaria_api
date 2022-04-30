const { JSDOM } = require('jsdom')
const https = require('https')
const mongoose = require('mongoose')
const config = require('./configs/config')
const Location = require('./models/location.model')

const options = {
    hostname: 'www.btsbg.org',
    port: 443,
    path: '/nacionalni-dvizheniya/100-nacionalni-turisticheski-obekta',
    method: 'GET',
};

(() => {
    mongoose.Promise = global.Promise
    mongoose.connect(config.mongodbUrl).then(() => {
        console.log('Successfully connected to the database')
    }).catch(err => {
        console.log('Could not connect to the database. Exiting now...', err)
        process.exit()
    })
    const chunks = []
    const req = https.request(options, res => {
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        res.on('end', async () => {
            await readMainPage(Buffer.concat(chunks).toString('utf8'))
        })
    })

    req.end()
})()

async function readMainPage (data) {
    let dom = new JSDOM(data)
    let q = dom.window.document.querySelectorAll('.glink .field-content a')
    let step = 1000
    // let skip = true
    for (let a of q) {
        // if(a.getAttribute('href') === '/100nto/panteon-na-gsrakovski') skip = false;
        // if(skip) continue
        setTimeout(async () => {
            await readSubPage(a.getAttribute('href'))
        }, step)
        step += 1000
    }
}

async function readSubPage (pageUrl) {
    options.path = pageUrl
    const chunks = []
    const req = https.request(options, res => {
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        res.on('end', async () => {
            await scrapPage(pageUrl, Buffer.concat(chunks).toString('utf8'))
        })
        res.on('error', err => console.log('SOME ERROR', err))
    })

    req.end()
}

async function scrapPage (url, data) {
    const dom = new JSDOM(data)
    const document = dom.window.document
    try {
        let imageUrl = document.querySelector('.mfp-thumbnail.img-responsive')
        if (!imageUrl) {
            console.log('no image', url)
            return
        }
        const name = document.querySelector('.page-header').innerHTML.trim()
        imageUrl = `https://www.btsbg.org/sites/default/files/obekti/${imageUrl.getAttribute('src').split('?')[0].split('/').splice(-1, 1)[0]}`
        let region = document.querySelectorAll('.field-item.even')[2].innerHTML.trim()
        let description = Array.from(document.querySelectorAll('.rtejustify'))
            .map((i) => i.innerHTML.includes('<a') ? '' : i.innerHTML)
            .join().replace(/&nbsp;/g, ' ').trim()
        let coordinates = []
        try {
            const match = /!2d([0-9.]+)!3d([0-9.]+)/gm.exec(document.querySelector('iframe').getAttribute('src'))
            coordinates = [match[2], match[1]]
        } catch (e) {}
        await new Location({
            name,
            description,
            coordinates,
            image: await getBase64FromUrl(imageUrl)
        }).save()
        console.log('SAVED ', url)
    } catch (e) {
        console.error(e)
        console.log('ERROR: ', data)
        process.exit(1)
    }
}

function getBase64FromUrl (url) {
    const chunks = []
    options.path = url.split('.org')[1]
    return new Promise((resolve) => {
        const req = https.request(options, res => {
            res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
            res.on('end', () => {
                resolve('data:' + res.headers['content-type'] + ';base64,' + Buffer.concat(chunks).toString('base64'))
            })
        })
        req.end()
    })
}
