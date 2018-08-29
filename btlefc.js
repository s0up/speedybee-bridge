const noble = require('noble');
const net = require('net');

const debug = false;

const { spawn } = require('child_process');

let currentDevice = null;
let tx = null;
const mainSocket = { socket: null }

const queue = [];

const devices = [
  {
    name: 'SpeedyBee F4',
    mustContain: 'SBF4',
    rxUUID: '1002',
    txUUID: '1001',
    serviceUUID: '1000'
  }
]

const setCurrentDevice = (name) => {
  // Only set once
  if (currentDevice) {
    return;
  }

  currentDevice = devices.find(d => name.includes(d.mustContain));
}

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
  const rx = characteristics.find(c => c.uuid === currentDevice.rxUUID);

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

  tx = characteristics.find(c => c.uuid === currentDevice.txUUID);

  if (!tx) {
    console.log('Cannot find tx uuid...');
    process.exit();
  }

  console.log('Waiting for commands...');
}

const explore = (error, services) => {
  for (const service of services) {
    if (service.uuid === currentDevice.serviceUUID) {
      console.log('Found UART service...');
      service.discoverCharacteristics([], getCharacteristics);
    }
  }
}

const connect = (peripheral) => {
  if (peripheral.advertisement.localName) {
    setCurrentDevice(peripheral.advertisement.localName);

    if (!currentDevice) {
      return;
    }

    peripheral.connect();

    peripheral.once('disconnect', () => {
      console.log('Disconnected.  Waiting for new connection...');
      noble.startScanning([], false); // any service UUID, no duplicates
    });

    const discover = () => {
      // once you know you have a peripheral with the desired
      // service, you can stop scanning for others:
      noble.stopScanning();
      // get the service you want on this peripheral:
      peripheral.discoverServices([], explore);
    }

    peripheral.once('connect', discover);
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
