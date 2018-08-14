const noble = require('noble');
const net = require('net');

const debug = false;

const { spawn } = require('child_process');

let tx = null;
const mainSocket = { socket: null }

const queue = [];

const processQueue = () => {
  if (queue.length > 0 && tx && mainSocket.socket) {
    const [item] = queue.splice(0, 1);

    if (debug) {
      console.log(`${item.type}: ${item.data.toString('hex')} ${item.data.toString()}`);
    }

    const write = (d) => {
      while (d.length > 20) {
        const output = d.slice(0, 19);
        tx.write(new Buffer(output), true);
        d = d.slice(19);
      }

      tx.write(new Buffer(d), true);
    }

    if (item.type === 'configurator') {
      write(item.data);
    }

    if (item.type === 'fc') {
      mainSocket.socket.write(item.data);
    }
  }

  setTimeout(() => {
    processQueue();
  }, 0);
}

processQueue();


const getCharacteristics = (error, characteristics) => {
  //console.log(`UUID=${characteristics.map(c => `${c.uuid}=${c.type}-${c.properties.join('|')}`)}`);
  const rx = characteristics.find(c => c.uuid === '1002');

  if (!rx) {
    console.log('Cannot find rx uuid...');
    process.exit();
  }

  rx.notify(true);

  rx.on('read', (data) => {
    queue.push({
      type: 'fc',
      data
    });
  });

  tx = characteristics.find(c => c.uuid === '1001');

  if (!tx) {
    console.log('Cannot find tx uuid...');
    process.exit();
  }

  /*
  const msp = require('./msp');

  const d = msp.send('MSP_MOTOR');
  const rawr = () => {
    setTimeout(() => {
      write(d);
      console.log('writing msp motor', d.toString());
      rawr();
    }, 1000);
  }

  rawr();*/

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
    mainSocket.socket = socket;
    queue.push({
      type: 'configurator',
      data
    });
  });
});

noble.on('stateChange', (state) => {
  if (state === 'poweredOn') {
    (async () => {
      // grab an arbitrary unused port.
      server.listen(8888, () => {
        console.log('Listening on ', server.address());
        spawn('socat', ['-d', '-d', 'pty,raw,echo=0,iexten=0', 'TCP:127.0.0.1:8888'], { stdio: 'inherit' });
        init();
      });
    })();
  }
});
