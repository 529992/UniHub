const scanDocument = jest.fn(async () => ({ scannedImages: [] }));

module.exports = { scanDocument };