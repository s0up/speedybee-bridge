const eventEmitter = require('events');
const util = require('util');

//http://www.multiwii.com/wiki/index.php?title=Multiwii_Serial_Protocol
//https://github.com/cleanflight/cleanflight/blob/2d1b548d0599c1575aecb345327f2737f52ea426/src/main/io/serial_msp.c

const utils = {
  joinUints(uints) {
    let out = uints[uints.length - 1];
    for (let index = uints.length - 2; index >= 0; index--) {
      out = (out << 8) + uints[index];
    }
    return out;
  },
  splitUint(uint, amount) {
    if (amount == undefined) amount = 2;

    switch (amount) {
      case 2 :
        uint = new Uint16Array([uint]);
        return [
          uint[0] & 255,
          uint[0] >>> 8
        ];
        break; //redundant but for backup (when/if modified) and sanity
      case 4 :
        uint = new Uint32Array([uint]);
        return [
          uint[0] & 255,
          (uint[0] >>> 8) & 255,
          (uint[0] >>> 16) & 255,
          (uint[0] >>> 24) & 255
        ];
        break;
    }
  }
};

const messageCodes = {
  //Inputs
  100: {
    name: 'MSP_IDENT',
    size: 7,
    handler(parts) {
      const out = {
        type: 'MSP_IDENT',
        version: parts[0]
      };
      /*const types = [
        'TRI/QUADP',
        'QUADX',
        'BI',
        'GIMBAL',
        'Y6',
        'HEX6',
        'FLYING_WING',
        'Y4',
        'HEX6X',
        'OCTOX8',
        'OCTOFLATP',
        'OCTOFLATX',
        'AIRPLANE',
        'HELI_120',
        'HELI_90',
        'VTAIL4',
        'HEX6H',
        'SINGLECOPTER',
        'DUALCOPTER'
      ];
      if (parts[1] >= types.length) {
        out.multitype = parts[1];
      }
      out.multitype = types[parts[1]];*/
      out.multitype = parts[1];
      //console.log(utils.joinUints([parts[3], parts[4], parts[5], parts[6]]))/*.toString(2));*/
      return out;
    }
  },
  101: {
    name: 'MSP_STATUS',
    size: 11,
    handler(parts) {
      const out = {
        type: 'MSP_STATUS',
        cycleTime: utils.joinUints([parts[0], parts[1]]),
        i2cErrors: utils.joinUints([parts[2], parts[3]])/*,
        sensor : utils.joinUints([parts[4], parts[5]]),
        flag : utils.joinUints([parts[6], parts[7], parts[8], parts[9]]),
        currentConfigurationSetting : parts[10]*/
      };
      return out;
    }
  },
  102: {
    name: 'MSP_RAW_IMU',
    size: 18,
    handler(parts) {
      const out = {
        type: 'MSP_RAW_IMU',
        acc: {
          x: utils.joinUints([parts[0], parts[1]]),
          y: utils.joinUints([parts[2], parts[3]]),
          z: utils.joinUints([parts[4], parts[5]])
        },
        gyro: {
          x: utils.joinUints([parts[6], parts[7]]),
          y: utils.joinUints([parts[8], parts[9]]),
          z: utils.joinUints([parts[10], parts[11]])
        },
        mag: {
          x: utils.joinUints([parts[12], parts[13]]),
          y: utils.joinUints([parts[14], parts[15]]),
          z: utils.joinUints([parts[16], parts[17]])
        }
      };
      return out;
    }
  },
  103: {
    name: 'MSP_SERVO',
    size: 16,
    handler(parts) {
      const out = {
        type: 'MSP_SERVO',
        servos: []
      };
      for (let index = 1; index < parts.length; index += 2) {
        out.servos.push(utils.joinUints([parts[index - 1], parts[index]]));
      }
      return out;
    }
  },
  104: {
    name: 'MSP_MOTOR',
    size: 16,
    handler(parts) {
      const out = {
        type: 'MSP_MOTOR',
        motors: []
      };
      for (let index = 1; index < parts.length; index += 2) {
        out.motors.push(utils.joinUints([parts[index - 1], parts[index]]))
      }
      return out;
    }
  },
  105: {
    name: 'MSP_RC',
    size: 16,
    handler(parts) {
      const out = {
        type: 'MSP_RC',
        roll: utils.joinUints([parts[0], parts[1]]),
        pitch: utils.joinUints([parts[2], parts[3]]),
        yaw: utils.joinUints([parts[4], parts[5]]),
        throttle: utils.joinUints([parts[6], parts[7]]),
        aux: []
      };
      for (let index = 9; index < parts.length; index += 2) {
        out.aux.push(utils.joinUints([parts[index - 1], parts[index]]))
      }
      return out;
    }
  },
  106: {
    name: 'MSP_RAW_GPS',
    size: 16,
    handler(parts) {
      const out = {
        type: 'MSP_RAW_GPS',
        satellites: parts[1],
        latitude: utils.joinUints([parts[2], parts[3], parts[4], parts[5]]),
        longitude: utils.joinUints([parts[6], parts[7], parts[8], parts[9]]),
        altitude: utils.joinUints([parts[10], parts[11]]),
        speed: utils.joinUints([parts[12], parts[13]]),
        heading: utils.joinUints([parts[14], parts[15]])
      };
      return out;
    }
  },
  107: {
    name: 'MSP_COMP_GPS',
    size: 5,
    handler(parts) {
      const out = {
        type: 'MSP_COMP_GPS',
        distanceToHome: utils.joinUints([parts[0], parts[1]]),
        headingToHome: utils.joinUints([parts[2], parts[3]])
      };
      if (parts[4] == 0) {
        out.gpsUpdate = false;
      } else {
        out.gpsUpdate = true;
      }
      return out;
    }
  },
  108: {
    name: 'MSP_ATTITUDE',
    size: 6,
    handler(parts) {
      const out = {
        type: 'MSP_ATTITUDE',
        angle: {
          x: utils.joinUints([parts[0], parts[1]]),
          y: utils.joinUints([parts[2], parts[3]])
        },
        heading: utils.joinUints([parts[4], parts[5]])
      };
      return out;
    }
  },
  109: {
    name: 'MSP_ALTITUDE',
    size: 6,
    handler(parts) {
      const out = {
        type: 'MSP_ALTITUDE',
        estimatedAltitude: utils.joinUints([parts[0], parts[1], parts[2], parts[3]]), //In cm
        variation: utils.joinUints([parts[4], parts[5]]) //cm per second
      };
      return out;
    }
  },
  110: {
    name: 'MSP_ANALOG',
    size: 7,
    handler(parts) {
      const out = {
        type: 'MSP_ANALOG',
        batteryVoltage: (parts[0] / 10), //Voltage in volts (arrives in 1/10 of a volt)
        powerMeterSum: utils.joinUints([parts[1], parts[2]]),
        rssi: utils.joinUints([parts[3], parts[4]]) / 1023, //Range of 0-1 (arrives in 0-1023)
        amperage: utils.joinUints([parts[5], parts[6]])
      };
      return out;
    }
  },
  111: {
    name: 'MSP_RC_TUNING',
    //size : 7, For multiwii
    size: 11, //For cleanflight (https://github.com/cleanflight/cleanflight/blob/68da7780452b2500da0dea44891a26f2765e5b8d/src/main/io/serial_msp.c)
    handler(parts) {
      const out = {
        type: 'MSP_RC_TUNING',
        rc: {
          rate: parts[0],
          expo: parts[1]
        },
        /*rate : { //For MultiWii
          rollPitch : parts[2],
          yaw :  parts[3]
        },
        throttle : {
          dynamicPid : parts[4],
          mid : parts[5],
          expo :  parts[6]
        }*/
        rate: { //For Cleanflight
          roll: parts[2],
          pitch: parts[3],
          yaw: {
            rate: parts[4],
            expo: parts[10]
          },
          breakpoint: utils.joinUints([parts[8], parts[9]])
        },
        throttle: {
          dynamicPid: parts[5],
          mid: parts[6],
          expo: parts[7]
        }
      };
      return out;
    }
  },
  112: {
    name: 'MSP_PID',
    size: 30,
    handler(parts) {
      const out = {
        type: 'MSP_PID',
      };
      const components = [
        'roll',
        'pitch',
        'yaw',
        'altitude',
        'position',
        'positionR',
        'navagationR',
        'level',
        'mag',
        'vel'
      ];
      for (let index = 0; index < components.length; index++) {
        const component = {
          p: parts[index * 3],
          i: parts[(index * 3) + 1],
          d: parts[(index * 3) + 2]
        }
        out[components[index]] = component;
      }
      return out;
    }
  },
  113: undefined, //Not yet implemented
  114: {
    name: 'MSP_MISC',
    size: 22,
    handler(parts) {
      const out = {
        type: 'MSP_MISC',
        powerTrigger: utils.joinUints([parts[0], parts[1]]),
        throttle: {
          min: utils.joinUints([parts[2], parts[3]]),
          max: utils.joinUints([parts[4], parts[5]]),
          failsafe: utils.joinUints([parts[8], parts[9]]),
        },
        minCommand: utils.joinUints([parts[6], parts[7]]),
        arm: utils.joinUints([parts[10], parts[11]]),
        lifetime: utils.joinUints([parts[12], parts[13], parts[14, parts[15]]]),
        magneticDeclination: utils.joinUints([parts[16], parts[17]]),
        battery: {
          scale: parts[18] / 10, //10th divide of a volt chnaged to volts
          warn: [parts[19], parts[20]] / 10,
          critical: parts[21] / 10
        }
      };
      return out;
    }
  },
  115: {
    name: 'MSP_MOTOR_PINS',
    size: 8,
    handler(parts) {
      const out = {
        type: 'MSP_MOTOR_PINS',
        motor: []
      };
      for (let index = 0; index < parts.length; index++) {
        out.motor[index] = parts[index];
      }
      return out;
    }
  },
  116: undefined,
  117: undefined,
  118: {
    name: 'MSP_WP',
    size: 18,
    handler(parts) {
      const out = {
        type: 'MSP_WP',
        number: parts[0],
        latitude: utils.joinUints([parts[1], parts[2], parts[3], parts[4]]),
        longitude: utils.joinUints([parts[5], parts[6], parts[7], parts[8]]),
        altitude: utils.joinUints([parts[9], parts[10], parts[11], parts[12]]),
        heading: utils.joinUints([parts[13], parts[14]]),
        time: utils.joinUints([parts[15], parts[16]]),
        navFlag: parts[17]
      };
      return out;
    }
  },
  119: undefined,
  120: undefined,
  //Inputs
  200: {
    name: 'MSP_SET_RAW_RC',
    builder(options, callback) {
      const confine = function (number, rest, max, min) {
        if (number == undefined) number = rest;

        if (rest == undefined) rest = 1500;
        if (max == undefined) max = 2000;
        if (min == undefined) min = 1000;

        if (number == undefined) number = rest;
        if (number > max) number = max;
        if (number < min) number = min;

        return number
      }

      options.roll = confine(options.roll);
      options.pitch = confine(options.pitch);
      options.yaw = confine(options.yaw);
      options.throttle = confine(options.throttle, 1118); //Default to zero for saftey

      if (options.aux == undefined) options.aux = [];

      for (var index = 0; index < 4; index++) {
        options.aux[index] = confine(options.aux[index], 1000);
      }

      const out = new Uint8Array(16);

      options.roll = utils.splitUint(options.roll);
      out[0] = options.roll[0];
      out[1] = options.roll[1];

      options.pitch = utils.splitUint(options.pitch);
      out[2] = options.pitch[0];
      out[3] = options.pitch[1];

      options.yaw = utils.splitUint(options.yaw);
      out[4] = options.yaw[0];
      out[5] = options.yaw[1];

      options.throttle = utils.splitUint(options.throttle);
      out[6] = options.throttle[0];
      out[7] = options.throttle[1];

      for (var index = 0; index < 4; index++) {
        options.aux[index] = utils.splitUint(options.aux[index]);
        out[8 + (index * 2)] = options.aux[index][0];
        out[8 + (index * 2) + 1] = options.aux[index][1];
      }
      return out;
    }
  },
  201: {
    name: 'MSP_SET_RAW_GPS',
    builder(options, callback) {
      if (options.simultation == undefined) options.simtulation = false;
      if (options.satellites == undefined) options.satellites = 0;
      if (options.latitude == undefined) options.latitude = 0;
      if (options.longitude == undefined) options.longitude = 0;
      if (options.altitude == undefined) options.altitude = 0;
      if (options.speed == undefined) options.speed = 0;

      const out = new Uint8Array(14);

      if (options.simultation) {
        out[0] = 0;
      } else {
        out[0] = 1;
      }

      out[1] = options.satellites;

      options.latitude = utils.splitUint(options.latitude, 4);
      out[2] = options.latitude[0];
      out[3] = options.latitude[1];
      out[4] = options.latitude[2];
      out[5] = options.latitude[3];

      options.longitude = utils.splitUint(options.longitude, 4);
      out[6] = options.longitude[0];
      out[7] = options.longitude[1];
      out[8] = options.longitude[2];
      out[9] = options.longitude[3];

      options.altitude = utils.splitUint(options.altitude);
      out[10] = options.altitude[0];
      out[11] = options.altitude[1];

      options.speed = utils.splitUint(options.speed);
      out[12] = options.speed[0];
      out[13] = options.speed[1];

      return out;
    }
  },
  202: {
    name: 'MSP_SET_PID',
    builder(options, callback) {
      const components = [
        'roll',
        'pitch',
        'yaw',
        'altitude',
        'position',
        'positionR',
        'navagationR',
        'level',
        'mag',
        'vel'
      ];

      const out = new Uint8Array(14);

      let index = 0;

      for (const key in components) {
        if (options[key] == undefined) {
          options[key] = {};
        }

        if (options[key].p == undefined) options[key].p = 0;
        if (options[key].i == undefined) options[key].i = 0;
        if (options[key].d == undefined) options[key].d = 0;

        out[index] = options[key].p;
        index++;
        out[index] = options[key].i;
        index++;
        out[index] = options[key].d;
        index++;
      }

      return out;
    }
  },
  203: undefined,
  204: undefined, /* leaving blank as different for cleanflight. will work on at later date{    name : 'MSP_SET_RC_TUNING',
    constructor : function (options, callback) {
    }
  }*/
  205: {
    name: 'MSP_ACC_CALIBRATION'
  },
  206: {
    name: 'MSP_MAG_CALIBRATION'
  },
  207: {
    name: 'MSP_SET_MISC',
    builder(options, callback) {
      const out = new Uint8Array(22);

      //Power trigger
      if (options.powerTrigger == undefined) powerTrigger = 0;

      options.powerTrigger = utils.splitUint(options.powerTrigger);

      out[0] = options.powerTrigger[0];
      out[1] = options.powerTrigger[1];

      //Throttle
      if (options.throttle == undefined) options.throttle = {};
      if (options.throttle.min == undefined) options.throttle.min = 0;
      if (options.throttle.max == undefined) options.throttle.max = 2000;
      if (options.throttle.failsafe == undefined) options.throttle.failsafe = 0;

      options.throttle.min = utils.splitUint(options.throttle.min);
      options.throttle.max = utils.splitUint(options.throttle.max);
      options.throttle.failsafe = utils.splitUint(ooptions.throttle.failsafe);

      out[2] = options.throttle.min[0];
      out[3] = options.throttle.min[1];
      out[4] = options.throttle.max[0];
      out[5] = options.throttle.max[1];
      out[6] = options.throttle.failsafe[0];
      out[7] = options.throttle.failsafe[1];

      //Min Command
      if (options.minCommand == undefined) options.minCommand = 0;

      options.minCommand = utils.splitUint(options.minCommand);

      out[8] = options.minCommand[0];
      out[9] = options.minCommand[1];

      //Arm
      if (options.arm == undefined) options.arm = 0;

      options.arm = utils.splitUint(options.arm);

      out[10] = options.arm[0];
      out[11] = options.arm[1];

      //Lifetime
      if (options.lifetime == undefined) options.lifetime = 0;

      options.lifetime = utils.splitUint(options.lifetime, 4);

      out[12] = options.lifetime[0];
      out[13] = options.lifetime[1];
      out[14] = options.lifetime[2];
      out[15] = options.lifetime[3];

      //Magnetic declination
      if (options.magneticDeclination == undefined) options.magneticDeclination = 0;

      options.magneticDeclination = utils.splitUint(options.magneticDeclination);

      out[16] = options.magneticDeclination[0];
      out[17] = options.magneticDeclination[1];

      //Battery
      if (options.battery == undefined) options.battery = {};
      if (options.battery.scale == undefined) options.battery.scale = 1;
      if (options.battery.warn == undefined) options.battery.warn = [0, 0];
      if (options.battery.warn.length < 2) options.battery.warn = [0, 0];
      if (options.battery.critical == undefined) options.battery.critical = 0;

      out[18] = options.battery.scale;
      out[19] = options.battery.warn[0];
      out[20] = options.battery.warn[1];
      out[21] = options.battery.critical;

      return out;
    }
  },
  208: {
    name: 'MSP_RESET_CONF'
  },
  209: {
    name: 'MSP_SET_WP',
    builder(options, callback) {
      if (options.number == undefined) options.number = 0;
      if (options.latitude == undefined) options.latitude = 0;
      if (options.longitude == undefined) options.longitude = 0;
      if (options.altitude == undefined) options.altitude = 0;
      if (options.heading == undefined) options.heading = 0;
      if (options.time == undefined) options.time = 0;

      if (options.navFlag == undefined) options.navFlag = true;

      if (options.navFlag) options.navFlag = 1;
      else options.navFlag = 0;

      const out = new Uint8Array(18);

      out[0] = options.number;

      options.latitude = utils.splitUint(options.latitude, 4);
      options.longitude = utils.splitUint(options.longitude, 4);

      out[1] = options.latitude[0];
      out[2] = options.latitude[1];
      out[3] = options.latitude[2];
      out[4] = options.latitude[3];

      out[5] = options.longitude[0];
      out[6] = options.longitude[1];
      out[7] = options.longitude[2];
      out[8] = options.longitude[3];

      options.altitude = utils.splitUint(options.altitude, 4);
      out[9] = options.altitude[0];
      out[10] = options.altitude[1];
      out[11] = options.altitude[2];
      out[12] = options.altitude[3];

      options.heading = utils.splitUint(options.heading);
      out[13] = options.heading[0];
      out[14] = options.heading[1];

      options.time = utils.splitUint(options.time);
      out[15] = options.time[0];
      out[16] = options.time[1];

      out[17] = options.navFlag;

      return out;
    }
  },
  210: {
    name: 'MSP_SELECT_SETTING',
    builder(options, callback) {
      if (options.currentSet == undefined) options.currentSet = 0;

      try {
        options.currentSet = parseInt(options.currentSet);
      } catch (error) {
        options.currentSet = 0;
      }

      if (options.currentSet < 0) options.currentSet = 0;
      if (options.currentSet > 2) options.currentSet = 2;

      const out = new Uint8Array(1);

      out[0] = options.currentSet;

      return out;
    }
  },
  211: {
    name: 'MSP_SET_HEAD',
    builder(options, callback) {
      if (options.heading == undefined) options.heading = 0;

      try {
        options.heading = parseInt(options.heading);
      } catch (error) {
        options.heading = 0;
      }

      if (options.heading < -180) options.heading = -180;
      if (options.heading > 180) options.heading = 180;

      options.heading += 180;

      const out = new Uint8Array(2);

      options.heading = utils.splitUint(options.heading);
      out[0] = options.heading[0];
      out[1] = options.heading[1];

      return out;
    }
  },
  212: undefined, /* undefined for now {    name : 'MSP_SET_SERVO_CONF',
    constructor : function (options, callback) {
    }
  }*/
  214: {
    name: 'MSP_SET_MOTOR',
    builder(options, callback) {
      if (options.motors == undefined) options.motors = [];

      const out = new Uint8Array(32);

      for (let index = 0; index < 16; index++) {
        if (options.motors[index] == undefined) options.motors[index] = 0;

        options.motors[index] = utils.splitUint(options.motors[index]);

        out[index * 2] = options.motors[index][0];
        out[(index * 2) + 1] = options.motors[index][1];
      }

      return out;
    }
  },
  240: {
    name: 'MSP_BIND'
  },
  250: {
    name: 'MSP_EEPROM_WRITE'
  }
};

