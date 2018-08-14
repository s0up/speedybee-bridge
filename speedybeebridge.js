const noble = require('noble');
const SerialPort = require('serialport');
const net = require('net');
const EventEmitter = require('events');

//Serial port that communicates with the configurator

//socat -d -d pty,raw,echo=0 TCP:127.0.0.1:8888
const emitter = new EventEmitter();

const getCharacteristics = (error, characteristics) => {
  //console.log(`UUID=${characteristics.map(c => `${c.uuid}=${c.type}-${c.properties.join('|')}`)}`);

  const rx = characteristics.find(c => c.uuid === '1002');

  if (!rx) {
    console.log('Cannot find rx uuid...');
    process.exit();
  }

  rx.notify(true);

  rx.on('read', (data) => {
    console.log('Received data from SBF4...');
    emitter.emit('fcData', data);
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

  /*
  const d = msp.send('MSP_MOTOR');
  write(d);*/
  emitter.on('tcpData', (data) => {
    write(data);
  });

  console.log('Waiting for commands...');
}

const explore = (error, services) => {
  for (const service of services) {
    if (service.uuid === '1000') {
      console.log('Found UART service...');
      service.discoverCharacteristics([], getCharacteristics);
    }
  }
}

const connect = (peripheral) => {
  if (peripheral.advertisement.localName && peripheral.advertisement.localName.includes('SBF4')) {
    peripheral.connect();

    const discover = () => {
      // once you know you have a peripheral with the desired
      // service, you can stop scanning for others:
      noble.stopScanning();
      // get the service you want on this peripheral:
      peripheral.discoverServices([], explore);

      console.log('Connected to SBF4...');
    }

    peripheral.on('connect', discover);
  }
}

function init() {
  noble.startScanning([], false); // any service UUID, no duplicates
  noble.on('discover', connect);
}

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    emitter.emit('tcpData', data);
  });

  emitter.on('fcData', (data) => {
    socket.write(data);
  })
});

noble.on('stateChange', (state) => {
  if (state === 'poweredOn') {
    (async () => {
      // grab an arbitrary unused port.
      server.listen(8888, () => {
        console.log('Listening on ', server.address());
        init();
      });
    })();
  }
});
