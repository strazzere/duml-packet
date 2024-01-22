import { Packet } from '../dist/packet';

function fuzz(buffer) {
    try {
      const fuzzing = Packet.fromBuffer(buffer)
      fuzzing.isValid()
      fuzzing.toHexString()
      fuzzing.toLongString()
      fuzzing.toShortString()
    } catch (e) {
        if (e.message.indexOf('Buffer length smaller than minimum size allowed for valid packet') !== -1 ||
            e.message.indexOf('Unexpected magic identifier') !== -1 ||
            e.message.indexOf('Packet length larger than provided buffer') !== -1) {
        } else {
            throw e;
        }
    }
}

export default {
    fuzz
};