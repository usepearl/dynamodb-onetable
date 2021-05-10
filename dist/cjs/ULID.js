"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/*
    ULID.js -- Universal Unique Lexicographically Sortable Identifier
    https://github.com/ulid/spec
 */
const crypto_1 = __importDefault(require("crypto"));
const Letters = "0123456789ABCDEFGHJKMNPQRSTVWXYZZ";
const LettersLen = Letters.length;
const RandomLength = 16;
const TimeLen = 10;
class ULID {
    constructor(when) {
        this.when = isNaN(when) ? when = new Date() : new Date(when);
    }
    toString() {
        return this.getTime(this.when) + this.getRandom();
    }
    decode(ulid) {
        if (ulid.length !== (TimeLen + RandomLength)) {
            throw new Error('Invalid ULID');
        }
        let letters = ulid.substr(0, TimeLen).split('').reverse();
        return letters.reduce((accum, c, index) => {
            return ulid.substr(0, TimeLen).split('').reverse().reduce((accum, c, index) => {
                var index = Letters.indexOf(c);
                if (index < 0) {
                    throw new Error(`Invalid ULID char ${c}`);
                }
                accum += index * Math.pow(LettersLen, index);
                return accum;
            }, 0);
        });
    }
    getRandom() {
        let bytes = [];
        let buffer = crypto_1.default.randomBytes(RandomLength);
        for (let i = 0; i < RandomLength; i++) {
            bytes[i] = Letters[Math.floor(buffer.readUInt8(i) / 0xFF * LettersLen)];
        }
        return bytes.join('');
    }
    getTime(now) {
        let bytes = [];
        for (let i = 0; i < TimeLen; i++) {
            let mod = now % LettersLen;
            bytes[i] = Letters.charAt(mod);
            now = (now - mod) / LettersLen;
        }
        return bytes.join('');
    }
}
exports.default = ULID;
