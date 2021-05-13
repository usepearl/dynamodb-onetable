/*
    Model.d.ts -- Hand crafted type definitions for Model

    Supports dynamic definition of types based on the Schema.js
*/

interface Constructable<T> {
    new(...args: any[]): T
}

/*
    Possible types for a schema field "type" property
 */
type OneType =
    ArrayConstructor |
    BooleanConstructor |
    DateConstructor |
    NumberConstructor |
    ObjectConstructor |
    StringConstructor |
    Buffer |
    string |
    Constructable<any>;

/*
    Schema.indexes signature
 */
type OneIndexSchema = {
    hash: string,
    sort?: string,
    description?: string,
    follow?: boolean,
};

/*
    Schema.models.Model.Field signature
 */
type OneFieldSchema = {
    crypt?: boolean,
    default?: (() => any) | string | number | boolean | object,
    enum?: string[],
    filter?: boolean,
    hidden?: boolean,
    map?: string,
    nulls?: boolean,
    required?: boolean,
    transform?: (model: AnyModel, op: string, name: string, value: any) => any,
    type: OneType,
    unique?: boolean,
    uuid?: boolean | string,
    validate?: RegExp | string,
    value?: ((name: string, context: {}, properties: {}) => any) | string,

    //  Deprecated
    ulid?: boolean,
    ksuid?: boolean,
};

/*
    Schema.models signature
 */
export type OneModelSchema = {
    [key: string]: OneFieldSchema
};

/*
    Schema signature
 */
type OneSchema = {
    models?: {
        [key: string]: OneModelSchema
    },
    indexes?: {
        [key: string]: OneIndexSchema
    },
};

/*
    Schema field with required "type" property
 */
type OneTypedField = {
    type: OneType
};

/*
    Schema Model of fields with a type property
 */
type OneTypedModel = Record<string, OneTypedField>;

/*
    Entity field signature generated from the schema
 */
type EntityField<T extends OneTypedField> =
      T['type'] extends StringConstructor ? string
    : T['type'] extends NumberConstructor ? number
    : T['type'] extends BooleanConstructor ? boolean
    : T['type'] extends ObjectConstructor ? object
    : T['type'] extends DateConstructor ? Date
    : T['type'] extends ArrayConstructor ? any[]
    : T['type'] extends Constructable<infer T> ? T
    : never;

/*
    Entities are objects whoes signature is based on the schema model of the same name.
 */

type RequiredExcluded<T extends OneModelSchema> = 
    Pick<T, { [K in keyof T]: T[K]["required"] extends true ? never : K }[keyof T]>

type OptionalExcluded<T extends OneModelSchema> = 
Pick<T, { [K in keyof T]: T[K]["required"] extends true ? K : never }[keyof T]>

type RequiredFields<T extends OneModelSchema> = {
    [P in keyof T]-?: EntityField<T[P]>
}

type OptionalFields<T extends OneModelSchema> = {
    [P in keyof T]?: EntityField<T[P]>
}
  

export type Entity<T extends OneModelSchema, IndexKeys extends keyof T, IndexMap extends {
    primary: {
        hash: 'pk',
        range: 'sk'
    },
    [key: string]: {
        hash: keyof T,
        range: keyof T
    },
}> = 
Omit<
OptionalFields<RequiredExcluded<T>>
& RequiredFields<OptionalExcluded<T>>
  & {
    indexDefinitions: IndexMap
    }
  , IndexKeys>;

/*
    Any entity. Essentially untyped.
 */
export type AnyEntity = {
    [key: string]: any
};

type ModelConstructorOptions = {
    fields?: {
        [key: string]: OneModelSchema
    },
    indexes?: {
        [key: string]: OneIndexSchema
    },
    timestamps?: boolean,
};

/*
    Possible params options for all APIs
 */
export type OneParams = {
    add?: object,
    batch?: object,
    capacity?: string,
    consistent?: boolean,
    context?: object,
    delete?: object,
    execute?: boolean,
    exists?: boolean,
    fields?: string[],
    hidden?: boolean,
    index?: string,
    limit?: number,
    log?: boolean,
    many?: boolean,
    metrics?: object,
    parse?: boolean,
    postFormat?: () => {},
    preFormat?: () => {},
    remove?: string[],
    return?: string,
    reverse?: boolean,
    start?: object,
    throw?: boolean,
    transaction?: object,
    type?: string,
    updateIndexes?: boolean,
    where?: string,
};