//Lookup message name and return code
const lookupMessageCode = function (type) {
  //So we can pass a hole message quickly
  if (typeof type === 'object') type = type.type;

  for (const key in messageCodes) {
    if (messageCodes[key].name.toUpperCase() == type.toUpperCase()) return key;
  }
};

const mspReader = function () {
  const _self = this;

  let parsing = 'header';
  let position = 0;
  let messageLength;
  let xor;

  const message = {
    id: undefined,
    parts: undefined
  };

  this.handleBuffer = function (buffer) {
    for (let index = 0; index < buffer.length; index++) {
      _self.handleData(buffer[index]);
    }
  };

  this.changeState = function (newState) {
    //console.log(newState);
    //Change the state
    parsing = newState;

    //Reset the position
    position = 0;
  };

  this.messageComplete = function () {
    //console.log(message);

    //Get info and functions for message
    const messageInfo = messageCodes[message.id];

    if (messageInfo == undefined) {
      //Message code is unrecognised
      _self.messageFail('Unrecognised message code');
    } else {
      //The message code is recognised
      if (messageInfo.size == message.parts.length || (messageInfo.size == undefined && message.parts.length == 0)) {
        if (messageInfo.size == undefined) {
          //Message is a confirmation response
          //This means we have no data to return
          _self.emit('message', {
            id: message.id,
            type: messageCodes[message.id].name,
            status: 'success'
          });
        } else {
          //Was a message with a payload, return normally
          const returnData = messageInfo.handler(message.parts);

          //Add the id number (code) into the message
          returnData.id = message.id;
          _self.emit('message', returnData);
        }

        //Reset the state to restart
        _self.changeState('header');
      } else {
        //Message length is invalid
        _self.messageFail('Invalid message length');
      }
    }
  };

  this.messageFail = function (message) {
    //console.log('Message failed - ', message);
    _self.emit('error', message);

    //Reset the state to restart
    _self.changeState('header');
  };

  this.states = {
    header(byte) {
      const header = [36, 77, 62]; // $M> in ascii (the header)
      if (header[position] == byte) {
        position++;
        if (position > 2) {
          //We found an entire header
          //console.log('Header found');

          //Progress state
          _self.changeState('info');
        }
      } else {
        //Byte was not correct part of header sequence... abort
        _self.messageFail('Invalid/Unrecognised header');
      }
    },
    info(byte) {
      if (position == 0) {
        //Start the xor for checksum
        xor = byte;

        //Should be the length byte
        messageLength = byte;

        //Setup message parts uint8array
        message.parts = new Uint8Array(messageLength);
        //console.log(messageLength);

        if (messageLength > 256) {
          //Too long of a message
          _self.messageFail('Message length invalid');
        } else {
          //console.log('Message length : ', messageLength);
        }
      } else if (position == 1) {
        //Update the xor for checksum
        xor ^= byte;

        //Should be the message id byte
        message.id = byte;

        //console.log('Message type : ', message.id);

        //Progress state
        if (messageLength == 0) {
          //Message length zero thus there IS NO payload
          _self.changeState('checksum');
        } else {
          //Message length is more than zero thus there IS a payload
          _self.changeState('payload');
        }


        return;
      }
      position++;
    },
    payload(byte) {
      //Update the xor for checksum
      xor ^= byte;

      //Push the byte into the messages parts
      message.parts[position] = byte;

      position++;

      if (position == messageLength) {
        //Finished parsing payload
        //console.log('Finished parsing ' + messageLength + ' bytes of payload');

        //Progress state
        _self.changeState('checksum');
      }
    },
    checksum(byte) {
      if (byte == xor) {
        _self.messageComplete();
      } else {
        _self.messageFail('Invalid checksum');
      }
    }
  };

  this.handleData = function (byte) {
    _self.states[parsing](byte);
  };

  eventEmitter.call(this);
};

