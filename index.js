var crc = require('crc');

function egtsToJson(egtsPacketBuf /* : Buffer */) /* : Object */ {
  var buf = egtsPacketBuf;
  var offset = 0;

  var result = {};

  // Header
  var header = {};

  header.PRV = buf.readUInt8(offset); offset += 1;
  if (header.PRV !== 0x01) {
    result.error = {
      code: 128,
      name: 'EGTS_PC_UNS_PROTOCOL',
    };
    return result;
  }

  header.SKID = buf.readUInt8(offset); offset += 1;

  var flags = buf.readUInt8(offset); offset += 1;
  header.PRF = (flags & parseInt('11000000', 2)) >> 6;
  header.RTE = Boolean(flags & parseInt('00100000', 2));
  header.ENA = (flags & parseInt('00011000', 2)) >> 3;
  header.CMP = Boolean(flags & parseInt('00000100', 2));
  header.PR = flags & parseInt('00000011', 2);

  header.HL = buf.readUInt8(offset); offset += 1;
  if (!(header.HL === 11 || header.HL === 16)) {
    result.error = {
      code: 131,
      name: 'EGTS_PC_INC_HEADERFORM',
    };
  }

  header.HE  = buf.readUInt8(offset); offset += 1;
  header.FDL = buf.readUInt16LE(offset); offset += 2;
  header.PID = buf.readUInt16LE(offset); offset += 2;
  header.PT = buf.readUInt8(offset); offset += 1;
  if (header.RTE) {
    header.PRA = buf.readUInt16LE(offset); offset += 2;
    header.RCA = buf.readUInt16LE(offset); offset += 2;
    header.TTL = buf.readUInt8(offset); offset += 1;
  }
  header.HCS = buf.readUInt8(offset); offset += 1;

  var headerBufferWithoutHCS = buf.slice(0, header.HL - 1);
  var headerChecksum = crc.crc8(headerBufferWithoutHCS);
  if (headerChecksum !== header.HCS) {
    result.error = {
      code: 137,
      name: 'EGTS_PC_HEADERCRC_ERROR',
    };
    return result;
  }

  result.header = header;

  if (!header.FDL) {
    return result;
  };

  // SFRD
  var sfrdBuf = buf.slice(offset, offset + header.FDL); offset += header.FDL;
  var SFRCS = buf.readUInt16LE(offset); offset += 2;

  var sfrdChecksum = crc.crc16(sfrdBuf);
  if (sfrdChecksum !== SFRCS) {
    result.error = {
      code: 138,
      name: 'EGTS_PC_DATACRC_ERROR',
    };
  }

  try {
    var SFRD;

    switch (header.PT) {
      case 0: // EGTS_PT_RESPONSE
        SFRD = parseSfrdResponse(buf);
        break;

      case 1: // EGTS_PT_APPDATA
        SFRD = parseSfrdAppData(buf);
        break;

      case 2: // EGTS_PT_SIGNED_APPDATA
        SFRD = parseSfrdSignedAppData(buf);
        break;

      default:
        throw new Error('Unknown packet type');
    }

    result.SFRD = SFRD;
  } catch (e) {
    result.error = {
      code: 132,
      name: 'EGTS_PC_INC_DATAFORM',
    };
  }

  return result;
}

function parseSfrdResponse(buf) {
  var response = {};

  var offset = 0;
  response.RPID = buf.readUInt16LE(offset); offset += 2;
  response.PR = buf.readUInt8(offset); offset += 1;

  var restSFRD = buf.slice(offset);
  var sfrd;
  if (restSFRD.length) {
    sfrd = parseSfrdAppData(restSFRD);
  } else {
    sfrd = {};
  }

  sfrd.response = response;
  return sfrd;
}

function parseSfrdAppData(buf) {

}

function parseSfrdSignedAppData(buf) {
  var signature = {};

  var offset = 0;
  signature.SIGL = buf.readUInt16LE(offset); offset += 2;
  signature.SIGD = buf.slice(offset, signature.SIGL); offset += signature.SIGL;

  var restSFRD = buf.slice(offset);
  var sfrd;
  if (restSFRD.length) {
    sfrd = parseSfrdAppData(restSFRD);
  } else {
    sfrd = {};
  }

  sfrd.signature = signature;
  return sfrd;
}
