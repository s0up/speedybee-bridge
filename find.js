const noble = require('noble');
const msp = require('./msp');

const reader = new msp.reader();

const knownServices = [
  /*
  {
    serviceUUID: 'f000ffd004514000b000000000000000',
    txUUID: '1234',
    rxUUID: '1234'
  },*/
  /*
  {
    serviceUUID: '180a',
    txUUID: '1234',
    rxUUID: '1234'
  },*/

  {
    serviceUUID: '1000',
    txUUID: '1003',
    rxUUID: '1002'
  },
]

const getDescriptors = (error, descriptors) => {
  descriptors[0].readValue((err, value) => {
    if (err) {
      console.log('ERR', err.toString());
      process.exit();
    }

    if (value) {
      console.log('VALUE', value.toString());
    }
  })
}

const getCharacteristics = (error, characteristics) => {
  console.log(`UUID=${characteristics.map(c => `${c.uuid}=${c.type}-${c.properties.join('|')}`)}`);

  const rx = characteristics.find(c => c.uuid === '1002');

  if (!rx) {
    console.log('Cannot find rx uuid...');
    process.exit();
  }

  rx.discoverDescriptors(getDescriptors);
  rx.notify(true);

  rx.read((data, notification) => {
    if (data) {
      data = data.toString();
    }

    if (notification) {
      notification = notification.toString();
    }
    console.log('RX READING', data, notification);
  });

  rx.on('read', (data, notification) => {
    reader.handleBuffer(data);


    reader.on('message', (message) => {
      console.log(message);
    });

    if (data) {
      data = data.toString();
    }

    if (notification) {
      notification = notification.toString();
    }

    console.log('RX READ', data, notification);
  });

  rx.on('data', (data, notification) => {
    if (data) {
      data = data.toString();
    }

    if (notification) {
      notification = notification.toString();
    }
    console.log('RX DATA', data, notification);
  });

  const tx = characteristics.find(c => c.uuid === '1001');

  if (!tx) {
    console.log('Cannot find tx uuid...');
    process.exit();
  }

  tx.discoverDescriptors(getDescriptors);

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
    console.log(`Found service with UUID ${service.uuid}`);
    if (knownServices.find(i => i.serviceUUID === service.uuid)) {
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
/*
function init() {
  noble.startScanning(); // any service UUID, no duplicates
  noble.startScanning([], true); // any service UUID, allow duplicates

  let connected = false;

  const discoverServices = (services) => {
    services.forEach((service) => {
      console.log(service);
    });
  }

  const connect = (p) => {
    p.connect((result) => {
      noble.stopScanning();
      p.discoverServices([], (error, services) => {
        discoverServices(services);
      }); // particular UUID's
    });
  }

  const print = () => {
    setTimeout(() => {
      const perihiperals = noble._peripherals;
      const serviceNames = Object.keys(perihiperals).forEach((i) => {
        const p = perihiperals[i];

        if (!connected && p.advertisement.localName && p.advertisement.localName.includes('SBF4')) {
          connected = true;
          connect(p);
        }
      });
      print();
    }, 5000);
  }

  print();
}*/

noble.on('stateChange', (state) => {
  if (state === 'poweredOn') {
    (async () => {
      init();
    })();
  }
});