export type OneParamsTyped<Index> = Omit<OneParams, 'index'> & { index: Index }

/*
    Properties for most APIs. Essentially untyped.
 */
export type OneProperties = {
    [key: string]: any
};

export class Paged<T> extends Array {
    start: string;
    next: () => Paged<T>;
}

export type AnyModel = {
    constructor(table: any, name: string, options?: ModelConstructorOptions): AnyModel;
    create(properties: OneProperties, params?: OneParams): Promise<AnyEntity>;
    find(properties: OneProperties, params?: OneParams): Promise<Paged<AnyEntity[]>>;
    get(properties: OneProperties, params?: OneParams): Promise<AnyEntity>;
    remove(properties: OneProperties, params?: OneParams): Promise<void>;
    scan(properties: OneProperties, params?: OneParams): Promise<Paged<AnyEntity[]>>;
    update(properties: OneProperties, params?: OneParams): Promise<AnyEntity>;
    deleteItem(properties: OneProperties, params?: OneParams): Promise<void>;
    getItem(properties: OneProperties, params?: OneParams): Promise<AnyEntity>;
    putItem(properties: OneProperties, params?: OneParams): Promise<AnyEntity>;
    queryItems(properties: OneProperties, params?: OneParams): Promise<Paged<AnyEntity[]>>;
    scanItems(properties: OneProperties, params?: OneParams): Promise<Paged<AnyEntity[]>>;
    updateItem(properties: OneProperties, params?: OneParams): Promise<AnyEntity>;
};

export type HasIndexDefinitions<T> = { indexDefinitions: { [key: string]: { hash: keyof T, range: keyof T } }}

export class Model<T extends HasIndexDefinitions<T>, P = Omit<T, "indexDefinitions">> {
    constructor(table: any, name: string, options?: ModelConstructorOptions);
    create(properties: P, params?: OneParams): Promise<P>;
    find<U extends ExtractIndex<T, IndexName>, IndexName extends keyof T["indexDefinitions"] = 'primary', >(properties: Omit<U, "indexDefinitions">, params?: OneParamsTyped<IndexName>): Promise<Paged<T[]>>;
    get<U extends ExtractIndex<T, IndexName>, IndexName extends keyof T["indexDefinitions"] = 'primary', >(properties: Omit<U, "indexDefinitions">, params?: OneParamsTyped<IndexName>): Promise<T>;
    remove<U extends ExtractIndex<T, IndexName>, IndexName extends keyof T["indexDefinitions"] = 'primary', >(properties: Omit<U, "indexDefinitions">, params?: OneParamsTyped<IndexName>): Promise<void>;
    scan(properties: Partial<P>, params?: OneParams): Promise<Paged<P[]>>;
    update<U extends ExtractIndex<T, IndexName>, IndexName extends keyof T["indexDefinitions"] = 'primary', >(properties: Omit<U, "indexDefinitions"> & Partial<T>, params?: OneParamsTyped<IndexName>): Promise<T>;
    deleteItem(properties: P, params?: OneParams): Promise<void>;
    getItem(properties: P, params?: OneParams): Promise<P>;
    putItem(properties: P, params?: OneParams): Promise<P>;
    queryItems(properties: P, params?: OneParams): Promise<Paged<P[]>>;
    scanItems(properties: P, params?: OneParams): Promise<Paged<P[]>>;
    updateItem(properties: P, params?: OneParams): Promise<P>;
}


export type ExtractIndex<T extends HasIndexDefinitions<T>, IndexName extends ExtractIndexNames<T>> =
    Pick<T, T["indexDefinitions"][IndexName]["hash"]>  &  Pick<T, T["indexDefinitions"][IndexName]["range"]>

export type ExtractIndexNames<T extends HasIndexDefinitions<T>> = keyof T["indexDefinitions"]

