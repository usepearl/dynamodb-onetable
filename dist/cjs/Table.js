"use strict";
/*
    Table.js - DynamoDB table class
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Table = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ULID_js_1 = __importDefault(require("./ULID.js"));
const Model_js_1 = require("./Model.js");
const IV_LENGTH = 16;
/*
    Default index keys if not supplied
 */
const DefaultIndexes = {
    primary: {
        hash: 'pk',
        sort: 'sk',
    },
};
/*
    Represent a single DynamoDB table
 */
class Table {
    constructor(params = {}) {
        let { client, //  Instance of DocumentClient or Dynamo. Use client.V3 to test for Dynamo V3.
        createdField, //  Name of "created" timestamp attribute.
        crypto, //  Crypto configuration. {primary: {cipher: 'aes-256-gcm', password}}.
        delimiter, //  Composite sort key delimiter (default ':').
        hidden, //  Hide key attributes in Javascript properties. Default false.
        intercept, //  Intercept hook function(model, operation, item, params, raw). Operation: 'create', 'delete', 'put', ...
        isoDates, //  Set to true to store dates as Javascript ISO Date strings.
        logger, //  Logging function(tag, message, properties). Tag is data.info|error|trace|exception.
        name, //  Table name.
        nulls, //  Store nulls in database attributes. Default false.
        schema, //  Table models schema.
        timestamps, //  Make "created" and "updated" timestamps. Default true.
        typeField, //  Name of model type attribute. Default "_type".
        updatedField, //  Name of "updated" timestamp attribute.
        uuid, //  Function to create a UUID, ULID, KSUID if field schema requires it.
        //  DEPRECATED
        ksuid, //  Function to create a KSUID if field schema requires it.
        ulid, //  Function to create a ULID if field schema requires it.
         } = params;
        if (!name) {
            throw new Error('Missing "name" property');
        }
        if (!client) {
            throw new Error('Missing "client" property');
        }
        this.logger = logger;
        this.log('trace', `Loading OneTable`, { params });
        this.params = params;
        this.client = client;
        this.V3 = client.V3;
        this.intercept = intercept;
        this.nulls = nulls || false;
        this.delimiter = delimiter || '#';
        this.createdField = createdField || 'created';
        this.updatedField = updatedField || 'updated';
        this.isoDates = isoDates || false;
        this.typeField = typeField || '_type';
        this.name = name;
        this.timestamps = timestamps || true;
        this.hidden = hidden || true;
        if (uuid == 'uuid') {
            this.makeID = this.uuid;
        }
        else if (uuid == 'ulid') {
            this.makeID = this.ulid;
        }
        else {
            this.makeID = uuid || this.uuid;
        }
        //  DEPRECATED
        this.ulid = ulid || this.ulid;
        this.ksuid = ksuid;
        //  Schema models
        this.models = {};
        this.indexes = DefaultIndexes;
        //  Context properties always applied to create/updates
        this.context = {};
        if (schema) {
            this.prepSchema(schema);
        }
        /*
            Model for unique attributes and for genric low-level API access
         */
        let primary = this.indexes.primary;
        this.unique = new Model_js_1.Model(this, '_Unique', {
            fields: {
                [primary.hash]: { value: '_unique:${' + primary.hash + '}' },
                [primary.sort]: { value: '_unique:' },
            },
            indexes: this.indexes,
            timestamps: false
        });
        this.generic = new Model_js_1.Model(this, '_Generic', {
            fields: {
                [primary.hash]: {},
                [primary.sort]: {},
            },
            indexes: this.indexes,
            timestamps: false
        });
        if (crypto) {
            this.initCrypto(crypto);
            this.crypto = Object.assign(crypto || {});
            for (let [name, crypto] of Object.entries(this.crypto)) {
                crypto.secret = crypto_1.default.createHash('sha256').update(crypto.password, 'utf8').digest();
                this.crypto[name] = crypto;
                this.crypto[name].name = name;
            }
        }
    }
    //  Return the current schema. This may include model schema defined at run-time
    getSchema() {
        let schema = { name: this.name, models: {}, indexes: this.indexes };
        for (let [name, model] of Object.entries(this.models)) {
            let item = {};
            for (let [field, properties] of Object.entries(model.fields)) {
                item[field] = {
                    crypt: properties.crypt,
                    enum: properties.enum,
                    filter: properties.filter,
                    foreign: properties.foreign,
                    hidden: properties.hidden,
                    map: properties.map,
                    name: field,
                    nulls: properties.nulls,
                    required: properties.required,
                    size: properties.size,
                    type: (typeof properties.type == 'function') ? properties.type.name : properties.type,
                    unique: properties.unique,
                    validate: properties.validate ? properties.validate.toString() : null,
                    value: properties.value,
                    //  Computed state
                    attribute: properties.attribute,
                    isIndexed: properties.isIndexed,
                };
            }
            schema.models[name] = item;
        }
        return schema;
    }
    prepSchema(params) {
        let { models, indexes } = params;
        if (!models || typeof models != 'object') {
            throw new Error('Schema is missing models');
        }
        if (!indexes || typeof indexes != 'object') {
            throw new Error('Schema is missing indexes');
        }
        this.indexes = indexes;
        for (let [name, fields] of Object.entries(models)) {
            this.models[name] = new Model_js_1.Model(this, name, { fields, indexes });
        }
    }
    listModels() {
        return Object.keys(this.models);
    }
    addModel(name, fields) {
        this.models[name] = new Model_js_1.Model(this, name, { indexes: schema.indexes, fields });
    }
    /*
        Thows exception if model cannot be found
     */
    getModel(name) {
        if (typeof name != 'string') {
            throw new Error(`Bad argument type for model name ${name}`);
        }
        let model = this.models[name];
        if (!model) {
            throw new Error(`Cannot find model ${name}`);
        }
        return model;
    }
    removeModel(name) {
        if (this.getModel(name)) {
            delete this.models[name];
        }
    }
    /*
        Set or update the context object. Return this for chaining.
     */
    setContext(context = {}, merge = false) {
        this.context = merge ? Object.assign(this.context, context) : context;
        return this;
    }
    /*
        Clear the context
     */
    clear() {
        this.context = {};
        return this;
    }
    //  High level API
    create(modelName, properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let model = this.getModel(modelName);
            return yield model.create(properties, params);
        });
    }
    find(modelName, properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let model = this.getModel(modelName);
            return yield model.find(properties, params);
        });
    }
    get(modelName, properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let model = this.getModel(modelName);
            return yield model.get(properties, params);
        });
    }
    remove(modelName, properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let model = this.getModel(modelName);
            return yield model.remove(properties, params);
        });
    }
    scan(modelName, properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let model = this.getModel(modelName);
            return yield model.scan(properties, params);
        });
    }
    update(modelName, properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let model = this.getModel(modelName);
            return yield model.update(properties, params);
        });
    }
    //  Low level API
    batchGet(batch, params = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            let result;
            try {
                this.log('trace', `Dynamo batchGet on "${this.name}"`, { batch }, params);
                batch.ConsistentRead = params.ConsistenRead ? true : false;
                if (this.V3) {
                    result = yield this.client.batchGet(batch);
                }
                else {
                    result = yield this.client.batchGet(batch).promise();
                }
                let response = result.Responses;
                if (params.parse && response) {
                    result = [];
                    for (let [tableName, items] of Object.entries(response)) {
                        for (let item of items) {
                            item = this.unmarshall(item);
                            let type = item[this.typeField] || '_unknown';
                            let model = this.models[type];
                            if (model && model != this.unique) {
                                result.push(model.transformReadItem('get', item, params));
                            }
                        }
                    }
                }
            }
            catch (err) {
                this.log('info', `BatchGet error`, { message: err.message, batch });
                throw err;
            }
            return result;
        });
    }
    batchWrite(batch, params = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            let result;
            try {
                this.log('trace', `Dynamo batchWrite on "${this.name}"`, { batch }, params);
                if (this.V3) {
                    result = yield this.client.batchWrite(batch);
                }
                else {
                    result = yield this.client.batchWrite(batch).promise();
                }
            }
            catch (err) {
                this.log('info', `BatchWrite error`, { message: err.message, batch });
                throw err;
            }
            return result;
        });
    }
    deleteItem(properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.generic.deleteItem(properties, params);
        });
    }
    getItem(properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.generic.getItem(properties, params);
        });
    }
    putItem(properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.generic.putItem(properties, params);
        });
    }
    queryItems(properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.generic.queryItems(properties, params);
        });
    }
    scanItems(properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.generic.scanItems(properties, params);
        });
    }
    updateItem(properties, params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.generic.updateItem(properties, params);
        });
    }
    /*
        Invoke a prepared transaction
        Note: transactGet does not work on non-primary indexes
     */
    transact(op, transaction, params = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            let result;
            try {
                this.log('trace', `Dynamo "${op}" transaction on "${this.name}"`, { transaction, op }, params);
                if (op == 'write') {
                    result = yield this.client.transactWrite(transaction);
                }
                else {
                    result = yield this.client.transactGet(transaction);
                }
                if (!this.V3) {
                    result = result.promise();
                }
                if (op == 'get') {
                    if (params.parse) {
                        let items = [];
                        for (let r of result.Responses) {
                            if (r.Item) {
                                let item = this.unmarshall(r.Item);
                                let type = item[this.typeField] || '_unknown';
                                let model = this.models[type];
                                if (model && model != this.unique) {
                                    items.push(model.transformReadItem('get', item, params));
                                }
                            }
                        }
                        result = items;
                    }
                }
            }
            catch (err) {
                this.log('info', `Transaction error`, { message: err.message, transaction });
                throw err;
            }
            return result;
        });
    }
    /*
        Convert items into a map of items by model type
     */
    groupByType(items) {
        let result = {};
        for (let [index, item] of Object.entries(items)) {
            let type = item[this.typeField] || '_unknown';
            let list = result[type] = result[type] || [];
            list.push(item);
        }
        return result;
    }
    log(type, message, context, params) {
        if (this.logger) {
            if (params && params.log) {
                this.logger('info', message, context);
            }
            else {
                this.logger(type, message, context);
            }
        }
    }
    // Simple non-crypto UUID. See node-uuid if you require crypto UUIDs.
    uuid() {
        return 'xxxxxxxxxxxxxxxxyxxxxxxxxxyxxxxx'.replace(/[xy]/g, function (c) {
            let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    // Simple time-based, sortable unique ID.
    ulid() {
        return new ULID_js_1.default().toString();
    }
    initCrypto(crypto) {
        this.crypto = Object.assign(crypto || {});
        for (let [name, crypto] of Object.entries(this.crypto)) {
            crypto.secret = crypto_1.default.createHash('sha256').update(crypto.password, 'utf8').digest();
            this.crypto[name] = crypto;
            this.crypto[name].name = name;
        }
    }
    encrypt(text, name = 'primary', inCode = 'utf8', outCode = 'base64') {
        if (text) {
            if (!this.crypto) {
                throw new Error('dynamo: No database secret or cipher defined');
            }
            let crypto = this.crypto[name];
            if (!crypto) {
                throw new Error(`dynamo: Database crypto not defined for ${name}`);
            }
            let iv = crypto_1.default.randomBytes(IV_LENGTH);
            let crypt = crypto_1.default.createCipheriv(crypto.cipher, crypto.secret, iv);
            let crypted = crypt.update(text, inCode, outCode) + crypt.final(outCode);
            let tag = (crypto.cipher.indexOf('-gcm') > 0) ? crypt.getAuthTag().toString(outCode) : '';
            text = `${crypto.name}:${tag}:${iv.toString('hex')}:${crypted}`;
        }
        return text;
    }
    decrypt(text, inCode = 'base64', outCode = 'utf8') {
        if (text) {
            let [name, tag, iv, data] = text.split(':');
            if (!data || !iv || !tag || !name) {
                return text;
            }
            if (!this.crypto) {
                throw new Error('dynamo: No database secret or cipher defined');
            }
            let crypto = this.crypto[name];
            if (!crypto) {
                throw new Error(`dynamo: Database crypto not defined for ${name}`);
            }
            iv = Buffer.from(iv, 'hex');
            let crypt = crypto_1.default.createDecipheriv(crypto.cipher, crypto.secret, iv);
            crypt.setAuthTag(Buffer.from(tag, inCode));
            text = crypt.update(data, inCode, outCode) + crypt.final(outCode);
        }
        return text;
    }
    marshall(item) {
        let client = this.client;
        if (client.V3) {
            let options = client.params.marshall;
            if (Array.isArray(item)) {
                for (let i = 0; i < item.length; i++) {
                    item[i] = client.marshall(item[i], options);
                }
            }
            else {
                item = client.marshall(item, options);
            }
        }
        return item;
    }
    unmarshall(item) {
        if (this.V3) {
            let client = this.client;
            let options = client.params.unmarshall;
            if (Array.isArray(item)) {
                for (let i = 0; i < item.length; i++) {
                    item[i] = client.unmarshall(item[i], options);
                }
            }
            else {
                item = client.unmarshall(item, options);
            }
        }
        return item;
    }
}
exports.Table = Table;
