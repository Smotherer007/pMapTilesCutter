#! /usr/bin/env node
const sharp = require('sharp')
const fs = require('fs')
const cliProgress = require('cli-progress')
const yargs = require('yargs')
    .option('sourcePath', {
        alias: 'sourcePath',
        describe: 'Image to cut in tiles',
        demandOption: true
    })
    .option('targetPath', {
        alias: 'targetPath',
        describe: 'Destination location for the generated image tiles',
        demandOption: true
    })
    .option('tileSize', {
        alias: 'tileSize',
        describe: 'Size of the image tiles',
        demandOption: true
    })
    .argv

cutTiles({
    sourcePath: yargs.sourcePath,
    targetPath: yargs.targetPath,
    tileSize: parseInt(yargs.tileSize)
}).then(() => function () {
    console.log("Tiles generation finished")
})

async function cutTiles(options) {
    if (!fs.existsSync(options.targetPath)) {
        fs.mkdirSync(options.targetPath, {recursive: true})
    }

    const sourceImage = await sharp(options.sourcePath)
    const sourceImageMetadata = await sourceImage.metadata()
    const sourceImageWidth = sourceImageMetadata.width
    const sourceImageHeight = sourceImageMetadata.height

    const maxTileDim = Math.ceil(Math.max(sourceImageWidth, sourceImageHeight) / options.tileSize)

    let minZoomLevel = 0
    let maxZoomLevel = 0
    let numTilesTotalForAllLevels = 1
    do {
        maxZoomLevel++
        numTilesTotalForAllLevels += Math.pow(2, 2 * maxZoomLevel)
    } while (Math.pow(2, maxZoomLevel) < maxTileDim)
    console.log(`Total number of zoom levels ${maxZoomLevel}`)

    let zoom = minZoomLevel
    let scale = maxZoomLevel
    while (zoom <= maxZoomLevel) {
        console.log(`Generating map tiles for zoom level ${zoom}`)
        await createCanvas(sourceImage, sourceImageMetadata, zoom, scale, options)
        await createTiles(zoom, options)
        zoom++
        scale--
    }
    console.log('Finished generating tiles')
}

async function createCanvas(image, imageMetaData, zoom, scale, options) {
    const canvasWidth = options.tileSize * Math.pow(2, zoom)
    const canvasHeight = options.tileSize * Math.pow(2, zoom)
    const imageWidth = scaleDimension(imageMetaData.width, scale)
    const imageHeight = scaleDimension(imageMetaData.height, scale)

    await sharp({
        create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0 }
        }
    }).composite([{
        input: await image
            .clone()
            .resize(imageWidth, imageHeight)
            .toBuffer(),
        left: parseInt((canvasWidth - imageWidth) / 2),
        top: parseInt((canvasHeight - imageHeight) / 2),
        blend: 'over'}])
        .toFile(options.targetPath + `canvas_${zoom}.png`)
}

async function createTiles(zoom, options) {
    const canvasMetadata = await sharp(options.targetPath + 'canvas_' + zoom + '.png').metadata()
    const canvasWidth = canvasMetadata.width
    const canvasHeight = canvasMetadata.height
    const numberOfXTiles = canvasWidth / options.tileSize
    const numberOfYTiles = canvasHeight / options.tileSize
    const totalNumberOfTiles = numberOfXTiles * numberOfXTiles
    let currentNumberOfGeneratedTiles = 0
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
    bar.start(totalNumberOfTiles, currentNumberOfGeneratedTiles)
    for (let y = 0; y < numberOfYTiles; y++) {
        const tileY = y * options.tileSize
        for (let x = 0; x < numberOfXTiles; x++) {
            const tileX = x * options.tileSize
            const directoryPath = options.targetPath + zoom + '/' + x + '/'
            if (!fs.existsSync(directoryPath)) {
                fs.mkdirSync(directoryPath, { recursive: true })
            }
            await sharp(options.targetPath + `canvas_${zoom}.png`)
                .extract({ left: tileX, top: tileY, width: options.tileSize, height: options.tileSize })
                .png({ palette: true })
                .toFile(directoryPath + y + '.png')
            currentNumberOfGeneratedTiles++
            bar.update(currentNumberOfGeneratedTiles)
        }
    }
    bar.stop()
}

function scaleDimension(dimension, scale) {
    let scaledDimension = dimension
    for (let i = 0; i < scale; i++) {
        scaledDimension = scaledDimension * 0.5
    }
    return Math.ceil(scaledDimension)
}