util.inherits(mspReader, eventEmitter);

module.exports = {
  reader: mspReader,

  lookup: lookupMessageCode,

  send(code, optionsInput) {
    function shallowCopy(o) {
      const copy = Object.create(o);
      for (prop in o) {
        if (o.hasOwnProperty(prop)) {
          if (typeof o[prop] === 'object') {
            copy[prop] = shallowCopy(o[prop]);
          } else {
            copy[prop] = o[prop];
          }
        }
      }
      return copy;
    }

    let options;
    if (optionsInput == undefined || optionsInput == null) {
      options = {};
    } else {
      options = shallowCopy(optionsInput); //Prevent byref funcion arg!!!
    }

    //console.log(options);

    if (typeof code === 'string') {
      for (const key in messageCodes) {
        if (messageCodes[key] != undefined) {
          if (messageCodes[key].name.toLowerCase() == code.toLowerCase()) {
            code = key;
            break;
          }
        }
      }
    }

    if (messageCodes[code] == undefined) {
      throw 'Code is not available/implemented';
    } else if (messageCodes[code].builder == undefined) {
      var word = new Buffer(6);

      word.write('$M<', 'ascii');

      word[3] = 0;
      word[4] = code;
      word[5] = code;

      return word;
    } else {
      const parts = messageCodes[code].builder(options);

      //console.log(code, parts);

      var word = new Buffer(6 + parts.length);

      word.write('$M<', 'ascii');

      word[3] = parts.length;
      word[4] = code;

      let xor = word[3] ^ word[4];

      //Payload
      for (let index = 0; index < parts.length; index++) {
        word[index + 5] = parts[index];
        xor ^= word[index + 5];
      }
      word[5 + parts.length] = xor;

      return word;
    }
  }
};

/*for (var key in messageCodes) {
  if (messageCodes[key] != undefined) {
    console.log(key + '. ' + messageCodes[key].name);
  }
}*/
