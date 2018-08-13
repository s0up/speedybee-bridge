const noble = require('noble');
const msp = require('./msp');

const reader = new msp.reader();

const getCharacteristics = (error, characteristics) => {
  //console.log(`UUID=${characteristics.map(c => `${c.uuid}=${c.type}-${c.properties.join('|')}`)}`);

  const rx = characteristics.find(c => c.uuid === '1002');

  if (!rx) {
    console.log('Cannot find rx uuid...');
    process.exit();
  }

  rx.notify(true);

  rx.on('read', (data) => {
    reader.handleBuffer(data);
    reader.on('message', (message) => {
      console.log(message);
    });
  });

  const tx = characteristics.find(c => c.uuid === '1001');

  if (!tx) {
    console.log('Cannot find tx uuid...');
    process.exit();
  }

  const write = (d) => {
    while (d.length > 20) {
      const output = d.slice(0, 19);
      tx.write(new Buffer(output), true);
      d = d.slice(20);
    }

    tx.write(new Buffer(d), true);
  }

  const d = msp.send('MSP_MOTOR');
  write(d);
}

const explore = (error, services) => {
  for (const service of services) {
    if (service.uuid === '1000') {
      service.discoverCharacteristics([], getCharacteristics);
    }
  }
}

const connect = (perihiperal) => {
  if (perihiperal.advertisement.localName && perihiperal.advertisement.localName.includes('SBF4')) {
    perihiperal.connect();

    const discover = () => {
      // once you know you have a peripheral with the desired
      // service, you can stop scanning for others:
      noble.stopScanning();
      // get the service you want on this peripheral:
      perihiperal.discoverServices([], explore);

      console.log('Connected to SBF4...');
    }

    perihiperal.on('connect', discover);
  }
}

function init() {
  noble.startScanning([], false); // any service UUID, no duplicates
  noble.on('discover', connect);
}

noble.on('stateChange', (state) => {
  if (state === 'poweredOn') {
    (async () => {
      init();
    })();
  }
});
